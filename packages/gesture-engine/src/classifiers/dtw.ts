/**
 * Dynamic Time Warping (DTW) classifier for gesture recognition.
 *
 * Tier 2: Works with 5–20 recorded templates per gesture class.
 * No training phase — just template storage and comparison.
 *
 * Key features:
 * - Sakoe-Chiba band constraint for O(N×W) instead of O(N²)
 * - Rotation-invariant mode using acceleration magnitude series
 *   (handles ring rotation around the finger)
 * - Multi-template voting: compares against all templates, picks
 *   best match with confidence derived from distance margin
 * - Explicit noise-class rejection when best distance exceeds threshold
 *
 * Research: Xu et al. (2012) achieved 93%+ accuracy on 7+ gesture types
 * with accelerometer-only DTW. Hein et al. (2021) found smart rings achieve
 * 98.8% accuracy on 12 gesture classes with SVM/Random Forest.
 */

import type {
  IMUSample,
  IMUWindow,
  GestureClass,
  GestureTemplate,
  RecognitionResult,
} from '../types';

// ─── DTW configuration ──────────────────────────────────────────────────────

export interface DTWConfig {
  /** Sakoe-Chiba band width as fraction of sequence length. Default: 0.1. */
  bandWidth: number;
  /** Use rotation-invariant magnitude series. Default: true. */
  rotationInvariant: boolean;
  /** Maximum DTW distance to accept a match (auto-calibrated if null). */
  maxDistance: number | null;
  /** Number of axes to use for multi-dim DTW when not rotation-invariant. */
  axes: number;
}

const DEFAULT_DTW_CONFIG: DTWConfig = {
  bandWidth: 0.1,
  rotationInvariant: true,
  maxDistance: null,
  axes: 3,
};

// ─── DTW Classifier ──────────────────────────────────────────────────────────

export class DTWClassifier {
  private config: DTWConfig;
  private classes = new Map<string, GestureClass>();

  constructor(config?: Partial<DTWConfig>) {
    this.config = { ...DEFAULT_DTW_CONFIG, ...config };
  }

  /** Register a gesture class with its templates. */
  setClass(gestureClass: GestureClass): void {
    // Pre-compute magnitude series for each template
    for (const template of gestureClass.templates) {
      if (!template.magnitudeSeries) {
        template.magnitudeSeries = this.computeMagnitudeSeries(template.samples);
      }
    }
    this.classes.set(gestureClass.definition.id, gestureClass);
  }

  /** Remove a gesture class. */
  removeClass(gestureId: string): void {
    this.classes.delete(gestureId);
  }

  /** Get all registered classes. */
  getClasses(): Map<string, GestureClass> {
    return new Map(this.classes);
  }

  /** Add a single template to an existing class. */
  addTemplate(gestureId: string, template: GestureTemplate): void {
    const cls = this.classes.get(gestureId);
    if (!cls) throw new Error(`Gesture class "${gestureId}" not found`);
    if (!template.magnitudeSeries) {
      template.magnitudeSeries = this.computeMagnitudeSeries(template.samples);
    }
    cls.templates.push(template);
    cls.isReady = cls.templates.length >= cls.minTemplates;
  }

  /** Delete a specific template by index from a gesture class. */
  deleteTemplate(gestureId: string, index: number): void {
    const cls = this.classes.get(gestureId);
    if (!cls) throw new Error(`Gesture class "${gestureId}" not found`);
    if (index < 0 || index >= cls.templates.length) {
      throw new Error(`Template index ${index} out of range (0–${cls.templates.length - 1})`);
    }
    cls.templates.splice(index, 1);
    cls.isReady = cls.templates.length >= cls.minTemplates;
  }

  /** Get all templates for a gesture class. */
  getTemplates(gestureId: string): GestureTemplate[] {
    const cls = this.classes.get(gestureId);
    if (!cls) return [];
    return [...cls.templates];
  }

  /** Get the number of templates for a gesture class. */
  getTemplateCount(gestureId: string): number {
    return this.classes.get(gestureId)?.templates.length ?? 0;
  }

  /** Remove all templates for a gesture class without unregistering it. */
  clearGesture(gestureId: string): void {
    const cls = this.classes.get(gestureId);
    if (!cls) return;
    cls.templates = [];
    cls.isReady = false;
  }

  /**
   * Classify a candidate window against all registered gesture classes.
   *
   * Returns the best match with confidence derived from the distance
   * margin between the best and second-best matches.
   */
  classify(window: IMUWindow): RecognitionResult {
    const now = window.endTime;

    if (this.classes.size === 0) {
      return this.makeRejection('no_matching_gesture', now, window);
    }

    // Extract candidate series
    const candidateSeries = this.config.rotationInvariant
      ? this.computeMagnitudeSeries(window.samples)
      : this.computeMultiAxisSeries(window.samples);

    // Compare against all templates in all classes
    const classDistances: Array<{
      gestureId: string;
      gestureName: string;
      bestDistance: number;
      meanDistance: number;
    }> = [];

    for (const [gestureId, cls] of this.classes) {
      if (!cls.isReady) continue;

      let bestDist = Infinity;
      let totalDist = 0;
      let count = 0;

      for (const template of cls.templates) {
        const templateSeries = this.config.rotationInvariant
          ? (template.magnitudeSeries ?? this.computeMagnitudeSeries(template.samples))
          : this.computeMultiAxisSeries(template.samples);

        const dist = this.config.rotationInvariant
          ? this.dtwDistance1D(candidateSeries as number[], templateSeries as number[])
          : this.dtwDistanceND(
              candidateSeries as number[][],
              templateSeries as number[][],
            );

        if (dist < bestDist) bestDist = dist;
        totalDist += dist;
        count++;
      }

      classDistances.push({
        gestureId,
        gestureName: cls.definition.name,
        bestDistance: bestDist,
        meanDistance: count > 0 ? totalDist / count : Infinity,
      });
    }

    if (classDistances.length === 0) {
      return this.makeRejection('no_matching_gesture', now, window);
    }

    // Sort by best distance (ascending)
    classDistances.sort((a, b) => a.bestDistance - b.bestDistance);

    const best = classDistances[0]!;
    const secondBest = classDistances.length > 1 ? classDistances[1] : null;

    // Check against max distance threshold
    if (this.config.maxDistance !== null && best.bestDistance > this.config.maxDistance) {
      return this.makeRejection('no_matching_gesture', now, window, classDistances);
    }

    // Compute confidence from distance margin
    const confidence = this.computeConfidence(
      best.bestDistance,
      secondBest?.bestDistance ?? best.bestDistance * 3,
    );

    return {
      gestureId: best.gestureId,
      gestureName: best.gestureName,
      confidence,
      classifierType: 'dtw',
      rawScore: best.bestDistance,
      timestamp: now,
      windowDuration: window.endTime - window.startTime,
      accepted: true, // FP mitigation handles rejection separately
      alternatives: classDistances.slice(1, 4).map((c) => ({
        gestureId: c.gestureId,
        confidence: this.computeConfidence(c.bestDistance, best.bestDistance),
        rawScore: c.bestDistance,
      })),
    };
  }

  /**
   * Compute consistency score between templates (for recording quality).
   * Returns 0.0–1.0 where 1.0 means templates are identical.
   */
  computeConsistency(templates: GestureTemplate[]): number {
    if (templates.length < 2) return 1;

    const series = templates.map((t) =>
      t.magnitudeSeries ?? this.computeMagnitudeSeries(t.samples),
    );

    let totalDist = 0;
    let pairs = 0;

    for (let i = 0; i < series.length; i++) {
      for (let j = i + 1; j < series.length; j++) {
        totalDist += this.dtwDistance1D(series[i]!, series[j]!);
        pairs++;
      }
    }

    const avgDist = pairs > 0 ? totalDist / pairs : 0;
    // Convert distance to 0–1 score. Sigmoid-like mapping.
    return 1 / (1 + avgDist / 10);
  }

  /**
   * Auto-calibrate maxDistance from registered templates.
   * Sets threshold at 2× the mean intra-class distance.
   */
  calibrateMaxDistance(): number {
    let totalIntraDist = 0;
    let pairs = 0;

    for (const cls of this.classes.values()) {
      if (cls.templates.length < 2) continue;
      const series = cls.templates.map((t) =>
        t.magnitudeSeries ?? this.computeMagnitudeSeries(t.samples),
      );
      for (let i = 0; i < series.length; i++) {
        for (let j = i + 1; j < series.length; j++) {
          totalIntraDist += this.dtwDistance1D(series[i]!, series[j]!);
          pairs++;
        }
      }
    }

    const threshold = pairs > 0 ? (totalIntraDist / pairs) * 2 : 50;
    this.config.maxDistance = threshold;
    return threshold;
  }

  // ─── Core DTW algorithms ────────────────────────────────────────────────

  /**
   * 1D DTW with Sakoe-Chiba band constraint.
   * Time complexity: O(N × W) where W = band width.
   */
  private dtwDistance1D(a: number[], b: number[]): number {
    const n = a.length;
    const m = b.length;
    const w = Math.max(1, Math.ceil(Math.max(n, m) * this.config.bandWidth));

    // Use flat array for cache-friendly access
    const INF = 1e18;
    const cost = new Float64Array((n + 1) * (m + 1)).fill(INF);
    cost[0] = 0;

    for (let i = 1; i <= n; i++) {
      const jStart = Math.max(1, i - w);
      const jEnd = Math.min(m, i + w);
      for (let j = jStart; j <= jEnd; j++) {
        const d = Math.abs(a[i - 1]! - b[j - 1]!);
        const idx = i * (m + 1) + j;
        cost[idx] = d + Math.min(
          cost[(i - 1) * (m + 1) + j]!,     // insertion
          cost[i * (m + 1) + (j - 1)]!,     // deletion
          cost[(i - 1) * (m + 1) + (j - 1)]!, // match
        );
      }
    }

    return cost[n * (m + 1) + m]! / Math.max(n, m); // Normalized
  }

  /**
   * Multi-dimensional DTW with Sakoe-Chiba band.
   * Each element is a vector of axis values.
   */
  private dtwDistanceND(a: number[][], b: number[][]): number {
    const n = a.length;
    const m = b.length;
    const w = Math.max(1, Math.ceil(Math.max(n, m) * this.config.bandWidth));

    const INF = 1e18;
    const cost = new Float64Array((n + 1) * (m + 1)).fill(INF);
    cost[0] = 0;

    for (let i = 1; i <= n; i++) {
      const jStart = Math.max(1, i - w);
      const jEnd = Math.min(m, i + w);
      for (let j = jStart; j <= jEnd; j++) {
        const d = euclideanDistance(a[i - 1]!, b[j - 1]!);
        const idx = i * (m + 1) + j;
        cost[idx] = d + Math.min(
          cost[(i - 1) * (m + 1) + j]!,
          cost[i * (m + 1) + (j - 1)]!,
          cost[(i - 1) * (m + 1) + (j - 1)]!,
        );
      }
    }

    return cost[n * (m + 1) + m]! / Math.max(n, m);
  }

  // ─── Series extraction ──────────────────────────────────────────────────

  private computeMagnitudeSeries(samples: IMUSample[]): number[] {
    return samples.map((s) => Math.sqrt(s.ax * s.ax + s.ay * s.ay + s.az * s.az));
  }

  private computeMultiAxisSeries(samples: IMUSample[]): number[][] {
    const numAxes = this.config.axes;
    return samples.map((s) => {
      const v = [s.ax, s.ay, s.az];
      if (numAxes >= 6) v.push(s.gx ?? 0, s.gy ?? 0, s.gz ?? 0);
      return v;
    });
  }

  // ─── Confidence scoring ─────────────────────────────────────────────────

  /**
   * Convert DTW distance to a 0–1 confidence score.
   *
   * Uses the margin between best and second-best match distances:
   * large margin → high confidence.
   * Also maps absolute distance through a sigmoid.
   */
  private computeConfidence(bestDist: number, secondBestDist: number): number {
    // Margin-based: how much better is the best vs second?
    const margin = secondBestDist > 0
      ? (secondBestDist - bestDist) / secondBestDist
      : 0;

    // Distance-based: sigmoid mapping of absolute distance
    const distScore = 1 / (1 + bestDist / 5);

    // Weighted combination
    return Math.min(1, 0.5 * distScore + 0.5 * (0.5 + margin * 0.5));
  }

  private makeRejection(
    reason: RecognitionResult['rejectionReason'],
    timestamp: number,
    window: IMUWindow,
    allDistances?: Array<{ gestureId: string; bestDistance: number }>,
  ): RecognitionResult {
    return {
      gestureId: null,
      gestureName: null,
      confidence: 0,
      classifierType: 'dtw',
      rawScore: Infinity,
      timestamp,
      windowDuration: window.endTime - window.startTime,
      accepted: false,
      rejectionReason: reason,
      alternatives: allDistances?.slice(0, 3).map((c) => ({
        gestureId: c.gestureId,
        confidence: 0,
        rawScore: c.bestDistance,
      })),
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i]! - (b[i] ?? 0);
    sum += d * d;
  }
  return Math.sqrt(sum);
}
