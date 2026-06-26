import { queryOptions, useQuery } from "@tanstack/react-query";
import type { LogQuery } from "@watchtower/shared";
import { server } from "@/lib/api";

export function getLogsQueryKey(query?: Partial<LogQuery>) {
	return query ? ["logs", query] : ["logs"];
}

export function logsQueryOptions(query: LogQuery) {
	return queryOptions({
		queryKey: getLogsQueryKey(query),
		queryFn: async ({ signal }) => {
			const { data, error } = await server.api.v1.logs.get({
				query,
				fetch: { signal },
			});
			if (error) throw error;

			return data;
		},
		staleTime: 5000,
		gcTime: 5 * 60 * 1000,
		placeholderData: (previous) => previous,
	});
}

export function useFilterLogs(query: LogQuery) {
	return useQuery(logsQueryOptions(query));
}
