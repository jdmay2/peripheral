import type {
  IndoorBikeData,
  TreadmillData,
  RowerData,
} from '../types/parsers';
import { FTMSResultCode } from '../types/parsers';
import {
  getUint24LE,
  isUint16NotAvailable,
  isInt16NotAvailable,
  isUint8NotAvailable,
} from '../utils/bytes';

/**
 * Parse Indoor Bike Data (0x2AD2, NOTIFY).
 *
 * CRITICAL FTMS GOTCHA: Bit 0 has **inverted semantics**.
 * 0 = field IS present, 1 = field is NOT present.
 * All other bits follow normal convention (1 = present).
 *
 * Flag bits and field order:
 *   bit 0:  More Data (0=speed present, 1=speed NOT present) — INVERTED
 *   bit 1:  Average Speed present
 *   bit 2:  Instantaneous Cadence present
 *   bit 3:  Average Cadence present
 *   bit 4:  Total Distance present
 *   bit 5:  Resistance Level present
 *   bit 6:  Instantaneous Power present
 *   bit 7:  Average Power present
 *   bit 8:  Expended Energy present
 *   bit 9:  Heart Rate present
 *   bit 10: Metabolic Equivalent present
 *   bit 11: Elapsed Time present
 *   bit 12: Remaining Time present
 */
export function parseIndoorBikeData(data: DataView): IndoorBikeData {
  const flags = data.getUint16(0, true);
  let offset = 2;
  const result: IndoorBikeData = {};

  // Bit 0 INVERTED: 0 means speed IS present
  if (!(flags & 0x0001)) {
    const raw = data.getUint16(offset, true);
    if (!isUint16NotAvailable(raw)) {
      result.speedKmh = raw * 0.01;
    }
    offset += 2;
  }

  // Bit 1: Average Speed
  if (flags & 0x0002) {
    const raw = data.getUint16(offset, true);
    if (!isUint16NotAvailable(raw)) {
      result.averageSpeedKmh = raw * 0.01;
    }
    offset += 2;
  }

  // Bit 2: Instantaneous Cadence (0.5 RPM resolution)
  if (flags & 0x0004) {
    const raw = data.getUint16(offset, true);
    if (!isUint16NotAvailable(raw)) {
      result.cadenceRpm = raw * 0.5;
    }
    offset += 2;
  }

  // Bit 3: Average Cadence
  if (flags & 0x0008) {
    const raw = data.getUint16(offset, true);
    if (!isUint16NotAvailable(raw)) {
      result.averageCadenceRpm = raw * 0.5;
    }
    offset += 2;
  }

  // Bit 4: Total Distance (uint24, meters)
  if (flags & 0x0010) {
    result.totalDistance = getUint24LE(data, offset);
    offset += 3;
  }

  // Bit 5: Resistance Level (sint16)
  if (flags & 0x0020) {
    const raw = data.getInt16(offset, true);
    if (!isInt16NotAvailable(raw)) {
      result.resistanceLevel = raw;
    }
    offset += 2;
  }

  // Bit 6: Instantaneous Power (sint16, watts)
  if (flags & 0x0040) {
    const raw = data.getInt16(offset, true);
    if (!isInt16NotAvailable(raw)) {
      result.powerWatts = raw;
    }
    offset += 2;
  }

  // Bit 7: Average Power (sint16, watts)
  if (flags & 0x0080) {
    const raw = data.getInt16(offset, true);
    if (!isInt16NotAvailable(raw)) {
      result.averagePowerWatts = raw;
    }
    offset += 2;
  }

  // Bit 8: Expended Energy (uint16 total + uint16 per hour + uint8 per minute)
  if (flags & 0x0100) {
    const totalRaw = data.getUint16(offset, true);
    if (!isUint16NotAvailable(totalRaw)) {
      result.totalEnergy = totalRaw;
    }
    offset += 2;

    const perHourRaw = data.getUint16(offset, true);
    if (!isUint16NotAvailable(perHourRaw)) {
      result.energyPerHour = perHourRaw;
    }
    offset += 2;

    const perMinRaw = data.getUint8(offset);
    if (!isUint8NotAvailable(perMinRaw)) {
      result.energyPerMinute = perMinRaw;
    }
    offset += 1;
  }

  // Bit 9: Heart Rate (uint8)
  if (flags & 0x0200) {
    const raw = data.getUint8(offset);
    if (!isUint8NotAvailable(raw)) {
      result.heartRate = raw;
    }
    offset += 1;
  }

  // Bit 10: Metabolic Equivalent (uint8, 0.1 MET)
  if (flags & 0x0400) {
    const raw = data.getUint8(offset);
    if (!isUint8NotAvailable(raw)) {
      result.metabolicEquivalent = raw * 0.1;
    }
    offset += 1;
  }

  // Bit 11: Elapsed Time (uint16, seconds)
  if (flags & 0x0800) {
    const raw = data.getUint16(offset, true);
    if (!isUint16NotAvailable(raw)) {
      result.elapsedTime = raw;
    }
    offset += 2;
  }

  // Bit 12: Remaining Time (uint16, seconds)
  if (flags & 0x1000) {
    const raw = data.getUint16(offset, true);
    if (!isUint16NotAvailable(raw)) {
      result.remainingTime = raw;
    }
  }

  return result;
}

/**
 * Parse Treadmill Data (0x2ACD, NOTIFY).
 * Same inverted bit 0 pattern as Indoor Bike.
 */
export function parseTreadmillData(data: DataView): TreadmillData {
  const flags = data.getUint16(0, true);
  let offset = 2;
  const result: TreadmillData = {};

  // Bit 0 INVERTED: 0 means speed IS present
  if (!(flags & 0x0001)) {
    const raw = data.getUint16(offset, true);
    if (!isUint16NotAvailable(raw)) {
      result.speedKmh = raw * 0.01;
    }
    offset += 2;
  }

  // Bit 1: Average Speed
  if (flags & 0x0002) {
    const raw = data.getUint16(offset, true);
    if (!isUint16NotAvailable(raw)) {
      result.averageSpeedKmh = raw * 0.01;
    }
    offset += 2;
  }

  // Bit 2: Total Distance (uint24)
  if (flags & 0x0004) {
    result.totalDistance = getUint24LE(data, offset);
    offset += 3;
  }

  // Bit 3: Inclination + Ramp Angle
  if (flags & 0x0008) {
    const incRaw = data.getInt16(offset, true);
    if (!isInt16NotAvailable(incRaw)) {
      result.inclination = incRaw * 0.1;
    }
    offset += 2;
    const rampRaw = data.getInt16(offset, true);
    if (!isInt16NotAvailable(rampRaw)) {
      result.rampAngle = rampRaw * 0.1;
    }
    offset += 2;
  }

  // Bit 4: Elevation Gain (positive uint16 + negative uint16, 0.1m)
  if (flags & 0x0010) {
    result.positiveElevationGain = data.getUint16(offset, true) * 0.1;
    offset += 2;
    result.negativeElevationGain = data.getUint16(offset, true) * 0.1;
    offset += 2;
  }

  // Bit 5: Instantaneous Pace (uint8, 0.1 km/min)
  if (flags & 0x0020) {
    result.instantaneousPace = data.getUint8(offset) * 0.1;
    offset += 1;
  }

  // Bit 6: Average Pace
  if (flags & 0x0040) {
    result.averagePace = data.getUint8(offset) * 0.1;
    offset += 1;
  }

  // Bit 7: Expended Energy (same 5-byte format as Indoor Bike)
  if (flags & 0x0080) {
    const totalRaw = data.getUint16(offset, true);
    if (!isUint16NotAvailable(totalRaw)) result.totalEnergy = totalRaw;
    offset += 2;
    const perHourRaw = data.getUint16(offset, true);
    if (!isUint16NotAvailable(perHourRaw)) result.energyPerHour = perHourRaw;
    offset += 2;
    const perMinRaw = data.getUint8(offset);
    if (!isUint8NotAvailable(perMinRaw)) result.energyPerMinute = perMinRaw;
    offset += 1;
  }

  // Bit 8: Heart Rate
  if (flags & 0x0100) {
    const raw = data.getUint8(offset);
    if (!isUint8NotAvailable(raw)) result.heartRate = raw;
    offset += 1;
  }

  // Bit 9: Metabolic Equivalent
  if (flags & 0x0200) {
    const raw = data.getUint8(offset);
    if (!isUint8NotAvailable(raw)) result.metabolicEquivalent = raw * 0.1;
    offset += 1;
  }

  // Bit 10: Elapsed Time
  if (flags & 0x0400) {
    const raw = data.getUint16(offset, true);
    if (!isUint16NotAvailable(raw)) result.elapsedTime = raw;
    offset += 2;
  }

  // Bit 11: Remaining Time
  if (flags & 0x0800) {
    const raw = data.getUint16(offset, true);
    if (!isUint16NotAvailable(raw)) result.remainingTime = raw;
    offset += 2;
  }

  // Bit 12: Force on Belt + Power Output
  if (flags & 0x1000) {
    const forceRaw = data.getInt16(offset, true);
    if (!isInt16NotAvailable(forceRaw)) result.forceOnBelt = forceRaw;
    offset += 2;
    const powerRaw = data.getInt16(offset, true);
    if (!isInt16NotAvailable(powerRaw)) result.powerOutput = powerRaw;
  }

  return result;
}

/**
 * Parse Rower Data (0x2AD1, NOTIFY).
 * Same inverted bit 0 pattern.
 */
export function parseRowerData(data: DataView): RowerData {
  const flags = data.getUint16(0, true);
  let offset = 2;
  const result: RowerData = {};

  // Bit 0 INVERTED: 0 means stroke rate + stroke count present
  if (!(flags & 0x0001)) {
    const raw = data.getUint8(offset);
    if (!isUint8NotAvailable(raw)) {
      result.strokeRate = raw * 0.5;
    }
    offset += 1;
    result.strokeCount = data.getUint16(offset, true);
    offset += 2;
  }

  // Bit 1: Average Stroke Rate
  if (flags & 0x0002) {
    result.averageStrokeRate = data.getUint8(offset) * 0.5;
    offset += 1;
  }

  // Bit 2: Total Distance (uint24)
  if (flags & 0x0004) {
    result.totalDistance = getUint24LE(data, offset);
    offset += 3;
  }

  // Bit 3: Instantaneous Pace (uint16, seconds/500m)
  if (flags & 0x0008) {
    result.instantaneousPace = data.getUint16(offset, true);
    offset += 2;
  }

  // Bit 4: Average Pace
  if (flags & 0x0010) {
    result.averagePace = data.getUint16(offset, true);
    offset += 2;
  }

  // Bit 5: Instantaneous Power (sint16, watts)
  if (flags & 0x0020) {
    const raw = data.getInt16(offset, true);
    if (!isInt16NotAvailable(raw)) result.instantaneousPower = raw;
    offset += 2;
  }

  // Bit 6: Average Power
  if (flags & 0x0040) {
    const raw = data.getInt16(offset, true);
    if (!isInt16NotAvailable(raw)) result.averagePower = raw;
    offset += 2;
  }

  // Bit 7: Resistance Level
  if (flags & 0x0080) {
    const raw = data.getInt16(offset, true);
    if (!isInt16NotAvailable(raw)) result.resistanceLevel = raw;
    offset += 2;
  }

  // Bit 8: Expended Energy
  if (flags & 0x0100) {
    const totalRaw = data.getUint16(offset, true);
    if (!isUint16NotAvailable(totalRaw)) result.totalEnergy = totalRaw;
    offset += 2;
    const perHourRaw = data.getUint16(offset, true);
    if (!isUint16NotAvailable(perHourRaw)) result.energyPerHour = perHourRaw;
    offset += 2;
    const perMinRaw = data.getUint8(offset);
    if (!isUint8NotAvailable(perMinRaw)) result.energyPerMinute = perMinRaw;
    offset += 1;
  }

  // Bit 9: Heart Rate
  if (flags & 0x0200) {
    const raw = data.getUint8(offset);
    if (!isUint8NotAvailable(raw)) result.heartRate = raw;
    offset += 1;
  }

  // Bit 10: Metabolic Equivalent
  if (flags & 0x0400) {
    const raw = data.getUint8(offset);
    if (!isUint8NotAvailable(raw)) result.metabolicEquivalent = raw * 0.1;
    offset += 1;
  }

  // Bit 11: Elapsed Time
  if (flags & 0x0800) {
    const raw = data.getUint16(offset, true);
    if (!isUint16NotAvailable(raw)) result.elapsedTime = raw;
    offset += 2;
  }

  // Bit 12: Remaining Time
  if (flags & 0x1000) {
    const raw = data.getUint16(offset, true);
    if (!isUint16NotAvailable(raw)) result.remainingTime = raw;
  }

  return result;
}

// ─── FTMS Control Point ──────────────────────────────────────────────────────

/** FTMS Control Point op codes */
export const FTMSOpCode = {
  RequestControl: 0x00,
  Reset: 0x01,
  SetTargetSpeed: 0x02,
  SetTargetInclination: 0x03,
  SetTargetResistanceLevel: 0x04,
  SetTargetPower: 0x05,
  SetTargetHeartRate: 0x06,
  StartOrResume: 0x07,
  StopOrPause: 0x08,
  SetIndoorBikeSimulation: 0x11,
  SetWheelCircumference: 0x12,
  SpinDownControl: 0x13,
  SetTargetedCadence: 0x14,
  ResponseCode: 0x80,
} as const;

/** Build a FTMS Control Point command to request control */
export function buildFTMSRequestControl(): number[] {
  return [FTMSOpCode.RequestControl];
}

/** Build a FTMS start/resume command */
export function buildFTMSStart(): number[] {
  return [FTMSOpCode.StartOrResume];
}

/** Build a FTMS stop command (0x01=stop, 0x02=pause) */
export function buildFTMSStop(pause = false): number[] {
  return [FTMSOpCode.StopOrPause, pause ? 0x02 : 0x01];
}

/** Build a set target power command (sint16 watts) */
export function buildFTMSSetTargetPower(watts: number): number[] {
  const low = watts & 0xff;
  const high = (watts >> 8) & 0xff;
  return [FTMSOpCode.SetTargetPower, low, high];
}

/** Build a set target resistance level command (uint8, 0.1 resolution) */
export function buildFTMSSetResistance(level: number): number[] {
  const raw = Math.round(level * 10);
  return [FTMSOpCode.SetTargetResistanceLevel, raw & 0xff];
}

/**
 * Build an indoor bike simulation command.
 *   windSpeed: sint16 at 0.001 m/s
 *   grade: sint16 at 0.01%
 *   crr: uint8 at 0.0001
 *   cw: uint8 at 0.01 kg/m
 */
export function buildFTMSSetSimulation(
  windSpeedMs: number,
  gradePercent: number,
  crr: number,
  cwKgM: number
): number[] {
  const wind = Math.round(windSpeedMs * 1000);
  const grade = Math.round(gradePercent * 100);
  const crrRaw = Math.round(crr * 10000);
  const cwRaw = Math.round(cwKgM * 100);
  return [
    FTMSOpCode.SetIndoorBikeSimulation,
    wind & 0xff,
    (wind >> 8) & 0xff,
    grade & 0xff,
    (grade >> 8) & 0xff,
    crrRaw & 0xff,
    cwRaw & 0xff,
  ];
}

/**
 * Parse FTMS Control Point response indication.
 * Format: [0x80, original_op_code, result_code]
 */
export function parseFTMSControlPointResponse(data: DataView): {
  opCode: number;
  resultCode: FTMSResultCode;
  success: boolean;
} {
  const responseCode = data.getUint8(0);
  if (responseCode !== 0x80) {
    throw new Error(
      `Expected FTMS response code 0x80, got 0x${responseCode.toString(16)}`
    );
  }
  const opCode = data.getUint8(1);
  const resultCode = data.getUint8(2) as FTMSResultCode;
  return {
    opCode,
    resultCode,
    success: resultCode === FTMSResultCode.Success,
  };
}
