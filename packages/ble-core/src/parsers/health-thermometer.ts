import type { TemperatureMeasurement, TemperatureType } from '../types/parsers';
import { readFLOAT } from '../utils/ieee11073';
import { parseDateTime, DATE_TIME_LENGTH } from '../utils/bytes';

/**
 * Parse Temperature Measurement (0x2A1C, INDICATE).
 *
 * Byte layout:
 *   [0]       flags
 *               bit 0: unit (0=Celsius, 1=Fahrenheit)
 *               bit 1: timestamp present
 *               bit 2: temperature type present
 *   [1–4]     temperature (IEEE 11073 FLOAT, 32-bit)
 *   [5–11]    timestamp (7 bytes, if flag bit 1)
 *   [...]     temperature type (uint8 enum, if flag bit 2)
 */
export function parseTemperatureMeasurement(
  data: DataView
): TemperatureMeasurement {
  const flags = data.getUint8(0);
  let offset = 1;

  const unit = (flags & 0x01) === 0 ? 'celsius' : 'fahrenheit';
  const temperature = readFLOAT(data, offset);
  offset += 4;

  let timestamp: Date | undefined;
  if (flags & 0x02) {
    timestamp = parseDateTime(data, offset);
    offset += DATE_TIME_LENGTH;
  }

  let temperatureType: TemperatureType | undefined;
  if (flags & 0x04) {
    const typeVal = data.getUint8(offset);
    if (typeVal >= 1 && typeVal <= 9) {
      temperatureType = typeVal as TemperatureType;
    }
  }

  return { temperature, unit, timestamp, temperatureType };
}
