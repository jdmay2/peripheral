import type {
  WeightMeasurement,
  BodyCompositionMeasurement,
} from '../types/parsers';
import { parseDateTime, DATE_TIME_LENGTH } from '../utils/bytes';

/**
 * Parse Weight Measurement (0x2A9D, INDICATE).
 *
 * Byte layout:
 *   [0]       flags (uint8)
 *               bit 0: imperial units (0=SI kg, 1=Imperial lb)
 *               bit 1: timestamp present
 *               bit 2: user ID present
 *               bit 3: BMI and height present
 *   [1–2]     weight (uint16, resolution 0.005 kg or 0.01 lb)
 *   [...]     timestamp (7 bytes, if flag bit 1)
 *   [...]     user ID (uint8, if flag bit 2)
 *   [...]     BMI (uint16, 0.1 resolution, if flag bit 3)
 *   [...]     height (uint16, 0.001m or 0.1in, if flag bit 3)
 */
export function parseWeightMeasurement(data: DataView): WeightMeasurement {
  const flags = data.getUint8(0);
  let offset = 1;

  const isImperial = (flags & 0x01) !== 0;
  const unit = isImperial ? 'lb' : 'kg';
  const rawWeight = data.getUint16(offset, true);
  const weight = isImperial ? rawWeight * 0.01 : rawWeight * 0.005;
  offset += 2;

  let timestamp: Date | undefined;
  if (flags & 0x02) {
    timestamp = parseDateTime(data, offset);
    offset += DATE_TIME_LENGTH;
  }

  let userId: number | undefined;
  if (flags & 0x04) {
    userId = data.getUint8(offset);
    offset += 1;
  }

  let bmi: number | undefined;
  let height: number | undefined;
  if (flags & 0x08) {
    bmi = data.getUint16(offset, true) * 0.1;
    offset += 2;
    const rawHeight = data.getUint16(offset, true);
    height = isImperial ? rawHeight * 0.1 : rawHeight * 0.001;
  }

  return { weight, unit, timestamp, userId, bmi, height };
}

/**
 * Parse Body Composition Measurement (0x2A9C, INDICATE).
 *
 * Uses 16-bit flags controlling 12+ optional uint16 fields.
 * Each field at 0.1 resolution unless otherwise noted.
 */
export function parseBodyCompositionMeasurement(
  data: DataView
): BodyCompositionMeasurement {
  const flags = data.getUint16(0, true);
  let offset = 2;

  const isImperial = (flags & 0x0001) !== 0;
  const unit = isImperial ? 'lb' : 'kg';

  const bodyFatPercentage = data.getUint16(offset, true) * 0.1;
  offset += 2;

  let timestamp: Date | undefined;
  if (flags & 0x0002) {
    timestamp = parseDateTime(data, offset);
    offset += DATE_TIME_LENGTH;
  }

  let userId: number | undefined;
  if (flags & 0x0004) {
    userId = data.getUint8(offset);
    offset += 1;
  }

  let basalMetabolism: number | undefined;
  if (flags & 0x0008) {
    basalMetabolism = data.getUint16(offset, true) * 0.1;
    offset += 2;
  }

  let musclePercentage: number | undefined;
  if (flags & 0x0010) {
    musclePercentage = data.getUint16(offset, true) * 0.1;
    offset += 2;
  }

  let muscleMass: number | undefined;
  if (flags & 0x0020) {
    muscleMass = data.getUint16(offset, true) * 0.1;
    offset += 2;
  }

  let fatFreeMass: number | undefined;
  if (flags & 0x0040) {
    fatFreeMass = data.getUint16(offset, true) * 0.1;
    offset += 2;
  }

  let softLeanMass: number | undefined;
  if (flags & 0x0080) {
    softLeanMass = data.getUint16(offset, true) * 0.1;
    offset += 2;
  }

  let bodyWaterMass: number | undefined;
  if (flags & 0x0100) {
    bodyWaterMass = data.getUint16(offset, true) * 0.1;
    offset += 2;
  }

  let impedance: number | undefined;
  if (flags & 0x0200) {
    impedance = data.getUint16(offset, true) * 0.1;
    offset += 2;
  }

  let weight: number | undefined;
  if (flags & 0x0400) {
    const rawWeight = data.getUint16(offset, true);
    weight = isImperial ? rawWeight * 0.01 : rawWeight * 0.005;
    offset += 2;
  }

  let height: number | undefined;
  if (flags & 0x0800) {
    const rawHeight = data.getUint16(offset, true);
    height = isImperial ? rawHeight * 0.1 : rawHeight * 0.001;
  }

  return {
    bodyFatPercentage,
    unit,
    timestamp,
    userId,
    basalMetabolism,
    musclePercentage,
    muscleMass,
    fatFreeMass,
    softLeanMass,
    bodyWaterMass,
    impedance,
    weight,
    height,
  };
}
