import type { GattParserEntry } from '../types/gatt';
import { StandardCharacteristics, StandardServices } from '../types/gatt';

import { parseHeartRateMeasurement, parseBodySensorLocation } from './heart-rate';
import { parseBloodPressureMeasurement } from './blood-pressure';
import { parseTemperatureMeasurement } from './health-thermometer';
import { parseGlucoseMeasurement } from './glucose';
import { parseWeightMeasurement, parseBodyCompositionMeasurement } from './weight-scale';
import {
  parseTemperature,
  parseHumidity,
  parsePressure,
  parseUVIndex,
  parseElevation,
  parseBatteryLevel,
  parseDeviceInfoString,
  parseSystemId,
  parsePnPId,
} from './environmental';
import { parseCSCMeasurement } from './cycling';
import { parseCyclingPowerMeasurement } from './cycling';
import { parseRSCMeasurement } from './running';
import {
  parseIndoorBikeData,
  parseTreadmillData,
  parseRowerData,
} from './fitness-machine';
import { parsePLXSpotCheck, parsePLXContinuous } from './pulse-oximeter';

/**
 * Global parser registry.
 *
 * Maps 16-bit characteristic UUIDs to their parser functions.
 * Users can extend this with custom parsers via `registerParser()`.
 */
const parserRegistry = new Map<string, GattParserEntry>();

function register<T>(entry: GattParserEntry<T>): void {
  parserRegistry.set(
    entry.characteristicUUID.toUpperCase(),
    entry as GattParserEntry
  );
}

// ─── Register all standard parsers ───────────────────────────────────────────

// Heart Rate
register({
  characteristicUUID: StandardCharacteristics.HeartRateMeasurement,
  serviceUUID: StandardServices.HeartRate,
  name: 'Heart Rate Measurement',
  parse: parseHeartRateMeasurement,
});

register({
  characteristicUUID: StandardCharacteristics.BodySensorLocation,
  serviceUUID: StandardServices.HeartRate,
  name: 'Body Sensor Location',
  parse: parseBodySensorLocation,
});

// Blood Pressure
register({
  characteristicUUID: StandardCharacteristics.BloodPressureMeasurement,
  serviceUUID: StandardServices.BloodPressure,
  name: 'Blood Pressure Measurement',
  parse: parseBloodPressureMeasurement,
});

// Health Thermometer
register({
  characteristicUUID: StandardCharacteristics.TemperatureMeasurement,
  serviceUUID: StandardServices.HealthThermometer,
  name: 'Temperature Measurement',
  parse: parseTemperatureMeasurement,
});

// Glucose
register({
  characteristicUUID: StandardCharacteristics.GlucoseMeasurement,
  serviceUUID: StandardServices.Glucose,
  name: 'Glucose Measurement',
  parse: parseGlucoseMeasurement,
});

// Weight Scale
register({
  characteristicUUID: StandardCharacteristics.WeightMeasurement,
  serviceUUID: StandardServices.WeightScale,
  name: 'Weight Measurement',
  parse: parseWeightMeasurement,
});

// Body Composition
register({
  characteristicUUID: StandardCharacteristics.BodyCompositionMeasurement,
  serviceUUID: StandardServices.BodyComposition,
  name: 'Body Composition Measurement',
  parse: parseBodyCompositionMeasurement,
});

// Environmental Sensing
register({
  characteristicUUID: StandardCharacteristics.Temperature,
  serviceUUID: StandardServices.EnvironmentalSensing,
  name: 'Temperature',
  parse: parseTemperature,
});

register({
  characteristicUUID: StandardCharacteristics.Humidity,
  serviceUUID: StandardServices.EnvironmentalSensing,
  name: 'Humidity',
  parse: parseHumidity,
});

register({
  characteristicUUID: StandardCharacteristics.Pressure,
  serviceUUID: StandardServices.EnvironmentalSensing,
  name: 'Pressure',
  parse: parsePressure,
});

register({
  characteristicUUID: StandardCharacteristics.UVIndex,
  serviceUUID: StandardServices.EnvironmentalSensing,
  name: 'UV Index',
  parse: parseUVIndex,
});

register({
  characteristicUUID: StandardCharacteristics.Elevation,
  serviceUUID: StandardServices.EnvironmentalSensing,
  name: 'Elevation',
  parse: parseElevation,
});

// Battery
register({
  characteristicUUID: StandardCharacteristics.BatteryLevel,
  serviceUUID: StandardServices.Battery,
  name: 'Battery Level',
  parse: parseBatteryLevel,
});

// Device Information (string characteristics)
for (const [key, uuid] of [
  ['ManufacturerName', StandardCharacteristics.ManufacturerName],
  ['ModelNumber', StandardCharacteristics.ModelNumber],
  ['SerialNumber', StandardCharacteristics.SerialNumber],
  ['HardwareRevision', StandardCharacteristics.HardwareRevision],
  ['FirmwareRevision', StandardCharacteristics.FirmwareRevision],
  ['SoftwareRevision', StandardCharacteristics.SoftwareRevision],
] as const) {
  register({
    characteristicUUID: uuid,
    serviceUUID: StandardServices.DeviceInformation,
    name: key.replace(/([A-Z])/g, ' $1').trim(),
    parse: parseDeviceInfoString,
  });
}

register({
  characteristicUUID: StandardCharacteristics.SystemId,
  serviceUUID: StandardServices.DeviceInformation,
  name: 'System ID',
  parse: parseSystemId,
});

register({
  characteristicUUID: StandardCharacteristics.PnPId,
  serviceUUID: StandardServices.DeviceInformation,
  name: 'PnP ID',
  parse: parsePnPId,
});

// Cycling Speed and Cadence
register({
  characteristicUUID: StandardCharacteristics.CSCMeasurement,
  serviceUUID: StandardServices.CyclingSpeedAndCadence,
  name: 'CSC Measurement',
  parse: parseCSCMeasurement,
});

// Cycling Power
register({
  characteristicUUID: StandardCharacteristics.CyclingPowerMeasurement,
  serviceUUID: StandardServices.CyclingPower,
  name: 'Cycling Power Measurement',
  parse: parseCyclingPowerMeasurement,
});

// Running Speed and Cadence
register({
  characteristicUUID: StandardCharacteristics.RSCMeasurement,
  serviceUUID: StandardServices.RunningSpeedAndCadence,
  name: 'RSC Measurement',
  parse: parseRSCMeasurement,
});

// Fitness Machine
register({
  characteristicUUID: StandardCharacteristics.IndoorBikeData,
  serviceUUID: StandardServices.FitnessMachine,
  name: 'Indoor Bike Data',
  parse: parseIndoorBikeData,
});

register({
  characteristicUUID: StandardCharacteristics.TreadmillData,
  serviceUUID: StandardServices.FitnessMachine,
  name: 'Treadmill Data',
  parse: parseTreadmillData,
});

register({
  characteristicUUID: StandardCharacteristics.RowerData,
  serviceUUID: StandardServices.FitnessMachine,
  name: 'Rower Data',
  parse: parseRowerData,
});

// Pulse Oximeter
register({
  characteristicUUID: StandardCharacteristics.PLXSpotCheck,
  serviceUUID: StandardServices.PulseOximeter,
  name: 'PLX Spot-Check Measurement',
  parse: parsePLXSpotCheck,
});

register({
  characteristicUUID: StandardCharacteristics.PLXContinuous,
  serviceUUID: StandardServices.PulseOximeter,
  name: 'PLX Continuous Measurement',
  parse: parsePLXContinuous,
});

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get the registered parser for a characteristic UUID.
 * Accepts both 16-bit ("2A37") and 128-bit UUIDs.
 */
export function getParser(characteristicUUID: string): GattParserEntry | undefined {
  let shortUUID = characteristicUUID.toUpperCase();

  // Extract 16-bit UUID from 128-bit SIG format
  if (shortUUID.length > 4) {
    const match = shortUUID.match(
      /^0000([0-9A-F]{4})-0000-1000-8000-00805F9B34FB$/
    );
    if (match) {
      shortUUID = match[1]!;
    } else {
      // Non-SIG UUID — check the registry as-is
      return parserRegistry.get(shortUUID);
    }
  }

  return parserRegistry.get(shortUUID);
}

/**
 * Auto-parse raw bytes from a characteristic notification.
 * Returns the parsed value if a parser exists, undefined otherwise.
 */
export function autoParse(characteristicUUID: string, data: DataView): unknown {
  const entry = getParser(characteristicUUID);
  if (!entry) return undefined;
  return entry.parse(data);
}

/**
 * Register a custom parser for a characteristic UUID.
 * Overwrites any existing parser for that UUID.
 */
export function registerParser<T>(entry: GattParserEntry<T>): void {
  register(entry);
}

/**
 * Get all registered parser entries.
 */
export function getAllParsers(): GattParserEntry[] {
  return Array.from(parserRegistry.values());
}

/**
 * Check if a parser exists for a characteristic UUID.
 */
export function hasParser(characteristicUUID: string): boolean {
  return getParser(characteristicUUID) !== undefined;
}
