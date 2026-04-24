import path from 'node:path';

const rootDir = process.cwd();
const nodeEnv = process.env.NODE_ENV || 'development';
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3001')
	.split(',')
	.map((value) => value.trim())
	.filter(Boolean);

export const config = {
	nodeEnv,
	isProd: nodeEnv === 'production',
	port: Number(process.env.SK_PORT || (nodeEnv === 'production' ? process.env.PORT : 8010) || 8010),
	jwtSecret: process.env.SK_JWT_SECRET || 'change-me-in-env',
	albyJwtSecret: process.env.ALBY_JWT || process.env.SK_ALBY_JWT || 'change-alby-jwt-secret',
	albyClientId: process.env.ALBY_ID || process.env.ALBY_ID_5173 || '',
	albyClientSecret: process.env.ALBY_SECRET || process.env.ALBY_SECRET_5173 || '',
	piApiKey: process.env.PI_API_KEY || '',
	piApiSecret: process.env.PI_API_SECRET || '',
	corsOrigins,
	dataFilePath: process.env.SK_DATA_PATH || path.join(rootDir, 'data', 'store.json')
};
