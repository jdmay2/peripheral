/**
 * IEEE 11073-20601 SFLOAT (16-bit) decoder.
 *
 * Format: 4-bit signed exponent (bits 15–12) + 12-bit signed mantissa (bits 11–0)
 * Value = mantissa × 10^exponent
 *
 * Used by: Blood Pressure, Glucose, Pulse Oximeter, Weight Scale
 *
 * IMPORTANT: Check special values BEFORE sign extension to avoid misinterpretation.
 */
export function decodeSFLOAT(raw: number): number {
  // Extract raw mantissa and exponent
  let mantissa = raw & 0x0fff;
  let exponent = (raw >> 12) & 0x0f;

  // Special values — check raw mantissa before sign extension
  switch (mantissa) {
    case 0x07fe:
      return Infinity; // +INFINITY
    case 0x07ff:
      return NaN; // NaN
    case 0x0800:
      return NaN; // NRes (not at this resolution)
    case 0x0801:
      return NaN; // Reserved for future use
    case 0x0802:
      return -Infinity; // -INFINITY
  }

  // Sign-extend mantissa from 12 bits
  if (mantissa >= 0x0800) {
    mantissa -= 0x1000;
  }

  // Sign-extend exponent from 4 bits
  if (exponent >= 0x08) {
    exponent -= 0x10;
  }

  return mantissa * Math.pow(10, exponent);
}

/**
 * Read an SFLOAT from a DataView at the given offset.
 */
export function readSFLOAT(data: DataView, offset: number): number {
  return decodeSFLOAT(data.getUint16(offset, true));
}

/**
 * IEEE 11073-20601 FLOAT (32-bit) decoder.
 *
 * Format: 8-bit signed exponent (byte 3) + 24-bit signed mantissa (bytes 0–2)
 * Value = mantissa × 10^exponent
 *
 * Used by: Health Thermometer
 */
export function decodeFLOAT(raw: number): number {
  // Extract raw mantissa (lower 24 bits) and exponent (upper 8 bits)
  let mantissa = raw & 0x00ffffff;
  let exponent = (raw >> 24) & 0xff;

  // Special values — check raw mantissa before sign extension
  switch (mantissa) {
    case 0x007ffffe:
      return Infinity; // +INFINITY
    case 0x007fffff:
      return NaN; // NaN
    case 0x00800000:
      return NaN; // NRes
    case 0x00800001:
      return NaN; // Reserved
    case 0x00800002:
      return -Infinity; // -INFINITY
  }

  // Sign-extend mantissa from 24 bits
  if (mantissa >= 0x00800000) {
    mantissa -= 0x01000000;
  }

  // Sign-extend exponent from 8 bits
  if (exponent >= 0x80) {
    exponent -= 0x100;
  }

  return mantissa * Math.pow(10, exponent);
}

/**
 * Read a FLOAT from a DataView at the given offset.
 * Reads 4 bytes as uint32 little-endian, then decodes.
 */
export function readFLOAT(data: DataView, offset: number): number {
  return decodeFLOAT(data.getUint32(offset, true));
}
