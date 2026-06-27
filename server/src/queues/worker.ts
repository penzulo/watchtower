import { createClient } from "@clickhouse/client";
import { clickHouseConnectionOptions } from "@watchtower/server/clickhouse/connection";
import { DEAD_LETTER_QUEUE, LOGS_QUEUE } from "@watchtower/server/queues";
import { workerRedis as redis } from "@watchtower/server/redis";
import type { DeadLetter, LogRecord } from "@watchtower/shared";

const clickhouse = createClient(clickHouseConnectionOptions);

async function processLogs() {
	let lastInsertTime = Date.now();

	while (true) {
		try {
			const queueSize = await redis.llen(LOGS_QUEUE);
			const timeElapsed = Date.now() - lastInsertTime;

			if (queueSize >= 5000 || (queueSize > 0 && timeElapsed >= 1000)) {
				// Only pop when we are absolutely ready to insert them into ClickHouse
				const batch = await redis.lpop(LOGS_QUEUE, 5000);
				if (batch && batch.length > 0) {
					const logs: LogRecord[] = batch.map((b) => JSON.parse(b as string));

					await clickhouse.insert({
						table: "logs",
						values: logs.map((record) => ({
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

					console.log(`[Worker] Inserted ${logs.length} logs from Redis`);
					lastInsertTime = Date.now();
				}
			} else {
				// Let logs accumulate safely in Redis
				await Bun.sleep(50);
			}
		} catch (error) {
			console.error(`[Worker] Failed to process logs batch:`, error);
			await Bun.sleep(1000); // Backoff on error
		}
	}
}

async function processDeadLetters() {
	let lastInsertTime = Date.now();

	while (true) {
		try {
			const queueSize = await redis.llen(DEAD_LETTER_QUEUE);
			const timeElapsed = Date.now() - lastInsertTime;

			if (queueSize >= 100 || (queueSize > 0 && timeElapsed >= 1000)) {
				const batch = await redis.lpop(DEAD_LETTER_QUEUE, 100);
				if (batch && batch.length > 0) {
					const letters: DeadLetter[] = batch.map((b) =>
						JSON.parse(b as string),
					);

					await clickhouse.insert({
						table: "dead_letters",
						values: letters.map((entry) => ({
							received_at: entry.received_at,
							error: entry.error,
							raw: JSON.stringify(entry.raw),
							source_ip: entry.source_ip ?? "",
						})),
						format: "JSONEachRow",
					});

					console.error(
						`[Worker] Inserted ${letters.length} dead letters from Redis`,
					);
					lastInsertTime = Date.now();
				}
			} else {
				await Bun.sleep(1000);
			}
		} catch (error) {
			console.error(`[Worker] Failed to process dead letters batch:`, error);
			await Bun.sleep(5000);
		}
	}
}

// Start the background workers
if (Bun.env.NODE_ENV !== "test") {
	processLogs();
	processDeadLetters();
}
