import type { IMUSample, IMUAxes } from '../types';

/**
 * High-performance circular buffer for streaming IMU data.
 *
 * Uses flat Float64Array storage for cache-friendly access.
 * Each sample occupies `stride` elements: [ax, ay, az, gx?, gy?, gz?, timestamp].
 */
export class CircularBuffer {
  private buffer: Float64Array;
  private head = 0;
  private _length = 0;
  private stride: number;
  readonly capacity: number;
  readonly axes: IMUAxes;

  constructor(capacity: number, axes: IMUAxes = 6) {
    this.capacity = capacity;
    this.axes = axes;
    // stride = axes + 1 (for timestamp)
    this.stride = axes + 1;
    this.buffer = new Float64Array(capacity * this.stride);
  }

  /** Number of samples currently in the buffer. */
  get length(): number {
    return this._length;
  }

  get isFull(): boolean {
    return this._length === this.capacity;
  }

  get isEmpty(): boolean {
    return this._length === 0;
  }

  /** Duration of buffered data in ms. */
  get duration(): number {
    if (this._length < 2) return 0;
    const first = this.get(0);
    const last = this.get(this._length - 1);
    return first && last ? last.timestamp - first.timestamp : 0;
  }

  /** Push a single IMU sample. O(1). */
  push(sample: IMUSample): void {
    const offset = this.head * this.stride;
    this.buffer[offset] = sample.ax;
    this.buffer[offset + 1] = sample.ay;
    this.buffer[offset + 2] = sample.az;
    if (this.axes === 6) {
      this.buffer[offset + 3] = sample.gx ?? 0;
      this.buffer[offset + 4] = sample.gy ?? 0;
      this.buffer[offset + 5] = sample.gz ?? 0;
    }
    this.buffer[offset + this.axes] = sample.timestamp;

    this.head = (this.head + 1) % this.capacity;
    if (this._length < this.capacity) this._length++;
  }

  /** Push multiple samples efficiently. */
  pushBatch(samples: IMUSample[]): void {
    for (const s of samples) this.push(s);
  }

  /** Get sample at logical index (0 = oldest). */
  get(index: number): IMUSample | null {
    if (index < 0 || index >= this._length) return null;
    const actualIndex = (this.head - this._length + index + this.capacity) % this.capacity;
    const offset = actualIndex * this.stride;

    const sample: IMUSample = {
      ax: this.buffer[offset]!,
      ay: this.buffer[offset + 1]!,
      az: this.buffer[offset + 2]!,
      timestamp: this.buffer[offset + this.axes]!,
    };

    if (this.axes === 6) {
      sample.gx = this.buffer[offset + 3]!;
      sample.gy = this.buffer[offset + 4]!;
      sample.gz = this.buffer[offset + 5]!;
    }

    return sample;
  }

  /** Get the most recent N samples as an array (newest last). */
  getLatest(count: number): IMUSample[] {
    const n = Math.min(count, this._length);
    const result: IMUSample[] = new Array(n);
    const startIndex = this._length - n;
    for (let i = 0; i < n; i++) {
      result[i] = this.get(startIndex + i)!;
    }
    return result;
  }

  /** Get all buffered samples as an array (oldest first). */
  toArray(): IMUSample[] {
    return this.getLatest(this._length);
  }

  /** Get samples within a time range. */
  getTimeRange(startMs: number, endMs: number): IMUSample[] {
    const result: IMUSample[] = [];
    for (let i = 0; i < this._length; i++) {
      const s = this.get(i)!;
      if (s.timestamp >= startMs && s.timestamp <= endMs) {
        result.push(s);
      }
    }
    return result;
  }

  /** Extract a flat Float32Array for a specific axis (for FFT, etc.). */
  extractAxis(axis: 'ax' | 'ay' | 'az' | 'gx' | 'gy' | 'gz', count?: number): Float32Array {
    const n = Math.min(count ?? this._length, this._length);
    const out = new Float32Array(n);
    const axisOffset = { ax: 0, ay: 1, az: 2, gx: 3, gy: 4, gz: 5 }[axis];
    const startIndex = this._length - n;

    for (let i = 0; i < n; i++) {
      const actualIndex = (this.head - this._length + startIndex + i + this.capacity) % this.capacity;
      out[i] = this.buffer[actualIndex * this.stride + axisOffset]!;
    }
    return out;
  }

  /** Extract acceleration magnitude series: sqrt(ax² + ay² + az²). */
  extractMagnitude(count?: number): Float32Array {
    const n = Math.min(count ?? this._length, this._length);
    const out = new Float32Array(n);
    const startIndex = this._length - n;

    for (let i = 0; i < n; i++) {
      const actualIndex = (this.head - this._length + startIndex + i + this.capacity) % this.capacity;
      const offset = actualIndex * this.stride;
      const ax = this.buffer[offset]!;
      const ay = this.buffer[offset + 1]!;
      const az = this.buffer[offset + 2]!;
      out[i] = Math.sqrt(ax * ax + ay * ay + az * az);
    }
    return out;
  }

  /** Clear all data. */
  clear(): void {
    this.head = 0;
    this._length = 0;
  }
}
