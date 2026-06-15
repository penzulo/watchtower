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

			await Promise.all([
				// publishLog(record),
				// enqueueLog(record),
			]);

			set.status = StatusMap.Accepted;
			return { id: record.id };
		},
		{
			body: LogPayloadSchema,
			error({ code, error, set }) {
				if (code === "VALIDATION") {
					// enqueueDead({ raw: error, receieved_at: new Date().toISOString() });
					set.status = StatusMap["Unprocessable Content"];
					return { message: "Validation failed", errors: error };
				}
			},
		},
	) // TODO: Make this handler

	.get("/stream", () => {}); // TODO: Make SSE handler
