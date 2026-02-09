/**
 * Hook for monitoring gesture engine statistics and health.
 *
 * Provides live metrics on recognition rate, false positive rate,
 * buffer health, and active classifier — useful for debug UIs
 * and performance monitoring dashboards.
 *
 * @example
 * ```tsx
 * const stats = useGestureStats(engine);
 *
 * return (
 *   <View>
 *     <Text>Recognition rate: {(stats.recognitionRate * 100).toFixed(1)}%</Text>
 *     <Text>FP rate: {(stats.fpRate * 100).toFixed(1)}%</Text>
 *     <Text>Buffer: {stats.bufferHealth}</Text>
 *     <Text>Classifier: {stats.activeClassifier}</Text>
 *   </View>
 * );
 * ```
 */

import { useState, useEffect } from 'react';
import type { GestureEngine } from '../engine';
import type { ClassifierType } from '../types';

export interface UseGestureStatsResult {
  /** Fraction of results that were accepted (0.0–1.0). */
  recognitionRate: number;
  /** Fraction of reported false positives over total accepted (0.0–1.0). */
  fpRate: number;
  /** Total accepted gestures since engine start. */
  totalAccepted: number;
  /** Total rejected results since engine start. */
  totalRejected: number;
  /** Buffer fill percentage: 'empty' | 'low' | 'normal' | 'full'. */
  bufferHealth: 'empty' | 'low' | 'normal' | 'full';
  /** Currently active classifier type. */
  activeClassifier: ClassifierType;
  /** Total IMU samples processed. */
  totalSamplesProcessed: number;
}

/**
 * Monitor gesture engine statistics at a configurable poll rate.
 *
 * @param engine - The GestureEngine instance to monitor.
 * @param options - Optional configuration.
 * @returns Live statistics about engine performance.
 */
export function useGestureStats(
  engine: GestureEngine | null,
  options?: {
    /** Poll interval in ms. Default: 2000. */
    pollIntervalMs?: number;
  },
): UseGestureStatsResult {
  const pollInterval = options?.pollIntervalMs ?? 2000;

  const [stats, setStats] = useState<UseGestureStatsResult>({
    recognitionRate: 0,
    fpRate: 0,
    totalAccepted: 0,
    totalRejected: 0,
    bufferHealth: 'empty',
    activeClassifier: 'dtw',
    totalSamplesProcessed: 0,
  });

  useEffect(() => {
    if (!engine) return;

    function update() {
      if (!engine) return;
      const diag = engine.getDiagnostics();
      const fp = diag.fpMetrics;

      const total = fp.totalAccepted + fp.totalRejected;
      const recognitionRate = total > 0 ? fp.totalAccepted / total : 0;
      const fpRate = fp.totalAccepted > 0
        ? fp.totalFPReported / fp.totalAccepted
        : 0;

      // Derive buffer health from buffer length vs capacity
      const bufferLen = diag.bufferLength;
      let bufferHealth: UseGestureStatsResult['bufferHealth'];
      if (bufferLen === 0) bufferHealth = 'empty';
      else if (bufferLen < 50) bufferHealth = 'low';
      else if (bufferLen < 400) bufferHealth = 'normal';
      else bufferHealth = 'full';

      setStats({
        recognitionRate,
        fpRate,
        totalAccepted: fp.totalAccepted,
        totalRejected: fp.totalRejected,
        bufferHealth,
        activeClassifier: diag.activeClassifier,
        totalSamplesProcessed: diag.totalSamplesProcessed,
      });
    }

    // Initial update
    update();

    const timer = setInterval(update, pollInterval);
    return () => clearInterval(timer);
  }, [engine, pollInterval]);

  return stats;
}
