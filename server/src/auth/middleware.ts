import { auth } from "@watchtower/server/auth";
import { Elysia } from "elysia";
import { StatusMap } from "elysia/utils";

export const betterAuthPlugin = new Elysia({ name: "better-auth" })
	.mount(auth.handler)
	.macro({
		auth: {
			async resolve({ status, request: { headers } }) {
				const session = await auth.api.getSession({ headers });
				if (!session) return status(StatusMap.Unauthorized);
				return { user: session.user, session: session.session };
			},
		},
	});
