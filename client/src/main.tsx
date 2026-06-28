import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";

// Import the generated route tree
import { routeTree } from "@/routeTree.gen";

const ReactQueryDevtools = import.meta.env.DEV
	? lazy(() =>
			import("@tanstack/react-query-devtools").then((m) => ({
				default: m.ReactQueryDevtools,
			})),
		)
	: () => null;

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 1000 * 60, // 1 minute
			retry: 1,
		},
	},
});

const router = createRouter({
	routeTree,
	context: { queryClient },
	defaultPreload: "intent",
	defaultPreloadDelay: 100,
});

// Register the router for type safety
declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
			<Suspense>
				<ReactQueryDevtools initialIsOpen={false} />
			</Suspense>
		</QueryClientProvider>
	</StrictMode>,
);
