/**
 * @peripheral/gesture-engine
 *
 * IMU-based gesture recognition for React Native.
 * Three-tier classification (threshold → DTW → ML) with
 * six-layer false positive mitigation.
 */

// ─── Core engine ─────────────────────────────────────────────────────────────
export { GestureEngine } from './engine';
export type { GestureEngineEvents, GestureLibraryData } from './engine';
export { GestureSequencer } from './engine/gesture-sequencer';
export type {
  GestureSequenceDef,
  SequenceRecognizedEvent,
  SequenceProgressEvent,
  SequenceTimeoutEvent,
  GestureSequencerEvents,
} from './engine/gesture-sequencer';

// ─── Types ───────────────────────────────────────────────────────────────────
export type {
  IMUSample,
  IMUAxes,
  IMUWindow,
  TimeDomainFeatures,
  FrequencyDomainFeatures,
  FeatureVector,
  GestureDefinition,
  GestureTemplate,
  GestureClass,
  RecognitionResult,
  ClassifierType,
  RejectionReason,
  ActivityLevel,
  ActivityContext,
  GestureEngineConfig,
  RecordingSession,
  ThresholdGestureDef,
} from './types';

// Re-export EngineState enum as value (usable at runtime)
export { EngineState } from './types';

// ─── Classifiers ─────────────────────────────────────────────────────────────
export { ThresholdClassifier } from './classifiers/threshold';
export { DTWClassifier } from './classifiers/dtw';
export type { DTWConfig } from './classifiers/dtw';
export { MLClassifier } from './classifiers/ml-inference';
export type { MLInferenceConfig } from './classifiers/ml-inference';

// ─── Pipeline components ─────────────────────────────────────────────────────
export { Segmenter } from './pipeline/segmenter';
export type { SegmenterConfig, SegmenterOutput } from './pipeline/segmenter';
export { FalsePositiveGuard } from './pipeline/false-positive-guard';
export type { FalsePositiveConfig } from './pipeline/false-positive-guard';
export { GestureRecorder } from './pipeline/recorder';
export type {
  RecorderConfig,
  RecorderEvents,
  RecorderPhase,
} from './pipeline/recorder';

// ─── Feature extraction ──────────────────────────────────────────────────────
export {
  extractTimeDomainFeatures,
  extractFrequencyDomainFeatures,
  extractFeatures,
} from './features';

// ─── Utilities ───────────────────────────────────────────────────────────────
export { CircularBuffer } from './utils/circular-buffer';
export {
  BiquadFilter,
  FilterBank,
  PreprocessingPipeline,
  butterworthLowPass,
  butterworthHighPass,
  zScoreNormalize,
  minMaxNormalize,
} from './utils/filters';
export type { PreprocessingConfig } from './utils/filters';

// ─── React hooks ─────────────────────────────────────────────────────────────
export {
  useGestureEngine,
  useGestureRecognition,
  useGestureRecorder,
  useActivityContext,
  useGestureLibrary,
  useSensorVisualization,
  useGestureStats,
  useGestureCalibration,
} from './hooks';
export type { UseGestureStatsResult } from './hooks';
export type { UseGestureCalibrationResult } from './hooks';
