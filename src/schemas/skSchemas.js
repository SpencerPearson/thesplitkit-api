import { z } from 'zod';

export const authSchema = z.object({
	email: z.string().email(),
	password: z.string().min(6)
});

export const remoteCredsSchema = z.object({
	username: z.string().min(1),
	password: z.string().min(1)
});

export const guidBodySchema = z.object({
	guid: z.string().uuid()
});

export const generateGuidSchema = z.object({
	eventName: z.string().min(1).max(120)
});

export const saveBlocksSchema = z.object({
	guid: z.string().uuid(),
	blocks: z.array(z.unknown())
});

export const saveSettingsSchema = z.object({
	guid: z.string().uuid(),
	settings: z.record(z.string(), z.unknown())
});
