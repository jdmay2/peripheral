/**
 * Create a DataView from a number array (as returned by react-native-ble-manager).
 * react-native-ble-manager returns characteristic values as number[].
 */
export function toDataView(bytes: number[]): DataView {
  const buffer = new ArrayBuffer(bytes.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    view[i] = bytes[i]! & 0xff;
  }
  return new DataView(buffer);
}

/**
 * Create a DataView from a base64 string (as returned by react-native-ble-plx).
 */
export function base64ToDataView(base64: string): DataView {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new DataView(bytes.buffer);
}

/**
 * Convert a DataView or ArrayBuffer to a hex string for debugging.
 */
export function toHexString(
  data: DataView | ArrayBuffer | number[]
): string {
  let bytes: Uint8Array;
  if (Array.isArray(data)) {
    bytes = new Uint8Array(data);
  } else if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else {
    bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
}

/**
 * Read a uint24 (3 bytes, little-endian) from a DataView.
 * Used by Fitness Machine total distance fields.
 */
export function getUint24LE(data: DataView, offset: number): number {
  return (
    data.getUint8(offset) |
    (data.getUint8(offset + 1) << 8) |
    (data.getUint8(offset + 2) << 16)
  );
}

/**
 * Read a sint24 (3 bytes, little-endian, signed) from a DataView.
 * Used by Environmental Sensing elevation.
 */
export function getInt24LE(data: DataView, offset: number): number {
  const unsigned = getUint24LE(data, offset);
  return unsigned >= 0x800000 ? unsigned - 0x1000000 : unsigned;
}

/**
 * Parse a Bluetooth Date Time field (7 bytes).
 * Format: uint16 year + uint8 month + uint8 day + uint8 hours + uint8 minutes + uint8 seconds
 */
export function parseDateTime(data: DataView, offset: number): Date {
  const year = data.getUint16(offset, true);
  const month = data.getUint8(offset + 2); // 1–12
  const day = data.getUint8(offset + 3);
  const hours = data.getUint8(offset + 4);
  const minutes = data.getUint8(offset + 5);
  const seconds = data.getUint8(offset + 6);
  return new Date(year, month - 1, day, hours, minutes, seconds);
}

/** Byte length of a Bluetooth Date Time field */
export const DATE_TIME_LENGTH = 7;

/**
 * Check if a uint16 value is the "Data Not Available" sentinel.
 */
export function isUint16NotAvailable(value: number): boolean {
  return value === 0xffff;
}

/**
 * Check if a sint16 value is the "Data Not Available" sentinel.
 */
export function isInt16NotAvailable(value: number): boolean {
  return value === 0x7fff;
}

/**
 * Check if a uint8 value is the "Data Not Available" sentinel.
 */
export function isUint8NotAvailable(value: number): boolean {
  return value === 0xff;
}
