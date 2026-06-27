import { type Static, t } from "elysia";

export const logLevels = [
	"trace",
	"debug",
	"info",
	"warn",
	"error",
	"fatal",
] as const;

export const LogLevel = t.Union([
	t.Literal("trace"),
	t.Literal("debug"),
	t.Literal("info"),
	t.Literal("warn"),
	t.Literal("error"),
	t.Literal("fatal"),
]);

export type TLogLevel = Static<typeof LogLevel>;
