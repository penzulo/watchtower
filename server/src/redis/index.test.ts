import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { LogRecord } from "@watchtower/shared";
import type Redis from "ioredis";
import { connection, createSubscriber, LOGS_CHANNEL, publishLog } from ".";

// Reusable factory so each test that needs a fresh subscriber
// doesn't repeat the setup boilerplate
async function makeSubscriber(): Promise<Redis> {
	const sub = createSubscriber();
	await sub.subscribe(LOGS_CHANNEL);
	return sub;
}

async function teardown(sub: Redis): Promise<void> {
	await sub.unsubscribe(LOGS_CHANNEL);
	await sub.quit();
}

// Helper so tests don't repeat the Promise/timeout pattern
function waitForMessage(
	subscriber: Redis,
	channel: string,
	timeoutMs = 3000,
): Promise<string> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(
			() =>
				reject(new Error(`Timed out after ${timeoutMs}ms waiting for message`)),
			timeoutMs,
		);

		subscriber.once("message", (chan, message) => {
			if (chan === channel) {
				clearTimeout(timeout);
				resolve(message);
			}
		});
	});
}

const baseRecord = (): LogRecord => ({
	id: crypto.randomUUID(),
	timestamp: new Date().toISOString(),
	received_at: new Date().toISOString(),
	level: "info",
	service: "test-service",
	environment: "development",
	message: "hello from test",
});

describe("Redis Pub/Sub", () => {
	afterAll(async () => {
	});

	describe("publishLog", () => {
		let subscriber: Redis;

		beforeAll(async () => {
			subscriber = await makeSubscriber();
		});

		afterAll(async () => {
			await teardown(subscriber);
		});

		it("sends a message to the logs channel", async () => {
			const record = baseRecord();
			const received = waitForMessage(subscriber, LOGS_CHANNEL);

			await publishLog(record);

			expect(JSON.parse(await received)).toEqual(record);
		});

		it("serialises the full record including optional fields", async () => {
			const record: LogRecord = {
				...baseRecord(),
				version: "1.2.3",
				extras: { user_id: "u_001", session_id: "s_xyz" },
			};

			const received = waitForMessage(subscriber, LOGS_CHANNEL);
			await publishLog(record);

			const parsed = JSON.parse(await received);
			expect(parsed.extras).toEqual({ user_id: "u_001", session_id: "s_xyz" });
		});

		it("publishes multiple messages in order", async () => {
			const records = [baseRecord(), baseRecord(), baseRecord()];
			const received: string[] = [];

			// Collect 3 messages in sequence
			const allReceived = new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(
					() => reject(new Error("Timed out waiting for 3 messages")),
					5000,
				);

				subscriber.on("message", function handler(chan, message) {
					if (chan !== LOGS_CHANNEL) return;
					received.push(message);
					if (received.length === records.length) {
						clearTimeout(timeout);
						subscriber.off("message", handler);
						resolve();
					}
				});
			});

			// Publish sequentially so order is deterministic
			for (const record of records) {
				await publishLog(record);
			}

			await allReceived;

			const parsedIds = received.map((m) => JSON.parse(m).id);
			const expectedIds = records.map((r) => r.id);
			expect(parsedIds).toEqual(expectedIds);
		});
	});

	describe("fan-out", () => {
		let subA: Redis;
		let subB: Redis;

		beforeAll(async () => {
			subA = await makeSubscriber();
			subB = await makeSubscriber();
		});

		afterAll(async () => {
			await teardown(subA);
			await teardown(subB);
		});

		it("delivers the same message to all active subscribers", async () => {
			const record = baseRecord();

			// Both wait independently — if fan-out is broken, one resolves and
			// the other times out
			const [rawA, rawB] = await Promise.all([
				waitForMessage(subA, LOGS_CHANNEL),
				waitForMessage(subB, LOGS_CHANNEL),
				publishLog(record), // kick off after listeners are registered
			]);

			expect(JSON.parse(rawA as string)).toEqual(record);
			expect(JSON.parse(rawB as string)).toEqual(record);
		});
	});

	describe("createSubscriber", () => {
		it("returns independent connections", async () => {
			const subA = createSubscriber();
			const subB = createSubscriber();

			// ioredis exposes connector.stream for the underlying socket —
			// the stream fd being different confirms separate TCP connections
			expect(subA).not.toBe(subB);

			await subA.quit();
			await subB.quit();
		});

		it("unsubscribed connection no longer receives messages", async () => {
			const sub = await makeSubscriber();

			// Confirm it works first
			const firstReceived = waitForMessage(sub, LOGS_CHANNEL);
			await publishLog(baseRecord());
			await firstReceived; // should resolve fine

			// Now unsubscribe
			await sub.unsubscribe(LOGS_CHANNEL);

			// Publish again — sub should NOT receive this
			let receivedAfterUnsub = false;
			sub.once("message", () => {
				receivedAfterUnsub = true;
			});

			await publishLog(baseRecord());

			// Give it a moment to arrive if it was going to
			await Bun.sleep(500);

			expect(receivedAfterUnsub).toBe(false);

			await sub.quit();
		});
	});
});
