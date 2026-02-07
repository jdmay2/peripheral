import type {
  HeartRateMeasurement,
  BodySensorLocation as BodySensorLocationEnum,
} from '../types/parsers';
import { BodySensorLocation } from '../types/parsers';

/**
 * Parse Heart Rate Measurement (0x2A37, NOTIFY).
 *
 * Byte layout:
 *   [0]      flags
 *              bit 0: HR format (0=uint8, 1=uint16)
 *              bits 1–2: sensor contact status (0b11=detected, 0b10=not detected)
 *              bit 3: energy expended present
 *              bit 4: RR-interval present
 *   [1–2]    HR value (uint8 or uint16 depending on bit 0)
 *   [...]    energy expended uint16 kJ (if flag bit 3)
 *   [...]    one or more uint16 RR-intervals at 1/1024s resolution (if flag bit 4)
 */
export function parseHeartRateMeasurement(
  data: DataView
): HeartRateMeasurement {
  const flags = data.getUint8(0);
  let offset = 1;

  // Heart rate value
  const is16bit = (flags & 0x01) !== 0;
  const heartRate = is16bit
    ? data.getUint16(offset, true)
    : data.getUint8(offset);
  offset += is16bit ? 2 : 1;

  // Sensor contact
  const contactBits = (flags >> 1) & 0x03;
  let sensorContact: boolean | null = null;
  if (contactBits === 0x03) {
    sensorContact = true;
  } else if (contactBits === 0x02) {
    sensorContact = false;
  }
  // 0x00 or 0x01 = not supported, leave as null

  // Energy expended
  let energyExpended: number | undefined;
  if (flags & 0x08) {
    energyExpended = data.getUint16(offset, true);
    offset += 2;
  }

  // RR-Intervals (can be multiple, packed until end of payload)
  const rrIntervals: number[] = [];
  if (flags & 0x10) {
    while (offset + 1 < data.byteLength) {
      // Convert from 1/1024s to milliseconds
      const rawRR = data.getUint16(offset, true);
      rrIntervals.push((rawRR / 1024) * 1000);
      offset += 2;
    }
  }

  return { heartRate, sensorContact, energyExpended, rrIntervals };
}

/**
 * Parse Body Sensor Location (0x2A38, READ).
 * Single uint8 enum value.
 */
export function parseBodySensorLocation(
  data: DataView
): BodySensorLocationEnum {
  const value = data.getUint8(0);
  if (value in BodySensorLocation) {
    return value as BodySensorLocationEnum;
  }
  return BodySensorLocation.Other;
}
