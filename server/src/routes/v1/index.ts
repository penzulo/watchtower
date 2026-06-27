import { logRoutes } from "@watchtower/server/routes/v1/logs";
import { Elysia } from "elysia";

export const v1 = new Elysia({ prefix: "/api/v1" }).use(logRoutes);
