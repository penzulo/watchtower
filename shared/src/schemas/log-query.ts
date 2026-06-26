import { t } from "elysia";
import { AppEnvironmentSchema } from "./environment";
import { LogLevel } from "./log-level";

export const LogQuerySchema = t.Object({
	service: t.Optional(t.String({ minLength: 1 })),
	level: t.Optional(t.Array(LogLevel)),
	environment: t.Optional(AppEnvironmentSchema),
	from: t.String({ format: "date-time" }),
	to: t.String({ format: "date-time" }),
	limit: t.Optional(t.Number({ minimum: 1, maximum: 1000, default: 200 })),
	cursor: t.Optional(t.String()), // For pagination
});

export type LogQuery = typeof LogQuerySchema.static;
