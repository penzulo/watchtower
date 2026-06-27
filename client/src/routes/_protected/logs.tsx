import { createFileRoute } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDownIcon } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useLiveLogs } from "@/hooks/use-live-logs";

export const Route = createFileRoute("/_protected/logs")({
	component: LogsPage,
});

const LEVEL_COLORS: Record<string, string> = {
	trace: "text-slate-400",
	debug: "text-blue-400",
	info: "text-green-400",
	warn: "text-yellow-400",
	error: "text-red-400",
	fatal: "text-red-300",
};

const MAX_LOGS = 2_000;
const SCROLL_THRESHOLD_PX = 80;

function LogsPage() {
	const {
		logs,
		status,
		metrics,
		isPaused,
		pause,
		resume,
		isFollowing,
		setIsFollowing,
		clear,
	} = useLiveLogs({
		url: `${import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000"}/api/v1/logs/stream`,
		capacity: MAX_LOGS,
		flushInterval: 100,
	});

	const parentRef = useRef<HTMLDivElement>(null);
	const isScrollingProgrammatically = useRef(false);

	const rowVirtualizer = useVirtualizer({
		count: logs.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => 36, // approximate height of a single log row
		overscan: 15,
	});

	const virtualRows = rowVirtualizer.getVirtualItems();
	const totalSize = rowVirtualizer.getTotalSize();

	// ── Scroll helpers ────────────────────────────────────────────────────────

	const scrollToBottom = useCallback(() => {
		if (logs.length === 0) return;
		isScrollingProgrammatically.current = true;
		rowVirtualizer.scrollToIndex(logs.length - 1, { behavior: "auto" });
		requestAnimationFrame(() => {
			isScrollingProgrammatically.current = false;
		});
	}, [rowVirtualizer, logs.length]);

	// Auto-scroll whenever the logs array grows while following
	useEffect(() => {
		if (isFollowing && logs.length > 0) scrollToBottom();
	}, [logs.length, isFollowing, scrollToBottom]);

	// Scroll detection — stops following when user scrolls up manually
	const handleScroll = useCallback(() => {
		if (isScrollingProgrammatically.current) return;
		if (!parentRef.current) return;

		const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
		const atBottom =
			scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD_PX;

		if (!atBottom && isFollowing) {
			setIsFollowing(false);
		} else if (atBottom && !isFollowing) {
			setIsFollowing(true);
		}
	}, [isFollowing, setIsFollowing]);

	// ── Go Live / Jump to bottom ──────────────────────────────────────────────

	const handleGoLive = useCallback(() => {
		if (isPaused) {
			resume();
		}
		setIsFollowing(true);
		requestAnimationFrame(() => scrollToBottom());
	}, [isPaused, resume, setIsFollowing, scrollToBottom]);

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
					<div className="flex items-center gap-4">
						<div className="text-xs text-muted-foreground font-mono">
							{metrics.receivedPerSecond} logs/sec
						</div>
						<div className="flex items-center gap-2">
							<span className="relative flex h-3 w-3">
								<span
									className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
										status === "connected" && !isPaused
											? "animate-ping bg-green-400"
											: "bg-muted-foreground"
									}`}
								/>
								<span
									className={`relative inline-flex h-3 w-3 rounded-full ${
										status === "connected" && !isPaused
											? "bg-green-500"
											: "bg-muted-foreground"
									}`}
								/>
							</span>
							<span>
								{isPaused ? "Paused" : status === "connected" ? "Live" : status}
							</span>
						</div>
						<Button
							variant="outline"
							size="sm"
							onClick={() => (isPaused ? resume() : pause())}
						>
							{isPaused ? "Resume" : "Pause"}
						</Button>
						<Button variant="outline" size="sm" onClick={clear}>
							Clear
						</Button>
					</div>
				</div>
			</header>

			{/* ── Log List area ──────────────────────────────────────────────────── */}
			<div className="relative flex-1 overflow-hidden p-4">
				<div
					ref={parentRef}
					onScroll={handleScroll}
					className="h-full w-full overflow-auto rounded-md border bg-card font-mono text-xs"
				>
					<div className="relative w-full" style={{ height: `${totalSize}px` }}>
						{virtualRows.map((virtualRow) => {
							const log = logs[virtualRow.index];
							if (!log) return null;

							const date = new Date(log.timestamp);
							const timeStr = date.toLocaleTimeString([], { hour12: false });
							const msStr = date.getMilliseconds().toString().padStart(3, "0");
							const level = log.level.toUpperCase().padEnd(5);
							const color = LEVEL_COLORS[log.level] ?? "text-muted-foreground";

							return (
								<pre
									key={virtualRow.index}
									data-index={virtualRow.index}
									ref={rowVirtualizer.measureElement}
									className={`absolute top-0 left-0 w-full px-4 py-0.5 leading-5 hover:bg-muted/40 ${color}`}
									style={{ transform: `translateY(${virtualRow.start}px)` }}
								>
									{`${timeStr}.${msStr} ${level} [${log.service}] ${log.message}`}
								</pre>
							);
						})}

						{logs.length === 0 && (
							<div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
								Waiting for logs…
							</div>
						)}
					</div>
				</div>

				{/* Floating action button */}
				{!isFollowing && (
					<div className="absolute bottom-8 left-1/2 z-20 -translate-x-1/2">
						<Button
							onClick={handleGoLive}
							className="animate-in fade-in slide-in-from-bottom-3 flex items-center gap-2 rounded-full px-5 shadow-xl"
						>
							<ArrowDownIcon className="h-4 w-4" />
							Jump to latest
						</Button>
					</div>
				)}
			</div>
		</main>
	);
}
