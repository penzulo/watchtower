import {
	createFileRoute,
	isRedirect,
	Outlet,
	redirect,
} from "@tanstack/react-router";

import { sessionQueryOptions } from "@/lib/session";

export const Route = createFileRoute("/_auth")({
	beforeLoad: async ({ context }) => {
		try {
			const { data: session } =
				await context.queryClient.ensureQueryData(sessionQueryOptions);

			if (session) {
				throw redirect({ to: "/" });
			}
		} catch (e) {
			// Always re-throw redirects — only swallow actual fetch errors
			// so a network failure doesn't lock users out of the login page
			if (isRedirect(e)) throw e;
		}
	},
	component: () => <Outlet />,
});
