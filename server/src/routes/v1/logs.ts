import { queryLogs } from "@watchtower/server/clickhouse/query";
import { enqueueDead, enqueueLog } from "@watchtower/server/queues";
import { createSubscriber, publishLog } from "@watchtower/server/redis";
import { LogQuerySchema } from "@watchtower/server/schemas/query";
import { LogPayloadSchema } from "@watchtower/shared";
import { Elysia, StatusMap } from "elysia";

const MAX_RANGE_MS = 1000 * 60 * 60 * 24 * 30;

export const logRoutes = new Elysia({ prefix: "/logs" })
	.post(
		"/",
		async ({ body, set }) => {
			const record = {
				...body,
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

	.get("/stream", ({ set }) => {
		set.headers["content-type"] = "text/event-stream";
		set.headers["cache-control"] = "no-cache";
		set.headers.connection = "keep-alive";

		return new Response(
			new ReadableStream({
				start(controller) {
					const subscriber = createSubscriber();

					subscriber.subscribe("logs:stream");

					subscriber.on("message", (_, message) => {
						controller.enqueue(
							new TextEncoder().encode(`data: ${message}\n\n`),
						);
					});

					return () => {
						subscriber.unsubscribe("logs:stream");
						subscriber.quit();
					};
				},
			}),
			{ headers: set.headers as Record<string, string> },
		);
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

			const result = await queryLogs({
				service: query.service,
				levels: query.level,
				environment: query.environment,
				from: from.toISOString(),
				to: to.toISOString(),
				limit: query.limit ?? 200,
				cursor: query.cursor,
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
