import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { clearSessionCookie, requireSession, setSessionCookie } from '../auth/session.js';
import {
	authSchema,
	generateGuidSchema,
	guidBodySchema,
	remoteCredsSchema,
	saveBlocksSchema,
	saveSettingsSchema
} from '../schemas/skSchemas.js';

const defaultMainSettings = {
	splits: 95,
	broadcastMode: 'edit',
	editEnclosure: '',
	broadcastDelay: 0
};

function isOwner(event, userId) {
	return event && userId && event.ownerId === userId;
}

export function createSkRouter({ store, jwtSecret, liveState, isProd }) {
	const router = Router();

	router.post('/register', async (req, res) => {
		const parsed = authSchema.safeParse(req.body);
		if (!parsed.success) return res.status(400).json({ status: 'invalid_payload' });

		const { email, password } = parsed.data;
		const existing = await store.findUserByEmail(email);
		if (existing) return res.status(409).json({ status: 'exists' });

		const passwordHash = await bcrypt.hash(password, 10);
		const user = {
			id: uuidv4(),
			email,
			passwordHash,
			remoteCreds: null,
			createdAt: Date.now()
		};
		await store.addUser(user);
		setSessionCookie(res, { userId: user.id, email: user.email }, jwtSecret, isProd);
		return res.json({ status: 'success', user: { email: user.email } });
	});

	router.post('/login', async (req, res) => {
		const parsed = authSchema.safeParse(req.body);
		if (!parsed.success) return res.status(400).json({ status: 'invalid_payload' });
		const { email, password } = parsed.data;
		const user = await store.findUserByEmail(email);
		if (!user) return res.status(401).json({ status: 'unauthorized' });
		const ok = await bcrypt.compare(password, user.passwordHash);
		if (!ok) return res.status(401).json({ status: 'unauthorized' });
		setSessionCookie(res, { userId: user.id, email: user.email }, jwtSecret, isProd);
		return res.json({ status: 'success', user: { email: user.email } });
	});

	router.get('/refresh', async (req, res) => {
		if (!req.session?.userId) return res.status(401).json({ status: 'unauthorized' });
		return res.json({ status: 'success', user: { email: req.session.email } });
	});

	router.get('/checkforuser', async (req, res) => {
		if (!req.session?.userId) return res.json({ hasCreds: false });
		const user = await store.findUserByEmail(req.session.email || '');
		return res.json({ hasCreds: Boolean(user?.remoteCreds) });
	});

	router.post('/saveremotecreds', requireSession, async (req, res) => {
		const parsed = remoteCredsSchema.safeParse(req.body);
		if (!parsed.success) return res.status(400).json({ status: 'invalid_payload' });
		await store.updateUser(req.session.userId, { remoteCreds: parsed.data });
		return res.json({ status: 'saved' });
	});

	router.post('/generateguid', requireSession, async (req, res) => {
		const parsed = generateGuidSchema.safeParse(req.body);
		if (!parsed.success) return res.status(400).json({ status: 'invalid_payload' });
		const guid = uuidv4();
		await store.createEvent({
			guid,
			ownerId: req.session.userId,
			eventName: parsed.data.eventName,
			blocks: [],
			settings: { ...defaultMainSettings },
			activeBlockGuid: null,
			updatedAt: Date.now(),
			createdAt: Date.now()
		});
		return res.json({ guid });
	});

	router.get('/getevents', requireSession, async (req, res) => {
		const events = await store.listEventsByOwner(req.session.userId);
		return res.json({
			events: events.map((event) => ({
				guid: event.guid,
				eventName: event.eventName,
				updatedAt: event.updatedAt
			}))
		});
	});

	router.get('/deleteguid', requireSession, async (req, res) => {
		const guid = String(req.query.guid || '');
		const event = await store.findEventByGuid(guid);
		if (!isOwner(event, req.session.userId)) return res.status(403).json({ status: 'forbidden' });
		await store.deleteEvent(guid);
		liveState.delete(guid);
		return res.json({ status: 'deleted' });
	});

	router.get('/getblocks', async (req, res) => {
		const guid = String(req.query.guid || '');
		const event = await store.findEventByGuid(guid);
		if (!event) {
			return res.json({
				guid,
				blocks: [],
				settings: { ...defaultMainSettings },
				activeBlockGuid: null
			});
		}
		return res.json({
			guid: event.guid,
			eventName: event.eventName,
			blocks: event.blocks || [],
			settings: event.settings || { ...defaultMainSettings },
			activeBlockGuid: event.activeBlockGuid || null
		});
	});

	router.post('/saveblocks', requireSession, async (req, res) => {
		const parsed = saveBlocksSchema.safeParse(req.body);
		if (!parsed.success) return res.status(400).json({ status: 'invalid_payload' });
		const { guid, blocks } = parsed.data;
		const event = await store.findEventByGuid(guid);
		if (!isOwner(event, req.session.userId)) return res.status(403).json({ status: 'forbidden' });

		const defaultBlock = blocks.find((block) => block?.settings?.default);
		const activeBlockGuid = defaultBlock?.blockGuid || event.activeBlockGuid || blocks?.[0]?.blockGuid || null;

		await store.updateEvent(guid, { blocks, activeBlockGuid });
		return res.json({ status: 'success' });
	});

	router.post('/savesettings', requireSession, async (req, res) => {
		const parsed = saveSettingsSchema.safeParse(req.body);
		if (!parsed.success) return res.status(400).json({ status: 'invalid_payload' });
		const { guid, settings } = parsed.data;
		const event = await store.findEventByGuid(guid);
		if (!isOwner(event, req.session.userId)) return res.status(403).json({ status: 'forbidden' });
		await store.updateEvent(guid, { settings });
		return res.json({ status: 'success' });
	});

	router.post('/verifyowner', requireSession, async (req, res) => {
		const parsed = guidBodySchema.safeParse(req.body);
		if (!parsed.success) return res.status(400).json({ status: 'invalid_payload' });
		const event = await store.findEventByGuid(parsed.data.guid);
		if (isOwner(event, req.session.userId)) return res.json({ status: 'ok' });
		return res.status(403).json({ status: 'forbidden' });
	});

	router.get('/event/lookup', async (req, res) => {
		const eventGuid = String(req.query.eventGuid || req.query.guid || req.query.event_id || '');
		if (!eventGuid) return res.status(400).json({ status: 'missing_event_guid' });
		const liveValue = liveState.get(eventGuid) || {};
		return res.json({
			eventGuid,
			serverData: liveValue,
			updatedAt: Date.now()
		});
	});

	// Compatibility stubs used by old UI modules.
	router.get('/getsounds', async (_req, res) => res.json({ sounds: [] }));
	router.post('/savesounds', async (_req, res) => res.json({ status: 'success' }));
	router.get('/gettriggers', async (_req, res) => res.json({ triggers: [] }));
	router.post('/savetriggers', async (_req, res) => res.json({ status: 'success' }));

	router.post('/logout', async (_req, res) => {
		clearSessionCookie(res, isProd);
		return res.json({ status: 'success', loggedIn: false });
	});

	return router;
}
