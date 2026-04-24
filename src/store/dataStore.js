import fs from 'node:fs/promises';
import path from 'node:path';

const defaultData = {
	users: [],
	events: []
};

export class DataStore {
	constructor(filePath) {
		this.filePath = filePath;
	}

	async init() {
		const dirPath = path.dirname(this.filePath);
		await fs.mkdir(dirPath, { recursive: true });
		try {
			await fs.access(this.filePath);
		} catch {
			await this.write(defaultData);
		}
	}

	async read() {
		const raw = await fs.readFile(this.filePath, 'utf8');
		const parsed = JSON.parse(raw || '{}');
		return {
			users: parsed.users || [],
			events: parsed.events || []
		};
	}

	async write(data) {
		await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf8');
	}

	async addUser(user) {
		const data = await this.read();
		data.users.push(user);
		await this.write(data);
		return user;
	}

	async findUserByEmail(email) {
		const data = await this.read();
		return data.users.find((user) => user.email.toLowerCase() === email.toLowerCase()) || null;
	}

	async updateUser(userId, partial) {
		const data = await this.read();
		const idx = data.users.findIndex((user) => user.id === userId);
		if (idx < 0) return null;
		data.users[idx] = { ...data.users[idx], ...partial };
		await this.write(data);
		return data.users[idx];
	}

	async createEvent(event) {
		const data = await this.read();
		data.events.push(event);
		await this.write(data);
		return event;
	}

	async listEventsByOwner(ownerId) {
		const data = await this.read();
		return data.events.filter((event) => event.ownerId === ownerId);
	}

	async findEventByGuid(guid) {
		const data = await this.read();
		return data.events.find((event) => event.guid === guid) || null;
	}

	async updateEvent(guid, partial) {
		const data = await this.read();
		const idx = data.events.findIndex((event) => event.guid === guid);
		if (idx < 0) return null;
		data.events[idx] = { ...data.events[idx], ...partial, updatedAt: Date.now() };
		await this.write(data);
		return data.events[idx];
	}

	async deleteEvent(guid) {
		const data = await this.read();
		const next = data.events.filter((event) => event.guid !== guid);
		const changed = next.length !== data.events.length;
		if (!changed) return false;
		data.events = next;
		await this.write(data);
		return true;
	}
}
