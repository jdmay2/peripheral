/**
 * Serialized command queue for BLE operations.
 *
 * Android's BLE stack throws GATT Error 133 when concurrent operations
 * are attempted. This queue ensures only one BLE operation runs at a time.
 */

type QueuedOperation<T> = {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  label?: string;
  timeout: number;
};

export class CommandQueue {
  private queue: QueuedOperation<unknown>[] = [];
  private running = false;
  private defaultTimeout: number;

  constructor(defaultTimeoutMs = 10000) {
    this.defaultTimeout = defaultTimeoutMs;
  }

  /**
   * Enqueue a BLE operation. Returns a promise that resolves when the
   * operation completes (after all prior operations finish).
   */
  enqueue<T>(
    operation: () => Promise<T>,
    options?: { label?: string; timeout?: number }
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        execute: operation as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
        label: options?.label,
        timeout: options?.timeout ?? this.defaultTimeout,
      });
      this.processNext();
    });
  }

  /** Number of operations waiting in the queue */
  get pending(): number {
    return this.queue.length;
  }

  /** Whether an operation is currently executing */
  get isProcessing(): boolean {
    return this.running;
  }

  /** Clear all pending operations (rejects them) */
  clear(): void {
    const pending = this.queue.splice(0);
    for (const op of pending) {
      op.reject(new Error('BLE command queue cleared'));
    }
  }

  private async processNext(): Promise<void> {
    if (this.running || this.queue.length === 0) return;

    this.running = true;
    const operation = this.queue.shift()!;

    try {
      const result = await Promise.race([
        operation.execute(),
        this.createTimeout(operation.timeout, operation.label),
      ]);
      operation.resolve(result);
    } catch (error) {
      operation.reject(error);
    } finally {
      this.running = false;
      // Process next in microtask to prevent stack overflow
      queueMicrotask(() => this.processNext());
    }
  }

  private createTimeout(ms: number, label?: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `BLE operation timed out after ${ms}ms${label ? ` (${label})` : ''}`
          )
        );
      }, ms);
    });
  }
}
