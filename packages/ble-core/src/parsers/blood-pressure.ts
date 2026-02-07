import type {
  BloodPressureMeasurement,
  BloodPressureStatus,
} from '../types/parsers';
import { readSFLOAT } from '../utils/ieee11073';
import { parseDateTime, DATE_TIME_LENGTH } from '../utils/bytes';

/**
 * Parse Blood Pressure Measurement (0x2A35, INDICATE).
 *
 * Byte layout:
 *   [0]       flags
 *               bit 0: units (0=mmHg, 1=kPa)
 *               bit 1: timestamp present
 *               bit 2: pulse rate present
 *               bit 3: user ID present
 *               bit 4: measurement status present
 *   [1–2]     systolic (SFLOAT)
 *   [3–4]     diastolic (SFLOAT)
 *   [5–6]     mean arterial pressure (SFLOAT)
 *   [7–13]    timestamp (7 bytes, if flag bit 1)
 *   [...]     pulse rate (SFLOAT, if flag bit 2)
 *   [...]     user ID (uint8, if flag bit 3)
 *   [...]     measurement status (uint16, if flag bit 4)
 */
export function parseBloodPressureMeasurement(
  data: DataView
): BloodPressureMeasurement {
  const flags = data.getUint8(0);
  let offset = 1;

  const unit = (flags & 0x01) === 0 ? 'mmHg' : 'kPa';

  const systolic = readSFLOAT(data, offset);
  offset += 2;
  const diastolic = readSFLOAT(data, offset);
  offset += 2;
  const meanArterialPressure = readSFLOAT(data, offset);
  offset += 2;

  let timestamp: Date | undefined;
  if (flags & 0x02) {
    timestamp = parseDateTime(data, offset);
    offset += DATE_TIME_LENGTH;
  }

  let pulseRate: number | undefined;
  if (flags & 0x04) {
    pulseRate = readSFLOAT(data, offset);
    offset += 2;
  }

  let userId: number | undefined;
  if (flags & 0x08) {
    userId = data.getUint8(offset);
    offset += 1;
  }

  let status: BloodPressureStatus | undefined;
  if (flags & 0x10) {
    const statusBits = data.getUint16(offset, true);
    status = {
      bodyMovement: (statusBits & 0x0001) !== 0,
      cuffFitTooLoose: (statusBits & 0x0002) !== 0,
      irregularPulse: (statusBits & 0x0004) !== 0,
      pulseRateExceedsUpperLimit: (statusBits & 0x0008) !== 0,
      pulseRateExceedsLowerLimit: (statusBits & 0x0010) !== 0,
      improperMeasurementPosition: (statusBits & 0x0020) !== 0,
    };
  }

  return {
    systolic,
    diastolic,
    meanArterialPressure,
    unit,
    timestamp,
    pulseRate,
    userId,
    status,
  };
}
