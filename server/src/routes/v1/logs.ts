import { enqueueDead, enqueueLog } from "@watchtower/server/queues";
import { createSubscriber, publishLog } from "@watchtower/server/redis";
import { LogPayloadSchema } from "@watchtower/shared";
import { Elysia, StatusMap } from "elysia";

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
	});
