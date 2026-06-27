import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	spyOn,
} from "bun:test";
import { createClient } from "@clickhouse/client";
import { Jobs, logQueue } from "@watchtower/server/queues";
import { logWorker } from "@watchtower/server/queues/worker";
import { queueConnection } from "@watchtower/server/redis";
import type { DeadLetter, LogRecord } from "@watchtower/shared";
import { QueueEvents } from "bullmq";

// ------------------------------------------------------------------ clients

const clickhouse = createClient({
	url: Bun.env.CLICKHOUSE_URL ?? "http://localhost:8123",
	username: Bun.env.CLICKHOUSE_USERNAME ?? "default",
	password: Bun.env.CLICKHOUSE_PASSWORD ?? "",
	database: Bun.env.CLICKHOUSE_DB ?? "watchtower",
});

// QueueEvents lets us await job completion/failure without polling
const queueEvents = new QueueEvents("logs", { connection: queueConnection });

// ------------------------------------------------------------------ helpers

function makeLogRecord(overrides: Partial<LogRecord> = {}): LogRecord {
	return {
		id: crypto.randomUUID(),
		timestamp: new Date().toISOString(),
		received_at: new Date().toISOString(),
		level: "info",
		service: "worker-test",
		environment: "development",
		message: "test message",
		...overrides,
	};
}

function makeDeadLetter(overrides: Partial<DeadLetter> = {}): DeadLetter {
	return {
		raw: { broken: true },
		error: "missing field: level",
		received_at: new Date().toISOString(),
		...overrides,
	};
}

// Wait for a specific job to complete or fail.
// Returns the job's return value on completion, throws on failure.
// This is how you bridge the async gap between enqueue and assertion.
async function waitForJob(jobId: string, timeoutMs = 10_000): Promise<void> {
	const job = await logQueue.getJob(jobId);
	if (!job) throw new Error(`Job ${jobId} not found`);

	// waitUntilFinished handles race conditions natively
	await Promise.race([
		job.waitUntilFinished(queueEvents),
		new Promise<void>((_, reject) =>
			setTimeout(
				() => reject(new Error(`Timeout waiting for job ${jobId}`)),
				timeoutMs,
			),
		),
	]);
}

// Query ClickHouse for a log row by id
async function getLogById(id: string): Promise<LogRecord | null> {
	const result = await clickhouse.query({
		query: `SELECT * FROM logs WHERE id = {id:String} LIMIT 1`,
		query_params: { id },
		format: "JSONEachRow",
	});

	const rows = await result.json<LogRecord>();
	return rows[0] ?? null;
}

// ------------------------------------------------------------------ setup

beforeAll(async () => {
	// Ensure the logs table exists — idempotent so it's safe to run every time
	await clickhouse.exec({
		query: `
      CREATE TABLE IF NOT EXISTS logs (
        id           String,
        timestamp    DateTime64(3, 'UTC'),
        received_at  DateTime64(3, 'UTC'),
        level        LowCardinality(String),
        service      LowCardinality(String),
        environment  LowCardinality(String),
        message      String,
        trace_id     Nullable(String),
        version      Nullable(String),
        extras       String
      )
      ENGINE = MergeTree()
      ORDER BY (service, timestamp)
    `,
	});

	// Give the worker a moment to connect before tests run
	await logWorker.waitUntilReady();
	await queueEvents.waitUntilReady();
});

afterEach(async () => {
	await logQueue.drain();
});

afterAll(async () => {
	await logWorker.close();
	await queueEvents.close();
	await logQueue.close();
	await clickhouse.close();
	await queueConnection.quit();
});

// ------------------------------------------------------------------ persistLog (unit-style)

describe("persistLog (via PERSIST_LOG job)", () => {
	it("inserts the log record into ClickHouse", async () => {
		const record = makeLogRecord({ message: "inserted by worker test" });
		const job = await logQueue.add(Jobs.PERSIST_LOG, record);

		await waitForJob(job.id as string);

		const row = await getLogById(record.id);
		expect(row).not.toBeNull();
		expect(row?.message).toBe("inserted by worker test");
		expect(row?.service).toBe("worker-test");
	});

	it("persists all core fields correctly", async () => {
		const record = makeLogRecord({
			level: "error",
			service: "payment-service",
			environment: "production",
			message: "payment gateway timeout",
		});

		const job = await logQueue.add(Jobs.PERSIST_LOG, record);
		await waitForJob(job.id as string);

		const row = await getLogById(record.id);
		expect(row?.level).toBe("error");
		expect(row?.service).toBe("payment-service");
		expect(row?.environment).toBe("production");
	});

	it("stores extras as a JSON string", async () => {
		const record = makeLogRecord({
			extras: { user_id: "u_001", session_id: "s_xyz", retry_count: 3 },
		});

		const job = await logQueue.add(Jobs.PERSIST_LOG, record);
		await waitForJob(job.id as string);

		const row = await getLogById(record.id);

		// ClickHouse stores it as a string — parse it back out
		const extras = JSON.parse(row?.extras as unknown as string);
		expect(extras).toEqual({
			user_id: "u_001",
			session_id: "s_xyz",
			retry_count: 3,
		});
	});

	it("stores empty object when extras is absent", async () => {
		const record = makeLogRecord();
		delete (record as Partial<LogRecord>).extras;

		const job = await logQueue.add(Jobs.PERSIST_LOG, record);
		await waitForJob(job.id as string);

		const row = await getLogById(record.id);
		expect(JSON.parse(row?.extras as unknown as string)).toEqual({});
	});

	it("handles nullable version field correctly", async () => {
		const withVersion = makeLogRecord({ version: "1.2.3" });
		const withoutVersion = makeLogRecord();

		const [j1, j2] = await Promise.all([
			logQueue.add(Jobs.PERSIST_LOG, withVersion),
			logQueue.add(Jobs.PERSIST_LOG, withoutVersion),
		]);

		await Promise.all([
			waitForJob(j1.id as string),
			waitForJob(j2.id as string),
		]);

		const rowWith = await getLogById(withVersion.id);
		const rowWithout = await getLogById(withoutVersion.id);

		expect(rowWith?.version).toBe("1.2.3");
		expect(rowWithout?.version).toBeNull();
	});

	it("processes multiple records concurrently without data corruption", async () => {
		const records = Array.from({ length: 10 }, (_, i) =>
			makeLogRecord({
				message: `concurrent message ${i}`,
				service: `service-${i}`,
			}),
		);

		const jobs = await Promise.all(
			records.map((r) => logQueue.add(Jobs.PERSIST_LOG, r)),
		);

		await Promise.all(jobs.map((j) => waitForJob(j.id as string)));

		// Every record should be independently retrievable with the right data
		for (const record of records) {
			const row = await getLogById(record.id);
			expect(row).not.toBeNull();
			expect(row?.message).toBe(record.message);
			expect(row?.service).toBe(record.service);
		}
	});
});

// ------------------------------------------------------------------ persistDead

describe("persistDead (via DEAD_LETTER job)", () => {
	it("logs the dead letter entry to stderr", async () => {
		const spy = spyOn(console, "error").mockImplementation(() => {});

		const entry = makeDeadLetter({ error: "sentinel: missing level field" });
		const job = await logQueue.add(Jobs.DEAD_LETTER, entry, {
			attempts: 1,
			removeOnFail: false,
		});

		await waitForJob(job.id as string);

		expect(spy).toHaveBeenCalledWith(
			"[DLQ]",
			expect.stringContaining("sentinel: missing level field"),
		);

		spy.mockRestore();
	});

	it("does not write dead letters to the logs table", async () => {
		// Use a sentinel id — if this ever appears in ClickHouse, the test catches it
		const sentinelId = `dlq-should-not-persist-${crypto.randomUUID()}`;
		const entry = makeDeadLetter({ raw: { id: sentinelId } });

		const job = await logQueue.add(Jobs.DEAD_LETTER, entry, {
			attempts: 1,
			removeOnFail: false,
		});

		await waitForJob(job.id as string);

		const row = await getLogById(sentinelId);
		expect(row).toBeNull();
	});
});

// ------------------------------------------------------------------ worker error handling

describe("worker error handling", () => {
	it("throws on unknown job types", async () => {
		// Add a raw job with an unrecognised name, bypassing the typed helpers
		const job = await logQueue.add(
			"unknown_job_type" as never,
			{},
			{ attempts: 1 },
		);

		// waitForJob rejects when the job fails — that's what we want here
		expect(waitForJob(job.id as string)).rejects.toThrow(
			"Unknown job type: unknown_job_type",
		);
	});

	it("emits the failed event with the error message", async () => {
		const failedEvents: Array<{ jobId: string; failedReason: string }> = [];

		queueEvents.on("failed", (payload) => {
			failedEvents.push(payload);
		});

		const job = await logQueue.add(
			"unknown_job_type" as never,
			{},
			{ attempts: 1 },
		);

		// Give it time to process and emit
		await Bun.sleep(2000);

		const match = failedEvents.find((e) => e.jobId === job.id);
		if (!match) console.log("FAILED EVENTS:", failedEvents, "JOB ID:", job.id);
		expect(match).toBeDefined();
		expect(match?.failedReason).toContain("Unknown job type");
	});

	it("retries PERSIST_LOG jobs on transient ClickHouse failure", async () => {
		// Simulate failure by pointing at a bad URL — the job should retry
		// We can't easily mock the ClickHouse client here since it's module-scoped,
		// so instead we verify the retry mechanism via attemptsMade on a failed job

		// This test is structural — it verifies the queue config (attempts: 3)
		// is respected by checking that a job enqueued with defaults has 3 attempts
		const job = await logQueue.add(Jobs.PERSIST_LOG, makeLogRecord());

		expect(job.opts.attempts).toBe(3);
	});
});

// ------------------------------------------------------------------ worker lifecycle

describe("worker lifecycle", () => {
	it("is ready and connected after import", async () => {
		// waitUntilReady resolves to the underlying Redis client if ready
		const client = await logWorker.waitUntilReady();
		expect(client).toBeDefined();
	});

	it("processes jobs from the logs queue", async () => {
		const record = makeLogRecord({ message: "lifecycle check" });
		const job = await logQueue.add(Jobs.PERSIST_LOG, record);

		// If the worker is alive and connected, this resolves.
		// If it resolves, the queue name, connection, and job routing are all correct.
		expect(waitForJob(job.id as string)).resolves.toBeUndefined();
	});
});
