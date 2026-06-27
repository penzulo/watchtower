import type { LogRecord } from "@watchtower/shared";
import { useCallback, useEffect, useRef, useState } from "react";

export type StreamStatus =
	| "connecting"
	| "connected"
	| "disconnected"
	| "error";

export interface StreamMetrics {
	received: number;
	receivedPerSecond: number;
	reconnects: number;
	queueSize: number;
}

export interface UseLogStreamOptions {
	url: string;
	withCredentials?: boolean;
}

export interface UseLogStreamReturn {
	status: StreamStatus;
	metrics: StreamMetrics;
	consume: () => LogRecord[];
	reconnect: () => void;
	disconnect: () => void;
}

export function useLogStream({
	url,
	withCredentials = true,
}: UseLogStreamOptions): UseLogStreamReturn {
	const [status, setStatus] = useState<StreamStatus>("disconnected");
	const [metrics, setMetrics] = useState<StreamMetrics>({
		received: 0,
		receivedPerSecond: 0,
		reconnects: 0,
		queueSize: 0,
	});

	const eventSourceRef = useRef<EventSource | null>(null);
	const incomingQueueRef = useRef<LogRecord[]>([]);

	// Internal stats refs to prevent re-renders when calculating rates
	const totalReceivedRef = useRef(0);
	const reconnectsRef = useRef(0);
	const lastCalcTimeRef = useRef(Date.now());
	const lastCalcTotalRef = useRef(0);

	const disconnect = useCallback(() => {
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
			eventSourceRef.current = null;
			setStatus("disconnected");
		}
	}, []);

	const connect = useCallback(() => {
		disconnect();
		setStatus("connecting");

		const es = new EventSource(url, { withCredentials });
		eventSourceRef.current = es;

		es.onopen = () => {
			setStatus("connected");
		};

		es.onerror = () => {
			// EventSource will automatically try to reconnect unless closed
			if (es.readyState === EventSource.CLOSED) {
				setStatus("disconnected");
			} else {
				setStatus("error");
			}
		};

		es.onmessage = (event) => {
			try {
				const log = JSON.parse(event.data) as LogRecord;
				incomingQueueRef.current.push(log);
				totalReceivedRef.current += 1;
			} catch {
				// Ignore malformed JSON to prevent crashing the UI
				console.warn("Received malformed log message:", event.data);
			}
		};
	}, [url, withCredentials, disconnect]);

	const reconnect = useCallback(() => {
		reconnectsRef.current += 1;
		connect();
	}, [connect]);

	// Initialize connection on mount
	useEffect(() => {
		connect();
		return () => {
			disconnect();
		};
	}, [connect, disconnect]);

	// Periodically update metrics
	useEffect(() => {
		const interval = setInterval(() => {
			const now = Date.now();
			const timeDiff = (now - lastCalcTimeRef.current) / 1000;
			const receivedDiff = totalReceivedRef.current - lastCalcTotalRef.current;

			const rps = timeDiff > 0 ? Math.round(receivedDiff / timeDiff) : 0;

			setMetrics({
				received: totalReceivedRef.current,
				receivedPerSecond: rps,
				reconnects: reconnectsRef.current,
				queueSize: incomingQueueRef.current.length,
			});

			lastCalcTimeRef.current = now;
			lastCalcTotalRef.current = totalReceivedRef.current;
		}, 1000);

		return () => clearInterval(interval);
	}, []);

	const consume = useCallback(() => {
		const batch = incomingQueueRef.current;
		incomingQueueRef.current = [];
		return batch;
	}, []);

	return {
		status,
		metrics,
		consume,
		reconnect,
		disconnect,
	};
}
