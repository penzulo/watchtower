import { cors } from "@elysiajs/cors";
import { runMigrations } from "@watchtower/server/clickhouse/migrate";
import { v1 } from "@watchtower/server/routes/v1";
import "@watchtower/server/queues/worker";
import { Elysia } from "elysia";

// Ensure database schema is up-to-date before starting the server
await runMigrations();

export const app = new Elysia()
	.use(
		cors({
			origin: Bun.env.CLIENT_URL ?? "http://localhost:5173",
			credentials: true,
		}),
	)
	.use(v1)
	.listen(3000);

console.log(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);

export type App = typeof app;
