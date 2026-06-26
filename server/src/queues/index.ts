import { redis } from "@watchtower/server/redis";
import type { DeadLetter, LogRecord } from "@watchtower/shared";

export const LOGS_QUEUE = "queues:logs";
export const DEAD_LETTER_QUEUE = "queues:dead_letters";

export async function enqueueLog(record: LogRecord): Promise<void> {
	await redis.rpush(LOGS_QUEUE, JSON.stringify(record));
}

export async function enqueueDead(entry: DeadLetter): Promise<void> {
	await redis.rpush(DEAD_LETTER_QUEUE, JSON.stringify(entry));
}
