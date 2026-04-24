import jwt from 'jsonwebtoken';

const ALBY_COOKIE = 'awt';

export function setAlbyCookie(res, tokenPayload, secret, isProd) {
	const token = jwt.sign(tokenPayload, secret, { expiresIn: '10d' });
	res.cookie(ALBY_COOKIE, token, {
		maxAge: 10 * 24 * 60 * 60 * 1000,
		httpOnly: true,
		path: '/',
		sameSite: isProd ? 'none' : 'lax',
		secure: isProd
	});
	return token;
}

export function clearAlbyCookie(res, isProd) {
	res.cookie(ALBY_COOKIE, '', {
		maxAge: 0,
		httpOnly: true,
		path: '/',
		sameSite: isProd ? 'none' : 'lax',
		secure: isProd
	});
}

export function readAlbyCookie(req, secret) {
	const token = req.cookies?.[ALBY_COOKIE];
	if (!token) return null;
	try {
		return jwt.verify(token, secret);
	} catch {
		return null;
	}
}
