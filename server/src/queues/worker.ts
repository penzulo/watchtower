import { createClient } from "@clickhouse/client";
import { clickHouseConnectionOptions } from "@watchtower/server/clickhouse/connection";
import { Jobs } from "@watchtower/server/queues";
import { workerConnection } from "@watchtower/server/redis";
import type { DeadLetter, LogRecord } from "@watchtower/shared";
import { type Job, Worker } from "bullmq";

const clickhouse = createClient(clickHouseConnectionOptions);

/**
 * A DataLoader-style batcher that aggregates individual items into arrays
 * and flushes them when they reach maxBatchSize or maxWaitMs.
 */
class Batcher<T> {
	private buffer: T[] = [];
	private resolves: Array<() => void> = [];
	private rejects: Array<(err: Error) => void> = [];
	private timer: ReturnType<typeof setTimeout> | null = null;

	constructor(
		private readonly maxBatchSize: number,
		private readonly maxWaitMs: number,
		private readonly flushFn: (batch: T[]) => Promise<void>,
	) {}

	async add(item: T): Promise<void> {
		return new Promise((resolve, reject) => {
			this.buffer.push(item);
			this.resolves.push(resolve);
			this.rejects.push(reject);

			if (this.buffer.length >= this.maxBatchSize) {
				this.flush();
			} else if (!this.timer) {
				this.timer = setTimeout(() => this.flush(), this.maxWaitMs);
			}
		});
	}

	private async flush() {
		if (this.buffer.length === 0) return;

		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}

		// Swap buffers synchronously to free up the instance for new items
		const batch = this.buffer;
		const resolves = this.resolves;
		const rejects = this.rejects;

		this.buffer = [];
		this.resolves = [];
		this.rejects = [];

		try {
			await this.flushFn(batch);
			resolves.forEach((resolve) => {
				resolve();
			});
		} catch (err) {
			rejects.forEach((reject) => {
				reject(err as Error);
			});
		}
	}
}

const logBatcher = new Batcher<LogRecord>(
	5000, // flush when 5000 logs accumulate...
	250, // ...or after 250ms, whichever happens first
	async (batch: LogRecord[]) => {
		await clickhouse.insert({
			table: "logs",
			values: batch.map((record: LogRecord) => ({
				id: record.id,
				timestamp: record.timestamp,
				received_at: record.received_at,
				level: record.level,
				service: record.service,
				environment: record.environment,
				message: record.message,
				version: record.version ?? null,
				extras: JSON.stringify(record.extras ?? {}),
			})),
			format: "JSONEachRow",
		});
		console.log(`[ClickHouse] Inserted batch of ${batch.length} logs`);
	},
);

const dlqBatcher = new Batcher<DeadLetter>(100, 1000, async (batch) => {
	await clickhouse.insert({
		table: "dead_letters",
		values: batch.map((entry) => ({
			received_at: entry.received_at,
			error: entry.error,
			raw: JSON.stringify(entry.raw),
			source_ip: entry.source_ip ?? "",
		})),
		format: "JSONEachRow",
	});
	console.error(`[ClickHouse] Inserted batch of ${batch.length} dead letters`);
});

export const logWorker = new Worker(
	"logs",
	async (job: Job) => {
		switch (job.name) {
			case Jobs.PERSIST_LOG:
				await logBatcher.add(job.data as LogRecord);
				break;

			case Jobs.DEAD_LETTER:
				await dlqBatcher.add(job.data as DeadLetter);
				break;

			default:
				throw new Error(`Unknown job type: ${job.name}`);
		}
	},
	{
		connection: workerConnection,
		// CRITICAL: Concurrency must be higher than the batch size!
		// BullMQ pulls this many jobs into memory at once. If concurrency is 10,
		// the batcher will never see more than 10 jobs at a time.
		concurrency: 6000,
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
