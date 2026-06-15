import { Elysia } from "elysia";
import { v1 } from "./routes/v1";

const app = new Elysia().use(v1).listen(3000);

console.log(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);

export type App = typeof app;
