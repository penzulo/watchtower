import { Elysia } from "elysia";
import { logRoutes } from "./logs";

export const v1 = new Elysia({ prefix: "/api/v1" }).use(logRoutes);
