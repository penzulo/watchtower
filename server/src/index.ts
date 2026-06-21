import { cors } from "@elysiajs/cors";
import { betterAuthPlugin } from "@watchtower/server/auth/middleware";
import { v1 } from "@watchtower/server/routes/v1";
import { Elysia } from "elysia";

export const app = new Elysia()
	.use(
		cors({
			origin: Bun.env.CLIENT_URL ?? "http://localhost:5173",
			credentials: true,
		}),
	)
	.use(betterAuthPlugin)
	.use(v1)
	.listen(3000);

console.log(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);

export type App = typeof app;
