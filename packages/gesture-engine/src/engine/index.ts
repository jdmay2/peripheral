/**
 * GestureEngine — main orchestrator for the gesture recognition pipeline.
 *
 * Data flow:
 *   Raw IMU samples → Preprocessing (filter) → Circular buffer →
 *   Segmenter (windowing + onset detection) → Classifier (threshold/DTW/ML) →
 *   False Positive Guard (6-layer mitigation) → Recognition result → Callbacks
 *
 * The engine manages the full lifecycle: start/stop/pause listening,
 * register/remove gestures, switch classifiers, and record new gestures.
 */

import type {
  IMUSample,
  IMUWindow,
  GestureEngineConfig,
  GestureClass,
  GestureDefinition,
  GestureTemplate,
  RecognitionResult,
  ActivityContext,
  EngineState,
  ClassifierType,
  ThresholdGestureDef,
} from '../types';
import { CircularBuffer } from '../utils/circular-buffer';
import { PreprocessingPipeline } from '../utils/filters';
import { Segmenter } from '../pipeline/segmenter';
import { FalsePositiveGuard } from '../pipeline/false-positive-guard';
import { GestureRecorder } from '../pipeline/recorder';
import { ThresholdClassifier } from '../classifiers/threshold';
import { DTWClassifier } from '../classifiers/dtw';
import { MLClassifier, type MLInferenceConfig } from '../classifiers/ml-inference';
import { EventEmitter } from '../utils/event-emitter';

// ─── Default configuration ───────────────────────────────────────────────────

const DEFAULT_CONFIG: Required<
  Pick<
    GestureEngineConfig,
    | 'sampleRate'
    | 'axes'
    | 'lowPassCutoff'
    | 'highPassCutoff'
    | 'filterOrder'
    | 'windowDuration'
    | 'windowOverlap'
    | 'minGestureDuration'
    | 'maxGestureDuration'
    | 'smaThresholdMultiplier'
    | 'minPeakAcceleration'
    | 'classifier'
    | 'confidenceThreshold'
    | 'dtwBandWidth'
    | 'dtwRotationInvariant'
    | 'activationGestureEnabled'
    | 'activationTimeout'
    | 'cooldownMs'
    | 'maxGesturesPerMinute'
    | 'progressiveCooldown'
    | 'disableAtActivityLevel'
    | 'computeFrequencyFeatures'
  >
> = {
  sampleRate: 50,
  axes: 6,
  lowPassCutoff: 20,
  highPassCutoff: 0.3,
  filterOrder: 2,
  windowDuration: 1.5,
  windowOverlap: 0.5,
  minGestureDuration: 0.3,
  maxGestureDuration: 3.0,
  smaThresholdMultiplier: 2.5,
  minPeakAcceleration: 1.5,
  classifier: 'dtw',
  confidenceThreshold: 0.7,
  dtwBandWidth: 0.1,
  dtwRotationInvariant: true,
  activationGestureEnabled: false,
  activationTimeout: 5,
  cooldownMs: 2000,
  maxGesturesPerMinute: 10,
  progressiveCooldown: true,
  disableAtActivityLevel: 'high',
  computeFrequencyFeatures: false,
};

// ─── Engine events ───────────────────────────────────────────────────────────

export interface GestureEngineEvents {
  /** State changed (idle, listening, armed, recording, paused, disposed). */
  stateChanged: EngineState;
  /** Gesture recognized and accepted (passed all filters). */
  gesture: RecognitionResult;
  /** Any recognition result (including rejections). */
  result: RecognitionResult;
  /** Activity level changed. */
  activityChanged: ActivityContext;
  /** Armed state changed (activation gesture detected). */
  armedStateChanged: { isArmed: boolean; remainingMs: number };
  /** Recalibration recommended due to excessive false positives. */
  recalibrationNeeded: void;
  /** Engine error. */
  error: Error;
}

// ─── GestureEngine ───────────────────────────────────────────────────────────

export class GestureEngine extends EventEmitter<GestureEngineEvents> {
  private config: GestureEngineConfig;
  private state: EngineState = 'idle' as EngineState;

  // Pipeline components
  private preprocessing: PreprocessingPipeline;
  private buffer: CircularBuffer;
  private segmenter: Segmenter;
  private fpGuard: FalsePositiveGuard;

  // Classifiers
  private thresholdClassifier = new ThresholdClassifier();
  private dtwClassifier: DTWClassifier;
  private mlClassifier: MLClassifier | null = null;
  private activeClassifier: ClassifierType;

  // Recorder
  private recorder: GestureRecorder;

  // Gesture library
  private gestureClasses = new Map<string, GestureClass>();
  private gestureDefinitions = new Map<string, GestureDefinition>();

  // Activity tracking
  private lastActivity: ActivityContext = {
    level: 'stationary',
    variance: 0,
    timestamp: 0,
  };

  // Sample counter for diagnostics
  private totalSamplesProcessed = 0;

  constructor(config?: GestureEngineConfig) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    const sampleRate = this.config.sampleRate ?? DEFAULT_CONFIG.sampleRate;
    const axes = this.config.axes ?? DEFAULT_CONFIG.axes;

    // Initialize preprocessing
    this.preprocessing = new PreprocessingPipeline({
      sampleRate,
      lowPassCutoff: this.config.lowPassCutoff ?? DEFAULT_CONFIG.lowPassCutoff,
      highPassCutoff:
        this.config.highPassCutoff ?? DEFAULT_CONFIG.highPassCutoff,
      numAxes: axes,
    });

    // Buffer for ~10 seconds of data
    this.buffer = new CircularBuffer(sampleRate * 10, axes);

    // Segmenter
    this.segmenter = new Segmenter({
      sampleRate,
      axes,
      windowDuration:
        this.config.windowDuration ?? DEFAULT_CONFIG.windowDuration,
      windowOverlap:
        this.config.windowOverlap ?? DEFAULT_CONFIG.windowOverlap,
      minGestureDuration:
        this.config.minGestureDuration ?? DEFAULT_CONFIG.minGestureDuration,
      maxGestureDuration:
        this.config.maxGestureDuration ?? DEFAULT_CONFIG.maxGestureDuration,
      smaThresholdMultiplier:
        this.config.smaThresholdMultiplier ??
        DEFAULT_CONFIG.smaThresholdMultiplier,
      minPeakAcceleration:
        this.config.minPeakAcceleration ??
        DEFAULT_CONFIG.minPeakAcceleration,
    });

    // False positive guard
    this.fpGuard = new FalsePositiveGuard({
      activationEnabled:
        this.config.activationGestureEnabled ??
        DEFAULT_CONFIG.activationGestureEnabled,
      activationGestureId: this.config.activationGestureId ?? null,
      activationTimeout:
        this.config.activationTimeout ?? DEFAULT_CONFIG.activationTimeout,
      confidenceThreshold:
        this.config.confidenceThreshold ?? DEFAULT_CONFIG.confidenceThreshold,
      baseCooldownMs: this.config.cooldownMs ?? DEFAULT_CONFIG.cooldownMs,
      maxGesturesPerMinute:
        this.config.maxGesturesPerMinute ??
        DEFAULT_CONFIG.maxGesturesPerMinute,
      disableAtActivityLevel:
        this.config.disableAtActivityLevel ??
        DEFAULT_CONFIG.disableAtActivityLevel,
    });

    // DTW classifier
    this.dtwClassifier = new DTWClassifier({
      bandWidth: this.config.dtwBandWidth ?? DEFAULT_CONFIG.dtwBandWidth,
      rotationInvariant:
        this.config.dtwRotationInvariant ??
        DEFAULT_CONFIG.dtwRotationInvariant,
      axes,
    });

    // ML classifier (lazy, only if config provided)
    if (this.config.modelPath && this.config.modelNumClasses) {
      this.mlClassifier = new MLClassifier({
        modelPath: this.config.modelPath,
        modelType: (this.config.classifier === 'onnx' ? 'onnx' : 'tflite'),
        numClasses: this.config.modelNumClasses,
        classMap: this.config.modelClassMap ?? {},
        axes,
        includeFrequencyFeatures:
          this.config.computeFrequencyFeatures ??
          DEFAULT_CONFIG.computeFrequencyFeatures,
      });
    }

    this.activeClassifier =
      this.config.classifier ?? DEFAULT_CONFIG.classifier;

    // Recorder
    this.recorder = new GestureRecorder({
      sampleRate,
      axes,
    });
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  /** Start listening for gestures. */
  start(): void {
    if (this.state === ('disposed' as EngineState)) {
      throw new Error('Engine has been disposed');
    }
    this.setState('listening' as EngineState);
  }

  /** Pause gesture recognition (still buffers data). */
  pause(): void {
    if (this.state === ('listening' as EngineState) || this.state === ('armed' as EngineState)) {
      this.setState('paused' as EngineState);
    }
  }

  /** Resume from pause. */
  resume(): void {
    if (this.state === ('paused' as EngineState)) {
      this.setState('listening' as EngineState);
    }
  }

  /** Stop listening and reset pipeline state. */
  stop(): void {
    this.setState('idle' as EngineState);
    this.preprocessing.reset();
    this.segmenter.reset();
    this.buffer.clear();
  }

  /** Dispose the engine and free resources. */
  dispose(): void {
    this.stop();
    this.mlClassifier?.dispose();
    this.recorder.stopSession();
    this.removeAllListeners();
    this.setState('disposed' as EngineState);
  }

  /** Current engine state. */
  getState(): EngineState {
    return this.state;
  }

  // ─── Data ingestion ─────────────────────────────────────────────────────

  /**
   * Feed raw IMU samples into the engine.
   *
   * Call this from your BLE notification handler. Samples are
   * preprocessed, buffered, segmented, classified, and filtered
   * through the full pipeline in real-time.
   */
  feedSamples(samples: IMUSample[]): void {
    if (this.state === ('disposed' as EngineState)) return;

    // Preprocess each sample
    const axes = this.config.axes ?? DEFAULT_CONFIG.axes;
    const processed: IMUSample[] = [];

    for (const raw of samples) {
      const values =
        axes === 6
          ? [raw.ax, raw.ay, raw.az, raw.gx ?? 0, raw.gy ?? 0, raw.gz ?? 0]
          : [raw.ax, raw.ay, raw.az];

      const filtered = this.preprocessing.process(values);

      const sample: IMUSample = {
        ax: filtered[0]!,
        ay: filtered[1]!,
        az: filtered[2]!,
        gx: axes === 6 ? filtered[3] : undefined,
        gy: axes === 6 ? filtered[4] : undefined,
        gz: axes === 6 ? filtered[5] : undefined,
        timestamp: raw.timestamp,
      };

      processed.push(sample);
      this.buffer.push(sample);
    }

    this.totalSamplesProcessed += samples.length;

    // Feed to recorder if active
    if (this.state === ('recording' as EngineState)) {
      this.recorder.feedSamples(processed);
      return; // Don't classify during recording
    }

    // Skip classification if not listening
    if (this.state !== ('listening' as EngineState) && this.state !== ('armed' as EngineState)) {
      return;
    }

    // Segment and classify
    const segmenterOutputs = this.segmenter.feed(processed);

    for (const output of segmenterOutputs) {
      // Track activity changes
      if (output.activity.level !== this.lastActivity.level) {
        this.lastActivity = output.activity;
        this.emit('activityChanged', output.activity);
      }

      // Only classify gesture candidates
      if (!output.isCandidate) continue;

      // Run classification
      void this.classifyWindow(output.window, output.activity);
    }
  }

  // ─── Classification ─────────────────────────────────────────────────────

  private async classifyWindow(
    window: IMUWindow,
    activity: ActivityContext,
  ): Promise<void> {
    try {
      let result: RecognitionResult;

      // Threshold classifier always runs in parallel (instant gestures)
      const thresholdResults = this.thresholdClassifier.classify(
        window.samples,
      );
      for (const tResult of thresholdResults) {
        const filtered = this.fpGuard.evaluate(tResult, activity);
        this.emitResult(filtered);
      }

      // Primary classifier
      switch (this.activeClassifier) {
        case 'dtw':
          result = this.dtwClassifier.classify(window);
          break;
        case 'tflite':
        case 'onnx':
          if (!this.mlClassifier) {
            this.emit(
              'error',
              new Error(
                `ML classifier not configured but activeClassifier is '${this.activeClassifier}'. ` +
                `Call setMLClassifier() or loadModel() first.`,
              ),
            );
            return;
          }
          result = await this.mlClassifier.classify(window);
          break;
        default:
          return; // threshold-only mode handled above
      }

      // Run through false positive guard
      const filtered = this.fpGuard.evaluate(result, activity);
      this.emitResult(filtered);
    } catch (err) {
      this.emit(
        'error',
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  }

  private emitResult(result: RecognitionResult): void {
    // Always emit to 'result' (for debugging/logging)
    this.emit('result', result);
    this.config.onResult?.(result);

    if (result.accepted) {
      this.emit('gesture', result);
      this.config.onGesture?.(result);

      // Update armed state visual
      const armedState = this.fpGuard.getArmedState();
      this.emit('armedStateChanged', armedState);
    }

    // Check recalibration
    if (this.fpGuard.needsRecalibration()) {
      this.emit('recalibrationNeeded', undefined);
    }
  }

  // ─── Gesture library management ─────────────────────────────────────────

  /** Register a gesture class (DTW templates). */
  registerGesture(gestureClass: GestureClass): void {
    this.gestureClasses.set(gestureClass.definition.id, gestureClass);
    this.gestureDefinitions.set(
      gestureClass.definition.id,
      gestureClass.definition,
    );
    this.dtwClassifier.setClass(gestureClass);
  }

  /** Register a threshold-based gesture (tap, shake, flick). */
  registerThresholdGesture(gesture: ThresholdGestureDef): void {
    this.thresholdClassifier.register(gesture);
    this.gestureDefinitions.set(gesture.id, {
      id: gesture.id,
      name: gesture.name,
      classifier: 'threshold',
    });
  }

  /** Remove a gesture from all classifiers. */
  removeGesture(gestureId: string): void {
    this.gestureClasses.delete(gestureId);
    this.gestureDefinitions.delete(gestureId);
    this.dtwClassifier.removeClass(gestureId);
    this.thresholdClassifier.unregister(gestureId);
  }

  /** Add a template to an existing DTW gesture class. */
  addTemplate(gestureId: string, template: GestureTemplate): void {
    this.dtwClassifier.addTemplate(gestureId, template);
    const cls = this.gestureClasses.get(gestureId);
    if (cls) {
      cls.templates.push(template);
      cls.isReady = cls.templates.length >= cls.minTemplates;
    }
  }

  /** Delete a specific template by index from a DTW gesture class. */
  deleteTemplate(gestureId: string, index: number): void {
    this.dtwClassifier.deleteTemplate(gestureId, index);
    const cls = this.gestureClasses.get(gestureId);
    if (cls) {
      cls.templates.splice(index, 1);
      cls.isReady = cls.templates.length >= cls.minTemplates;
    }
  }

  /** Get all templates for a DTW gesture class. */
  getTemplates(gestureId: string): GestureTemplate[] {
    return this.dtwClassifier.getTemplates(gestureId);
  }

  /** Get the number of templates for a DTW gesture class. */
  getTemplateCount(gestureId: string): number {
    return this.dtwClassifier.getTemplateCount(gestureId);
  }

  /** Remove all templates for a gesture class without unregistering it. */
  clearGesture(gestureId: string): void {
    this.dtwClassifier.clearGesture(gestureId);
    const cls = this.gestureClasses.get(gestureId);
    if (cls) {
      cls.templates = [];
      cls.isReady = false;
    }
  }

  /** Get all registered gesture definitions. */
  getGestures(): GestureDefinition[] {
    return Array.from(this.gestureDefinitions.values());
  }

  /** Get a gesture class by ID. */
  getGestureClass(gestureId: string): GestureClass | undefined {
    return this.gestureClasses.get(gestureId);
  }

  /** Auto-calibrate DTW distance threshold from registered templates. */
  calibrate(): number {
    return this.dtwClassifier.calibrateMaxDistance();
  }

  // ─── Classifier switching ───────────────────────────────────────────────

  /** Switch the active classifier. */
  setClassifier(type: ClassifierType): void {
    this.activeClassifier = type;
  }

  /** Get the active classifier type. */
  getClassifier(): ClassifierType {
    return this.activeClassifier;
  }

  /** Configure or replace the ML classifier. */
  setMLClassifier(config: MLInferenceConfig): void {
    this.mlClassifier?.dispose();
    this.mlClassifier = new MLClassifier(config);
  }

  /** Pre-load the ML model. */
  async loadModel(): Promise<void> {
    if (!this.mlClassifier) {
      throw new Error('No ML classifier configured');
    }
    await this.mlClassifier.loadModel();
  }

  // ─── Recording ──────────────────────────────────────────────────────────

  /** Get the gesture recorder instance. */
  getRecorder(): GestureRecorder {
    return this.recorder;
  }

  /** Start recording a new gesture. Switches engine to recording mode. */
  startRecording(gestureId: string, gestureName: string): void {
    this.setState('recording' as EngineState);
    this.recorder.startSession(gestureId, gestureName);
  }

  /** Stop recording and return to listening. */
  stopRecording(): void {
    this.recorder.stopSession();
    this.setState('listening' as EngineState);
  }

  /**
   * Finalize recording and register the gesture.
   * Returns the gesture class if consistency check passes, null otherwise.
   */
  finalizeRecording(definition?: GestureDefinition): GestureClass | null {
    const gestureClass = this.recorder.finalizeSession(definition);

    if (gestureClass) {
      this.registerGesture(gestureClass);
    }

    this.setState('listening' as EngineState);
    return gestureClass;
  }

  // ─── False positive controls ────────────────────────────────────────────

  /** Report a false positive for adaptive threshold adjustment. */
  reportFalsePositive(gestureId: string): void {
    this.fpGuard.reportFalsePositive(gestureId);
  }

  /** Report a true positive for threshold relaxation. */
  reportTruePositive(gestureId: string): void {
    this.fpGuard.reportTruePositive(gestureId);
  }

  /** Manually arm the system (bypass activation gesture). */
  arm(): void {
    this.fpGuard.arm();
    this.setState('armed' as EngineState);
    this.emit('armedStateChanged', this.fpGuard.getArmedState());
  }

  /** Manually disarm. */
  disarm(): void {
    this.fpGuard.disarm();
    if (this.state === ('armed' as EngineState)) {
      this.setState('listening' as EngineState);
    }
    this.emit('armedStateChanged', { isArmed: false, remainingMs: 0 });
  }

  /** Set geofence active state. */
  setGeofenceActive(active: boolean): void {
    this.fpGuard.setGeofenceActive(active);
  }

  /** Get false positive mitigation metrics. */
  getFPMetrics() {
    return this.fpGuard.getMetrics();
  }

  // ─── Diagnostics ────────────────────────────────────────────────────────

  /** Get current activity context. */
  getActivity(): ActivityContext {
    return this.lastActivity;
  }

  /** Get engine diagnostic info. */
  getDiagnostics() {
    return {
      state: this.state,
      totalSamplesProcessed: this.totalSamplesProcessed,
      bufferLength: this.buffer.length,
      bufferDuration: this.buffer.duration,
      activeClassifier: this.activeClassifier,
      registeredGestures: this.gestureDefinitions.size,
      activity: this.lastActivity,
      armedState: this.fpGuard.getArmedState(),
      fpMetrics: this.fpGuard.getMetrics(),
      mlReady: this.mlClassifier?.isReady ?? false,
    };
  }

  /** Get the raw circular buffer (for visualization). */
  getBuffer(): CircularBuffer {
    return this.buffer;
  }

  // ─── Serialization ──────────────────────────────────────────────────────

  /**
   * Export the gesture library as a JSON-serializable object.
   * Use this to persist gestures to storage (MMKV, AsyncStorage, etc.).
   */
  exportLibrary(): GestureLibraryData {
    const classes: Record<string, GestureClass> = {};
    for (const [id, cls] of this.gestureClasses) {
      classes[id] = {
        ...cls,
        templates: cls.templates.map((t) => ({
          ...t,
          // Strip the pre-computed features to reduce storage size
          features: undefined,
        })),
      };
    }
    return { version: 1, classes };
  }

  /**
   * Import a gesture library from serialized data.
   * Replaces all current gestures.
   */
  importLibrary(data: GestureLibraryData): void {
    if (data.version !== 1) {
      throw new Error(`Unsupported library version: ${data.version}`);
    }

    // Clear existing
    for (const id of this.gestureClasses.keys()) {
      this.removeGesture(id);
    }

    // Import
    for (const [, cls] of Object.entries(data.classes)) {
      this.registerGesture(cls);
    }
  }

  // ─── Internal ───────────────────────────────────────────────────────────

  private setState(state: EngineState): void {
    if (this.state === state) return;
    this.state = state;
    this.emit('stateChanged', state);
  }
}

// ─── Serialization types ─────────────────────────────────────────────────────

export interface GestureLibraryData {
  version: 1;
  classes: Record<string, GestureClass>;
}
