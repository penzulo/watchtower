import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import type { DeadLetter, LogRecord } from "@watchtower/shared";
import type { Job } from "bullmq";
import { connection } from "../redis";
import { enqueueDead, enqueueLog, Jobs, logQueue } from ".";

// ------------------------------------------------------------------ helpers

function makeLogRecord(overrides: Partial<LogRecord> = {}): LogRecord {
	return {
		id: crypto.randomUUID(),
		timestamp: new Date().toISOString(),
		received_at: new Date().toISOString(),
		level: "info",
		service: "test-service",
		environment: "development",
		message: "test message",
		...overrides,
	};
}

function makeDeadLetter(overrides: Partial<DeadLetter> = {}): DeadLetter {
	return {
		raw: { garbage: true },
		error: "Validation failed: missing field 'level'",
		received_at: new Date().toISOString(),
		...overrides,
	};
}

// Fetch the most recently added job by name from the queue.
// BullMQ's getJobs() returns jobs in LIFO order by default.
async function getLatestJob(jobName: string): Promise<Job | undefined> {
	const waiting = await logQueue.getJobs(["waiting"]);
	return waiting.find((j) => j.name === jobName);
}

// Drain all waiting jobs between tests so assertions never
// bleed across — this is the integration test equivalent of
// a DB transaction rollback
async function drainQueue(): Promise<void> {
	await logQueue.drain();
}

// ------------------------------------------------------------------ suite

describe("Log Queue", () => {
	beforeAll(async () => {
		// Clean slate before the whole suite runs
		await drainQueue();
	});

	afterEach(async () => {
		// Clean between each test so job counts are always predictable
		await drainQueue();
	});

	afterAll(async () => {
		await logQueue.close();
	});

	// ---------------------------------------------------------------- enqueueLog

	describe("enqueueLog", () => {
		it("adds a job with the PERSIST_LOG name", async () => {
			await enqueueLog(makeLogRecord());

			const job = await getLatestJob(Jobs.PERSIST_LOG);
			expect(job).toBeDefined();
			expect(job?.name).toBe(Jobs.PERSIST_LOG);
		});

		it("preserves the full log record as job data", async () => {
			const record = makeLogRecord({
				message: "preserve me",
				extras: { user_id: "u_001" },
			});

			await enqueueLog(record);

			const job = await getLatestJob(Jobs.PERSIST_LOG);
			expect(job?.data).toEqual(record);
		});

		it("applies 3 retry attempts", async () => {
			await enqueueLog(makeLogRecord());

			const job = await getLatestJob(Jobs.PERSIST_LOG);
			expect(job?.opts?.attempts).toBe(3);
		});

		it("applies exponential backoff", async () => {
			await enqueueLog(makeLogRecord());

			const job = await getLatestJob(Jobs.PERSIST_LOG);
			expect(job?.opts?.backoff).toEqual({
				type: "exponential",
				delay: 1000,
			});
		});

		it("does not add a DEAD_LETTER job when a valid log is enqueued", async () => {
			await enqueueLog(makeLogRecord());

			const dead = await getLatestJob(Jobs.DEAD_LETTER);
			expect(dead).toBeUndefined();
		});

		it("increments the waiting job count by 1", async () => {
			const before = await logQueue.getWaitingCount();
			await enqueueLog(makeLogRecord());
			const after = await logQueue.getWaitingCount();

			expect(after).toBe(before + 1);
		});
	});

	// ---------------------------------------------------------------- enqueueDead

	describe("enqueueDead", () => {
		it("adds a job with the DEAD_LETTER name", async () => {
			await enqueueDead(makeDeadLetter());

			const job = await getLatestJob(Jobs.DEAD_LETTER);
			expect(job).toBeDefined();
			expect(job?.name).toBe(Jobs.DEAD_LETTER);
		});

		it("preserves the full dead letter payload as job data", async () => {
			const entry = makeDeadLetter({
				error: "missing required field: service",
				raw: { level: "info", message: "oops" },
			});

			await enqueueDead(entry);

			const job = await getLatestJob(Jobs.DEAD_LETTER);
			expect(job?.data).toEqual(entry);
		});

		it("sets attempts to 1 — dead letters never retry", async () => {
			await enqueueDead(makeDeadLetter());

			const job = await getLatestJob(Jobs.DEAD_LETTER);
			expect(job?.opts?.attempts).toBe(1);
		});

		it("sets removeOnFail to false — dead letters are never auto-cleaned", async () => {
			await enqueueDead(makeDeadLetter());

			const job = await getLatestJob(Jobs.DEAD_LETTER);
			expect(job?.opts?.removeOnFail).toBe(false);
		});

		it("does not add a PERSIST_LOG job when a dead letter is enqueued", async () => {
			await enqueueDead(makeDeadLetter());

			const persist = await getLatestJob(Jobs.PERSIST_LOG);
			expect(persist).toBeUndefined();
		});
	});

	// ---------------------------------------------------------------- mutual exclusivity

	describe("mutual exclusivity", () => {
		it("enqueuing a log and a dead letter produces exactly 2 jobs", async () => {
			await enqueueLog(makeLogRecord());
			await enqueueDead(makeDeadLetter());

			const count = await logQueue.getWaitingCount();
			expect(count).toBe(2);
		});

		it("each job carries its own correct name", async () => {
			await enqueueLog(makeLogRecord());
			await enqueueDead(makeDeadLetter());

			const waiting = await logQueue.getJobs(["waiting"]);
			const names = waiting.map((j) => j.name);

			expect(names).toContain(Jobs.PERSIST_LOG);
			expect(names).toContain(Jobs.DEAD_LETTER);
		});

		it("dead letter data does not bleed into persist_log job", async () => {
			const dead = makeDeadLetter({ error: "sentinel error value" });
			const log = makeLogRecord({ message: "sentinel log value" });

			await enqueueLog(log);
			await enqueueDead(dead);

			const waiting = await logQueue.getJobs(["waiting"]);

			const persistJob = waiting.find((j) => j.name === Jobs.PERSIST_LOG);
			const deadJob = waiting.find((j) => j.name === Jobs.DEAD_LETTER);

			expect(persistJob?.data?.message).toBe("sentinel log value");
			expect(deadJob?.data?.error).toBe("sentinel error value");

			// Cross-check: neither field exists on the wrong job
			expect(persistJob?.data?.error).toBeUndefined();
			expect(deadJob?.data?.message).toBeUndefined();
		});
	});
});
