import { beforeEach, describe, expect, it, mock } from "bun:test";

const mockQuery = mock(async () => ({
	json: async () => [],
}));

mock.module("@clickhouse/client", () => ({
	createClient: () => ({
		query: mockQuery,
	}),
}));

import { queryLogs } from "@watchtower/server/clickhouse/query";

describe("clickhouse/query", () => {
	beforeEach(() => {
		mockQuery.mockClear();
	});

	it("executes basic query with time range", async () => {
		mockQuery.mockResolvedValueOnce({
			json: async () => [{ id: "1", timestamp: "2023-01-01T00:00:00Z" }],
		});

		const result = await queryLogs({
			from: "2023-01-01T00:00:00Z",
			to: "2023-01-02T00:00:00Z",
			limit: 10,
		});

		expect(mockQuery).toHaveBeenCalledTimes(1);
		const callArg = mockQuery.mock.calls[0][0];

		expect(callArg.query).toContain("timestamp >= {from:DateTime64(3)}");
		expect(callArg.query).toContain("timestamp <= {to:DateTime64(3)}");
		expect(callArg.query_params.from).toBe("2023-01-01T00:00:00Z");
		expect(callArg.query_params.to).toBe("2023-01-02T00:00:00Z");
		expect(callArg.query_params.limit).toBe(11); // limit + 1

		expect(result.logs.length).toBe(1);
		expect(result.next_cursor).toBeNull();
	});

	it("returns next_cursor when there are more results than limit", async () => {
		mockQuery.mockResolvedValueOnce({
			json: async () => [
				{ id: "2", timestamp: "2023-01-01T01:00:00Z" },
				{ id: "1", timestamp: "2023-01-01T00:00:00Z" },
			],
		});

		const result = await queryLogs({
			from: "2023-01-01T00:00:00Z",
			to: "2023-01-02T00:00:00Z",
			limit: 1,
		});

		// Received 2, limit 1 -> hasMore = true
		expect(result.logs.length).toBe(1);
		expect(result.logs[0].id).toBe("2");
		expect(result.next_cursor).not.toBeNull();

		// Encode cursor manually to verify
		const expectedCursor = Buffer.from("2023-01-01T01:00:00Z|2").toString(
			"base64",
		);
		expect(result.next_cursor).toBe(expectedCursor);
	});

	it("adds service filter if provided", async () => {
		mockQuery.mockResolvedValueOnce({
			json: async () => [],
		});

		await queryLogs({
			from: "2023-01-01T00:00:00Z",
			to: "2023-01-02T00:00:00Z",
			limit: 10,
			service: "auth",
		});

		const callArg = mockQuery.mock.calls[0][0];
		expect(callArg.query).toContain("service = {service:String}");
		expect(callArg.query_params.service).toBe("auth");
	});

	it("adds level filter if provided", async () => {
		mockQuery.mockResolvedValueOnce({
			json: async () => [],
		});

		await queryLogs({
			from: "2023-01-01T00:00:00Z",
			to: "2023-01-02T00:00:00Z",
			limit: 10,
			levels: ["error", "fatal"],
		});

		const callArg = mockQuery.mock.calls[0][0];
		expect(callArg.query).toContain("level IN ({levels:Array(String)})");
		expect(callArg.query_params.levels).toEqual(["error", "fatal"]);
	});

	it("adds environment filter if provided", async () => {
		mockQuery.mockResolvedValueOnce({
			json: async () => [],
		});

		await queryLogs({
			from: "2023-01-01T00:00:00Z",
			to: "2023-01-02T00:00:00Z",
			limit: 10,
			environment: "production",
		});

		const callArg = mockQuery.mock.calls[0][0];
		expect(callArg.query).toContain("environment = {environment:String}");
		expect(callArg.query_params.environment).toBe("production");
	});

	it("adds cursor conditions if cursor is provided", async () => {
		mockQuery.mockResolvedValueOnce({
			json: async () => [],
		});

		const cursor = Buffer.from("2023-01-01T00:00:00Z|12345").toString("base64");

		await queryLogs({
			from: "2023-01-01T00:00:00Z",
			to: "2023-01-02T00:00:00Z",
			limit: 10,
			cursor,
		});

		const callArg = mockQuery.mock.calls[0][0];
		expect(callArg.query).toContain(
			"(timestamp, id) < ({cursorTimestamp:DateTime64(3)}, {cursorId:String})",
		);
		expect(callArg.query_params.cursorTimestamp).toBe("2023-01-01T00:00:00Z");
		expect(callArg.query_params.cursorId).toBe("12345");
	});
});
