import type {
  EnvironmentalData,
  BatteryLevel,
  DeviceInformation,
} from '../types/parsers';
import { getInt24LE } from '../utils/bytes';

// ─── Environmental Sensing ───────────────────────────────────────────────────

/** Parse Temperature (0x2A6E): sint16 at 0.01°C */
export function parseTemperature(data: DataView): number {
  return data.getInt16(0, true) * 0.01;
}

/** Parse Humidity (0x2A6F): uint16 at 0.01% */
export function parseHumidity(data: DataView): number {
  return data.getUint16(0, true) * 0.01;
}

/** Parse Pressure (0x2A6D): uint32 at 0.1 Pa */
export function parsePressure(data: DataView): number {
  return data.getUint32(0, true) * 0.1;
}

/** Parse UV Index (0x2A76): uint8 */
export function parseUVIndex(data: DataView): number {
  return data.getUint8(0);
}

/** Parse Elevation (0x2A6C): sint24 at 0.01m */
export function parseElevation(data: DataView): number {
  return getInt24LE(data, 0) * 0.01;
}

/**
 * Convenience: parse all environmental characteristics into a single object.
 * Pass individual parsed values; this just bundles them.
 */
export function bundleEnvironmentalData(
  partial: Partial<EnvironmentalData>
): EnvironmentalData {
  return { ...partial };
}

// ─── Battery Service ─────────────────────────────────────────────────────────

/** Parse Battery Level (0x2A19, READ/NOTIFY): uint8 percentage 0–100 */
export function parseBatteryLevel(data: DataView): BatteryLevel {
  return { level: data.getUint8(0) };
}

// ─── Device Information Service ──────────────────────────────────────────────

/** Decode a UTF-8 string from a DataView (for DIS characteristics) */
function decodeString(data: DataView): string {
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return new TextDecoder().decode(bytes);
}

/** Parse any string DIS characteristic (Manufacturer Name, Model, etc.) */
export function parseDeviceInfoString(data: DataView): string {
  return decodeString(data);
}

/**
 * Parse System ID (0x2A23, READ): 8 bytes
 * Bytes 0–4: Manufacturer Identifier (40 bits)
 * Bytes 5–7: Organizationally Unique Identifier (24 bits)
 */
export function parseSystemId(
  data: DataView
): DeviceInformation['systemId'] {
  const mfr = Array.from(
    new Uint8Array(data.buffer, data.byteOffset, 5)
  )
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(':');

  const oui = Array.from(
    new Uint8Array(data.buffer, data.byteOffset + 5, 3)
  )
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(':');

  return { manufacturer: mfr, organizationallyUnique: oui };
}

/**
 * Parse PnP ID (0x2A50, READ): 7 bytes
 * Byte 0: Vendor ID Source (1=Bluetooth SIG, 2=USB Implementer's Forum)
 * Bytes 1–2: Vendor ID (uint16)
 * Bytes 3–4: Product ID (uint16)
 * Bytes 5–6: Product Version (uint16)
 */
export function parsePnPId(data: DataView): DeviceInformation['pnpId'] {
  return {
    vendorIdSource: data.getUint8(0),
    vendorId: data.getUint16(1, true),
    productId: data.getUint16(3, true),
    productVersion: data.getUint16(5, true),
  };
}
