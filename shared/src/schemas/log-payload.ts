import { t } from "elysia";
import { LogLevel } from "./log-level";

/**
 * Log Payload Schema
 *
 * This is what the Log Producer sends to the Elysia
 * Gateway which is then validated and thrown in the
 * DLQ or processed and streamed to the frontend.
 */
export const LogPayloadSchema = t.Object({
	timestamp: t.String({ format: "date-time" }),
	level: LogLevel,
	service: t.String({ minLength: 1 }),
	environment: t.Union([
		t.Literal("production"),
		t.Literal("staging"),
		t.Literal("development"),
	]),
	message: t.String({ minLength: 1 }),
	version: t.Optional(t.String()),
	extras: t.Optional(t.Record(t.String(), t.Unknown())),
});

export type LogPayload = typeof LogPayloadSchema.static;
