import { createClient } from "@clickhouse/client";
import type { LogRecord } from "@watchtower/shared";

let _clickhouse: ReturnType<typeof createClient> | null = null;

function getClickhouse(): ReturnType<typeof createClient> {
	if (!_clickhouse) {
		_clickhouse = createClient({
			url: Bun.env.CLICKHOUSE_URL ?? "http://localhost:8123",
			username: Bun.env.CLICKHOUSE_USERNAME ?? "default",
			password: Bun.env.CLICKHOUSE_PASSWORD ?? "",
			database: Bun.env.CLICKHOUSE_DB ?? "watchtower",
		});
	}
	return _clickhouse;
}

export interface QueryParams {
	service?: string;
	levels?: string[];
	environment?: string;
	from: string;
	to: string;
	limit: number;
	cursor?: string;
}

export interface QueryResult {
	logs: LogRecord[];
	next_cursor: string | null;
}

export async function queryLogs(params: QueryParams): Promise<QueryResult> {
	const conditions = [
		`timestamp >= {from:DateTime64(3)}`,
		`timestamp <= {to:DateTime64(3)}`,
	];

	const query_params: Record<string, unknown> = {
		from: params.from,
		to: params.to,
		limit: params.limit + 1, // One extra to detect next page
	};

	if (params.service) {
		conditions.push(`service = {service:String}`);
		query_params.service = params.service;
	}

	if (params.levels?.length) {
		conditions.push(`level IN ({levels:Array(String)})`);
		query_params.levels = params.levels;
	}

	if (params.environment) {
		conditions.push(`environment = {environment:String}`);
		query_params.environment = params.environment;
	}

	if (params.cursor) {
		const [cursorTimestamp, cursorId] = decodeCursor(params.cursor);
		conditions.push(
			`(timestamp, id) < ({cursorTimestamp:DateTime64(3)}, {cursorId:String})`,
		);
		query_params.cursorTimestamp = cursorTimestamp;
		query_params.cursorId = cursorId;
	}

	const result = await getClickhouse().query({
		query: `
			SELECT *
			FROM logs
			WHERE ${conditions.join(" AND ")}
			ORDER BY timestamp DESC, id DESC
			LIMIT {limit:UInt32}
		`,
		query_params,
		format: "JSONEachRow",
	});

	const rows = await result.json<LogRecord>();

	const hasMore = rows.length > params.limit;
	const logs = hasMore ? rows.slice(0, params.limit) : rows;
	const next_cursor = hasMore
		? encodeCursor(logs[logs.length - 1].timestamp, logs[logs.length - 1].id)
		: null;

	return { logs, next_cursor };
}

function encodeCursor(timestamp: string, id: string): string {
	return Buffer.from(`${timestamp}|${id}`).toString("base64");
}

function decodeCursor(cursor: string): [string, string] {
	const [timestamp, id] = Buffer.from(cursor, "base64").toString().split("|");
	return [timestamp, id];
}
