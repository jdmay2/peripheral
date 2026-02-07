/**
 * Sliding window segmenter with gesture onset detection.
 *
 * Processes streaming IMU data into fixed-duration overlapping windows,
 * detects gesture candidates using Signal Magnitude Area (SMA) thresholds
 * and jerk-based onset detection, and classifies the current activity level
 * to gate recognition during high-activity periods.
 *
 * Based on UCI HAR standard: 2.56s window / 128 samples at 50 Hz.
 * Magic Ring paper recommends average jerk for ring form factors.
 */

import type {
  IMUSample,
  IMUWindow,
  IMUAxes,
  ActivityLevel,
  ActivityContext,
} from '../types';

// ─── Configuration ───────────────────────────────────────────────────────────

export interface SegmenterConfig {
  /** Expected sample rate (Hz). Default: 50. */
  sampleRate: number;
  /** Number of axes. Default: 6. */
  axes: IMUAxes;
  /** Window duration in seconds. Default: 1.5. */
  windowDuration: number;
  /** Window overlap ratio 0.0–1.0. Default: 0.5. */
  windowOverlap: number;
  /** Minimum gesture duration in seconds. Default: 0.3. */
  minGestureDuration: number;
  /** Maximum gesture duration in seconds. Default: 3.0. */
  maxGestureDuration: number;
  /** SMA threshold multiplier above baseline. Default: 2.5. */
  smaThresholdMultiplier: number;
  /** Minimum peak acceleration to trigger. Default: 1.5. */
  minPeakAcceleration: number;
  /** Context window duration for activity classification (seconds). Default: 2.0. */
  contextWindowDuration: number;
}

const DEFAULT_SEGMENTER_CONFIG: SegmenterConfig = {
  sampleRate: 50,
  axes: 6,
  windowDuration: 1.5,
  windowOverlap: 0.5,
  minGestureDuration: 0.3,
  maxGestureDuration: 3.0,
  smaThresholdMultiplier: 2.5,
  minPeakAcceleration: 1.5,
  contextWindowDuration: 2.0,
};

// ─── Segmenter ──────────────────────────────────────────────────────────────

export class Segmenter {
  private config: SegmenterConfig;
  private sampleBuffer: IMUSample[] = [];
  private windowSamples: number; // samples per window
  private stepSamples: number; // samples per step (overlap)
  private samplesSinceLastWindow = 0;

  // Baseline SMA tracking (running average)
  private baselineSMA = 0;
  private baselineSMACount = 0;
  private readonly baselineDecay = 0.995; // slow exponential decay

  // Activity context
  private contextBuffer: IMUSample[] = [];
  private contextSamples: number;

  constructor(config?: Partial<SegmenterConfig>) {
    this.config = { ...DEFAULT_SEGMENTER_CONFIG, ...config };
    this.windowSamples = Math.round(
      this.config.sampleRate * this.config.windowDuration,
    );
    this.stepSamples = Math.round(
      this.windowSamples * (1 - this.config.windowOverlap),
    );
    this.contextSamples = Math.round(
      this.config.sampleRate * this.config.contextWindowDuration,
    );
  }

  /**
   * Feed one or more samples into the segmenter.
   *
   * Returns any complete windows that are ready for classification,
   * along with whether each window is a gesture candidate.
   */
  feed(samples: IMUSample[]): SegmenterOutput[] {
    const outputs: SegmenterOutput[] = [];

    for (const sample of samples) {
      this.sampleBuffer.push(sample);
      this.contextBuffer.push(sample);
      this.samplesSinceLastWindow++;

      // Update baseline SMA (exponential moving average)
      const sma =
        Math.abs(sample.ax) + Math.abs(sample.ay) + Math.abs(sample.az);
      if (this.baselineSMACount === 0) {
        this.baselineSMA = sma;
      } else {
        this.baselineSMA =
          this.baselineDecay * this.baselineSMA +
          (1 - this.baselineDecay) * sma;
      }
      this.baselineSMACount++;

      // Trim context buffer
      if (this.contextBuffer.length > this.contextSamples) {
        this.contextBuffer.shift();
      }

      // Check if we have enough for a window step
      if (
        this.samplesSinceLastWindow >= this.stepSamples &&
        this.sampleBuffer.length >= this.windowSamples
      ) {
        const windowSamples = this.sampleBuffer.slice(
          this.sampleBuffer.length - this.windowSamples,
        );

        const window: IMUWindow = {
          samples: windowSamples,
          startTime: windowSamples[0]!.timestamp,
          endTime: windowSamples[windowSamples.length - 1]!.timestamp,
          sampleRate: this.config.sampleRate,
          axes: this.config.axes,
        };

        const isCandidate = this.isGestureCandidate(windowSamples);
        const activity = this.classifyActivity();

        outputs.push({ window, isCandidate, activity });

        this.samplesSinceLastWindow = 0;
      }

      // Trim sample buffer (keep enough for next window)
      const maxBufferSize = this.windowSamples + this.stepSamples;
      if (this.sampleBuffer.length > maxBufferSize) {
        this.sampleBuffer = this.sampleBuffer.slice(
          this.sampleBuffer.length - maxBufferSize,
        );
      }
    }

    return outputs;
  }

  /** Reset segmenter state. */
  reset(): void {
    this.sampleBuffer = [];
    this.contextBuffer = [];
    this.samplesSinceLastWindow = 0;
    this.baselineSMA = 0;
    this.baselineSMACount = 0;
  }

  /** Get current activity context. */
  getActivity(): ActivityContext {
    return this.classifyActivity();
  }

  /** Get current baseline SMA value. */
  getBaselineSMA(): number {
    return this.baselineSMA;
  }

  // ─── Gesture candidate detection ────────────────────────────────────────

  private isGestureCandidate(samples: IMUSample[]): boolean {
    // Check 1: SMA exceeds baseline by threshold
    let windowSMA = 0;
    let maxAccel = 0;

    for (const s of samples) {
      const sma = Math.abs(s.ax) + Math.abs(s.ay) + Math.abs(s.az);
      windowSMA += sma;
      const mag = Math.sqrt(s.ax * s.ax + s.ay * s.ay + s.az * s.az);
      if (mag > maxAccel) maxAccel = mag;
    }
    windowSMA /= samples.length;

    const smaThreshold =
      this.baselineSMA * this.config.smaThresholdMultiplier;
    const smaExceeded = windowSMA > smaThreshold;

    // Check 2: Minimum peak acceleration
    const peakExceeded = maxAccel >= this.config.minPeakAcceleration;

    // Check 3: Duration bounds (check if active portion falls within bounds)
    if (smaExceeded && peakExceeded) {
      const activeDuration = this.measureActiveDuration(
        samples,
        smaThreshold * 0.5,
      );
      const minMs = this.config.minGestureDuration * 1000;
      const maxMs = this.config.maxGestureDuration * 1000;
      if (activeDuration >= minMs && activeDuration <= maxMs) {
        return true;
      }
    }

    return false;
  }

  private measureActiveDuration(
    samples: IMUSample[],
    threshold: number,
  ): number {
    let firstActive = -1;
    let lastActive = -1;

    for (let i = 0; i < samples.length; i++) {
      const sma =
        Math.abs(samples[i]!.ax) +
        Math.abs(samples[i]!.ay) +
        Math.abs(samples[i]!.az);
      if (sma > threshold) {
        if (firstActive === -1) firstActive = i;
        lastActive = i;
      }
    }

    if (firstActive === -1 || lastActive === -1) return 0;
    return samples[lastActive]!.timestamp - samples[firstActive]!.timestamp;
  }

  // ─── Activity classification ────────────────────────────────────────────

  /**
   * Classify current activity level from accelerometer magnitude variance.
   *
   * Variance thresholds (from research doc):
   * - < 0.1 = stationary
   * - 0.1–2.0 = low activity
   * - 2.0–8.0 = moderate activity
   * - >= 8.0 = high activity
   */
  private classifyActivity(): ActivityContext {
    if (this.contextBuffer.length < 10) {
      return { level: 'stationary', variance: 0, timestamp: Date.now() };
    }

    // Compute magnitude variance
    let magSum = 0;
    const magnitudes: number[] = [];

    for (const s of this.contextBuffer) {
      const mag = Math.sqrt(s.ax * s.ax + s.ay * s.ay + s.az * s.az);
      magnitudes.push(mag);
      magSum += mag;
    }

    const mean = magSum / magnitudes.length;
    let varSum = 0;
    for (const m of magnitudes) {
      const d = m - mean;
      varSum += d * d;
    }
    const variance = varSum / magnitudes.length;

    let level: ActivityLevel;
    if (variance < 0.1) level = 'stationary';
    else if (variance < 2.0) level = 'low';
    else if (variance < 8.0) level = 'moderate';
    else level = 'high';

    return {
      level,
      variance,
      timestamp:
        this.contextBuffer[this.contextBuffer.length - 1]?.timestamp ??
        Date.now(),
    };
  }
}

// ─── Output type ─────────────────────────────────────────────────────────────

export interface SegmenterOutput {
  /** The extracted window. */
  window: IMUWindow;
  /** Whether this window passes pre-filter checks as a gesture candidate. */
  isCandidate: boolean;
  /** Current activity context. */
  activity: ActivityContext;
}
