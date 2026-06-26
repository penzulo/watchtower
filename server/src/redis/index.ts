import Redis from "ioredis";

const REDIS_HOST = Bun.env.REDIS_HOST ?? "localhost";
const REDIS_PORT = Number(Bun.env.REDIS_PORT ?? 6379);
const REDIS_PASSWORD = Bun.env.REDIS_PASSWORD ?? "";

/**
 * Base connection options.
 *
 * - maxRetriesPerRequest: null  — required by BullMQ; tells ioredis to retry
 *   commands indefinitely instead of rejecting after a fixed number of attempts.
 * - enableReadyCheck: false     — also required by BullMQ to avoid the initial
 *   READY check blocking queue operations on startup.
 * - lazyConnect: true           — defers the TCP handshake until the first
 *   command is issued, so module import does not eagerly open sockets.
 */
const BASE_OPTS = {
	host: REDIS_HOST,
	port: REDIS_PORT,
	password: REDIS_PASSWORD,
	maxRetriesPerRequest: null,
	enableReadyCheck: false,
	lazyConnect: true,
} as const;

function createConnection(label: string): Redis {
	const conn = new Redis(BASE_OPTS);
	conn.on("error", (err: Error) =>
		console.error(`[Redis:${label}] ${err.message}`),
	);
	return conn;
}

/**
 * Dedicated connection for BullMQ Queue (producer side).
 * Must NOT be shared with any subscriber or the worker.
 */
export const queueConnection = createConnection("queue");

/**
 * Dedicated connection for BullMQ Worker (consumer side).
 * BullMQ Worker uses blocking commands (BLPOP / XREAD) that would stall
 * any other commands issued on the same connection.
 */
export const workerConnection = createConnection("worker");

/**
 * Dedicated connection for PUBLISH commands.
 * Keeps pub/sub publishing completely isolated from BullMQ traffic.
 */
const publishConnection = createConnection("publish");

/**
 * Factory — creates one dedicated subscriber connection per SSE client.
 *
 * ioredis enters subscriber mode the moment you call .subscribe(), which
 * makes the connection unusable for any other command. Each SSE client
 * therefore needs its own connection; this factory enforces that pattern.
 */
export function createSubscriber(): Redis {
	return createConnection("subscriber");
}

export const LOGS_CHANNEL = "logs:stream";

export async function publishLog(record: unknown): Promise<void> {
	await publishConnection.publish(LOGS_CHANNEL, JSON.stringify(record));
}
