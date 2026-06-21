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

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_LOGS = 50_000;
const SCROLL_THRESHOLD_PX = 80;

// ─── Component ───────────────────────────────────────────────────────────────

function LogsPage() {
	const [logs, setLogs] = useState<LogRecord[]>([]);
	const [pendingCount, setPendingCount] = useState(0);
	const [isLive, _setIsLive] = useState(true);

	const isLiveRef = useRef(true);
	const pendingRef = useRef<LogRecord[]>([]);
	const incomingRef = useRef<LogRecord[]>([]);

	const parentRef = useRef<HTMLDivElement>(null);
	const isScrollingProgrammatically = useRef(false);

	const setIsLive = useCallback((value: boolean) => {
		isLiveRef.current = value;
		_setIsLive(value);
	}, []);

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

	// ── Scroll helpers ────────────────────────────────────────────────────────

	const scrollToBottom = useCallback(() => {
		if (rows.length === 0) return;
		isScrollingProgrammatically.current = true;
		rowVirtualizer.scrollToIndex(rows.length - 1, { behavior: "auto" });
		requestAnimationFrame(() => {
			isScrollingProgrammatically.current = false;
		});
	}, [rowVirtualizer, rows.length]);

	// Auto-scroll whenever the logs array grows while live
	useEffect(() => {
		if (isLive && logs.length > 0) scrollToBottom();
	}, [logs.length, isLive, scrollToBottom]);

	// Scroll detection — sets isLive=false when user scrolls up manually
	const handleScroll = useCallback(() => {
		if (isScrollingProgrammatically.current) return;
		if (!parentRef.current) return;

		const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
		const atBottom =
			scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD_PX;

		if (!atBottom && isLiveRef.current) {
			setIsLive(false);
		} else if (
			atBottom &&
			!isLiveRef.current &&
			pendingRef.current.length === 0
		) {
			setIsLive(true);
		}
	}, [setIsLive]);

	// ── Go Live / Jump to bottom ──────────────────────────────────────────────

	const handleGoLive = useCallback(() => {
		// Flush any incoming buffer first so we don't lose in-flight messages
		const incoming = incomingRef.current.splice(0);
		const pending = pendingRef.current.splice(0);
		setPendingCount(0);

		const toAdd = [...incoming, ...pending];
		if (toAdd.length > 0) {
			setLogs((prev) => {
				const next = [...prev, ...toAdd];
				return next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next;
			});
		}

		setIsLive(true);
		requestAnimationFrame(() => scrollToBottom());
	}, [setIsLive, scrollToBottom]);

	// ── RAF batch flush — the core performance fix ────────────────────────────
	//
	// Instead of calling setLogs() on every SSE message (up to 800×/sec),
	// we accumulate new records into `incomingRef` and flush them to state
	// at most once per animation frame (~60×/sec).
	//
	// This collapses up to ~13 individual setState calls into a single batch
	// per frame, cutting React reconciliation work by ~13× and eliminating
	// the lag under heavy ingestion.
	useEffect(() => {
		let rafId: number;

		const flush = () => {
			if (isLiveRef.current && incomingRef.current.length > 0) {
				const batch = incomingRef.current.splice(0); // drain atomically
				setLogs((prev) => {
					const next = [...prev, ...batch];
					return next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next;
				});
			}
			rafId = requestAnimationFrame(flush);
		};

		rafId = requestAnimationFrame(flush);
		return () => cancelAnimationFrame(rafId);
	}, []);

	// ── SSE connection ────────────────────────────────────────────────────────

	useEffect(() => {
		const url = `${import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000"}/api/v1/logs/stream`;
		const source = new EventSource(url, { withCredentials: true });

		source.onmessage = (event: MessageEvent<string>) => {
			let record: LogRecord;
			try {
				record = JSON.parse(event.data) as LogRecord;
			} catch {
				console.warn("[SSE] Failed to parse:", event.data);
				return;
			}

			if (isLiveRef.current) {
				// Push into the incoming buffer; the RAF loop flushes this to state
				incomingRef.current.push(record);
			} else {
				// Buffer pending without touching state; only the count triggers a render
				pendingRef.current.push(record);
				setPendingCount(pendingRef.current.length);
			}
		};

		source.onerror = () => {
			console.warn("[SSE] Connection lost — browser will retry automatically.");
		};

		return () => source.close();
	}, []);

	return (
		<main className="flex h-svh flex-col bg-background">
			{/* ── Header ──────────────────────────────────────────────────────── */}
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

			{/* ── Table area ──────────────────────────────────────────────────── */}
			<div className="relative flex-1 overflow-hidden p-4">
				<div
					ref={parentRef}
					onScroll={handleScroll}
					className="h-full overflow-auto rounded-md border bg-card"
				>
					<table className="w-full caption-bottom text-sm">
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
					</table>
				</div>

				{/*
				 * Floating action button — two states:
				 *
				 * 1. Paused + pending logs → "X new logs" (flush + go live)
				 * 2. Paused + no pending   → "Jump to latest" (scroll + go live)
				 *
				 * Neither shows when isLive=true AND user is at the bottom.
				 */}
				{!isLive && (
					<div className="absolute bottom-8 left-1/2 z-20 -translate-x-1/2">
						<Button
							onClick={handleGoLive}
							className="animate-in fade-in slide-in-from-bottom-3 flex items-center gap-2 rounded-full px-5 shadow-xl"
						>
							<ArrowDownIcon className="h-4 w-4" />
							{pendingCount > 0
								? `${pendingCount.toLocaleString()} new logs`
								: "Jump to latest"}
						</Button>
					</div>
				)}
			</div>
		</main>
	);
}
