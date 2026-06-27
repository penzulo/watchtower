export class RingBuffer<T> {
	private buffer: T[];
	private head: number = 0;
	private tail: number = 0;
	private _size: number = 0;
	private _capacity: number;

	constructor(capacity: number) {
		this._capacity = capacity;
		this.buffer = new Array(capacity);
	}

	push(item: T) {
		this.buffer[this.tail] = item;
		this.tail = (this.tail + 1) % this._capacity;
		if (this._size < this._capacity) {
			this._size++;
		} else {
			this.head = (this.head + 1) % this._capacity;
		}
	}

	pushMany(items: T[]) {
		if (items.length === 0) return;

		// If the items array is larger than our capacity, we only need the last `capacity` items
		const toPush =
			items.length > this._capacity ? items.slice(-this._capacity) : items;

		for (let i = 0; i < toPush.length; i++) {
			this.push(toPush[i]);
		}
	}

	toArray(): T[] {
		if (this._size === 0) return [];
		if (this.head < this.tail) {
			return this.buffer.slice(this.head, this.tail);
		}

		const result = new Array(this._size);
		let count = 0;
		for (let i = this.head; i < this._capacity; i++) {
			result[count++] = this.buffer[i];
		}
		for (let i = 0; i < this.tail; i++) {
			result[count++] = this.buffer[i];
		}
		return result;
	}

	clear() {
		this.head = 0;
		this.tail = 0;
		this._size = 0;
		this.buffer = new Array(this._capacity); // Allow GC of old objects
	}

	get size() {
		return this._size;
	}

	get capacity() {
		return this._capacity;
	}
}
