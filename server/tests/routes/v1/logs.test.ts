import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	type Mock,
	spyOn,
} from "bun:test";
import { treaty } from "@elysiajs/eden";
import * as clickhouseQuery from "@watchtower/server/clickhouse/query";
import { app } from "@watchtower/server/index";
import * as queues from "@watchtower/server/queues";
import * as redis from "@watchtower/server/redis";
import type { LogPayload } from "@watchtower/shared";

const api = treaty(app);

function makePayload(overrides: Partial<LogPayload> = {}): LogPayload {
	return {
		timestamp: new Date().toISOString(),
		level: "info",
		service: "auth-service",
		environment: "development",
		message: "user logged in",
		...overrides,
	};
}

function makeRequest(body: unknown): Request {
	return new Request("http://localhost/api/v1/logs", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

let publishSpy: Mock<typeof redis.publishLog>;
let enqueueSpy: Mock<typeof queues.enqueueLog>;
let deadSpy: Mock<typeof queues.enqueueDead>;
let queryLogsSpy: Mock<typeof clickhouseQuery.queryLogs>;

beforeAll(() => {
	publishSpy = spyOn(redis, "publishLog").mockResolvedValue(undefined);
	enqueueSpy = spyOn(queues, "enqueueLog").mockResolvedValue(undefined);
	deadSpy = spyOn(queues, "enqueueDead").mockResolvedValue(undefined);
	queryLogsSpy = spyOn(clickhouseQuery, "queryLogs").mockResolvedValue({
		logs: [],
		next_cursor: null,
	});
});

beforeEach(() => {
	publishSpy.mockClear();
	enqueueSpy.mockClear();
	deadSpy.mockClear();
	queryLogsSpy.mockClear();
});

afterAll(() => {
	publishSpy.mockRestore();
	enqueueSpy.mockRestore();
	deadSpy.mockRestore();
	queryLogsSpy.mockRestore();
});

describe("POST /api/v1/logs", () => {
	describe("happy path", () => {
		it("returns 202 Accepted for a valid payload", async () => {
			const { status } = await api.api.v1.logs.post(makePayload());
			expect(status).toBe(202);
		});

		it("returns the generated log id in the response body", async () => {
			const { data } = await api.api.v1.logs.post(makePayload());
			expect(data).toHaveProperty("id");
			expect(typeof data?.id).toBe("string");
			expect(data?.id.length).toBeGreaterThan(0);
		});

		it("generated id is a valid UUID", async () => {
			const { data } = await api.api.v1.logs.post(makePayload());
			expect(data?.id).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
			);
		});

		it("calls publishLog with the full enriched record", async () => {
			const payload = makePayload({ message: "sentinel message" });
			await api.api.v1.logs.post(payload);

			expect(publishSpy).toHaveBeenCalledTimes(1);

			const [published] = publishSpy.mock.calls[0];
			expect(published.message).toBe("sentinel message");
			expect(published.id).toBeDefined(); // server-generated
			expect(published.received_at).toBeDefined(); // server-generated
		});

		it("calls enqueueLog with the full enriched record", async () => {
			const payload = makePayload({ service: "payment-service" });
			await api.api.v1.logs.post(payload);

			expect(enqueueSpy).toHaveBeenCalledTimes(1);

			const [enqueued] = enqueueSpy.mock.calls[0];
			expect(enqueued.service).toBe("payment-service");
		});

		it("publishLog and enqueueLog receive the same record", async () => {
			await api.api.v1.logs.post(makePayload());

			const published = publishSpy.mock.calls[0][0];
			const enqueued = enqueueSpy.mock.calls[0][0];

			expect(published).toEqual(enqueued);
		});

		it("does not call enqueueDead for a valid payload", async () => {
			await api.api.v1.logs.post(makePayload());
			expect(deadSpy).not.toHaveBeenCalled();
		});

		it("accepts all valid log levels", async () => {
			const levels = [
				"trace",
				"debug",
				"info",
				"warn",
				"error",
				"fatal",
			] as const;

			for (const level of levels) {
				const { status } = await api.api.v1.logs.post(makePayload({ level }));
				expect(status).toBe(202);
			}
		});

		it("accepts optional fields when present", async () => {
			const payload = makePayload({
				version: "2.1.0",
				extras: { user_id: "u_001", retry: 3 },
			});

			const { status, data } = await api.api.v1.logs.post(payload);
			expect(status).toBe(202);
			expect(data).toHaveProperty("id");
		});

		it("accepts payload without optional fields", async () => {
			// Only required fields — no trace_id, version, extras
			const { status } = await api.api.v1.logs.post(makePayload());
			expect(status).toBe(202);
		});
	});

	describe("validation failures", () => {
		it("returns 422 for a missing required field", async () => {
			const { message } = makePayload();
			// Send without 'level'
			const response = await app.handle(
				makeRequest({
					message,
					service: "x",
					environment: "development",
					timestamp: new Date().toISOString(),
				}),
			);
			expect(response.status).toBe(422);
		});

		it("returns 422 for an invalid log level", async () => {
			const response = await app.handle(
				makeRequest(makePayload({ level: "verbose" as never })),
			);
			expect(response.status).toBe(422);
		});

		it("returns 422 for an invalid environment value", async () => {
			const response = await app.handle(
				makeRequest(makePayload({ environment: "prod" as never })),
			);
			expect(response.status).toBe(422);
		});

		it("returns 422 for a non-ISO timestamp", async () => {
			const response = await app.handle(
				makeRequest(makePayload({ timestamp: "not-a-date" })),
			);
			expect(response.status).toBe(422);
		});

		it("returns 422 for an empty message", async () => {
			const response = await app.handle(
				makeRequest(makePayload({ message: "" })),
			);
			expect(response.status).toBe(422);
		});

		it("returns a validation error body with a message field", async () => {
			const response = await app.handle(makeRequest({}));
			const body = await response.json();

			expect(body).toHaveProperty("message");
			expect(body).toHaveProperty("errors");
		});

		it("calls enqueueDead for a validation failure", async () => {
			await app.handle(makeRequest({ garbage: true }));
			expect(deadSpy).toHaveBeenCalledTimes(1);
		});

		it("does not call publishLog or enqueueLog on validation failure", async () => {
			await app.handle(makeRequest({ garbage: true }));
			expect(publishSpy).not.toHaveBeenCalled();
			expect(enqueueSpy).not.toHaveBeenCalled();
		});

		it("returns 422 for a completely empty body", async () => {
			const response = await app.handle(
				new Request("http://localhost/api/v1/logs", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: "{}",
				}),
			);
			expect(response.status).toBe(422);
		});
	});

	// ---------------------------------------------------------------- api versioning

	describe("API versioning", () => {
		it("returns 404 for an unversioned path", async () => {
			const response = await app.handle(
				new Request("http://localhost/logs", { method: "POST" }),
			);
			expect(response.status).toBe(404);
		});

		it("returns 404 for a v2 path that does not exist", async () => {
			const response = await app.handle(
				new Request("http://localhost/api/v2/logs", { method: "POST" }),
			);
			expect(response.status).toBe(404);
		});

		it("responds on the correct versioned path", async () => {
			const response = await app.handle(makeRequest(makePayload()));
			// 202 confirms the route resolved — not 404
			expect(response.status).toBe(202);
		});
	});
});

// ------------------------------------------------------------------ GET /api/v1/logs

describe("GET /api/v1/logs", () => {
	it("returns 200 and calls queryLogs with correct parameters", async () => {
		queryLogsSpy.mockResolvedValueOnce({
			logs: [
				{
					id: "log1",
					message: "test",
					timestamp: "2023-01-01T00:00:00Z",
					service: "auth",
					level: "info",
					environment: "development",
					received_at: "2023-01-01T00:00:00Z",
				},
			],
			next_cursor: "cursor_xyz",
		});

		const response = await app.handle(
			new Request(
				"http://localhost/api/v1/logs?from=2023-01-01T00:00:00.000Z&to=2023-01-02T00:00:00.000Z&service=auth&level=info&environment=development&limit=50",
			),
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.logs.length).toBe(1);
		expect(body.next_cursor).toBe("cursor_xyz");

		expect(queryLogsSpy).toHaveBeenCalledTimes(1);
		expect(queryLogsSpy).toHaveBeenCalledWith({
			service: "auth",
			levels: ["info"],
			environment: "development",
			from: "2023-01-01T00:00:00.000Z",
			to: "2023-01-02T00:00:00.000Z",
			limit: 50,
			cursor: undefined,
		});
	});

	it("returns 400 if 'from' is after 'to'", async () => {
		const response = await app.handle(
			new Request(
				"http://localhost/api/v1/logs?from=2023-01-02T00:00:00Z&to=2023-01-01T00:00:00Z",
			),
		);
		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.message).toBe("'from' must be earlier than 'to'");
		expect(queryLogsSpy).not.toHaveBeenCalled();
	});

	it("returns 400 if time range exceeds 30 days", async () => {
		const response = await app.handle(
			new Request(
				"http://localhost/api/v1/logs?from=2023-01-01T00:00:00Z&to=2023-03-01T00:00:00Z",
			),
		);
		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.message).toBe("Time range cannot exceed 30 days");
		expect(queryLogsSpy).not.toHaveBeenCalled();
	});

	it("returns 422 if 'from' or 'to' is missing", async () => {
		const response = await app.handle(
			new Request("http://localhost/api/v1/logs?from=2023-01-01T00:00:00Z"),
		);
		expect(response.status).toBe(422);
	});
});

// ------------------------------------------------------------------ GET /api/v1/logs/stream

describe("GET /api/v1/logs/stream", () => {
	it("returns 200 with text/event-stream content type", async () => {
		const response = await app.handle(
			new Request("http://localhost/api/v1/logs/stream"),
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/event-stream");
	});

	it("sets cache-control to no-cache", async () => {
		const response = await app.handle(
			new Request("http://localhost/api/v1/logs/stream"),
		);
		expect(response.headers.get("cache-control")).toBe("no-cache");
	});

	it("returns a readable stream body", async () => {
		const response = await app.handle(
			new Request("http://localhost/api/v1/logs/stream"),
		);
		expect(response.body).not.toBeNull();
		expect(response.body).toBeInstanceOf(ReadableStream);
	});
});
