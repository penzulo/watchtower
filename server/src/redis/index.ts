import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

// Shared connection for general commands and BullMQ internals
export const connection = new Redis(REDIS_URL, {
	maxRetriesPerRequest: null, // required by BullMQ
	enableReadyCheck: false,
});

// Factory — call this once per SSE connection
// ioredis enters subscriber mode on the connection the moment
// you call .subscribe(), making it unusable for other commands.
// Each SSE client therefore needs its own dedicated connection.
export function createSubscriber(): Redis {
	return new Redis(REDIS_URL, {
		maxRetriesPerRequest: null,
		enableReadyCheck: false,
	});
}

export const LOGS_CHANNEL = "logs:stream";

export async function publishLog(record: unknown): Promise<void> {
	await connection.publish(LOGS_CHANNEL, JSON.stringify(record));
}
