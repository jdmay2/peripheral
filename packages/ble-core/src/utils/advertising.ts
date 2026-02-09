import type { ScanResult } from '../types/ble';

/**
 * Parsed manufacturer-specific data from advertising payload.
 */
export interface ParsedManufacturerData {
  /** Bluetooth SIG company identifier */
  companyId: number;
  /** Raw data bytes (excluding the 2-byte company ID) */
  data: Uint8Array;
}

/**
 * Parsed service data from advertising payload.
 */
export interface ParsedServiceData {
  /** Service UUID */
  uuid: string;
  /** Raw data bytes */
  data: Uint8Array;
}

/**
 * Extract manufacturer-specific data entries from a scan result.
 *
 * react-native-ble-manager provides manufacturer data as a record
 * where keys are company IDs (as strings) and values are byte arrays.
 *
 * @example
 * ```ts
 * const mfgData = parseManufacturerData(scanResult.advertising);
 * for (const entry of mfgData) {
 *   console.log(`Company: 0x${entry.companyId.toString(16)}, bytes: ${entry.data.length}`);
 * }
 * ```
 */
export function parseManufacturerData(
  advertising: ScanResult['advertising']
): ParsedManufacturerData[] {
  const mfgData = advertising.manufacturerData;
  if (!mfgData || typeof mfgData !== 'object') return [];

  const results: ParsedManufacturerData[] = [];

  for (const [key, value] of Object.entries(mfgData)) {
    const companyId = parseInt(key, 10);
    if (Number.isNaN(companyId)) continue;

    let data: Uint8Array;
    if (value instanceof Uint8Array) {
      data = value;
    } else if (Array.isArray(value)) {
      data = new Uint8Array(value as number[]);
    } else if (
      value &&
      typeof value === 'object' &&
      'bytes' in value &&
      Array.isArray((value as { bytes: number[] }).bytes)
    ) {
      // Some platforms wrap in { bytes: [...] }
      data = new Uint8Array((value as { bytes: number[] }).bytes);
    } else {
      continue;
    }

    results.push({ companyId, data });
  }

  return results;
}

/**
 * Extract service data entries from a scan result.
 *
 * react-native-ble-manager provides service data as a record
 * where keys are service UUIDs and values are byte arrays.
 */
export function parseServiceData(
  advertising: ScanResult['advertising']
): ParsedServiceData[] {
  const svcData = advertising.serviceData;
  if (!svcData || typeof svcData !== 'object') return [];

  const results: ParsedServiceData[] = [];

  for (const [uuid, value] of Object.entries(svcData)) {
    let data: Uint8Array;
    if (value instanceof Uint8Array) {
      data = value;
    } else if (Array.isArray(value)) {
      data = new Uint8Array(value as number[]);
    } else if (
      value &&
      typeof value === 'object' &&
      'bytes' in value &&
      Array.isArray((value as { bytes: number[] }).bytes)
    ) {
      data = new Uint8Array((value as { bytes: number[] }).bytes);
    } else {
      continue;
    }

    results.push({ uuid, data });
  }

  return results;
}

/**
 * Get the advertised TX power level from a scan result.
 * Returns null if not advertised.
 */
export function getAdvertisedTxPower(
  advertising: ScanResult['advertising']
): number | null {
  return advertising.txPowerLevel ?? null;
}

/**
 * Check if the advertising device reports itself as connectable.
 * Returns true if the field is not present (most peripherals are connectable).
 */
export function isConnectable(
  advertising: ScanResult['advertising']
): boolean {
  return advertising.isConnectable ?? true;
}
