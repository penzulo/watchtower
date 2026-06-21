import { type Static, t } from "elysia";

export const logLevels = [
	"trace",
	"debug",
	"info",
	"warn",
	"error",
	"fatal",
] as const;

export const LogLevel = t.Union(logLevels.map((level) => t.Literal(level)));
export type TLogLevel = Static<typeof LogLevel>;
