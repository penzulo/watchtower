import { t } from "elysia";

export const AppEnvironmentSchema = t.Union([
	t.Literal("development"),
	t.Literal("staging"),
	t.Literal("production"),
]);

export type AppEnvironment = typeof AppEnvironmentSchema.static;
