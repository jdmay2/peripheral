import type { ReconnectionConfig } from '../types/ble';

const DEFAULT_CONFIG: Required<ReconnectionConfig> = {
  maxAttempts: 5,
  baseDelay: 1000,
  maxDelay: 30000,
  multiplier: 2.0,
  jitter: true,
};

export type ReconnectAttemptCallback = (attempt: number, delay: number) => void;
export type ReconnectSuccessCallback = () => void;
export type ReconnectFailureCallback = (error: unknown) => void;
export type ReconnectGiveUpCallback = (attempts: number) => void;

export class ReconnectionManager {
  private config: Required<ReconnectionConfig>;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private active = false;

  /** Called before each reconnection attempt */
  onAttempt?: ReconnectAttemptCallback;
  /** Called when reconnection succeeds */
  onSuccess?: ReconnectSuccessCallback;
  /** Called when an individual attempt fails */
  onFailure?: ReconnectFailureCallback;
  /** Called when all attempts are exhausted */
  onGiveUp?: ReconnectGiveUpCallback;

  constructor(config?: ReconnectionConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the reconnection loop.
   * @param connectFn Async function that attempts to reconnect. Should throw on failure.
   */
  async start(connectFn: () => Promise<void>): Promise<void> {
    if (this.active) return;
    this.active = true;
    this.attempt = 0;

    while (this.active && this.attempt < this.config.maxAttempts) {
      this.attempt++;
      const delay = this.calculateDelay(this.attempt);

      this.onAttempt?.(this.attempt, delay);

      // Wait for the backoff delay
      await this.sleep(delay);

      if (!this.active) break;

      try {
        await connectFn();
        // Success!
        this.active = false;
        this.onSuccess?.();
        return;
      } catch (error) {
        this.onFailure?.(error);
      }
    }

    // All attempts exhausted
    if (this.active) {
      this.active = false;
      this.onGiveUp?.(this.attempt);
    }
  }

  /** Cancel any active reconnection loop */
  cancel(): void {
    this.active = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Whether reconnection is currently in progress */
  get isReconnecting(): boolean {
    return this.active;
  }

  /** Current attempt number (0 if not reconnecting) */
  get currentAttempt(): number {
    return this.active ? this.attempt : 0;
  }

  /** Reset attempt counter (e.g., after a successful manual reconnection) */
  reset(): void {
    this.cancel();
    this.attempt = 0;
  }

  /** Update config at runtime */
  updateConfig(config: Partial<ReconnectionConfig>): void {
    Object.assign(this.config, config);
  }

  private calculateDelay(attempt: number): number {
    // Exponential backoff: baseDelay * multiplier^(attempt-1)
    let delay =
      this.config.baseDelay *
      Math.pow(this.config.multiplier, attempt - 1);

    // Cap at maxDelay
    delay = Math.min(delay, this.config.maxDelay);

    // Add jitter (±25% of delay)
    if (this.config.jitter) {
      const jitterRange = delay * 0.25;
      delay += (Math.random() - 0.5) * 2 * jitterRange;
    }

    return Math.round(Math.max(0, delay));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.timer = setTimeout(resolve, ms);
    });
  }
}
