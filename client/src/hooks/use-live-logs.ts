import {
	type UseLogStreamOptions,
	useLogStream,
} from "@watchtower/client/hooks/use-log-stream";
import type { LogRecord } from "@watchtower/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RingBuffer } from "@/lib/ring-buffer";

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

	// The storage layer — owned entirely here so version increments
	// cause THIS component to re-render, not a child hook.
	const bufferRef = useRef(new RingBuffer<LogRecord>(capacity));
	const [version, setVersion] = useState(0);

	const pushMany = useCallback((items: LogRecord[]) => {
		if (items.length === 0) return;
		bufferRef.current.pushMany(items);
		setVersion((v) => v + 1);
	}, []);

	const toArray = useCallback(() => bufferRef.current.toArray(), []);

	const clear = useCallback(() => {
		bufferRef.current.clear();
		setVersion((v) => v + 1);
	}, []);

	// The orchestration layer (triggers renders for controls)
	const [isPaused, setIsPaused] = useState(false);
	const [isFollowing, setIsFollowing] = useState(true);

	// Ingestion flush cycle
	useEffect(() => {
		if (isPaused) return;

		const interval = setInterval(() => {
			const batch = consume();
			if (batch.length > 0) {
				pushMany(batch);
			}
		}, flushInterval);

		return () => clearInterval(interval);
	}, [consume, isPaused, flushInterval, pushMany]);

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

	// Only recompute the flat array snapshot when the version increments.
	const logs = useMemo(() => {
		void version; // read to track the dependency
		return toArray();
		// eslint-disable-next-line react-hooks/exhaustive-deps
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
