/**
 * Feature extraction from IMU data windows.
 *
 * Time-domain features: mean, variance, RMS, peak-to-peak, zero-crossing rate,
 * SMA, magnitude stats, inter-axis correlation, average jerk, IQR, energy.
 *
 * Frequency-domain features: dominant frequency, spectral energy, spectral
 * entropy, spectral centroid (requires FFT — uses built-in Radix-2 DIT).
 */

import type {
  IMUSample,
  IMUWindow,
  IMUAxes,
  TimeDomainFeatures,
  FrequencyDomainFeatures,
  FeatureVector,
} from '../types';

// ─── Time-domain features ────────────────────────────────────────────────────

/**
 * Extract time-domain features from an IMU window.
 */
export function extractTimeDomainFeatures(
  samples: IMUSample[],
  axes: IMUAxes = 6,
): TimeDomainFeatures {
  const n = samples.length;
  if (n === 0) throw new Error('Cannot extract features from empty window');

  const numAxes = axes === 6 ? 6 : 3;
  const getAxisValue = (s: IMUSample, axis: number): number => {
    switch (axis) {
      case 0: return s.ax;
      case 1: return s.ay;
      case 2: return s.az;
      case 3: return s.gx ?? 0;
      case 4: return s.gy ?? 0;
      case 5: return s.gz ?? 0;
      default: return 0;
    }
  };

  // Per-axis statistics
  const mean = new Array(numAxes).fill(0);
  const variance = new Array(numAxes).fill(0);
  const rms = new Array(numAxes).fill(0);
  const mins = new Array(numAxes).fill(Infinity);
  const maxs = new Array(numAxes).fill(-Infinity);
  const zeroCrossingRate = new Array(numAxes).fill(0);

  // Collect values for IQR
  const axisValues: number[][] = Array.from({ length: numAxes }, () => []);

  // First pass: mean, min, max, collect values
  for (let i = 0; i < n; i++) {
    const sample = samples[i]!;
    for (let a = 0; a < numAxes; a++) {
      const v = getAxisValue(sample, a);
      mean[a] += v;
      if (v < mins[a]) mins[a] = v;
      if (v > maxs[a]) maxs[a] = v;
      axisValues[a]!.push(v);
    }
  }
  for (let a = 0; a < numAxes; a++) mean[a] /= n;

  // Second pass: variance, RMS, zero crossings
  for (let i = 0; i < n; i++) {
    const sample = samples[i]!;
    for (let a = 0; a < numAxes; a++) {
      const v = getAxisValue(sample, a);
      const diff = v - mean[a];
      variance[a] += diff * diff;
      rms[a] += v * v;

      if (i > 0) {
        const prev = getAxisValue(samples[i - 1]!, a);
        if ((v - mean[a]) * (prev - mean[a]) < 0) {
          zeroCrossingRate[a]++;
        }
      }
    }
  }
  for (let a = 0; a < numAxes; a++) {
    variance[a] /= n;
    rms[a] = Math.sqrt(rms[a] / n);
    zeroCrossingRate[a] /= n > 1 ? n - 1 : 1;
  }

  // Peak-to-peak
  const peakToPeak = mins.map((min, a) => maxs[a] - min);

  // IQR (interquartile range)
  const iqr = axisValues.map((vals) => {
    vals.sort((a, b) => a - b);
    const q1 = percentile(vals, 25);
    const q3 = percentile(vals, 75);
    return q3 - q1;
  });

  // Signal Magnitude Area (accel only)
  let sma = 0;
  for (let i = 0; i < n; i++) {
    const s = samples[i]!;
    sma += Math.abs(s.ax) + Math.abs(s.ay) + Math.abs(s.az);
  }
  sma /= n;

  // Acceleration magnitude statistics
  const magnitudes = new Float32Array(n);
  let magSum = 0;
  for (let i = 0; i < n; i++) {
    const { ax, ay, az } = samples[i]!;
    magnitudes[i] = Math.sqrt(ax * ax + ay * ay + az * az);
    magSum += magnitudes[i]!;
  }
  const magnitudeMean = magSum / n;
  let magVarSum = 0;
  for (let i = 0; i < n; i++) {
    const d = magnitudes[i]! - magnitudeMean;
    magVarSum += d * d;
  }
  const magnitudeVariance = magVarSum / n;

  // Inter-axis correlations [xy, xz, yz] (accel only)
  const correlations = [
    correlation(axisValues[0]!, axisValues[1]!),
    correlation(axisValues[0]!, axisValues[2]!),
    correlation(axisValues[1]!, axisValues[2]!),
  ];

  // Average jerk (derivative of acceleration magnitude)
  let jerkSum = 0;
  for (let i = 1; i < n; i++) {
    const dt = (samples[i]!.timestamp - samples[i - 1]!.timestamp) / 1000; // seconds
    if (dt > 0) {
      jerkSum += Math.abs(magnitudes[i]! - magnitudes[i - 1]!) / dt;
    }
  }
  const averageJerk = n > 1 ? jerkSum / (n - 1) : 0;

  // Total energy
  let energy = 0;
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < numAxes; a++) {
      const v = getAxisValue(samples[i]!, a);
      energy += v * v;
    }
  }

  return {
    mean,
    variance,
    rms,
    peakToPeak,
    zeroCrossingRate,
    sma,
    magnitudeMean,
    magnitudeVariance,
    correlations,
    averageJerk,
    iqr,
    energy,
  };
}

// ─── Frequency-domain features ───────────────────────────────────────────────

/**
 * Extract frequency-domain features using a built-in Radix-2 FFT.
 * No external dependencies required.
 */
export function extractFrequencyDomainFeatures(
  samples: IMUSample[],
  sampleRate: number,
  axes: IMUAxes = 6,
): FrequencyDomainFeatures {
  const numAxes = axes === 6 ? 6 : 3;
  const n = nextPowerOf2(samples.length);
  const freqResolution = sampleRate / n;

  const dominantFrequency: number[] = [];
  const spectralEnergy: number[] = [];
  const spectralEntropy: number[] = [];
  const spectralCentroid: number[] = [];

  const getAxisValue = (s: IMUSample, axis: number): number => {
    switch (axis) {
      case 0: return s.ax;
      case 1: return s.ay;
      case 2: return s.az;
      case 3: return s.gx ?? 0;
      case 4: return s.gy ?? 0;
      case 5: return s.gz ?? 0;
      default: return 0;
    }
  };

  for (let a = 0; a < numAxes; a++) {
    // Extract axis data, zero-pad to power of 2
    const real = new Float64Array(n);
    const imag = new Float64Array(n);
    for (let i = 0; i < samples.length; i++) {
      real[i] = getAxisValue(samples[i]!, a);
    }

    // Apply Hann window
    for (let i = 0; i < samples.length; i++) {
      real[i] = real[i]! * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (samples.length - 1)));
    }

    // FFT in-place
    fftRadix2(real, imag);

    // Compute power spectrum (only positive frequencies: n/2 + 1 bins)
    const halfN = n / 2;
    const power = new Float64Array(halfN);
    let totalPower = 0;
    let maxPower = 0;
    let maxIndex = 0;
    let centroidNum = 0;

    for (let i = 1; i < halfN; i++) { // skip DC
      power[i] = real[i]! * real[i]! + imag[i]! * imag[i]!;
      totalPower += power[i]!;
      if (power[i]! > maxPower) {
        maxPower = power[i]!;
        maxIndex = i;
      }
      centroidNum += i * freqResolution * power[i]!;
    }

    dominantFrequency.push(maxIndex * freqResolution);
    spectralEnergy.push(totalPower);

    // Spectral centroid
    spectralCentroid.push(totalPower > 0 ? centroidNum / totalPower : 0);

    // Spectral entropy
    let entropy = 0;
    if (totalPower > 0) {
      for (let i = 1; i < halfN; i++) {
        const p = power[i]! / totalPower;
        if (p > 0) entropy -= p * Math.log2(p);
      }
    }
    spectralEntropy.push(entropy);
  }

  return { dominantFrequency, spectralEnergy, spectralEntropy, spectralCentroid };
}

// ─── Combined feature extraction ─────────────────────────────────────────────

/**
 * Extract full feature vector from an IMU window.
 */
export function extractFeatures(
  window: IMUWindow,
  includeFrequency: boolean = false,
): FeatureVector {
  const timeDomain = extractTimeDomainFeatures(window.samples, window.axes);
  const frequencyDomain = includeFrequency
    ? extractFrequencyDomainFeatures(window.samples, window.sampleRate, window.axes)
    : undefined;

  // Build flat array for ML input
  const flat: number[] = [
    ...timeDomain.mean,
    ...timeDomain.variance,
    ...timeDomain.rms,
    ...timeDomain.peakToPeak,
    ...timeDomain.zeroCrossingRate,
    timeDomain.sma,
    timeDomain.magnitudeMean,
    timeDomain.magnitudeVariance,
    ...timeDomain.correlations,
    timeDomain.averageJerk,
    ...timeDomain.iqr,
    timeDomain.energy,
  ];

  if (frequencyDomain) {
    flat.push(
      ...frequencyDomain.dominantFrequency,
      ...frequencyDomain.spectralEnergy,
      ...frequencyDomain.spectralEntropy,
      ...frequencyDomain.spectralCentroid,
    );
  }

  return { timeDomain, frequencyDomain, flat };
}

// ─── Built-in Radix-2 DIT FFT ───────────────────────────────────────────────

/** In-place Radix-2 Decimation-in-Time FFT. Arrays must be power-of-2 length. */
function fftRadix2(real: Float64Array, imag: Float64Array): void {
  const n = real.length;
  if (n <= 1) return;

  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      [real[i], real[j]] = [real[j]!, real[i]!];
      [imag[i], imag[j]] = [imag[j]!, imag[i]!];
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Butterfly operations
  for (let size = 2; size <= n; size *= 2) {
    const halfSize = size / 2;
    const angle = (-2 * Math.PI) / size;
    const wReal = Math.cos(angle);
    const wImag = Math.sin(angle);

    for (let i = 0; i < n; i += size) {
      let curReal = 1;
      let curImag = 0;

      for (let k = 0; k < halfSize; k++) {
        const evenIdx = i + k;
        const oddIdx = i + k + halfSize;

        const tReal = curReal * real[oddIdx]! - curImag * imag[oddIdx]!;
        const tImag = curReal * imag[oddIdx]! + curImag * real[oddIdx]!;

        real[oddIdx] = real[evenIdx]! - tReal;
        imag[oddIdx] = imag[evenIdx]! - tImag;
        real[evenIdx] = real[evenIdx]! + tReal;
        imag[evenIdx] = imag[evenIdx]! + tImag;

        const newCurReal = curReal * wReal - curImag * wImag;
        curImag = curReal * wImag + curImag * wReal;
        curReal = newCurReal;
      }
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function percentile(sortedArr: number[], p: number): number {
  const idx = ((p / 100) * (sortedArr.length - 1));
  const lower = Math.floor(idx);
  const frac = idx - lower;
  if (lower + 1 >= sortedArr.length) return sortedArr[lower]!;
  return sortedArr[lower]! + frac * (sortedArr[lower + 1]! - sortedArr[lower]!);
}

function correlation(a: number[], b: number[]): number {
  const n = a.length;
  if (n === 0) return 0;
  let sumA = 0, sumB = 0;
  for (let i = 0; i < n; i++) { sumA += a[i]!; sumB += b[i]!; }
  const meanA = sumA / n;
  const meanB = sumB / n;

  let cov = 0, varA = 0, varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i]! - meanA;
    const db = b[i]! - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }

  const denom = Math.sqrt(varA * varB);
  return denom > 0 ? cov / denom : 0;
}

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}
