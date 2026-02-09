import { toFullUUID, toShortUUID } from '../types/gatt';

/**
 * Bluetooth SIG base UUID suffix (uppercase, no dashes).
 */
const SIG_UUID_SUFFIX = '00001000800000805F9B34FB';

/**
 * Validate whether a string is a valid Bluetooth UUID.
 * Accepts 16-bit shorthand ("2A37", "0x2A37") or full 128-bit format
 * ("00002A37-0000-1000-8000-00805F9B34FB").
 */
export function isValidUUID(uuid: string): boolean {
  if (isShortUUID(uuid)) return true;

  // 128-bit UUID: 8-4-4-4-12 hex
  return /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/.test(
    uuid
  );
}

/**
 * Check whether a string is a valid 16-bit (short) Bluetooth UUID.
 * Accepts "2A37" or "0x2A37" formats.
 */
export function isShortUUID(uuid: string): boolean {
  const hex = uuid.replace(/^0[xX]/, '');
  return /^[0-9A-Fa-f]{4}$/.test(hex);
}

/**
 * Expand a 16-bit short UUID to its full 128-bit Bluetooth SIG form.
 * Wraps the existing `toFullUUID()` from GATT types with input validation.
 *
 * @returns Full 128-bit UUID string, or null if input is not a valid short UUID
 *
 * @example
 * ```ts
 * expandShortUUID('2A37');
 * // => "00002A37-0000-1000-8000-00805F9B34FB"
 * ```
 */
export function expandShortUUID(short: string): string | null {
  const hex = short.replace(/^0[xX]/, '');
  if (!/^[0-9A-Fa-f]{4}$/.test(hex)) return null;
  return toFullUUID(hex);
}

/**
 * Extract the 16-bit short UUID from a full 128-bit Bluetooth SIG UUID.
 * Returns null if the UUID is not a standard SIG UUID.
 *
 * Wraps the existing `toShortUUID()` from GATT types.
 *
 * @example
 * ```ts
 * shortenUUID('00002A37-0000-1000-8000-00805F9B34FB');
 * // => "2A37"
 * shortenUUID('12345678-1234-1234-1234-123456789ABC');
 * // => null (custom UUID, not SIG)
 * ```
 */
export function shortenUUID(full: string): string | null {
  return toShortUUID(full);
}

/**
 * Check if a UUID belongs to the Bluetooth SIG base UUID range.
 */
export function isSigUUID(uuid: string): boolean {
  if (isShortUUID(uuid)) return true;

  const normalized = uuid.toUpperCase().replace(/-/g, '');
  if (normalized.length !== 32) return false;

  // Check if it follows the pattern: 0000XXXX + SIG_UUID_SUFFIX
  return (
    normalized.startsWith('0000') &&
    normalized.substring(8) === SIG_UUID_SUFFIX
  );
}
