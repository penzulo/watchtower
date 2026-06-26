import { createFileRoute } from "@tanstack/react-router";
import { useFilterLogs } from "@/hooks/use-filter-logs";

export const Route = createFileRoute("/_protected/dummy-logs")({
	component: DummyLogsComponent,
});

function DummyLogsComponent() {
	// Let's fetch logs from the last 7 days as an example
	const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
	const toDate = new Date().toISOString();

	const { data, isLoading, error } = useFilterLogs({
		from: fromDate,
		to: toDate,
		limit: 50,
	});

	if (isLoading) {
		return (
			<div className="p-8 text-muted-foreground animate-pulse">
				Loading dummy logs...
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-8 text-destructive">
				Error fetching logs: {error.message}
			</div>
		);
	}

	return (
		<div className="p-8 flex flex-col gap-6">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">Dummy Logs Route</h1>
				<p className="text-muted-foreground mt-2">
					This route is using the custom `useFilterLogs` hook.
				</p>
			</div>

			<div className="bg-muted p-4 rounded-xl border overflow-auto shadow-inner max-h-[70vh]">
				<pre className="text-sm font-mono whitespace-pre-wrap">
					{JSON.stringify(data, null, 2)}
				</pre>
			</div>
		</div>
	);
}
