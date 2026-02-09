import { parseDateTime, DATE_TIME_LENGTH } from '../utils/bytes';

// ─── Current Time (0x2A2B) ──────────────────────────────────────────────────

/**
 * Parsed Current Time characteristic (0x2A2B).
 *
 * Contains the current date/time, day of week, fractions of second,
 * and an adjust reason bitmask.
 */
export interface CurrentTime {
  /** Exact date/time value */
  exactTime: Date;
  /** Day of week: 0 = unknown, 1 = Monday, ..., 7 = Sunday */
  dayOfWeek: number;
  /** Fractions of a second in 1/256th units (0–255) */
  fractions256: number;
  /** Adjust reason flags */
  adjustReason: {
    /** Manual time update */
    manualTimeUpdate: boolean;
    /** External reference time update */
    externalReferenceTimeUpdate: boolean;
    /** Change of time zone */
    changeOfTimeZone: boolean;
    /** Change of DST */
    changeOfDST: boolean;
  };
}

/**
 * Parse Current Time characteristic (0x2A2B).
 *
 * Data format (10 bytes):
 * - Bytes 0–6: Date Time (7 bytes)
 * - Byte 7: Day of Week (0 = unknown, 1 = Monday, 7 = Sunday)
 * - Byte 8: Fractions256 (1/256 s)
 * - Byte 9: Adjust Reason (bitmask)
 */
export function parseCurrentTime(data: DataView): CurrentTime {
  const exactTime = parseDateTime(data, 0);
  const dayOfWeek = data.getUint8(DATE_TIME_LENGTH);
  const fractions256 = data.getUint8(DATE_TIME_LENGTH + 1);
  const adjustReasonBits = data.getUint8(DATE_TIME_LENGTH + 2);

  return {
    exactTime,
    dayOfWeek,
    fractions256,
    adjustReason: {
      manualTimeUpdate: (adjustReasonBits & 0x01) !== 0,
      externalReferenceTimeUpdate: (adjustReasonBits & 0x02) !== 0,
      changeOfTimeZone: (adjustReasonBits & 0x04) !== 0,
      changeOfDST: (adjustReasonBits & 0x08) !== 0,
    },
  };
}

// ─── Local Time Information (0x2A0F) ────────────────────────────────────────

/**
 * Parsed Local Time Information characteristic (0x2A0F).
 */
export interface LocalTimeInfo {
  /** Time zone offset from UTC in 15-minute increments (-48 to +56) */
  timeZone: number;
  /** DST offset in hours */
  dstOffset: DSTOffset;
}

/** DST offset values as defined by the Bluetooth specification */
export enum DSTOffset {
  StandardTime = 0,
  HalfAnHourDaylightTime = 2,
  DaylightTime = 4,
  DoubleDaylightTime = 8,
  Unknown = 255,
}

/**
 * Parse Local Time Information characteristic (0x2A0F).
 *
 * Data format (2 bytes):
 * - Byte 0: Time Zone (sint8, units of 15 min from UTC)
 * - Byte 1: DST Offset (uint8)
 */
export function parseLocalTimeInfo(data: DataView): LocalTimeInfo {
  const timeZone = data.getInt8(0);
  const dstOffset = data.getUint8(1) as DSTOffset;

  return { timeZone, dstOffset };
}

// ─── Reference Time Information (0x2A14) ────────────────────────────────────

/**
 * Parsed Reference Time Information characteristic (0x2A14).
 */
export interface ReferenceTimeInfo {
  /** Time source */
  source: TimeSource;
  /** Accuracy of time information in units of 1/8 second (255 = unknown) */
  accuracy: number;
  /** Days since last update (255 = 255 or more days) */
  daysSinceUpdate: number;
  /** Hours since last update (255 = 255 or more hours) */
  hoursSinceUpdate: number;
}

/** Time source values as defined by the Bluetooth specification */
export enum TimeSource {
  Unknown = 0,
  NetworkTimeProtocol = 1,
  GPS = 2,
  RadioTimeSignal = 3,
  Manual = 4,
  AtomicClock = 5,
  CellularNetwork = 6,
}

/**
 * Parse Reference Time Information characteristic (0x2A14).
 *
 * Data format (4 bytes):
 * - Byte 0: Time Source (uint8)
 * - Byte 1: Accuracy (uint8, 1/8s units, 255 = unknown)
 * - Byte 2: Days since update (uint8, 255 = 255+)
 * - Byte 3: Hours since update (uint8, 255 = 255+)
 */
export function parseReferenceTimeInfo(data: DataView): ReferenceTimeInfo {
  return {
    source: data.getUint8(0) as TimeSource,
    accuracy: data.getUint8(1),
    daysSinceUpdate: data.getUint8(2),
    hoursSinceUpdate: data.getUint8(3),
  };
}
