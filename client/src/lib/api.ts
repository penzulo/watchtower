import { treaty } from "@elysiajs/eden";
import type { App } from "@watchtower/server";

/**
 * Type-safe Eden Treaty client.
 *
 * The `treaty` call only creates a typed proxy — no network request is made
 * at import time. All requests go through `credentials: "include"` so the
 * Better Auth session cookie is forwarded automatically.
 */
export const api = treaty<App>(
	import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000",
	{
		fetch: {
			credentials: "include",
		},
	},
);
