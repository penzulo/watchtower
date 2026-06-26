import { betterAuthPlugin } from "@watchtower/server/auth/middleware";
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
import { Elysia, StatusMap } from "elysia";

const MAX_RANGE_MS = 1000 * 60 * 60 * 24 * 30;

export const logRoutes = new Elysia({ prefix: "/logs" })
	.use(betterAuthPlugin)
	.post(
		"/",
		async ({ body, set }) => {
			const record = {
				...(body as LogPayload),
				id: crypto.randomUUID(),
				received_at: new Date().toISOString(),
			};

			await Promise.all([publishLog(record), enqueueLog(record)]);

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

	// TODO: This route needs a separate auth mechanism as it
	// a service-to-service endpoint
	.get(
		"/stream",
		({ set }) => {
			set.headers["content-type"] = "text/event-stream";
			set.headers["cache-control"] = "no-cache";
			set.headers.connection = "keep-alive";

			const subscriber = createSubscriber();

			const stream = new ReadableStream({
				start(controller) {
					subscriber.subscribe(LOGS_CHANNEL);

					subscriber.on("message", (_, message) => {
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
				// (Returning a function from start() is NOT part of the spec and is silently ignored.)
				cancel() {
					subscriber.unsubscribe(LOGS_CHANNEL);
					subscriber.quit().catch(() => {});
				},
			});

			return new Response(stream, {
				headers: set.headers as Record<string, string>,
			});
		},
		{ auth: true },
	)

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
			});

			return result;
		},
		{
			auth: true,
			query: LogQuerySchema,
			error({ code, error, set }) {
				if (code === "VALIDATION") {
					set.status = StatusMap["Unprocessable Content"];
					return { message: "Invalid query parameters", errors: error.all };
				}
			},
		},
	);
