import type {
  PLXSpotCheckMeasurement,
  PLXContinuousMeasurement,
} from '../types/parsers';
import { readSFLOAT } from '../utils/ieee11073';
import { parseDateTime, DATE_TIME_LENGTH } from '../utils/bytes';

/**
 * Parse PLX Spot-Check Measurement (0x2A5E, INDICATE).
 *
 * Byte layout:
 *   [0]      flags
 *              bit 0: timestamp present
 *              bit 1: measurement status present
 *              bit 2: device and sensor status present
 *              bit 3: pulse amplitude index present
 *   [1–2]    SpO2 (SFLOAT %)
 *   [3–4]    Pulse Rate (SFLOAT BPM)
 *   [...]    optional fields based on flags
 */
export function parsePLXSpotCheck(data: DataView): PLXSpotCheckMeasurement {
  const flags = data.getUint8(0);
  let offset = 1;

  const spo2 = readSFLOAT(data, offset);
  offset += 2;
  const pulseRate = readSFLOAT(data, offset);
  offset += 2;

  let timestamp: Date | undefined;
  if (flags & 0x01) {
    timestamp = parseDateTime(data, offset);
    offset += DATE_TIME_LENGTH;
  }

  let measurementStatus: number | undefined;
  if (flags & 0x02) {
    measurementStatus = data.getUint16(offset, true);
    offset += 2;
  }

  let deviceAndSensorStatus: number | undefined;
  if (flags & 0x04) {
    // 3 bytes: uint16 device status + uint8 sensor status
    deviceAndSensorStatus =
      data.getUint16(offset, true) | (data.getUint8(offset + 2) << 16);
    offset += 3;
  }

  let pulseAmplitudeIndex: number | undefined;
  if (flags & 0x08) {
    pulseAmplitudeIndex = readSFLOAT(data, offset);
  }

  return {
    spo2,
    pulseRate,
    timestamp,
    measurementStatus,
    deviceAndSensorStatus,
    pulseAmplitudeIndex,
  };
}

/**
 * Parse PLX Continuous Measurement (0x2A5F, NOTIFY).
 *
 * Byte layout:
 *   [0]      flags
 *              bit 0: SpO2PR-Fast present
 *              bit 1: SpO2PR-Slow present
 *              bit 2: measurement status present
 *              bit 3: device and sensor status present
 *              bit 4: pulse amplitude index present
 *   [1–2]    SpO2 normal (SFLOAT)
 *   [3–4]    Pulse Rate normal (SFLOAT)
 *   [...]    optional fast/slow/status fields
 */
export function parsePLXContinuous(
  data: DataView
): PLXContinuousMeasurement {
  const flags = data.getUint8(0);
  let offset = 1;

  const spo2 = readSFLOAT(data, offset);
  offset += 2;
  const pulseRate = readSFLOAT(data, offset);
  offset += 2;

  const result: PLXContinuousMeasurement = { spo2, pulseRate };

  if (flags & 0x01) {
    result.spo2Fast = readSFLOAT(data, offset);
    offset += 2;
    result.pulseRateFast = readSFLOAT(data, offset);
    offset += 2;
  }

  if (flags & 0x02) {
    result.spo2Slow = readSFLOAT(data, offset);
    offset += 2;
    result.pulseRateSlow = readSFLOAT(data, offset);
    offset += 2;
  }

  if (flags & 0x04) {
    result.measurementStatus = data.getUint16(offset, true);
    offset += 2;
  }

  if (flags & 0x08) {
    result.deviceAndSensorStatus =
      data.getUint16(offset, true) | (data.getUint8(offset + 2) << 16);
    offset += 3;
  }

  if (flags & 0x10) {
    result.pulseAmplitudeIndex = readSFLOAT(data, offset);
  }

  return result;
}
