import { createClient } from "@clickhouse/client";
import { Jobs } from "@watchtower/server/queues";
import { connection } from "@watchtower/server/redis";
import type { DeadLetter, LogRecord } from "@watchtower/shared";
import { type Job, Worker } from "bullmq";

const clickhouse = createClient({
	url: Bun.env.CLICKHOUSE_URL ?? "http://localhost:8123",
	username: Bun.env.CLICKHOUSE_USERNAME ?? "default",
	password: Bun.env.CLICKHOUSE_PASSWORD ?? "",
	database: Bun.env.CLICKHOUSE_DB ?? "watchtower",
});

async function persistLog(record: LogRecord): Promise<void> {
	await clickhouse.insert({
		table: "logs",
		values: [
			{
				id: record.id,
				timestamp: record.timestamp,
				received_at: record.received_at,
				level: record.level,
				service: record.service,
				environment: record.environment,
				message: record.message,
				version: record.version ?? null,
				extras: JSON.stringify(record.extras ?? {}),
			},
		],
		format: "JSONEachRow",
	});
}

async function persistDead(entry: DeadLetter): Promise<void> {
	console.error("[DLQ]", JSON.stringify(entry));
}

export const logWorker = new Worker(
	"logs",
	async (job: Job) => {
		switch (job.name) {
			case Jobs.PERSIST_LOG:
				await persistLog(job.data as LogRecord);
				break;

			case Jobs.DEAD_LETTER:
				await persistDead(job.data as DeadLetter);
				break;

			default:
				throw new Error(`Unknown job type: ${job.name}`);
		}
	},
	{
		connection,
		concurrency: 10, // processes up to 10 jobs in parallel
	},
);

logWorker.on("failed", (job, error) => {
	console.error(
		`[Worker] Job ${job?.id} (${job?.name}) failed:`,
		error.message,
	);
});

logWorker.on("completed", (job) => {
	console.log(`[Worker] Job ${job.id} (${job.name}) completed`);
});
