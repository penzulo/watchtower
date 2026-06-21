import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { sessionQueryOptions } from "@/lib/session";

export const Route = createFileRoute("/_protected")({
	beforeLoad: async ({ context }) => {
		const { data: session } =
			await context.queryClient.ensureQueryData(sessionQueryOptions);

		if (!session) {
			throw redirect({ to: "/login" });
		}

		// Expose session to all nested routes via route context
		return { session };
	},
	component: () => <Outlet />,
});
