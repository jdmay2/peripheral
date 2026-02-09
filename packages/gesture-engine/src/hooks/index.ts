/**
 * React hooks for the gesture recognition engine.
 *
 * Provides declarative bindings for engine lifecycle, gesture recognition,
 * recording, activity context, gesture library management, stats, and calibration.
 */

export { useGestureStats, type UseGestureStatsResult } from './use-gesture-stats';
export { useGestureCalibration, type UseGestureCalibrationResult } from './use-gesture-calibration';

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  GestureEngineConfig,
  RecognitionResult,
  ActivityContext,
  GestureDefinition,
  GestureClass,
  GestureTemplate,
  ThresholdGestureDef,
  EngineState,
  IMUSample,
} from '../types';
import { GestureEngine, type GestureLibraryData } from '../engine';
import type { RecorderPhase } from '../pipeline/recorder';
import type { RecordingSession } from '../types';

// ─── useGestureEngine ────────────────────────────────────────────────────────

/**
 * Core hook: creates and manages a GestureEngine instance.
 *
 * The engine is created once on mount and disposed on unmount.
 * Returns a stable ref to the engine plus state/controls.
 *
 * @example
 * ```tsx
 * const { engine, state, isListening, start, stop, feedSamples } =
 *   useGestureEngine({ sampleRate: 50, axes: 3 });
 *
 * // In your BLE notification handler:
 * onNotification((data) => feedSamples(parseSamples(data)));
 * ```
 */
export function useGestureEngine(config?: GestureEngineConfig) {
  const engineRef = useRef<GestureEngine | null>(null);
  const [state, setState] = useState<EngineState>('idle' as EngineState);
  const [error, setError] = useState<Error | null>(null);

  // Create engine once
  if (!engineRef.current) {
    engineRef.current = new GestureEngine(config);
  }
  const engine = engineRef.current;

  useEffect(() => {
    const unsubs = [
      engine.on('stateChanged', setState),
      engine.on('error', setError),
    ];
    return () => {
      unsubs.forEach((u) => u());
      engine.dispose();
      engineRef.current = null;
    };
  }, [engine]);

  const start = useCallback(() => engine.start(), [engine]);
  const stop = useCallback(() => engine.stop(), [engine]);
  const pause = useCallback(() => engine.pause(), [engine]);
  const resume = useCallback(() => engine.resume(), [engine]);
  const feedSamples = useCallback(
    (samples: IMUSample[]) => engine.feedSamples(samples),
    [engine],
  );

  return {
    engine,
    state,
    isListening: state === ('listening' as EngineState) || state === ('armed' as EngineState),
    isRecording: state === ('recording' as EngineState),
    isPaused: state === ('paused' as EngineState),
    error,
    start,
    stop,
    pause,
    resume,
    feedSamples,
  };
}

// ─── useGestureRecognition ───────────────────────────────────────────────────

/**
 * Subscribe to gesture recognition events from the engine.
 *
 * @example
 * ```tsx
 * const { lastGesture, allResults, armedState, needsRecalibration } =
 *   useGestureRecognition(engine);
 *
 * useEffect(() => {
 *   if (lastGesture) {
 *     triggerSmartHomeAction(lastGesture.gestureId);
 *   }
 * }, [lastGesture]);
 * ```
 */
export function useGestureRecognition(
  engine: GestureEngine | null,
  options?: {
    /** Max results to keep in history. Default: 50. */
    maxHistory?: number;
    /** Callback on accepted gesture. */
    onGesture?: (result: RecognitionResult) => void;
    /** Callback on any result (including rejections). */
    onResult?: (result: RecognitionResult) => void;
  },
) {
  const [lastGesture, setLastGesture] = useState<RecognitionResult | null>(
    null,
  );
  const [allResults, setAllResults] = useState<RecognitionResult[]>([]);
  const [armedState, setArmedState] = useState<{
    isArmed: boolean;
    remainingMs: number;
  }>({ isArmed: false, remainingMs: 0 });
  const [needsRecalibration, setNeedsRecalibration] = useState(false);

  const maxHistory = options?.maxHistory ?? 50;
  const onGesture = options?.onGesture;
  const onResult = options?.onResult;

  useEffect(() => {
    if (!engine) return;

    const unsubs = [
      engine.on('gesture', (result) => {
        setLastGesture(result);
        onGesture?.(result);
      }),
      engine.on('result', (result) => {
        setAllResults((prev) => {
          const next = [result, ...prev];
          return next.length > maxHistory ? next.slice(0, maxHistory) : next;
        });
        onResult?.(result);
      }),
      engine.on('armedStateChanged', setArmedState),
      engine.on('recalibrationNeeded', () => setNeedsRecalibration(true)),
    ];

    return () => unsubs.forEach((u) => u());
  }, [engine, maxHistory, onGesture, onResult]);

  const reportFalsePositive = useCallback(
    (gestureId: string) => {
      engine?.reportFalsePositive(gestureId);
    },
    [engine],
  );

  const reportTruePositive = useCallback(
    (gestureId: string) => {
      engine?.reportTruePositive(gestureId);
      setNeedsRecalibration(false);
    },
    [engine],
  );

  const clearHistory = useCallback(() => {
    setAllResults([]);
    setLastGesture(null);
  }, []);

  return {
    lastGesture,
    allResults,
    armedState,
    needsRecalibration,
    reportFalsePositive,
    reportTruePositive,
    clearHistory,
  };
}

// ─── useGestureRecorder ──────────────────────────────────────────────────────

/**
 * Hook for the gesture recording workflow.
 *
 * @example
 * ```tsx
 * const { phase, session, countdown, startSession, finalizeSession } =
 *   useGestureRecorder(engine);
 *
 * return (
 *   <View>
 *     {phase === 'countdown' && <Text>Get ready: {countdown}</Text>}
 *     {phase === 'recording' && <Text>Recording {session?.currentIndex + 1}...</Text>}
 *     {phase === 'review' && (
 *       <Button title={`Save (${(session?.consistencyScore ?? 0) * 100}%)`}
 *               onPress={finalizeSession} />
 *     )}
 *   </View>
 * );
 * ```
 */
export function useGestureRecorder(engine: GestureEngine | null) {
  const [phase, setPhase] = useState<RecorderPhase>('idle');
  const [session, setSession] = useState<RecordingSession | null>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!engine) return;
    const recorder = engine.getRecorder();

    const unsubs = [
      recorder.on('phaseChanged', (p) => {
        setPhase(p);
        setSession(recorder.getSession());
      }),
      recorder.on('countdownTick', setCountdown),
      recorder.on('recordingCompleted', () => {
        setSession(recorder.getSession());
      }),
      recorder.on('repetitionDiscarded', () => {
        setSession(recorder.getSession());
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }, [engine]);

  const startSession = useCallback(
    (gestureId: string, gestureName: string) => {
      engine?.startRecording(gestureId, gestureName);
    },
    [engine],
  );

  const stopSession = useCallback(() => {
    engine?.stopRecording();
    setPhase('idle');
    setSession(null);
  }, [engine]);

  const finalizeSession = useCallback(
    (definition?: GestureDefinition) => {
      const result = engine?.finalizeRecording(definition) ?? null;
      setPhase('idle');
      setSession(null);
      return result;
    },
    [engine],
  );

  const discardLast = useCallback(() => {
    engine?.getRecorder().discardLastRepetition();
    setSession(engine?.getRecorder().getSession() ?? null);
  }, [engine]);

  const recordAnother = useCallback(() => {
    engine?.getRecorder().recordAnother();
  }, [engine]);

  return {
    phase,
    session,
    countdown,
    isRecording: phase === 'recording',
    isCountdown: phase === 'countdown',
    isReview: phase === 'review',
    startSession,
    stopSession,
    finalizeSession,
    discardLast,
    recordAnother,
  };
}

// ─── useActivityContext ──────────────────────────────────────────────────────

/**
 * Track the current activity level from IMU data.
 *
 * @example
 * ```tsx
 * const { activity, isStationary } = useActivityContext(engine);
 *
 * return (
 *   <Text>Activity: {activity.level} (variance: {activity.variance.toFixed(2)})</Text>
 * );
 * ```
 */
export function useActivityContext(engine: GestureEngine | null) {
  const [activity, setActivity] = useState<ActivityContext>({
    level: 'stationary',
    variance: 0,
    timestamp: 0,
  });

  useEffect(() => {
    if (!engine) return;
    return engine.on('activityChanged', setActivity);
  }, [engine]);

  return {
    activity,
    level: activity.level,
    variance: activity.variance,
    isStationary: activity.level === 'stationary',
    isLowActivity: activity.level === 'low',
    isModerateActivity: activity.level === 'moderate',
    isHighActivity: activity.level === 'high',
  };
}

// ─── useGestureLibrary ───────────────────────────────────────────────────────

/**
 * Manage the gesture library: register, remove, import/export.
 *
 * @example
 * ```tsx
 * const { gestures, registerGesture, removeGesture, exportLibrary } =
 *   useGestureLibrary(engine);
 *
 * return gestures.map(g => (
 *   <GestureCard key={g.id} gesture={g} onDelete={() => removeGesture(g.id)} />
 * ));
 * ```
 */
export function useGestureLibrary(engine: GestureEngine | null) {
  const [gestures, setGestures] = useState<GestureDefinition[]>([]);

  const refresh = useCallback(() => {
    setGestures(engine?.getGestures() ?? []);
  }, [engine]);

  // Refresh on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  const registerGesture = useCallback(
    (gestureClass: GestureClass) => {
      engine?.registerGesture(gestureClass);
      refresh();
    },
    [engine, refresh],
  );

  const registerThresholdGesture = useCallback(
    (gesture: ThresholdGestureDef) => {
      engine?.registerThresholdGesture(gesture);
      refresh();
    },
    [engine, refresh],
  );

  const removeGesture = useCallback(
    (gestureId: string) => {
      engine?.removeGesture(gestureId);
      refresh();
    },
    [engine, refresh],
  );

  const addTemplate = useCallback(
    (gestureId: string, template: GestureTemplate) => {
      engine?.addTemplate(gestureId, template);
      refresh();
    },
    [engine, refresh],
  );

  const exportLibrary = useCallback((): GestureLibraryData | null => {
    return engine?.exportLibrary() ?? null;
  }, [engine]);

  const importLibrary = useCallback(
    (data: GestureLibraryData) => {
      engine?.importLibrary(data);
      refresh();
    },
    [engine, refresh],
  );

  const calibrate = useCallback((): number => {
    return engine?.calibrate() ?? 0;
  }, [engine]);

  return {
    gestures,
    gestureCount: gestures.length,
    registerGesture,
    registerThresholdGesture,
    removeGesture,
    addTemplate,
    exportLibrary,
    importLibrary,
    calibrate,
    refresh,
  };
}

// ─── useSensorVisualization ──────────────────────────────────────────────────

/**
 * Provides real-time sensor data for visualization (charts/graphs).
 *
 * Returns the latest N samples from the circular buffer,
 * refreshed at a configurable frame rate.
 *
 * @example
 * ```tsx
 * const { samples, magnitudes } = useSensorVisualization(engine, {
 *   sampleCount: 200,
 *   refreshRate: 30,
 * });
 *
 * return <AccelerometerChart data={samples} />;
 * ```
 */
export function useSensorVisualization(
  engine: GestureEngine | null,
  options?: {
    /** Number of samples to return. Default: 100. */
    sampleCount?: number;
    /** Refresh rate in Hz. Default: 20. */
    refreshRate?: number;
  },
) {
  const sampleCount = options?.sampleCount ?? 100;
  const refreshRate = options?.refreshRate ?? 20;
  const [samples, setSamples] = useState<IMUSample[]>([]);
  const [magnitudes, setMagnitudes] = useState<number[]>([]);

  useEffect(() => {
    if (!engine) return;

    const intervalMs = 1000 / refreshRate;
    const timer = setInterval(() => {
      const buf = engine.getBuffer();
      const latest = buf.getLatest(sampleCount);
      setSamples(latest);
      setMagnitudes(
        latest.map((s) =>
          Math.sqrt(s.ax * s.ax + s.ay * s.ay + s.az * s.az),
        ),
      );
    }, intervalMs);

    return () => clearInterval(timer);
  }, [engine, sampleCount, refreshRate]);

  return { samples, magnitudes };
}
