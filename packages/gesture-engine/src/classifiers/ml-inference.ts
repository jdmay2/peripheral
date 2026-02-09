/**
 * ML model inference classifier (Tier 3).
 *
 * Wraps react-native-fast-tflite (TFLite) and onnxruntime-react-native (ONNX)
 * with lazy loading — models are loaded on first inference call. Both are
 * optional peer dependencies.
 *
 * - TFLite: JSI-based, zero-copy, CoreML/NNAPI acceleration. 30+ inferences/sec.
 * - ONNX: Broader model compat (PyTorch/TF exports), slightly slower on mobile.
 *
 * Train models offline in Python (TensorFlow/PyTorch), export to .tflite or
 * .onnx, bundle in the app's assets.
 *
 * Input: Flat Float32Array from FeatureVector.flat or raw windowed samples.
 * Output: Softmax probability array mapped to gesture class IDs.
 */

import type {
  IMUWindow,
  RecognitionResult,
  ClassifierType,
} from '../types';
import { extractFeatures } from '../features';
import { zScoreNormalize } from '../utils/filters';

// ─── Configuration ───────────────────────────────────────────────────────────

export interface MLInferenceConfig {
  /** Path to the model file (bundled asset). */
  modelPath: string;
  /** Model type. */
  modelType: 'tflite' | 'onnx';
  /** Number of output classes. */
  numClasses: number;
  /** Map from class index → gesture ID. */
  classMap: Record<number, string>;
  /** Map from class index → gesture name (for display). */
  classNameMap?: Record<number, string>;
  /** Index of the "noise" / "no gesture" class. Set to null if none. */
  noiseClassIndex?: number | null;
  /** Whether input is raw samples (true) or pre-extracted features (false). Default: false. */
  rawSampleInput?: boolean;
  /** Expected input tensor length (for validation). */
  inputLength?: number;
  /** Number of axes for feature extraction. Default: 6. */
  axes?: 3 | 6;
  /** Whether to include frequency features. Default: true. */
  includeFrequencyFeatures?: boolean;
  /** Whether to z-score normalize input. Default: true. */
  normalizeInput?: boolean;
  /** Use GPU delegate (CoreML on iOS, NNAPI on Android). Default: true. */
  useGPU?: boolean;
}

// ─── Lazy model loading ──────────────────────────────────────────────────────

type TFLiteModel = {
  runSync: (inputs: unknown[]) => unknown[];
};

type ONNXOutputTensor = {
  data: ArrayLike<number>;
};

type ONNXSession = {
  run: (feeds: Record<string, unknown>) => Promise<Record<string, ONNXOutputTensor>>;
};

async function loadTFLiteModel(path: string, useGPU: boolean): Promise<TFLiteModel> {
  try {
    const tflite = require('react-native-fast-tflite');
    const loadModel = tflite.loadTensorflowModel ?? tflite.default?.loadTensorflowModel;
    if (!loadModel) throw new Error('loadTensorflowModel not found');

    const delegate = useGPU ? 'core-ml' : undefined; // iOS; Android uses 'nnapi'
    return await loadModel(path, delegate);
  } catch (err) {
    throw new Error(
      `Failed to load TFLite model. Ensure "react-native-fast-tflite" is installed.\n` +
      `Original error: ${err}`,
    );
  }
}

async function loadONNXSession(path: string): Promise<ONNXSession> {
  try {
    const ort = require('onnxruntime-react-native');
    const InferenceSession = ort.InferenceSession ?? ort.default?.InferenceSession;
    if (!InferenceSession) throw new Error('InferenceSession not found');

    return await InferenceSession.create(path);
  } catch (err) {
    throw new Error(
      `Failed to load ONNX model. Ensure "onnxruntime-react-native" is installed.\n` +
      `Original error: ${err}`,
    );
  }
}

// ─── ML Classifier ──────────────────────────────────────────────────────────

export class MLClassifier {
  private config: MLInferenceConfig;
  private tfliteModel: TFLiteModel | null = null;
  private onnxSession: ONNXSession | null = null;
  private isLoading = false;
  private loadError: Error | null = null;

  constructor(config: MLInferenceConfig) {
    this.config = config;
  }

  /** Whether the model is loaded and ready for inference. */
  get isReady(): boolean {
    return this.tfliteModel !== null || this.onnxSession !== null;
  }

  /** Load the model. Called automatically on first classify() if not preloaded. */
  async loadModel(): Promise<void> {
    if (this.isReady || this.isLoading) return;
    this.isLoading = true;
    this.loadError = null;

    try {
      if (this.config.modelType === 'tflite') {
        this.tfliteModel = await loadTFLiteModel(
          this.config.modelPath,
          this.config.useGPU !== false,
        );
      } else {
        this.onnxSession = await loadONNXSession(this.config.modelPath);
      }
    } catch (err) {
      this.loadError = err instanceof Error ? err : new Error(String(err));
      throw this.loadError;
    } finally {
      this.isLoading = false;
    }
  }

  /** Unload the model to free memory. */
  dispose(): void {
    this.tfliteModel = null;
    this.onnxSession = null;
  }

  /**
   * Classify an IMU window using the loaded ML model.
   *
   * Pipeline:
   * 1. Extract features (or use raw samples)
   * 2. Normalize input
   * 3. Run inference
   * 4. Map softmax output to gesture IDs
   */
  async classify(window: IMUWindow): Promise<RecognitionResult> {
    const now = window.endTime;
    const classifierType: ClassifierType =
      this.config.modelType === 'tflite' ? 'tflite' : 'onnx';

    // Auto-load model
    if (!this.isReady) {
      try {
        await this.loadModel();
      } catch {
        return this.makeRejection(classifierType, now, window);
      }
    }

    // Prepare input
    const inputArray = this.prepareInput(window);

    // Run inference
    let probabilities: number[];
    try {
      probabilities = this.config.modelType === 'tflite'
        ? this.runTFLite(inputArray)
        : await this.runONNX(inputArray);
    } catch (err) {
      console.error('[MLClassifier] Inference error:', err);
      return this.makeRejection(classifierType, now, window);
    }

    // Find top predictions
    const indexed = probabilities.map((p, i) => ({ index: i, prob: p }));
    indexed.sort((a, b) => b.prob - a.prob);

    const top = indexed[0]!;

    // Check if top prediction is the noise class
    if (
      this.config.noiseClassIndex != null &&
      top.index === this.config.noiseClassIndex
    ) {
      return {
        gestureId: null,
        gestureName: null,
        confidence: 1 - top.prob,
        classifierType,
        rawScore: top.prob,
        timestamp: now,
        windowDuration: window.endTime - window.startTime,
        accepted: false,
        rejectionReason: 'noise_class_match',
        alternatives: indexed.slice(1, 4).map((item) => ({
          gestureId: this.config.classMap[item.index] ?? `class_${item.index}`,
          confidence: item.prob,
          rawScore: item.prob,
        })),
      };
    }

    const gestureId = this.config.classMap[top.index] ?? `class_${top.index}`;
    const gestureName =
      this.config.classNameMap?.[top.index] ?? gestureId;

    return {
      gestureId,
      gestureName,
      confidence: top.prob,
      classifierType,
      rawScore: top.prob,
      timestamp: now,
      windowDuration: window.endTime - window.startTime,
      accepted: true,
      alternatives: indexed.slice(1, 4).map((item) => ({
        gestureId: this.config.classMap[item.index] ?? `class_${item.index}`,
        confidence: item.prob,
        rawScore: item.prob,
      })),
    };
  }

  // ─── Input preparation ──────────────────────────────────────────────────

  private prepareInput(window: IMUWindow): Float32Array {
    let input: Float32Array;

    if (this.config.rawSampleInput) {
      // Flatten raw samples: [ax0, ay0, az0, gx0, gy0, gz0, ax1, ...]
      const axes = this.config.axes ?? window.axes;
      input = new Float32Array(window.samples.length * axes);
      for (let i = 0; i < window.samples.length; i++) {
        const s = window.samples[i]!;
        const offset = i * axes;
        input[offset] = s.ax;
        input[offset + 1] = s.ay;
        input[offset + 2] = s.az;
        if (axes === 6) {
          input[offset + 3] = s.gx ?? 0;
          input[offset + 4] = s.gy ?? 0;
          input[offset + 5] = s.gz ?? 0;
        }
      }
    } else {
      // Extract feature vector
      const features = extractFeatures(
        window,
        this.config.includeFrequencyFeatures !== false,
      );
      input = new Float32Array(features.flat);
    }

    // Z-score normalize
    if (this.config.normalizeInput !== false) {
      zScoreNormalize(input);
    }

    // Validate input length
    if (this.config.inputLength && input.length !== this.config.inputLength) {
      console.warn(
        `[MLClassifier] Input length mismatch: got ${input.length}, ` +
        `expected ${this.config.inputLength}. Padding/truncating.`,
      );
      const corrected = new Float32Array(this.config.inputLength);
      corrected.set(input.subarray(0, this.config.inputLength));
      return corrected;
    }

    return input;
  }

  // ─── Runtime inference ──────────────────────────────────────────────────

  private runTFLite(input: Float32Array): number[] {
    if (!this.tfliteModel) throw new Error('TFLite model not loaded');

    // react-native-fast-tflite runSync takes array of typed arrays
    const outputs = this.tfliteModel.runSync([input]);
    const output = outputs[0];
    if (output == null) {
      throw new Error('TFLite model returned no outputs');
    }

    // Convert to regular number array
    if (output instanceof Float32Array) {
      return Array.from(output);
    }
    if (ArrayBuffer.isView(output)) {
      return Array.from(output as unknown as ArrayLike<number>);
    }
    if (Array.isArray(output)) {
      return output.map((value) => Number(value));
    }
    throw new Error('Unsupported TFLite output type');
  }

  private async runONNX(input: Float32Array): Promise<number[]> {
    if (!this.onnxSession) throw new Error('ONNX session not loaded');

    const ort = require('onnxruntime-react-native');
    const Tensor = ort.Tensor ?? ort.default?.Tensor;

    const inputTensor = new Tensor('float32', input, [1, input.length]);
    const result = await this.onnxSession.run({ input: inputTensor });

    // Get first output tensor
    const outputKey = Object.keys(result)[0]!;
    const output = result[outputKey];
    if (!output) {
      throw new Error('ONNX model returned no outputs');
    }
    const outputData = output.data;
    return Array.from(outputData);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private makeRejection(
    classifierType: ClassifierType,
    timestamp: number,
    window: IMUWindow,
  ): RecognitionResult {
    return {
      gestureId: null,
      gestureName: null,
      confidence: 0,
      classifierType,
      rawScore: 0,
      timestamp,
      windowDuration: window.endTime - window.startTime,
      accepted: false,
      rejectionReason: 'no_matching_gesture',
    };
  }
}
