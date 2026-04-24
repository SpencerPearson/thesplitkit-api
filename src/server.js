import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { DataStore } from './store/dataStore.js';
import { createSocketServer } from './realtime/socketServer.js';
import { createSkRouter } from './routes/skRoutes.js';
import { createAlbyStubRouter } from './routes/albyStubRoutes.js';
import { readSession } from './auth/session.js';

const app = express();
const store = new DataStore(config.dataFilePath);
await store.init();

app.use(
	cors({
		origin(origin, callback) {
			if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
			return callback(new Error('CORS origin not allowed'));
		},
		credentials: true
	})
);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.use((req, _res, next) => {
	req.session = readSession(req, config.jwtSecret);
	next();
});

const server = http.createServer(app);
const { liveState } = createSocketServer(server, config.corsOrigins);

app.get('/health', (_req, res) => {
	res.json({ status: 'ok', service: 'thesplitkit-api' });
});

app.use('/api/sk', createSkRouter({ store, jwtSecret: config.jwtSecret, liveState, isProd: config.isProd }));
app.use(
	'/api/alby',
	createAlbyStubRouter({
		isProd: config.isProd,
		albyClientId: config.albyClientId,
		albyClientSecret: config.albyClientSecret,
		albyJwtSecret: config.albyJwtSecret
	})
);

app.use((_req, res) => {
	res.status(404).json({ status: 'not_found' });
});

app.use((err, _req, res, _next) => {
	console.error('Unhandled API error:', err?.message || err);
	res.status(500).json({ status: 'server_error' });
});

server.listen(config.port, () => {
	console.log(`thesplitkit-api listening on http://localhost:${config.port}`);
});
