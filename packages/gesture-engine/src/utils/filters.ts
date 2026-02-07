/**
 * Digital signal processing for IMU data.
 *
 * Implements real-time IIR Butterworth filters for preprocessing
 * accelerometer and gyroscope data before feature extraction.
 */

// ─── Butterworth filter coefficients ─────────────────────────────────────────

interface FilterCoefficients {
  /** Feed-forward (numerator) coefficients. */
  b: number[];
  /** Feedback (denominator) coefficients. */
  a: number[];
}

/**
 * Compute 2nd-order Butterworth low-pass filter coefficients.
 *
 * Uses bilinear transform (Tustin's method) to convert analog
 * prototype to digital filter at the given sample rate.
 */
export function butterworthLowPass(cutoffHz: number, sampleRate: number): FilterCoefficients {
  const wc = Math.tan((Math.PI * cutoffHz) / sampleRate);
  const wc2 = wc * wc;
  const sqrt2 = Math.SQRT2;
  const k = 1 + sqrt2 * wc + wc2;

  return {
    b: [wc2 / k, (2 * wc2) / k, wc2 / k],
    a: [1, (2 * (wc2 - 1)) / k, (1 - sqrt2 * wc + wc2) / k],
  };
}

/**
 * Compute 2nd-order Butterworth high-pass filter coefficients.
 */
export function butterworthHighPass(cutoffHz: number, sampleRate: number): FilterCoefficients {
  const wc = Math.tan((Math.PI * cutoffHz) / sampleRate);
  const wc2 = wc * wc;
  const sqrt2 = Math.SQRT2;
  const k = 1 + sqrt2 * wc + wc2;

  return {
    b: [1 / k, -2 / k, 1 / k],
    a: [1, (2 * (wc2 - 1)) / k, (1 - sqrt2 * wc + wc2) / k],
  };
}

// ─── IIR filter state ────────────────────────────────────────────────────────

/**
 * Real-time 2nd-order IIR (biquad) filter.
 * Maintains internal state for sample-by-sample processing.
 */
export class BiquadFilter {
  private b: number[];
  private a: number[];
  // Direct Form II transposed state
  private z1 = 0;
  private z2 = 0;

  constructor(coefficients: FilterCoefficients) {
    this.b = coefficients.b;
    this.a = coefficients.a;
  }

  /** Process a single sample. Returns the filtered value. */
  process(input: number): number {
    const output = this.b[0]! * input + this.z1;
    this.z1 = this.b[1]! * input - this.a[1]! * output + this.z2;
    this.z2 = this.b[2]! * input - this.a[2]! * output;
    return output;
  }

  /** Process an array of samples in-place. */
  processArray(data: Float32Array): Float32Array {
    for (let i = 0; i < data.length; i++) {
      data[i] = this.process(data[i]!);
    }
    return data;
  }

  /** Reset filter state (call when data stream restarts). */
  reset(): void {
    this.z1 = 0;
    this.z2 = 0;
  }
}

// ─── Multi-axis filter bank ──────────────────────────────────────────────────

/**
 * Bank of filters for processing multi-axis IMU data.
 * One filter instance per axis to maintain independent state.
 */
export class FilterBank {
  private filters: BiquadFilter[];
  readonly numAxes: number;

  constructor(coefficients: FilterCoefficients, numAxes: number) {
    this.numAxes = numAxes;
    this.filters = Array.from({ length: numAxes }, () => new BiquadFilter(coefficients));
  }

  /** Process one sample per axis. Returns filtered values. */
  process(values: number[]): number[] {
    return values.map((v, i) => this.filters[i]!.process(v));
  }

  /** Reset all filter states. */
  reset(): void {
    this.filters.forEach((f) => f.reset());
  }
}

// ─── Preprocessing pipeline ──────────────────────────────────────────────────

export interface PreprocessingConfig {
  sampleRate: number;
  lowPassCutoff: number;
  highPassCutoff: number;
  numAxes: number;
}

/**
 * Complete preprocessing pipeline: low-pass → high-pass (gravity removal).
 */
export class PreprocessingPipeline {
  private lowPass: FilterBank;
  private highPass: FilterBank;

  constructor(config: PreprocessingConfig) {
    const lpCoeffs = butterworthLowPass(config.lowPassCutoff, config.sampleRate);
    const hpCoeffs = butterworthHighPass(config.highPassCutoff, config.sampleRate);
    this.lowPass = new FilterBank(lpCoeffs, config.numAxes);
    this.highPass = new FilterBank(hpCoeffs, config.numAxes);
  }

  /** Process a single multi-axis sample through the full chain. */
  process(values: number[]): number[] {
    const smoothed = this.lowPass.process(values);
    return this.highPass.process(smoothed);
  }

  /** Reset all filter states. */
  reset(): void {
    this.lowPass.reset();
    this.highPass.reset();
  }
}

// ─── Normalization ───────────────────────────────────────────────────────────

/** Z-score normalize an array in-place. Returns {mean, std}. */
export function zScoreNormalize(data: Float32Array): { mean: number; std: number } {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i]!;
  const mean = sum / data.length;

  let sqSum = 0;
  for (let i = 0; i < data.length; i++) {
    const d = data[i]! - mean;
    sqSum += d * d;
  }
  const std = Math.sqrt(sqSum / data.length) || 1; // avoid division by zero

  for (let i = 0; i < data.length; i++) {
    data[i] = (data[i]! - mean) / std;
  }

  return { mean, std };
}

/** Min-max normalize to [0, 1] range. */
export function minMaxNormalize(data: Float32Array): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    if (data[i]! < min) min = data[i]!;
    if (data[i]! > max) max = data[i]!;
  }
  const range = max - min || 1;
  for (let i = 0; i < data.length; i++) {
    data[i] = (data[i]! - min) / range;
  }
  return { min, max };
}
