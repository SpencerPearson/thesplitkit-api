import { Router } from 'express';
import { clearAlbyCookie, readAlbyCookie, setAlbyCookie } from '../auth/albySession.js';

function parseJson(text) {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

function toBasicAuth(clientId, clientSecret) {
	return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
}

async function fetchAlbyUser(accessToken) {
	const [accountRes, balanceRes] = await Promise.all([
		fetch('https://api.getalby.com/user/value4value', {
			headers: { Authorization: `Bearer ${accessToken}` }
		}),
		fetch('https://api.getalby.com/balance', {
			headers: { Authorization: `Bearer ${accessToken}` }
		})
	]);

	if (!accountRes.ok || !balanceRes.ok) {
		throw new Error('Failed to fetch Alby user profile');
	}

	const [account, balance] = await Promise.all([accountRes.json(), balanceRes.json()]);
	return { ...account, ...balance };
}

async function keysendPayment(accessToken, payment) {
	const response = await fetch('https://api.getalby.com/payments/keysend', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${accessToken}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			destination: payment.destination,
			amount: payment.amount,
			custom_records: payment.customRecords || {}
		})
	});
	const text = await response.text();
	const data = parseJson(text) || { raw: text };
	return {
		success: response.ok,
		type: 'keysend',
		destination: payment.destination,
		amount: payment.amount,
		data
	};
}

async function lnAddressPayment(accessToken, payment) {
	const [name, server] = String(payment.destination || '').split('@');
	if (!name || !server) {
		return {
			success: false,
			type: 'lnaddress',
			destination: payment.destination,
			error: 'invalid_lnaddress'
		};
	}

	try {
		const lnurlRes = await fetch(`https://${server}/.well-known/lnurlp/${name}`);
		if (!lnurlRes.ok) {
			return { success: false, type: 'lnaddress', destination: payment.destination, error: 'lnurl_lookup_failed' };
		}
		const lnurlData = await lnurlRes.json();
		if (!lnurlData.callback) {
			return { success: false, type: 'lnaddress', destination: payment.destination, error: 'lnurl_callback_missing' };
		}

		const callbackUrl = new URL(lnurlData.callback);
		callbackUrl.searchParams.set('amount', String(payment.amount * 1000));
		const invoiceRes = await fetch(callbackUrl.toString());
		if (!invoiceRes.ok) {
			return {
				success: false,
				type: 'lnaddress',
				destination: payment.destination,
				error: 'lnurl_invoice_failed'
			};
		}

		const invoiceData = await invoiceRes.json();
		if (!invoiceData.pr) {
			return { success: false, type: 'lnaddress', destination: payment.destination, error: 'bolt11_missing' };
		}

		const payRes = await fetch('https://api.getalby.com/payments/bolt11', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ invoice: invoiceData.pr })
		});
		const payText = await payRes.text();
		const payData = parseJson(payText) || { raw: payText };
		return {
			success: payRes.ok,
			type: 'lnaddress',
			destination: payment.destination,
			amount: payment.amount,
			data: payData
		};
	} catch (error) {
		return {
			success: false,
			type: 'lnaddress',
			destination: payment.destination,
			error: error.message || 'lnaddress_payment_failed'
		};
	}
}

export function createAlbyStubRouter({ isProd, albyClientId, albyClientSecret, albyJwtSecret }) {
	const router = Router();
	const hasAlbyConfig = Boolean(albyClientId && albyClientSecret && albyJwtSecret);

	router.post('/handlePayments', async (req, res) => {
		const albySession = readAlbyCookie(req, albyJwtSecret);
		if (!albySession?.access_token) {
			// Preserve compatibility with existing frontend behavior.
			return res.json([]);
		}

		const payments = Array.isArray(req.body) ? req.body : [];
		const results = [];
		for (const payment of payments) {
			const isLnAddress =
				payment?.type === 'lnaddress' || String(payment?.destination || '').includes('@');
			const result = isLnAddress
				? await lnAddressPayment(albySession.access_token, payment)
				: await keysendPayment(albySession.access_token, payment);
			results.push(result);
		}

		return res.json(results);
	});

	router.get('/logout', async (_req, res) => {
		clearAlbyCookie(res, isProd);
		return res.json({ loggedIn: false });
	});

	router.get('/refresh', async (req, res) => {
		if (!hasAlbyConfig) return res.status(503).json({});
		try {
			const albySession = readAlbyCookie(req, albyJwtSecret);
			if (!albySession?.refresh_token) return res.status(401).json({});

			const tokenBody = new URLSearchParams({
				refresh_token: albySession.refresh_token,
				grant_type: 'refresh_token'
			});

			const tokenRes = await fetch('https://api.getalby.com/oauth/token', {
				method: 'POST',
				headers: {
					Authorization: toBasicAuth(albyClientId, albyClientSecret),
					'Content-Type': 'application/x-www-form-urlencoded'
				},
				body: tokenBody
			});
			if (!tokenRes.ok) return res.status(401).json({});

			const tokenData = await tokenRes.json();
			setAlbyCookie(res, tokenData, albyJwtSecret, isProd);
			const user = await fetchAlbyUser(tokenData.access_token);
			return res.json(user);
		} catch (error) {
			console.error('alby refresh error:', error.message || error);
			return res.status(500).json({});
		}
	});

	router.get('/auth', async (req, res) => {
		if (!hasAlbyConfig) return res.status(503).json({});
		try {
			const code = String(req.query.code || '');
			const redirectUri = String(req.query.redirect_uri || '');
			if (!code || !redirectUri) return res.status(400).json({});

			const tokenBody = new URLSearchParams({
				code,
				redirect_uri: redirectUri,
				grant_type: 'authorization_code'
			});

			const tokenRes = await fetch('https://api.getalby.com/oauth/token', {
				method: 'POST',
				headers: {
					Authorization: toBasicAuth(albyClientId, albyClientSecret),
					'Content-Type': 'application/x-www-form-urlencoded'
				},
				body: tokenBody
			});
			if (!tokenRes.ok) {
				const text = await tokenRes.text();
				console.error('alby auth failed:', text);
				return res.status(401).json({});
			}

			const tokenData = await tokenRes.json();
			setAlbyCookie(res, tokenData, albyJwtSecret, isProd);
			const user = await fetchAlbyUser(tokenData.access_token);
			return res.json(user);
		} catch (error) {
			console.error('alby auth error:', error.message || error);
			return res.status(500).json({});
		}
	});

	router.get('/webhook/create', async (_req, res) => {
		return res.json({ status: 'stubbed' });
	});

	router.post('/webhook/settle', async (_req, res) => {
		return res.json({ status: 'stubbed' });
	});

	return router;
}
