import { createClient } from "@clickhouse/client";
import { clickHouseConnectionOptions } from "@watchtower/server/clickhouse/connection";
import type { LogRecord } from "@watchtower/shared";

let _clickhouse: ReturnType<typeof createClient> | null = null;

function getClickhouse(): ReturnType<typeof createClient> {
	if (!_clickhouse) {
		_clickhouse = createClient(clickHouseConnectionOptions);
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
	sortBy?: "timestamp" | "level";
	sortDirection?: "asc" | "desc";
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

	const sortBy = params.sortBy ?? "timestamp";
	const sortDirection = params.sortDirection === "asc" ? "ASC" : "DESC";

	if (params.cursor) {
		try {
			const [cursorTimestamp, cursorId] = decodeCursor(params.cursor);
			// Simple cursor logic based on timestamp. If sort is ASC, we want > cursor.
			const op = sortDirection === "ASC" ? ">" : "<";
			conditions.push(
				`(timestamp, id) ${op} ({cursorTimestamp:DateTime64(3)}, {cursorId:String})`,
			);
			query_params.cursorTimestamp = cursorTimestamp;
			query_params.cursorId = cursorId;
		} catch {
			console.warn("Invalid cursor passed, ignoring:", params.cursor);
		}
	}

	// NOTE: `id ASC` as a secondary sort key triggers a ClickHouse-internal
	// engine bug — NOT an application-level type error. Repro'd directly
	// against ClickHouse with no app code involved:
	//
	//   SELECT * FROM logs
	//   WHERE timestamp >= ... AND timestamp <= ...
	//   ORDER BY timestamp ASC, id ASC
	//   LIMIT 51
	//
	// fails with:
	//   Cannot convert string '<uuid>' to type DateTime64(3): while executing
	//   'FUNCTION __topKFilter(timestamp : 0) -> __topKFilter(timestamp) UInt8'
	//
	// `__topKFilter` is ClickHouse's internal top-K/partial-sort optimizer for
	// ORDER BY ... LIMIT queries. Something in that optimizer's column binding
	// gets confused specifically when sorting ASC by (timestamp, id) — dropping
	// the `id ASC` secondary key (or sorting DESC) avoids it entirely, which is
	// the actual smoking gun that this lives in ClickHouse's query planner, not
	// in our query construction or parameter binding.
	//
	// Workaround: omit the `id` tie-breaker on ascending timestamp sorts. This
	// only matters for determinism when many rows share an identical timestamp
	// (sub-millisecond collisions), which is an acceptable trade for now.
	const orderClause =
		sortBy === "timestamp"
			? sortDirection === "ASC"
				? `ORDER BY timestamp ASC`
				: `ORDER BY timestamp DESC, id DESC`
			: `ORDER BY ${sortBy} ${sortDirection}, timestamp DESC, id DESC`;

	const query = `
			SELECT *
			FROM logs
			WHERE ${conditions.join(" AND ")}
			${orderClause}
			LIMIT {limit:UInt32}
		`;

	const result = await getClickhouse().query({
		query,
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
	const payload = JSON.stringify({ t: timestamp, i: id });
	return Buffer.from(payload).toString("base64url");
}

function decodeCursor(cursor: string): [string, string] {
	const decoded = Buffer.from(cursor, "base64url").toString();

	try {
		const obj = JSON.parse(decoded);
		if (obj?.t && obj.i) {
			return [obj.t, obj.i];
		}
	} catch {
		// Fallback for old pipe-separated cursors
	}

	const separatorIndex = decoded.indexOf("|");
	if (separatorIndex === -1) {
		throw new Error("Invalid cursor format");
	}

	const timestamp = decoded.slice(0, separatorIndex);
	const id = decoded.slice(separatorIndex + 1);
	return [timestamp, id];
}
