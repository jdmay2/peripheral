/**
 * Threshold-based classifier for simple gestures.
 *
 * Detects tap, double-tap, shake, and flick using peak detection
 * on acceleration magnitude. Requires no training — just configure
 * thresholds per gesture type.
 *
 * This is Tier 1: simplest approach, zero training needed.
 */

import type { IMUSample, ThresholdGestureDef, RecognitionResult } from '../types';

interface TapState {
  lastTapTime: number;
  tapCount: number;
}

interface ShakeState {
  crossingCount: number;
  windowStart: number;
  lastAbove: boolean;
}

export class ThresholdClassifier {
  private gestures = new Map<string, ThresholdGestureDef>();
  private tapStates = new Map<string, TapState>();
  private shakeStates = new Map<string, ShakeState>();
  private pendingDoubleTaps = new Map<string, ReturnType<typeof setTimeout>>();

  /** Register a threshold-based gesture. */
  register(gesture: ThresholdGestureDef): void {
    this.gestures.set(gesture.id, gesture);
    if (gesture.type === 'doubleTap') {
      this.tapStates.set(gesture.id, { lastTapTime: 0, tapCount: 0 });
    }
    if (gesture.type === 'shake') {
      this.shakeStates.set(gesture.id, {
        crossingCount: 0,
        windowStart: 0,
        lastAbove: false,
      });
    }
  }

  /** Remove a gesture. */
  unregister(id: string): void {
    this.gestures.delete(id);
    this.tapStates.delete(id);
    this.shakeStates.delete(id);
    const timer = this.pendingDoubleTaps.get(id);
    if (timer) clearTimeout(timer);
    this.pendingDoubleTaps.delete(id);
  }

  /**
   * Process a window of samples. Returns all detected gestures.
   *
   * Call this on each new sliding window. The classifier maintains
   * internal state for multi-event gestures (double-tap, shake).
   */
  classify(samples: IMUSample[]): RecognitionResult[] {
    const results: RecognitionResult[] = [];

    for (const [id, gesture] of this.gestures) {
      const result = this.detectGesture(gesture, samples);
      if (result) results.push(result);
    }

    return results;
  }

  /** Reset all internal state. */
  reset(): void {
    this.tapStates.forEach((s) => { s.lastTapTime = 0; s.tapCount = 0; });
    this.shakeStates.forEach((s) => { s.crossingCount = 0; s.windowStart = 0; s.lastAbove = false; });
    for (const timer of this.pendingDoubleTaps.values()) clearTimeout(timer);
    this.pendingDoubleTaps.clear();
  }

  // ─── Detection methods ──────────────────────────────────────────────────

  private detectGesture(
    gesture: ThresholdGestureDef,
    samples: IMUSample[],
  ): RecognitionResult | null {
    switch (gesture.type) {
      case 'tap':
        return this.detectTap(gesture, samples);
      case 'doubleTap':
        return this.detectDoubleTap(gesture, samples);
      case 'shake':
        return this.detectShake(gesture, samples);
      case 'flick':
        return this.detectFlick(gesture, samples);
      default:
        return null;
    }
  }

  private detectTap(
    gesture: ThresholdGestureDef,
    samples: IMUSample[],
  ): RecognitionResult | null {
    // Find a sharp acceleration spike followed by rapid decay
    for (let i = 1; i < samples.length - 1; i++) {
      const value = this.getAxisValue(samples[i]!, gesture.axis);
      const prev = this.getAxisValue(samples[i - 1]!, gesture.axis);
      const next = this.getAxisValue(samples[i + 1]!, gesture.axis);

      // Peak detection: value exceeds threshold AND is a local maximum
      if (value > gesture.threshold && value > prev && value > next) {
        // Verify it's a brief spike (not sustained motion)
        const peakDuration = this.measurePeakDuration(
          samples, i, gesture.threshold * 0.5, gesture.axis,
        );
        if (peakDuration < 200) { // < 200ms = tap-like
          return this.makeResult(gesture, 0.85 + Math.min(value / (gesture.threshold * 3), 0.15), samples[i]!.timestamp);
        }
      }
    }
    return null;
  }

  private detectDoubleTap(
    gesture: ThresholdGestureDef,
    samples: IMUSample[],
  ): RecognitionResult | null {
    const state = this.tapStates.get(gesture.id);
    if (!state) return null;

    const maxInterval = gesture.maxInterval ?? 400;

    for (let i = 1; i < samples.length - 1; i++) {
      const value = this.getAxisValue(samples[i]!, gesture.axis);
      const prev = this.getAxisValue(samples[i - 1]!, gesture.axis);
      const next = this.getAxisValue(samples[i + 1]!, gesture.axis);

      if (value > gesture.threshold && value > prev && value > next) {
        const peakDuration = this.measurePeakDuration(
          samples, i, gesture.threshold * 0.5, gesture.axis,
        );
        if (peakDuration > 200) continue;

        const now = samples[i]!.timestamp;
        if (state.tapCount === 0 || now - state.lastTapTime > maxInterval) {
          // First tap or reset
          state.tapCount = 1;
          state.lastTapTime = now;
        } else if (now - state.lastTapTime <= maxInterval) {
          // Second tap within interval
          state.tapCount = 0;
          state.lastTapTime = 0;
          return this.makeResult(gesture, 0.9, now);
        }
      }
    }
    return null;
  }

  private detectShake(
    gesture: ThresholdGestureDef,
    samples: IMUSample[],
  ): RecognitionResult | null {
    const state = this.shakeStates.get(gesture.id);
    if (!state) return null;

    const minCrossings = gesture.minCrossings ?? 6;
    const windowMs = 1000; // 1-second shake detection window

    for (const sample of samples) {
      const value = this.getAxisValue(sample, gesture.axis);
      const isAbove = value > gesture.threshold;

      // Reset window if too much time has passed
      if (state.windowStart > 0 && sample.timestamp - state.windowStart > windowMs) {
        state.crossingCount = 0;
        state.windowStart = 0;
      }

      // Count threshold crossings (direction changes)
      if (isAbove !== state.lastAbove) {
        if (state.crossingCount === 0) state.windowStart = sample.timestamp;
        state.crossingCount++;
        state.lastAbove = isAbove;

        if (state.crossingCount >= minCrossings) {
          const crossings = state.crossingCount;
          state.crossingCount = 0;
          state.windowStart = 0;
          const confidence = Math.min(0.7 + (crossings / (minCrossings * 2)) * 0.3, 1);
          return this.makeResult(gesture, confidence, sample.timestamp);
        }
      }
    }
    return null;
  }

  private detectFlick(
    gesture: ThresholdGestureDef,
    samples: IMUSample[],
  ): RecognitionResult | null {
    // Flick: rapid jerk (derivative of acceleration) spike
    for (let i = 1; i < samples.length; i++) {
      const curr = this.getAxisValue(samples[i]!, gesture.axis);
      const prev = this.getAxisValue(samples[i - 1]!, gesture.axis);
      const dt = (samples[i]!.timestamp - samples[i - 1]!.timestamp) / 1000;
      if (dt <= 0) continue;

      const jerk = Math.abs(curr - prev) / dt;
      if (jerk > gesture.threshold) {
        // Verify it's directional (not oscillation)
        const direction = curr - prev;
        let sustained = true;
        for (let j = i + 1; j < Math.min(i + 5, samples.length); j++) {
          const nextDir = this.getAxisValue(samples[j]!, gesture.axis) -
                          this.getAxisValue(samples[j - 1]!, gesture.axis);
          if (nextDir * direction < 0) { sustained = false; break; }
        }

        if (sustained) {
          const confidence = Math.min(0.7 + (jerk / (gesture.threshold * 3)) * 0.3, 1);
          return this.makeResult(gesture, confidence, samples[i]!.timestamp);
        }
      }
    }
    return null;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private getAxisValue(sample: IMUSample, axis?: string): number {
    switch (axis) {
      case 'x': return Math.abs(sample.ax);
      case 'y': return Math.abs(sample.ay);
      case 'z': return Math.abs(sample.az);
      default: return Math.sqrt(sample.ax ** 2 + sample.ay ** 2 + sample.az ** 2);
    }
  }

  private measurePeakDuration(
    samples: IMUSample[], peakIndex: number, halfThreshold: number, axis?: string,
  ): number {
    let start = peakIndex;
    let end = peakIndex;
    while (start > 0 && this.getAxisValue(samples[start - 1]!, axis) > halfThreshold) start--;
    while (end < samples.length - 1 && this.getAxisValue(samples[end + 1]!, axis) > halfThreshold) end++;
    return samples[end]!.timestamp - samples[start]!.timestamp;
  }

  private makeResult(
    gesture: ThresholdGestureDef, confidence: number, timestamp: number,
  ): RecognitionResult {
    return {
      gestureId: gesture.id,
      gestureName: gesture.name,
      confidence: Math.min(confidence, 1),
      classifierType: 'threshold',
      rawScore: confidence,
      timestamp,
      windowDuration: 0,
      accepted: true,
      alternatives: [],
    };
  }
}
