# @peripherals/gesture-engine

IMU-based gesture recognition for React Native. Three-tier classification from BLE wearable sensors with six-layer false positive mitigation achieving <0.02 false positives per hour.

## Architecture

| Layer | Component | Purpose |
|-------|-----------|---------|
| **Preprocessing** | `PreprocessingPipeline` | Butterworth low-pass (20 Hz) + high-pass (0.3 Hz gravity removal) |
| **Buffering** | `CircularBuffer` | High-performance Float64Array ring buffer for streaming data |
| **Segmentation** | `Segmenter` | Sliding window extraction + SMA-based gesture onset detection |
| **Classification** | `ThresholdClassifier` | Tier 1: tap, double-tap, shake, flick (zero training) |
| | `DTWClassifier` | Tier 2: template matching with 5–20 samples (no training phase) |
| | `MLClassifier` | Tier 3: TFLite/ONNX CNN/LSTM models (train offline in Python) |
| **FP Mitigation** | `FalsePositiveGuard` | 6-layer system: pre-filters, context gate, activation gesture, noise class, adaptive thresholds, rate limiting |
| **Orchestration** | `GestureEngine` | Full pipeline: feed samples → get recognized gestures |
| **Recording** | `GestureRecorder` | 5-step recording workflow with consistency scoring |

## Installation

```bash
# In your monorepo
pnpm add @peripherals/gesture-engine

# Optional peer dependencies for ML inference:
pnpm add react-native-fast-tflite   # TFLite (recommended, JSI-based)
pnpm add onnxruntime-react-native   # ONNX (broader model compat)
```

## Quick start

```tsx
import {
  useGestureEngine,
  useGestureRecognition,
  useGestureLibrary,
} from '@peripherals/gesture-engine';

function GestureController() {
  const { engine, isListening, start, stop, feedSamples } =
    useGestureEngine({
      sampleRate: 50,
      axes: 3,   // accel-only (e.g., Oura Ring, MetaMotion)
      classifier: 'dtw',
      confidenceThreshold: 0.7,
    });

  const { lastGesture, reportFalsePositive } =
    useGestureRecognition(engine, {
      onGesture: (result) => {
        console.log(`Gesture: ${result.gestureName} (${result.confidence})`);
        triggerSmartHomeAction(result.gestureId!);
      },
    });

  const { registerThresholdGesture } = useGestureLibrary(engine);

  useEffect(() => {
    // Register a simple tap gesture (no training needed)
    registerThresholdGesture({
      id: 'tap',
      name: 'Tap',
      type: 'tap',
      threshold: 2.5,
    });
    start();
  }, []);

  // Feed samples from BLE (call in your notification handler)
  // feedSamples([{ ax: 0.1, ay: -0.3, az: 9.8, timestamp: Date.now() }]);

  return (
    <View>
      <Text>{isListening ? '🟢 Listening' : '⚪ Idle'}</Text>
      {lastGesture && (
        <View>
          <Text>{lastGesture.gestureName}</Text>
          <Button title="Not me" onPress={() =>
            reportFalsePositive(lastGesture.gestureId!)} />
        </View>
      )}
    </View>
  );
}
```

## Three-tier classification

### Tier 1: Threshold (zero training)

Detects simple gestures from acceleration peaks. No training needed — just configure thresholds.

```ts
engine.registerThresholdGesture({
  id: 'double-tap',
  name: 'Double Tap',
  type: 'doubleTap',
  threshold: 3.0,
  maxInterval: 400, // ms between taps
});

engine.registerThresholdGesture({
  id: 'shake',
  name: 'Shake',
  type: 'shake',
  threshold: 2.0,
  minCrossings: 6,
});

engine.registerThresholdGesture({
  id: 'flick',
  name: 'Flick',
  type: 'flick',
  threshold: 50, // jerk threshold
  axis: 'x',     // axis-specific
});
```

Supported types: `tap`, `doubleTap`, `shake`, `flick`.

### Tier 2: DTW template matching (5–20 samples)

Dynamic Time Warping with Sakoe-Chiba band constraint. No training phase — record templates, start recognizing.

```ts
// Record templates using the built-in recorder
const { startSession, finalizeSession, phase, session, countdown } =
  useGestureRecorder(engine);

// Start recording
startSession('circle-left', 'Circle Left');

// After recording 5 reps with ≥70% consistency:
const gestureClass = finalizeSession();
// → Automatically registered with the engine

// Or register manually:
engine.registerGesture({
  definition: { id: 'swipe-right', name: 'Swipe Right' },
  templates: savedTemplates,
  isReady: true,
  minTemplates: 3,
});
```

Features:
- **Rotation-invariant mode** (default): uses acceleration magnitude √(ax²+ay²+az²) — handles ring rotation around the finger
- **Multi-axis mode**: full 3D/6D DTW for orientation-sensitive gestures
- **Auto-calibration**: `engine.calibrate()` sets distance threshold from registered templates

### Tier 3: ML model inference (train offline)

For production quality, train a model in Python and run on-device:

```ts
import { GestureEngine } from '@peripherals/gesture-engine';

const engine = new GestureEngine({
  classifier: 'tflite',
  modelPath: require('./gesture_model.tflite'),
  modelNumClasses: 12,
  modelClassMap: {
    0: 'tap', 1: 'double-tap', 2: 'swipe-left',
    3: 'swipe-right', 4: 'circle', 5: 'flick',
    // ...
    11: 'noise', // explicit noise class
  },
  computeFrequencyFeatures: true,
});

// Pre-load model
await engine.loadModel();
```

Supports both TFLite (via `react-native-fast-tflite`, JSI, CoreML/NNAPI acceleration) and ONNX (via `onnxruntime-react-native`).

## Six-layer false positive mitigation

The `FalsePositiveGuard` runs every recognition result through 6 layers:

| Layer | Technique | Effect |
|-------|-----------|--------|
| 0 | Pre-filters | Reject if energy, duration, or peak accel below thresholds |
| 1 | Context gating | Disable during high activity; geofence to home |
| 2 | Activation gesture | Two-stage: detect "wake" gesture → 5s armed window → detect command |
| 3 | Noise class | ML classifier trained with explicit "not a gesture" class |
| 4 | Adaptive thresholds | Increase threshold on FP report, slowly relax after 20+ TPs |
| 5 | Rate limiting | 2s cooldown, progressive escalation, 10/min cap, deduplication |

### Activation gesture (most effective)

```ts
const engine = new GestureEngine({
  activationGestureEnabled: true,
  activationGestureId: 'double-tap',
  activationTimeout: 5, // seconds
});

// Engine stays idle until double-tap is detected
// Then enters "armed" state for 5 seconds
// Only command gestures during armed window are accepted
```

### Feedback loop

```tsx
// User confirms "that wasn't intentional"
engine.reportFalsePositive(result.gestureId);
// → Threshold for that gesture increases 10%
// → Cooldown doubles (2s → 4s → 8s)

// Implicit: every accepted gesture is a true positive
engine.reportTruePositive(result.gestureId);
// → After 20 consecutive TPs, threshold slowly relaxes
```

## React hooks

### `useGestureEngine(config?)`

Creates and manages the engine lifecycle.

```ts
const {
  engine,       // GestureEngine instance (stable ref)
  state,        // EngineState: idle | listening | armed | recording | paused | disposed
  isListening,  // state === 'listening' || state === 'armed'
  isRecording,  // state === 'recording'
  isPaused,     // state === 'paused'
  error,        // Last error
  start,        // () => void
  stop,         // () => void
  pause,        // () => void
  resume,       // () => void
  feedSamples,  // (samples: IMUSample[]) => void
} = useGestureEngine(config);
```

### `useGestureRecognition(engine, options?)`

Subscribe to recognition events.

```ts
const {
  lastGesture,           // Most recent accepted gesture
  allResults,            // Full history (including rejections)
  armedState,            // { isArmed, remainingMs }
  needsRecalibration,    // True if excessive FPs detected
  reportFalsePositive,   // (gestureId) => void
  reportTruePositive,    // (gestureId) => void
  clearHistory,          // () => void
} = useGestureRecognition(engine, { maxHistory: 50 });
```

### `useGestureRecorder(engine)`

Recording workflow UI state.

```ts
const {
  phase,           // RecorderPhase: idle | countdown | recording | processing | review | complete
  session,         // { gestureId, templates, targetCount, currentIndex, consistencyScore }
  countdown,       // Seconds remaining in countdown
  isRecording,     // phase === 'recording'
  isCountdown,     // phase === 'countdown'
  isReview,        // phase === 'review'
  startSession,    // (gestureId, name) => void
  stopSession,     // () => void
  finalizeSession, // (definition?) => GestureClass | null
  discardLast,     // () => void — discard last rep
  recordAnother,   // () => void — record additional rep
} = useGestureRecorder(engine);
```

### `useActivityContext(engine)`

Track activity level from IMU variance.

```ts
const {
  activity,            // { level, variance, timestamp }
  level,               // 'stationary' | 'low' | 'moderate' | 'high'
  isStationary,
  isHighActivity,      // Recognition disabled during high activity
} = useActivityContext(engine);
```

### `useGestureLibrary(engine)`

Manage gesture classes and templates.

```ts
const {
  gestures,                  // GestureDefinition[]
  gestureCount,
  registerGesture,           // (GestureClass) => void
  registerThresholdGesture,  // (ThresholdGestureDef) => void
  removeGesture,             // (id) => void
  addTemplate,               // (gestureId, template) => void
  exportLibrary,             // () => GestureLibraryData
  importLibrary,             // (data) => void
  calibrate,                 // () => number (auto-calibrates DTW threshold)
} = useGestureLibrary(engine);
```

### `useSensorVisualization(engine, options?)`

Real-time sensor data for charts/graphs.

```ts
const {
  samples,     // IMUSample[] (latest N samples)
  magnitudes,  // number[] (acceleration magnitude per sample)
} = useSensorVisualization(engine, {
  sampleCount: 200,
  refreshRate: 30, // Hz
});
```

## Persistence

Export/import the gesture library for storage:

```ts
import { useGestureLibrary } from '@peripherals/gesture-engine';

// Export (e.g., save to MMKV)
const data = exportLibrary();
storage.set('gesture-library', JSON.stringify(data));

// Import on app launch
const saved = JSON.parse(storage.getString('gesture-library')!);
importLibrary(saved);
```

## Connecting to BLE sensors

The engine is sensor-agnostic — feed any IMU data as `IMUSample[]`:

```ts
import { useBleDevice, useCharacteristic } from '@peripherals/ble-core';

function useSensorBridge(engine: GestureEngine, deviceId: string) {
  const device = useBleDevice(deviceId);

  // Subscribe to accelerometer characteristic
  useCharacteristic(device, {
    serviceUUID: 'your-imu-service-uuid',
    characteristicUUID: 'your-accel-char-uuid',
    onNotification: (data: DataView) => {
      // Parse your sensor's binary format
      const samples = parseIMUData(data);
      engine.feedSamples(samples);
    },
  });
}
```

Compatible sensors: Polar H10/Verity (raw accel via PMD service), MetaMotion/Mbientlab MetaWear, ESP32+MPU6050 custom rings, any BLE IMU exposing raw data.

## Feature extraction

Built-in feature extraction for ML model training:

```ts
import {
  extractTimeDomainFeatures,
  extractFrequencyDomainFeatures,
  extractFeatures,
} from '@peripherals/gesture-engine';

// Full feature vector (time + frequency domain)
const features = extractFeatures(window, true);
console.log(features.flat); // number[] ready for ML input

// Time-domain only: mean, variance, RMS, peak-to-peak,
// zero-crossing rate, SMA, magnitude stats, inter-axis
// correlations, average jerk, IQR, energy
const td = extractTimeDomainFeatures(samples, 6);

// Frequency-domain: dominant frequency, spectral energy,
// spectral entropy, spectral centroid (built-in Radix-2 FFT)
const fd = extractFrequencyDomainFeatures(samples, 50, 6);
```

## Signal processing utilities

```ts
import {
  PreprocessingPipeline,
  CircularBuffer,
  butterworthLowPass,
  butterworthHighPass,
  zScoreNormalize,
} from '@peripherals/gesture-engine';

// Preprocessing: low-pass (20 Hz) → high-pass (0.3 Hz gravity removal)
const pipeline = new PreprocessingPipeline({
  sampleRate: 50,
  lowPassCutoff: 20,
  highPassCutoff: 0.3,
  numAxes: 6,
});
const filtered = pipeline.process([ax, ay, az, gx, gy, gz]);

// Circular buffer for streaming data (10 seconds at 50 Hz)
const buffer = new CircularBuffer(500, 6);
buffer.push({ ax, ay, az, gx, gy, gz, timestamp });
const latest = buffer.getLatest(100);
const magnitudes = buffer.extractMagnitude(100);
```

## Imperative usage (no React)

```ts
import { GestureEngine } from '@peripherals/gesture-engine';

const engine = new GestureEngine({
  sampleRate: 50,
  axes: 3,
  classifier: 'dtw',
});

engine.on('gesture', (result) => {
  console.log(`Recognized: ${result.gestureName} (${result.confidence})`);
});

engine.on('activityChanged', (ctx) => {
  console.log(`Activity: ${ctx.level}`);
});

engine.registerThresholdGesture({
  id: 'tap', name: 'Tap', type: 'tap', threshold: 2.5,
});

engine.start();

// Feed from any source
bleDevice.onNotification((data) => {
  engine.feedSamples(parseIMU(data));
});

// Clean up
engine.dispose();
```

## Requirements

- React Native ≥ 0.73
- React ≥ 18.0
- For ML inference: `react-native-fast-tflite` (TFLite) or `onnxruntime-react-native` (ONNX) — both optional
- BLE sensor providing raw accelerometer (and optionally gyroscope) data at ≥ 20 Hz

## Pipeline data flow

```
BLE Sensor
    │
    ▼
feedSamples([IMUSample...])
    │
    ├─► PreprocessingPipeline (Butterworth LP + HP)
    │
    ├─► CircularBuffer (ring buffer storage)
    │
    ├─► Segmenter (sliding window + SMA onset detection)
    │       │
    │       ├─► isCandidate? ──No──► skip
    │       │
    │       ▼ Yes
    │
    ├─► ThresholdClassifier (tap/shake/flick — always runs)
    │
    ├─► DTWClassifier / MLClassifier (primary classifier)
    │
    ├─► FalsePositiveGuard (6-layer mitigation)
    │       │
    │       ├─► Context gate (activity level, geofence)
    │       ├─► Activation gesture (armed window)
    │       ├─► Confidence threshold (adaptive)
    │       ├─► Rate limiter + cooldown
    │       │
    │       ▼
    │
    └─► RecognitionResult { gestureId, confidence, accepted }
            │
            ├─► onGesture callback / 'gesture' event
            └─► onResult callback / 'result' event
```
