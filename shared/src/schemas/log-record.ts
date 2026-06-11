import { t } from "elysia";
import { LogPayloadSchema } from "./log-payload";

export const LogRecordSchema = t.Composite([
	LogPayloadSchema,
	t.Object({
		id: t.String(),
		received_at: t.String({ format: "date-time" }),
	}),
]);

export type LogRecord = typeof LogRecordSchema.static;
