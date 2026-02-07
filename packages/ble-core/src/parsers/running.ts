import type { RSCMeasurement } from '../types/parsers';

/**
 * Parse RSC Measurement (0x2A53, NOTIFY).
 *
 * Byte layout:
 *   [0]      flags
 *              bit 0: stride length present
 *              bit 1: total distance present
 *              bit 2: walking/running status (0=running, 1=walking)
 *   [1–2]    instantaneous speed (uint16, 1/256 m/s)
 *   [3]      instantaneous cadence (uint8, steps/min)
 *   [4–5]    stride length (uint16, 0.01m, if flag bit 0)
 *   [...]    total distance (uint32, 0.1m, if flag bit 1)
 */
export function parseRSCMeasurement(data: DataView): RSCMeasurement {
  const flags = data.getUint8(0);
  let offset = 1;

  const speedMs = data.getUint16(offset, true) / 256;
  offset += 2;

  const cadence = data.getUint8(offset);
  offset += 1;

  const isWalking = (flags & 0x04) !== 0;

  let strideLength: number | undefined;
  if (flags & 0x01) {
    strideLength = data.getUint16(offset, true) * 0.01;
    offset += 2;
  }

  let totalDistance: number | undefined;
  if (flags & 0x02) {
    totalDistance = data.getUint32(offset, true) * 0.1;
  }

  return { speedMs, cadence, strideLength, totalDistance, isWalking };
}
