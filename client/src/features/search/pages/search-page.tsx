import { Loader2 } from "lucide-react";
import { useFilterLogs } from "@/hooks/use-filter-logs";
import { Route } from "@/routes/_app/search";
import { LogsFilters } from "../components/logs-filters";
import { LogsTable } from "../components/logs-table";

export function SearchPage() {
	const search = Route.useSearch();
	const { data, isLoading, isFetching } = useFilterLogs(search);

	// The API returns { logs, next_cursor }
	const logs = data && "logs" in data ? data.logs : [];
	const nextCursor = data && "next_cursor" in data ? data.next_cursor : null;

	return (
		<main className="flex h-svh flex-col bg-background">
			<header className="flex items-center justify-between border-b px-6 py-4">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Search Logs</h1>
					<p className="text-sm text-muted-foreground">
						Query logs across services and environments.
					</p>
				</div>
				<div className="flex items-center gap-4 text-sm text-muted-foreground">
					{isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
					<span>{logs.length} results displayed</span>
				</div>
			</header>

			<div className="flex flex-1 flex-col overflow-hidden">
				<LogsFilters />
				<div className="relative flex-1 overflow-hidden p-4">
					<div className="h-full overflow-auto rounded-md border bg-card">
						{isLoading && logs.length === 0 ? (
							<div className="flex h-full items-center justify-center">
								<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
							</div>
						) : (
							<LogsTable data={logs} nextCursor={nextCursor} />
						)}
					</div>
				</div>
			</div>
		</main>
	);
}
