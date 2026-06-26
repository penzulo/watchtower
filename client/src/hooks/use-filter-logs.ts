import { queryOptions, useQuery } from "@tanstack/react-query";
import type { LogQuery } from "@watchtower/shared";
import { api } from "@/lib/api";

export function getLogsQueryKey(query?: Partial<LogQuery>) {
	return query ? ["logs", query] : ["logs"];
}

export function logsQueryOptions(query: LogQuery) {
	return queryOptions({
		queryKey: getLogsQueryKey(query),
		queryFn: async () => {
			const { data, error } = await api.api.v1.logs.get({ query: query });
			if (error) {
				throw error;
			}
			return data;
		},
	});
}

export function useFilterLogs(query: LogQuery) {
	return useQuery(logsQueryOptions(query));
}
