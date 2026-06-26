import { RedisClient } from "bun";

const REDIS_HOST = Bun.env.REDIS_HOST ?? "localhost";
const REDIS_PORT = Number(Bun.env.REDIS_PORT ?? 6379);
const REDIS_PASSWORD = Bun.env.REDIS_PASSWORD ?? "";

const auth = REDIS_PASSWORD ? `:${REDIS_PASSWORD}@` : "";
const redisUrl = `redis://${auth}${REDIS_HOST}:${REDIS_PORT}`;

export function createConnection(): RedisClient {
	return new RedisClient(redisUrl);
}

/**
 * Main application Redis client (used by Elysia routes).
 * Bun.redis automatically pipelines and multiplexes commands.
 */
export const redis = createConnection();

/**
 * Dedicated Redis client for the background worker.
 * When the API is flooding the main connection with 8,000+ RPS of un-awaited
 * pipelined writes, sharing that connection can starve the worker's read commands.
 */
export const workerRedis = createConnection();

/**
 * Factory — creates one dedicated subscriber connection per SSE client.
 *
 * A subscriber connection is locked into a subscriber state, so it
 * cannot be shared with the main application client.
 */
export function createSubscriber(): RedisClient {
	return createConnection();
}

export const LOGS_CHANNEL = "logs:stream";

export async function publishLog(record: unknown): Promise<void> {
	await redis.publish(LOGS_CHANNEL, JSON.stringify(record));
}
