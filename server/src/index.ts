import { v1 } from "@watchtower/server/routes/v1";
import { Elysia } from "elysia";

const app = new Elysia().use(v1).listen(3000);

console.log(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);

export type App = typeof app;
