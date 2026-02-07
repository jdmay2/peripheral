import type { GlucoseMeasurement } from '../types/parsers';
import { readSFLOAT } from '../utils/ieee11073';
import { parseDateTime, DATE_TIME_LENGTH } from '../utils/bytes';

/**
 * Parse Glucose Measurement (0x2A18, NOTIFY).
 *
 * Byte layout:
 *   [0]      flags
 *              bit 0: time offset present
 *              bit 1: concentration, type & location present
 *              bit 2: concentration units (0=kg/L, 1=mol/L)
 *              bit 3: sensor status annunciation present
 *              bit 4: context info follows
 *   [1–2]    sequence number (uint16)
 *   [3–9]    base time (7 bytes)
 *   [...]    time offset (sint16 minutes, if flag bit 0)
 *   [...]    concentration (SFLOAT, if flag bit 1)
 *   [...]    type-location nibble pair (uint8, if flag bit 1)
 *   [...]    sensor status annunciation (uint16, if flag bit 3)
 */
export function parseGlucoseMeasurement(data: DataView): GlucoseMeasurement {
  const flags = data.getUint8(0);
  let offset = 1;

  const sequenceNumber = data.getUint16(offset, true);
  offset += 2;

  const baseTime = parseDateTime(data, offset);
  offset += DATE_TIME_LENGTH;

  let timeOffset: number | undefined;
  if (flags & 0x01) {
    timeOffset = data.getInt16(offset, true);
    offset += 2;
  }

  let concentration: number | undefined;
  let concentrationUnit: 'kg/L' | 'mol/L' | undefined;
  let type: number | undefined;
  let location: number | undefined;

  if (flags & 0x02) {
    concentration = readSFLOAT(data, offset);
    concentrationUnit = (flags & 0x04) !== 0 ? 'mol/L' : 'kg/L';
    offset += 2;

    const typeLocation = data.getUint8(offset);
    type = typeLocation & 0x0f;
    location = (typeLocation >> 4) & 0x0f;
    offset += 1;
  }

  let sensorStatus: number | undefined;
  if (flags & 0x08) {
    sensorStatus = data.getUint16(offset, true);
  }

  return {
    sequenceNumber,
    baseTime,
    timeOffset,
    concentration,
    concentrationUnit,
    type,
    location,
    sensorStatus,
  };
}

// ─── Record Access Control Point (RACP, 0x2A52) helpers ──────────────────────

export const RACPOpCode = {
  ReportStoredRecords: 0x01,
  DeleteStoredRecords: 0x02,
  AbortOperation: 0x03,
  ReportNumberOfStoredRecords: 0x04,
  NumberOfStoredRecordsResponse: 0x05,
  ResponseCode: 0x06,
} as const;

export const RACPOperator = {
  Null: 0x00,
  AllRecords: 0x01,
  LessThanOrEqual: 0x02,
  GreaterThanOrEqual: 0x03,
  WithinRange: 0x04,
  FirstRecord: 0x05,
  LastRecord: 0x06,
} as const;

/** Build RACP command to report all stored records */
export function buildRACPReportAll(): number[] {
  return [RACPOpCode.ReportStoredRecords, RACPOperator.AllRecords];
}

/** Build RACP command to get the count of stored records */
export function buildRACPReportCount(): number[] {
  return [
    RACPOpCode.ReportNumberOfStoredRecords,
    RACPOperator.AllRecords,
  ];
}

/** Build RACP command to delete all stored records */
export function buildRACPDeleteAll(): number[] {
  return [RACPOpCode.DeleteStoredRecords, RACPOperator.AllRecords];
}

/** Build RACP abort operation command */
export function buildRACPAbort(): number[] {
  return [RACPOpCode.AbortOperation, RACPOperator.Null];
}
