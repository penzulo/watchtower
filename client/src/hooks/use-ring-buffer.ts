import { useCallback, useRef, useState } from "react";

export interface UseRingBufferReturn<T> {
	push: (item: T) => void;
	pushMany: (item: T[]) => void;
	toArray: () => void;
	version: number;
}

export class RingBuffer<T> {
	private readonly buffer: (T | undefined)[];
	private readonly capacity: number;
	private head = 0;
	private count = 0;

	constructor(capacity: number) {
		if (capacity < 0) {
			throw new Error("RingBuffer capacity must be positive");
		}
		this.capacity = capacity;
		this.buffer = new Array(capacity);
	}

	push(item: T): void {
		const writeIndex = (this.head + this.count) % this.capacity;
		this.buffer[writeIndex] = item;

		if (this.count < this.capacity) {
			this.count += 1;
		} else {
			this.head = (this.head + 1) % this.capacity;
		}
	}

	pushMany(items: T[]): void {
		for (const item of items) {
			this.push(item);
		}
	}

	get size(): number {
		return this.count;
	}

	get isFull(): boolean {
		return this.count === this.capacity;
	}

	toArray(): T[] {
		const result: T[] = new Array(this.count);
		for (let i = 0; i < this.count; i++) {
			result[i] = this.buffer[(this.head + i) % this.capacity] as T;
		}
		return result;
	}

	clear(): void {
		this.head = 0;
		this.count = 0;
		this.buffer.fill(undefined);
	}
}

export function useRingBuffer<T>(capacity: number): UseRingBufferReturn<T> {
	const bufferRef = useRef(new RingBuffer<T>(capacity));
	const [version, setVersion] = useState(0);

	const push = useCallback((item: T) => {
		bufferRef.current.push(item);
		setVersion((v) => v + 1);
	}, []);

	const pushMany = useCallback((items: T[]) => {
		bufferRef.current.pushMany(items);
		setVersion((v) => v + 1);
	}, []);

	const toArray = useCallback(() => bufferRef.current.toArray(), []);

	return { push, pushMany, toArray, version };
}
