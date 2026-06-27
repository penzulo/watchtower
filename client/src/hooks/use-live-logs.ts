import {
	type UseLogStreamOptions,
	useLogStream,
} from "@watchtower/client/hooks/use-log-stream";
import type { LogRecord } from "@watchtower/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRingBuffer } from "@/hooks/use-ring-buffer";

export interface UseLiveLogsOptions extends UseLogStreamOptions {
	/** Maximum number of logs to keep in memory */
	capacity?: number;
	/** How often (in ms) to flush the stream queue into the ring buffer */
	flushInterval?: number;
}

export function useLiveLogs({
	url,
	withCredentials = true,
	capacity = 10000,
	flushInterval = 100,
}: UseLiveLogsOptions) {
	// The transport layer
	const { status, metrics, consume, reconnect, disconnect } = useLogStream({
		url,
		withCredentials,
	});

	// The storage layer
	const { pushMany, toArray, clear, version } =
		useRingBuffer<LogRecord>(capacity);

	// The orchestration layer (triggers renders for controls)
	const [isPaused, setIsPaused] = useState(false);
	const [isFollowing, setIsFollowing] = useState(true);

	// Ingestion flush cycle
	useEffect(() => {
		if (isPaused || status !== "connected") {
			return;
		}

		const interval = setInterval(() => {
			const batch = consume();
			if (batch.length > 0) {
				pushMany(batch);
			}
		}, flushInterval);

		return () => clearInterval(interval);
	}, [consume, isPaused, flushInterval, status, pushMany]);

	// Controls
	const pause = useCallback(() => {
		setIsPaused(true);
		// Disconnect from the SSE stream so we don't buffer infinitely in memory
		// and save network overhead when the user isn't watching
		disconnect();
	}, [disconnect]);

	const resume = useCallback(() => {
		setIsPaused(false);
		if (status === "disconnected" || status === "error") {
			reconnect();
		}
	}, [reconnect, status]);

	const togglePause = useCallback(() => {
		if (isPaused) {
			resume();
		} else {
			pause();
		}
	}, [isPaused, pause, resume]);

	// Extracting values from the ring buffer is expensive if done on every render.
	// Only compute the flat array when the version increments.
	// biome-ignore lint/correctness/useExhaustiveDependencies: Version change triggers recomputation
	const logs = useMemo(() => {
		return toArray();
	}, [version, toArray]);

	return {
		// Data
		logs,
		status,
		metrics,

		// State
		isPaused,
		isFollowing,

		// Actions
		pause,
		resume,
		togglePause,
		setIsFollowing,
		clear,
		reconnect,
	};
}
