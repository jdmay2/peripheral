import type {
  CSCMeasurement,
  CSCComputed,
  CyclingPowerMeasurement,
} from '../types/parsers';

/**
 * Parse CSC Measurement (0x2A5B, NOTIFY).
 *
 * Byte layout:
 *   [0]      flags
 *              bit 0: wheel revolution data present
 *              bit 1: crank revolution data present
 *   [1–6]    wheel revolutions (uint32) + last wheel event time (uint16, 1/1024s)
 *   [...]    crank revolutions (uint16) + last crank event time (uint16, 1/1024s)
 */
export function parseCSCMeasurement(data: DataView): CSCMeasurement {
  const flags = data.getUint8(0);
  let offset = 1;
  const result: CSCMeasurement = {};

  if (flags & 0x01) {
    result.cumulativeWheelRevolutions = data.getUint32(offset, true);
    offset += 4;
    result.lastWheelEventTime = data.getUint16(offset, true);
    offset += 2;
  }

  if (flags & 0x02) {
    result.cumulativeCrankRevolutions = data.getUint16(offset, true);
    offset += 2;
    result.lastCrankEventTime = data.getUint16(offset, true);
  }

  return result;
}

/**
 * Compute speed and cadence from two consecutive CSC measurements.
 *
 * @param prev Previous measurement
 * @param curr Current measurement
 * @param wheelCircumferenceM Wheel circumference in meters (default 2.105m for 700x25c)
 */
export function computeCSCValues(
  prev: CSCMeasurement,
  curr: CSCMeasurement,
  wheelCircumferenceM = 2.105
): CSCComputed {
  const result: CSCComputed = {};

  // Compute speed from wheel data
  if (
    curr.cumulativeWheelRevolutions != null &&
    prev.cumulativeWheelRevolutions != null &&
    curr.lastWheelEventTime != null &&
    prev.lastWheelEventTime != null
  ) {
    const revDelta =
      curr.cumulativeWheelRevolutions - prev.cumulativeWheelRevolutions;
    // Handle uint16 timer rollover
    const timeDelta =
      ((curr.lastWheelEventTime - prev.lastWheelEventTime) & 0xffff) / 1024;

    if (timeDelta > 0 && revDelta >= 0) {
      const distanceM = revDelta * wheelCircumferenceM;
      const speedMs = distanceM / timeDelta;
      result.speedKmh = speedMs * 3.6;
    }
  }

  // Compute cadence from crank data
  if (
    curr.cumulativeCrankRevolutions != null &&
    prev.cumulativeCrankRevolutions != null &&
    curr.lastCrankEventTime != null &&
    prev.lastCrankEventTime != null
  ) {
    const crankDelta =
      (curr.cumulativeCrankRevolutions - prev.cumulativeCrankRevolutions) &
      0xffff;
    const timeDelta =
      ((curr.lastCrankEventTime - prev.lastCrankEventTime) & 0xffff) / 1024;

    if (timeDelta > 0 && crankDelta >= 0) {
      result.cadenceRpm = (crankDelta / timeDelta) * 60;
    }
  }

  return result;
}

/**
 * Parse Cycling Power Measurement (0x2A63, NOTIFY).
 *
 * Byte layout:
 *   [0–1]    flags (uint16)
 *   [2–3]    instantaneous power (sint16, watts) — MANDATORY
 *   [...]    optional fields based on flags
 *
 * NOTE: Wheel event time in CPS uses 1/2048s resolution
 *       (different from CSC's 1/1024s).
 */
export function parseCyclingPowerMeasurement(
  data: DataView
): CyclingPowerMeasurement {
  const flags = data.getUint16(0, true);
  let offset = 2;

  const instantaneousPower = data.getInt16(offset, true);
  offset += 2;

  const result: CyclingPowerMeasurement = { instantaneousPower };

  // Bit 0: Pedal Power Balance
  if (flags & 0x0001) {
    result.pedalPowerBalance = data.getUint8(offset) * 0.5;
    result.pedalPowerBalanceReference =
      flags & 0x0002 ? 'left' : 'unknown';
    offset += 1;
  }

  // Bit 2: Accumulated Torque (uint16, 1/32 Nm)
  if (flags & 0x0004) {
    result.accumulatedTorque = data.getUint16(offset, true) / 32;
    offset += 2;
  }

  // Bit 4: Wheel Revolution Data (uint32 revs + uint16 time at 1/2048s)
  if (flags & 0x0010) {
    result.cumulativeWheelRevolutions = data.getUint32(offset, true);
    offset += 4;
    result.lastWheelEventTime = data.getUint16(offset, true);
    offset += 2;
  }

  // Bit 5: Crank Revolution Data (uint16 revs + uint16 time at 1/1024s)
  if (flags & 0x0020) {
    result.cumulativeCrankRevolutions = data.getUint16(offset, true);
    offset += 2;
    result.lastCrankEventTime = data.getUint16(offset, true);
    offset += 2;
  }

  // Bit 6: Extreme Force Magnitudes (sint16 max + sint16 min, newtons)
  if (flags & 0x0040) {
    result.maximumForce = data.getInt16(offset, true);
    offset += 2;
    result.minimumForce = data.getInt16(offset, true);
    offset += 2;
  }

  // Bit 7: Extreme Torque Magnitudes (sint16 max + sint16 min, 1/32 Nm)
  if (flags & 0x0080) {
    result.maximumTorque = data.getInt16(offset, true) / 32;
    offset += 2;
    result.minimumTorque = data.getInt16(offset, true) / 32;
  }

  return result;
}
