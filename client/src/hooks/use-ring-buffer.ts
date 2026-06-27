import { RingBuffer } from "@watchtower/client/lib/ring-buffer";
import { useCallback, useRef, useState } from "react";

export interface UseRingBufferReturn<T> {
	push: (item: T) => void;
	pushMany: (item: T[]) => void;
	toArray: () => T[];
	clear: () => void;
	version: number;
}

export function useRingBuffer<T>(capacity: number): UseRingBufferReturn<T> {
	const bufferRef = useRef(new RingBuffer<T>(capacity));
	const [version, setVersion] = useState(0);

	const push = useCallback((item: T) => {
		bufferRef.current.push(item);
		setVersion((v) => v + 1);
	}, []);

	const pushMany = useCallback((items: T[]) => {
		if (items.length === 0) return;
		bufferRef.current.pushMany(items);
		setVersion((v) => v + 1);
	}, []);

	const clear = useCallback(() => {
		bufferRef.current.clear();
		setVersion((v) => v + 1);
	}, []);

	const toArray = useCallback(() => bufferRef.current.toArray(), []);

	return { push, pushMany, toArray, clear, version };
}
