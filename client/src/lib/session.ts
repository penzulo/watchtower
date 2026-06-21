import { queryOptions } from "@tanstack/react-query";

import { authClient } from "@/lib/auth-client";

/**
 * Cached session query.
 * Used in route `beforeLoad` guards so repeated navigations
 * don't re-fetch — the result is served from the QueryClient cache
 * until `staleTime` expires or the cache is explicitly invalidated.
 */
export const sessionQueryOptions = queryOptions({
	queryKey: ["session"],
	queryFn: () => authClient.getSession(),
	staleTime: 1000 * 60 * 5, // 5 minutes
	retry: false,
});
