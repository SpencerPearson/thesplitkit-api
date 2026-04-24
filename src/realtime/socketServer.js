import { Server } from 'socket.io';

export function createSocketServer(httpServer, corsOrigins) {
	const io = new Server(httpServer, {
		cors: {
			origin: corsOrigins,
			credentials: true
		}
	});

	const liveState = new Map();

	const eventNs = io.of('/event');
	eventNs.on('connection', (socket) => {
		const eventId = socket.handshake.query.event_id;
		if (typeof eventId === 'string' && eventId) {
			socket.join(eventId);
			const current = liveState.get(eventId);
			if (current) socket.emit('remoteValue', current);
		}

		socket.on('connected', (guid) => {
			if (typeof guid === 'string' && guid) socket.join(guid);
		});

		socket.on('valueBlock', (payload) => {
			const guid = payload?.valueGuid || eventId;
			if (!guid) return;
			const data = payload?.serverData || {};
			liveState.set(guid, data);
			eventNs.to(guid).emit('remoteValue', data);
		});
	});

	const leaderboardNs = io.of('/leaderboard');
	leaderboardNs.on('connection', (socket) => {
		socket.emit('testResponse', { leaderboard: [] });
	});

	const boostboardNs = io.of('/boostboard');
	boostboardNs.on('connection', (socket) => {
		socket.emit('testResponse', { boosts: [] });
	});

	return {
		io,
		liveState
	};
}
