import { queryLogs } from "@watchtower/server/clickhouse/query";
import { enqueueDead, enqueueLog } from "@watchtower/server/queues";
import {
	createSubscriber,
	LOGS_CHANNEL,
	publishLog,
} from "@watchtower/server/redis";
import {
	type LogPayload,
	LogPayloadSchema,
	LogQuerySchema,
} from "@watchtower/shared";
import { Elysia, StatusMap, t } from "elysia";

const MAX_RANGE_MS = 1000 * 60 * 60 * 24 * 30;

export const logRoutes = new Elysia({ prefix: "/logs" })
	.post(
		"/",
		async ({ body, set }) => {
			const record = {
				...(body as LogPayload),
				id: crypto.randomUUID(),
				received_at: new Date().toISOString(),
			};

			// Fire and forget: leverage Bun.redis auto-pipelining.
			// We don't await the network round-trip here so the API responds instantly.
			Promise.all([publishLog(record), enqueueLog(record)]).catch((err) =>
				console.error("[Redis] Failed to ingest log:", err),
			);

			set.status = StatusMap.Accepted;
			return { id: record.id };
		},
		{
			body: LogPayloadSchema,
			error({ code, error, set }) {
				if (code === "VALIDATION") {
					enqueueDead({
						raw: error,
						error: "Validation failed",
						received_at: new Date().toISOString(),
					});
					set.status = StatusMap["Unprocessable Content"];
					return { message: "Validation failed", errors: error };
				}
			},
		},
	)
	.post(
		"/batch",
		async ({ body, set }) => {
			const payloads = body as LogPayload[];

			const records = payloads.map((payload) => ({
				...payload,
				id: crypto.randomUUID(),
				received_at: new Date().toISOString(),
			}));

			// Fire and forget batch ingestion
			const promises = [];
			for (const record of records) {
				promises.push(publishLog(record));
				promises.push(enqueueLog(record));
			}

			Promise.all(promises).catch((err) =>
				console.error("[Redis] Failed to ingest log batch:", err),
			);

			set.status = StatusMap.Accepted;
			return {
				message: `Accepted ${records.length} logs`,
				count: records.length,
			};
		},
		{
			body: t.Array(LogPayloadSchema, { maxItems: 2000 }),
			error({ code, error, set }) {
				if (code === "VALIDATION") {
					enqueueDead({
						raw: error,
						error: "Batch validation failed",
						received_at: new Date().toISOString(),
					});
					set.status = StatusMap["Unprocessable Content"];
					return { message: "Validation failed", errors: error };
				}
			},
		},
	)

	// TODO: This route needs a separate auth mechanism as it
	// a service-to-service endpoint
	.get("/stream", ({ set }) => {
		set.headers["content-type"] = "text/event-stream";
		set.headers["cache-control"] = "no-cache";
		set.headers.connection = "keep-alive";

		const subscriber = createSubscriber();

		const stream = new ReadableStream({
			async start(controller) {
				await subscriber.subscribe(LOGS_CHANNEL, (message) => {
					try {
						// Guard against the race where a PUBLISH fires after the
						// client has disconnected and the controller is already closed.
						// Without this, Bun throws ERR_INVALID_STATE and crashes.
						controller.enqueue(
							new TextEncoder().encode(`data: ${message}\n\n`),
						);
					} catch {
						// Controller is closed — the cancel() below will clean up
						// the subscriber on the next tick.
					}
				});
			},
			// cancel() is the correct ReadableStream lifecycle hook for cleanup.
			// It fires when: the client disconnects, the response is aborted,
			// or the stream is explicitly cancelled.
			async cancel() {
				try {
					// Must await unsubscribe so bun:redis completes the UNSUBSCRIBE
					// handshake with the server before we tear down the connection.
					// Calling close() immediately after unsubscribe() (without awaiting)
					// destroys the socket mid-handshake and throws ERR_REDIS_CONNECTION_CLOSED.
					await subscriber.unsubscribe(LOGS_CHANNEL);
				} catch {
					// Already disconnected or unsubscribe failed — safe to ignore.
				} finally {
					try {
						subscriber.close();
					} catch {
						// Connection already gone — nothing to do.
					}
				}
			},
		});

		return new Response(stream, {
			headers: set.headers as Record<string, string>,
		});
	})

	.get(
		"/",
		async ({ query, set }) => {
			const from = new Date(query.from);
			const to = new Date(query.to);

			if (from.getTime() >= to.getTime()) {
				set.status = StatusMap["Bad Request"];
				return { message: "'from' must be earlier than 'to'" };
			}

			if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
				set.status = StatusMap["Bad Request"];
				return { message: "Time range cannot exceed 30 days" };
			}

			const level = query.level;
			const result = await queryLogs({
				service: query.service,
				levels:
					level === undefined
						? undefined
						: Array.isArray(level)
							? level
							: [level],
				environment: query.environment,
				from: from.toISOString().replace("T", " ").replace("Z", ""),
				to: to.toISOString().replace("T", " ").replace("Z", ""),
				limit: Number(query.limit ?? 200),
				cursor: query.cursor,
				sortBy: query.sortBy as "timestamp" | "level" | undefined,
				sortDirection: query.sortDirection as "asc" | "desc" | undefined,
			});

			return result;
		},
		{
			query: LogQuerySchema,
			error({ code, error, set }) {
				if (code === "VALIDATION") {
					set.status = StatusMap["Unprocessable Content"];
					return { message: "Invalid query parameters", errors: error.all };
				}
			},
		},
	);
