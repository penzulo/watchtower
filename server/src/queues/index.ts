import { queueConnection } from "@watchtower/server/redis";
import type { DeadLetter, LogRecord } from "@watchtower/shared";
import { Queue } from "bullmq";

export const Jobs = {
	PERSIST_LOG: "persist_log",
	DEAD_LETTER: "dead_letter",
} as const;

export const logQueue = new Queue("logs", {
	connection: queueConnection,
	defaultJobOptions: {
		attempts: 3,
		backoff: {
			type: "exponential",
			delay: 1000,
		},
		removeOnComplete: { count: 100 },
		removeOnFail: { count: 500 },
	},
});

export async function enqueueLog(record: LogRecord): Promise<void> {
	await logQueue.add(Jobs.PERSIST_LOG, record);
}

export async function enqueueDead(entry: DeadLetter): Promise<void> {
	await logQueue.add(Jobs.DEAD_LETTER, entry, {
		attempts: 1,
		removeOnFail: false,
	});
}
