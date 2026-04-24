import jwt from 'jsonwebtoken';

const COOKIE_NAME = 'sk_session';

export function setSessionCookie(res, payload, jwtSecret, isProd) {
	const token = jwt.sign(payload, jwtSecret, { expiresIn: '14d' });
	res.cookie(COOKIE_NAME, token, {
		httpOnly: true,
		path: '/',
		sameSite: isProd ? 'none' : 'lax',
		secure: isProd,
		maxAge: 14 * 24 * 60 * 60 * 1000
	});
	return token;
}

export function clearSessionCookie(res, isProd) {
	res.cookie(COOKIE_NAME, '', {
		httpOnly: true,
		path: '/',
		sameSite: isProd ? 'none' : 'lax',
		secure: isProd,
		maxAge: 0
	});
}

export function readSession(req, jwtSecret) {
	const token = req.cookies?.[COOKIE_NAME];
	if (!token) return null;
	try {
		return jwt.verify(token, jwtSecret);
	} catch {
		return null;
	}
}

export function requireSession(req, res, next) {
	if (!req.session?.userId) {
		return res.status(401).json({ status: 'unauthorized' });
	}
	next();
}
