/**
 * Hook for DTW calibration workflow.
 *
 * Provides a simple API to trigger auto-calibration of DTW distance
 * thresholds based on registered gesture templates. Calibration
 * computes optimal `maxDistance` from intra-class template distances.
 *
 * @example
 * ```tsx
 * const { isCalibrating, progress, calibrationResult, startCalibration } =
 *   useGestureCalibration(engine);
 *
 * return (
 *   <View>
 *     <Button
 *       title={isCalibrating ? `Calibrating... ${progress}%` : 'Calibrate'}
 *       onPress={startCalibration}
 *       disabled={isCalibrating}
 *     />
 *     {calibrationResult !== null && (
 *       <Text>Distance threshold: {calibrationResult.toFixed(2)}</Text>
 *     )}
 *   </View>
 * );
 * ```
 */

import { useState, useCallback } from 'react';
import type { GestureEngine } from '../engine';

export interface UseGestureCalibrationResult {
  /** Whether calibration is currently in progress. */
  isCalibrating: boolean;
  /** Calibration progress (0–100). For DTW, this is 0 or 100 since it's synchronous. */
  progress: number;
  /** The computed maxDistance threshold (null if never calibrated). */
  calibrationResult: number | null;
  /** Error from last calibration attempt. */
  error: Error | null;
  /** Trigger calibration. */
  startCalibration: () => void;
}

/**
 * Manage DTW auto-calibration.
 *
 * @param engine - The GestureEngine instance.
 * @returns Calibration state and controls.
 */
export function useGestureCalibration(
  engine: GestureEngine | null,
): UseGestureCalibrationResult {
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [calibrationResult, setCalibrationResult] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const startCalibration = useCallback(() => {
    if (!engine || isCalibrating) return;

    setIsCalibrating(true);
    setProgress(0);
    setError(null);

    try {
      // DTW calibration is synchronous but may be computationally expensive
      // for large template sets, so we wrap in a microtask to not block render.
      queueMicrotask(() => {
        try {
          const threshold = engine.calibrate();
          setCalibrationResult(threshold);
          setProgress(100);
        } catch (err) {
          setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
          setIsCalibrating(false);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsCalibrating(false);
    }
  }, [engine, isCalibrating]);

  return {
    isCalibrating,
    progress,
    calibrationResult,
    error,
    startCalibration,
  };
}
