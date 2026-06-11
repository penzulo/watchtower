import { t } from "elysia";

export const LogLevel = t.Union([
	t.Literal("trace"),
	t.Literal("debug"),
	t.Literal("info"),
	t.Literal("warn"),
	t.Literal("error"),
	t.Literal("fatal"),
]);
