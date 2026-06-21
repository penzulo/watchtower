import { Database } from "bun:sqlite";
import { betterAuth } from "better-auth";

const db = new Database(Bun.env.AUTH_DB_PATH ?? "./watchtower-auth.sqlite");

export const auth = betterAuth({
	database: db,
	emailAndPassword: {
		enabled: true,
	},
	trustedOrigins: [Bun.env.CLIENT_URL ?? "http://localhost:3000"],
});
