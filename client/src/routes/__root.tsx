import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { TooltipProvider } from "@/components/ui/tooltip";

export interface RouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
	component: () => (
		<TooltipProvider>
			<Outlet />
			<TanStackRouterDevtools />
		</TooltipProvider>
	),
});
