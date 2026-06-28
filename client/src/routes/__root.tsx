import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";

const TanStackRouterDevtools = import.meta.env.DEV
	? lazy(() =>
			import("@tanstack/router-devtools").then((m) => ({
				default: m.TanStackRouterDevtools,
			})),
		)
	: () => null;

export interface RouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
	component: () => (
		<TooltipProvider>
			<Outlet />
			<Suspense>
				<TanStackRouterDevtools />
			</Suspense>
		</TooltipProvider>
	),
});
