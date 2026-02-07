/**
 * Core types for the gesture recognition engine.
 */

// ─── IMU data ────────────────────────────────────────────────────────────────

/** Single IMU sample (3-axis or 6-axis). */
export interface IMUSample {
  /** Accelerometer X (m/s² or g) */
  ax: number;
  /** Accelerometer Y */
  ay: number;
  /** Accelerometer Z */
  az: number;
  /** Gyroscope X (rad/s or deg/s) — undefined for accel-only devices */
  gx?: number;
  /** Gyroscope Y */
  gy?: number;
  /** Gyroscope Z */
  gz?: number;
  /** Timestamp in milliseconds (monotonic preferred) */
  timestamp: number;
}

/** Whether the data is 3-axis (accel only) or 6-axis (accel + gyro). */
export type IMUAxes = 3 | 6;

/** A contiguous window of IMU samples. */
export interface IMUWindow {
  samples: IMUSample[];
  startTime: number;
  endTime: number;
  sampleRate: number;
  axes: IMUAxes;
}

// ─── Features ────────────────────────────────────────────────────────────────

/** Time-domain features extracted from a window. */
export interface TimeDomainFeatures {
  /** Per-axis mean */
  mean: number[];
  /** Per-axis variance */
  variance: number[];
  /** Per-axis root mean square */
  rms: number[];
  /** Per-axis peak-to-peak range */
  peakToPeak: number[];
  /** Per-axis zero-crossing rate */
  zeroCrossingRate: number[];
  /** Signal magnitude area: mean(|ax| + |ay| + |az|) */
  sma: number;
  /** Acceleration magnitude: sqrt(ax² + ay² + az²) per sample, then stats */
  magnitudeMean: number;
  magnitudeVariance: number;
  /** Inter-axis correlations [xy, xz, yz] */
  correlations: number[];
  /** Average jerk (derivative of acceleration magnitude) */
  averageJerk: number;
  /** Interquartile range per axis */
  iqr: number[];
  /** Total energy: sum of squared values across all axes */
  energy: number;
}

/** Frequency-domain features from FFT. */
export interface FrequencyDomainFeatures {
  /** Dominant frequency per axis (Hz) */
  dominantFrequency: number[];
  /** Spectral energy per axis */
  spectralEnergy: number[];
  /** Spectral entropy per axis */
  spectralEntropy: number[];
  /** Spectral centroid per axis */
  spectralCentroid: number[];
}

/** Combined feature vector. */
export interface FeatureVector {
  timeDomain: TimeDomainFeatures;
  frequencyDomain?: FrequencyDomainFeatures;
  /** Flat numeric array for ML model input. */
  flat: number[];
}

// ─── Gesture definition ──────────────────────────────────────────────────────

/** A named gesture class. */
export interface GestureDefinition {
  /** Unique gesture identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Gesture category for UI grouping. */
  category?: string;
  /** Description of how to perform the gesture. */
  description?: string;
  /** Which classifier to use (default: engine's active classifier). */
  classifier?: ClassifierType;
}

/** A recorded gesture template for DTW matching. */
export interface GestureTemplate {
  /** Gesture ID this template belongs to. */
  gestureId: string;
  /** Raw IMU samples. */
  samples: IMUSample[];
  /** Pre-computed features for fast comparison. */
  features?: FeatureVector;
  /** Pre-computed magnitude series for rotation-invariant DTW. */
  magnitudeSeries?: number[];
  /** Recording timestamp. */
  recordedAt: number;
  /** Duration in ms. */
  duration: number;
  /** Sample rate at recording time. */
  sampleRate: number;
}

/** A gesture class with all its templates. */
export interface GestureClass {
  definition: GestureDefinition;
  templates: GestureTemplate[];
  /** Whether this class has enough templates for recognition. */
  isReady: boolean;
  /** Minimum templates required (default: 3). */
  minTemplates: number;
}

// ─── Classification result ───────────────────────────────────────────────────

/** Output from any classifier tier. */
export interface RecognitionResult {
  /** Matched gesture ID, or null if rejected. */
  gestureId: string | null;
  /** Gesture name for display. */
  gestureName: string | null;
  /** Confidence score 0.0–1.0. */
  confidence: number;
  /** Which classifier produced this result. */
  classifierType: ClassifierType;
  /** Distance/score from the classifier (lower = better for DTW). */
  rawScore: number;
  /** Timestamp of recognition. */
  timestamp: number;
  /** Duration of the detected gesture window in ms. */
  windowDuration: number;
  /** Whether this result passed all false-positive filters. */
  accepted: boolean;
  /** Rejection reason if not accepted. */
  rejectionReason?: RejectionReason;
  /** Runner-up results for debugging. */
  alternatives?: Array<{
    gestureId: string;
    confidence: number;
    rawScore: number;
  }>;
}

export type ClassifierType = 'threshold' | 'dtw' | 'tflite' | 'onnx';

export type RejectionReason =
  | 'below_confidence_threshold'
  | 'below_energy_threshold'
  | 'invalid_duration'
  | 'cooldown_active'
  | 'rate_limit'
  | 'context_gate'
  | 'activation_required'
  | 'no_matching_gesture'
  | 'noise_class_match';

// ─── Activity context ────────────────────────────────────────────────────────

/** Current activity level inferred from accelerometer variance. */
export type ActivityLevel = 'stationary' | 'low' | 'moderate' | 'high';

export interface ActivityContext {
  level: ActivityLevel;
  /** Accelerometer magnitude variance over the context window. */
  variance: number;
  /** Timestamp of last context update. */
  timestamp: number;
}

// ─── Pipeline configuration ──────────────────────────────────────────────────

export interface GestureEngineConfig {
  /** Expected sample rate from the BLE sensor (Hz). Default: 50. */
  sampleRate?: number;
  /** Number of IMU axes (3 = accel only, 6 = accel+gyro). Default: 6. */
  axes?: IMUAxes;

  // ─── Preprocessing ────────────────────────────
  /** Low-pass filter cutoff frequency (Hz). Default: 20. */
  lowPassCutoff?: number;
  /** High-pass filter cutoff frequency (Hz) for gravity removal. Default: 0.3. */
  highPassCutoff?: number;
  /** Butterworth filter order. Default: 2. */
  filterOrder?: number;

  // ─── Windowing ────────────────────────────────
  /** Sliding window duration in seconds. Default: 1.5. */
  windowDuration?: number;
  /** Window overlap ratio 0.0–1.0. Default: 0.5. */
  windowOverlap?: number;

  // ─── Segmentation ─────────────────────────────
  /** Minimum gesture duration in seconds. Default: 0.3. */
  minGestureDuration?: number;
  /** Maximum gesture duration in seconds. Default: 3.0. */
  maxGestureDuration?: number;
  /** SMA threshold multiplier over baseline for gesture detection. Default: 2.5. */
  smaThresholdMultiplier?: number;
  /** Minimum peak acceleration to consider as gesture. Default: 1.5 (g or m/s²). */
  minPeakAcceleration?: number;

  // ─── Classification ───────────────────────────
  /** Active classifier type. Default: 'dtw'. */
  classifier?: ClassifierType;
  /** Confidence threshold for acceptance. Default: 0.7. */
  confidenceThreshold?: number;
  /** DTW: Sakoe-Chiba band width as fraction of sequence length. Default: 0.1. */
  dtwBandWidth?: number;
  /** DTW: Use rotation-invariant magnitude series. Default: true. */
  dtwRotationInvariant?: boolean;
  /** TFLite/ONNX model path. */
  modelPath?: string;
  /** Number of gesture classes the model was trained on. */
  modelNumClasses?: number;
  /** Class label mapping (index → gesture ID). */
  modelClassMap?: Record<number, string>;

  // ─── False positive mitigation ────────────────
  /** Enable two-stage activation gesture. Default: false. */
  activationGestureEnabled?: boolean;
  /** Activation gesture ID (must be in the gesture library). */
  activationGestureId?: string;
  /** Armed state timeout in seconds after activation. Default: 5. */
  activationTimeout?: number;
  /** Cooldown between gesture triggers in ms. Default: 2000. */
  cooldownMs?: number;
  /** Max gestures per minute. Default: 10. */
  maxGesturesPerMinute?: number;
  /** Progressive cooldown: multiply cooldown on consecutive FPs. Default: true. */
  progressiveCooldown?: boolean;
  /** Activity level that disables recognition. Default: 'high'. */
  disableAtActivityLevel?: ActivityLevel;

  // ─── Feature extraction ───────────────────────
  /** Compute frequency-domain features (requires FFT). Default: false for DTW, true for ML. */
  computeFrequencyFeatures?: boolean;

  // ─── Callbacks ────────────────────────────────
  /** Called on every recognition result (including rejections). */
  onResult?: (result: RecognitionResult) => void;
  /** Called only on accepted gestures. */
  onGesture?: (result: RecognitionResult) => void;
  /** Called on activity level changes. */
  onActivityChange?: (context: ActivityContext) => void;
  /** Called on errors. */
  onError?: (error: Error) => void;
}

// ─── Engine state ────────────────────────────────────────────────────────────

export enum EngineState {
  Idle = 'idle',
  Listening = 'listening',
  Armed = 'armed',
  Recording = 'recording',
  Paused = 'paused',
  Disposed = 'disposed',
}

// ─── Recorder types ──────────────────────────────────────────────────────────

export interface RecordingSession {
  gestureId: string;
  templates: GestureTemplate[];
  targetCount: number;
  currentIndex: number;
  isRecording: boolean;
  consistencyScore: number | null;
}

// ─── Threshold gesture definition ────────────────────────────────────────────

export interface ThresholdGestureDef {
  id: string;
  name: string;
  type: 'tap' | 'doubleTap' | 'shake' | 'flick' | 'rotation';
  /** Acceleration magnitude threshold. */
  threshold: number;
  /** For doubleTap: max interval between taps in ms. */
  maxInterval?: number;
  /** For shake: minimum number of threshold crossings. */
  minCrossings?: number;
  /** For rotation: minimum angular change in degrees. */
  minAngle?: number;
  /** Axis to monitor: 'magnitude' | 'x' | 'y' | 'z'. Default: 'magnitude'. */
  axis?: 'magnitude' | 'x' | 'y' | 'z';
}
