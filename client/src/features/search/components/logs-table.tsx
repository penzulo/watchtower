import type { LogQuery, LogRecord } from "@watchtower/shared";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Route } from "@/routes/_app/search";

const LEVEL_COLORS: Record<string, string> = {
	trace: "text-slate-400",
	debug: "text-blue-400",
	info: "text-green-400",
	warn: "text-yellow-400",
	error: "text-red-400",
	fatal: "text-red-300",
};

function LogRow({ log }: { log: LogRecord }) {
	const [expanded, setExpanded] = useState(false);

	const date = new Date(log.timestamp);
	const timeStr = date.toLocaleTimeString([], { hour12: false });
	const msStr = date.getMilliseconds().toString().padStart(3, "0");
	const level = log.level.toUpperCase().padEnd(5);
	const color = LEVEL_COLORS[log.level] ?? "text-muted-foreground";

	return (
		<li>
			{/* Summary row — one click toggles detail panel */}
			<button
				type="button"
				aria-expanded={expanded}
				onClick={() => setExpanded((v) => !v)}
				className={`flex w-full items-center gap-2 px-4 py-0.5 text-left font-mono text-xs leading-5 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${color}`}
			>
				<span className="shrink-0 opacity-50">
					{expanded ? (
						<ChevronUp className="h-3 w-3" />
					) : (
						<ChevronDown className="h-3 w-3" />
					)}
				</span>
				<span className="truncate">
					{`${timeStr}.${msStr} ${level} [${log.service}] ${log.message}`}
				</span>
			</button>

			{/* Detail panel — only rendered when expanded */}
			{expanded && (
				<section
					aria-label={`Details for log ${log.id}`}
					className="border-b border-border/40 bg-muted/20 px-4 py-3"
				>
					<dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
						<dt className="text-muted-foreground">id</dt>
						<dd>{log.id}</dd>
						<dt className="text-muted-foreground">timestamp</dt>
						<dd>{log.timestamp}</dd>
						<dt className="text-muted-foreground">level</dt>
						<dd className={color}>{log.level}</dd>
						<dt className="text-muted-foreground">service</dt>
						<dd>{log.service}</dd>
						<dt className="text-muted-foreground">environment</dt>
						<dd>{log.environment}</dd>
						<dt className="text-muted-foreground">message</dt>
						<dd className="break-all">{log.message}</dd>
						{log.received_at && (
							<>
								<dt className="text-muted-foreground">received_at</dt>
								<dd>{log.received_at}</dd>
							</>
						)}
					</dl>

					{log.extras && Object.keys(log.extras).length > 0 && (
						<details open>
							<summary className="mb-1 cursor-pointer font-mono text-xs text-muted-foreground select-none hover:text-foreground">
								extras
							</summary>
							<pre className="overflow-auto rounded bg-card p-3 text-xs leading-relaxed">
								{JSON.stringify(log.extras, null, 2)}
							</pre>
						</details>
					)}
				</section>
			)}
		</li>
	);
}

export function LogsTable({
	data,
	nextCursor,
}: {
	data: LogRecord[];
	nextCursor: string | null;
}) {
	const navigate = Route.useNavigate();
	const search = Route.useSearch();

	const isSortedAsc =
		search.sortBy === "timestamp" && search.sortDirection === "asc";

	const toggleSort = () => {
		navigate({
			search: (old: LogQuery) => ({
				...old,
				sortBy: "timestamp" as const,
				sortDirection: isSortedAsc ? "desc" : "asc",
				cursor: undefined,
			}),
		});
	};

	return (
		<section className="flex h-full flex-col">
			{/* Toolbar */}
			<header className="flex items-center gap-2 border-b bg-card px-4 py-2">
				<button
					type="button"
					onClick={toggleSort}
					className="font-mono text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1"
				>
					time {isSortedAsc ? "↑" : "↓"}
				</button>
			</header>

			{/* Log list */}
			<ol className="flex-1 overflow-auto font-mono text-xs">
				{data.length === 0 ? (
					<li className="flex h-24 items-center justify-center text-sm text-muted-foreground">
						No results found.
					</li>
				) : (
					data.map((log) => <LogRow key={log.id} log={log} />)
				)}
			</ol>

			{/* Pagination footer */}
			<footer className="sticky bottom-0 flex items-center justify-between border-t bg-card px-4 py-3">
				<span className="text-sm text-muted-foreground">
					{data.length} result{data.length !== 1 ? "s" : ""}
				</span>
				<Button
					variant="outline"
					size="sm"
					disabled={!nextCursor}
					onClick={() => {
						if (nextCursor) {
							navigate({
								search: (old: LogQuery) => ({
									...old,
									cursor: nextCursor,
								}),
							});
						}
					}}
				>
					Next page
				</Button>
			</footer>
		</section>
	);
}
