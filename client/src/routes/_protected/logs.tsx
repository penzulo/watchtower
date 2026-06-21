import { createFileRoute } from "@tanstack/react-router";
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { LogRecord } from "@watchtower/shared";
import { ArrowDownIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_protected/logs")({
	component: LogsPage,
});

const columnHelper = createColumnHelper<LogRecord>();

const LEVEL_STYLES: Record<string, string> = {
	trace: "bg-slate-500",
	debug: "bg-blue-500",
	info: "bg-green-500",
	warn: "bg-yellow-500",
	error: "bg-red-500",
	fatal: "bg-red-900 animate-pulse",
};

const columns = [
	columnHelper.accessor("timestamp", {
		header: "Time",
		cell: (info) => {
			const date = new Date(info.getValue());
			return (
				<span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
					{date.toLocaleTimeString([], { hour12: false })}
					<span className="opacity-50">
						.{date.getMilliseconds().toString().padStart(3, "0")}
					</span>
				</span>
			);
		},
		size: 110,
	}),
	columnHelper.accessor("level", {
		header: "Level",
		cell: (info) => {
			const level = info.getValue();
			return (
				<Badge
					variant="outline"
					className={`border-transparent font-mono text-xs uppercase text-white ${LEVEL_STYLES[level] ?? "bg-gray-500"}`}
				>
					{level}
				</Badge>
			);
		},
		size: 75,
	}),
	columnHelper.accessor("service", {
		header: "Service",
		cell: (info) => (
			<span className="font-medium text-foreground">{info.getValue()}</span>
		),
		size: 140,
	}),
	columnHelper.accessor("environment", {
		header: "Env",
		cell: (info) => (
			<span className="font-mono text-xs text-muted-foreground">
				{info.getValue()}
			</span>
		),
		size: 90,
	}),
	columnHelper.accessor("message", {
		header: "Message",
		cell: (info) => (
			<span className="font-mono text-xs">{info.getValue()}</span>
		),
	}),
];

const MAX_LOGS = 50_000;
const SCROLL_THRESHOLD_PX = 80;

function LogsPage() {
	const [logs, setLogs] = useState<LogRecord[]>([]);
	const [pendingCount, setPendingCount] = useState(0);
	// We store pending logs in a ref so the interval closure never captures
	// a stale slice — only pendingCount drives re-renders.
	const pendingRef = useRef<LogRecord[]>([]);
	const isLiveRef = useRef(true);
	const [isLive, _setIsLive] = useState(true);

	// Sync isLive into both state (for re-renders) and ref (for interval closure)
	const setIsLive = useCallback((value: boolean) => {
		isLiveRef.current = value;
		_setIsLive(value);
	}, []);

	const parentRef = useRef<HTMLDivElement>(null);
	const isScrollingProgrammatically = useRef(false);

	const table = useReactTable({
		data: logs,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getRowId: (row) => row.id,
	});

	const { rows } = table.getRowModel();

	const rowVirtualizer = useVirtualizer({
		count: rows.length,
		getScrollElement: () => parentRef.current,
		// Use the actual measured height once rows are rendered;
		// 36px matches the compact py-2 row height
		estimateSize: () => 36,
		overscan: 15,
	});

	const virtualRows = rowVirtualizer.getVirtualItems();
	const totalSize = rowVirtualizer.getTotalSize();

	const paddingTop = virtualRows.length > 0 ? (virtualRows[0]?.start ?? 0) : 0;
	const paddingBottom =
		virtualRows.length > 0
			? totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0)
			: 0;

	// Scroll to the very last row using the virtualizer's own API so it is
	// aware of the dynamic item sizes it has already measured.
	const scrollToBottom = useCallback(() => {
		if (rows.length === 0) return;
		isScrollingProgrammatically.current = true;
		rowVirtualizer.scrollToIndex(rows.length - 1, { behavior: "auto" });
		// Give the browser one frame to apply the scroll before re-enabling
		// the scroll listener's "pause on scroll-up" detection.
		requestAnimationFrame(() => {
			isScrollingProgrammatically.current = false;
		});
	}, [rowVirtualizer, rows.length]);

	// Auto-scroll whenever logs grow AND we are live
	useEffect(() => {
		if (isLive && logs.length > 0) {
			scrollToBottom();
		}
	}, [logs.length, isLive, scrollToBottom]);

	// Scroll detection — only pause when the user manually scrolls up
	const handleScroll = useCallback(() => {
		if (isScrollingProgrammatically.current) return;
		if (!parentRef.current) return;

		const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
		const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
		const atBottom = distanceFromBottom < SCROLL_THRESHOLD_PX;

		if (!atBottom && isLiveRef.current) {
			setIsLive(false);
		} else if (
			atBottom &&
			!isLiveRef.current &&
			pendingRef.current.length === 0
		) {
			// User manually scrolled back to the bottom with nothing pending — go live again
			setIsLive(true);
		}
	}, [setIsLive]);

	// "Go Live" — flush buffer, re-enable live mode, snap to bottom
	const handleGoLive = useCallback(() => {
		const pending = pendingRef.current;
		if (pending.length > 0) {
			setLogs((prev) => {
				const next = [...prev, ...pending];
				return next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next;
			});
			pendingRef.current = [];
			setPendingCount(0);
		}
		setIsLive(true);
		// scrollToBottom fires via the useEffect above once logs state updates,
		// but we also call it eagerly for immediate feedback.
		requestAnimationFrame(() => scrollToBottom());
	}, [setIsLive, scrollToBottom]);

	// --- Real SSE connection ---
	useEffect(() => {
		const url = `${import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000"}/api/v1/logs/stream`;

		// withCredentials forwards the Better Auth session cookie cross-origin.
		// EventSource natively reconnects on drop; we don't need a manual retry loop.
		const source = new EventSource(url, { withCredentials: true });

		source.onmessage = (event: MessageEvent<string>) => {
			let record: LogRecord;
			try {
				record = JSON.parse(event.data) as LogRecord;
			} catch {
				console.warn("[SSE] Failed to parse log message:", event.data);
				return;
			}

			if (isLiveRef.current) {
				setLogs((prev) => {
					const next = [...prev, record];
					return next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next;
				});
			} else {
				pendingRef.current = [...pendingRef.current, record];
				setPendingCount(pendingRef.current.length);
			}
		};

		source.onerror = () => {
			// EventSource will auto-reconnect after a back-off.
			// We surface the disconnection in the UI via the isLive indicator
			// without crashing — no action needed here beyond logging.
			console.warn("[SSE] Connection lost — browser will retry automatically.");
		};

		return () => {
			source.close();
		};
		// Empty deps — runs once on mount, tears down on unmount.
	}, []);

	return (
		<main className="flex h-svh flex-col bg-background">
			<header className="flex items-center justify-between border-b px-6 py-4">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Live Logs</h1>
					<p className="text-sm text-muted-foreground">
						Real-time log stream from the server.
					</p>
				</div>
				<div className="flex items-center gap-4 text-sm text-muted-foreground">
					<span>{logs.length.toLocaleString()} logs</span>
					<div className="flex items-center gap-2">
						<span className="relative flex h-3 w-3">
							<span
								className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
									isLive ? "animate-ping bg-green-400" : "bg-muted-foreground"
								}`}
							/>
							<span
								className={`relative inline-flex h-3 w-3 rounded-full ${
									isLive ? "bg-green-500" : "bg-muted-foreground"
								}`}
							/>
						</span>
						<span>{isLive ? "Live" : "Paused"}</span>
					</div>
				</div>
			</header>

			{/* Table area — overflow-hidden on this wrapper keeps padding/button inside */}
			<div className="relative flex-1 overflow-hidden p-4">
				{/*
				 * The scroll container. This is the element the virtualizer watches.
				 * overflow-auto here, NOT on the <Table> itself — this is what makes
				 * position: sticky on <thead> work correctly.
				 */}
				<div
					ref={parentRef}
					onScroll={handleScroll}
					className="h-full overflow-auto rounded-md border bg-card"
				>
					<Table>
						{/*
						 * Sticky header: sticky + top-0 + z-10 + a solid bg so rows
						 * scrolling underneath it are hidden behind the header.
						 * bg-card matches the table background so there's no bleed-through.
						 */}
						<TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
							{table.getHeaderGroups().map((headerGroup) => (
								<TableRow key={headerGroup.id} className="hover:bg-transparent">
									{headerGroup.headers.map((header) => (
										<TableHead
											key={header.id}
											style={{ width: header.column.getSize() }}
											className="bg-card font-semibold text-foreground"
										>
											{header.isPlaceholder
												? null
												: flexRender(
														header.column.columnDef.header,
														header.getContext(),
													)}
										</TableHead>
									))}
								</TableRow>
							))}
						</TableHeader>

						<TableBody>
							{paddingTop > 0 && (
								<tr>
									<td style={{ height: paddingTop }} />
								</tr>
							)}

							{virtualRows.map((virtualRow) => {
								const row = rows[virtualRow.index];
								if (!row) return null;
								return (
									<TableRow
										key={row.id}
										data-index={virtualRow.index}
										ref={rowVirtualizer.measureElement}
										className="border-b border-border/40 transition-colors hover:bg-muted/50"
									>
										{row.getVisibleCells().map((cell) => (
											<TableCell
												key={cell.id}
												style={{ width: cell.column.getSize() }}
												className="py-2"
											>
												{flexRender(
													cell.column.columnDef.cell,
													cell.getContext(),
												)}
											</TableCell>
										))}
									</TableRow>
								);
							})}

							{paddingBottom > 0 && (
								<tr>
									<td style={{ height: paddingBottom }} />
								</tr>
							)}

							{logs.length === 0 && (
								<TableRow>
									<TableCell
										colSpan={columns.length}
										className="h-24 text-center text-muted-foreground"
									>
										Waiting for logs…
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>

				{/* Floating "Go Live" pill — visible only when paused with buffered logs */}
				{!isLive && pendingCount > 0 && (
					<div className="absolute bottom-8 left-1/2 z-20 -translate-x-1/2">
						<Button
							onClick={handleGoLive}
							className="animate-in fade-in slide-in-from-bottom-3 flex items-center gap-2 rounded-full px-5 shadow-xl"
						>
							<ArrowDownIcon className="h-4 w-4" />
							{pendingCount.toLocaleString()} new logs
						</Button>
					</div>
				)}
			</div>
		</main>
	);
}
