import { StandardServices, StandardCharacteristics } from '../types/gatt';

/**
 * A device profile describes a category of BLE peripheral:
 * what services it exposes, which characteristics to subscribe to,
 * and metadata for discovery and display.
 */
export interface DeviceProfile {
  /** Unique profile identifier */
  id: string;
  /** Human-readable name (e.g., "Heart Rate Monitor") */
  name: string;
  /** Service UUIDs to scan for */
  scanServices: string[];
  /** Required services — connection fails if any are missing */
  requiredServices: string[];
  /** Characteristics to auto-subscribe on connection */
  autoSubscribe: Array<{
    serviceUUID: string;
    characteristicUUID: string;
  }>;
  /** Optional characteristics to read on connection */
  autoRead?: Array<{
    serviceUUID: string;
    characteristicUUID: string;
  }>;
  /** Device category for UI grouping */
  category: DeviceCategory;
}

export type DeviceCategory =
  | 'heart_rate'
  | 'blood_pressure'
  | 'thermometer'
  | 'weight_scale'
  | 'glucose'
  | 'pulse_oximeter'
  | 'cycling'
  | 'running'
  | 'fitness_machine'
  | 'environmental'
  | 'generic';

// ─── Built-in profiles ───────────────────────────────────────────────────────

export const HeartRateMonitorProfile: DeviceProfile = {
  id: 'heart_rate_monitor',
  name: 'Heart Rate Monitor',
  scanServices: [StandardServices.HeartRate],
  requiredServices: [StandardServices.HeartRate],
  autoSubscribe: [
    {
      serviceUUID: StandardServices.HeartRate,
      characteristicUUID: StandardCharacteristics.HeartRateMeasurement,
    },
  ],
  autoRead: [
    {
      serviceUUID: StandardServices.HeartRate,
      characteristicUUID: StandardCharacteristics.BodySensorLocation,
    },
    {
      serviceUUID: StandardServices.Battery,
      characteristicUUID: StandardCharacteristics.BatteryLevel,
    },
  ],
  category: 'heart_rate',
};

export const CyclingSpeedCadenceProfile: DeviceProfile = {
  id: 'cycling_speed_cadence',
  name: 'Cycling Speed & Cadence Sensor',
  scanServices: [StandardServices.CyclingSpeedAndCadence],
  requiredServices: [StandardServices.CyclingSpeedAndCadence],
  autoSubscribe: [
    {
      serviceUUID: StandardServices.CyclingSpeedAndCadence,
      characteristicUUID: StandardCharacteristics.CSCMeasurement,
    },
  ],
  category: 'cycling',
};

export const CyclingPowerMeterProfile: DeviceProfile = {
  id: 'cycling_power_meter',
  name: 'Cycling Power Meter',
  scanServices: [StandardServices.CyclingPower],
  requiredServices: [StandardServices.CyclingPower],
  autoSubscribe: [
    {
      serviceUUID: StandardServices.CyclingPower,
      characteristicUUID: StandardCharacteristics.CyclingPowerMeasurement,
    },
  ],
  category: 'cycling',
};

export const IndoorBikeProfile: DeviceProfile = {
  id: 'indoor_bike',
  name: 'Indoor Bike / Smart Trainer',
  scanServices: [StandardServices.FitnessMachine],
  requiredServices: [StandardServices.FitnessMachine],
  autoSubscribe: [
    {
      serviceUUID: StandardServices.FitnessMachine,
      characteristicUUID: StandardCharacteristics.IndoorBikeData,
    },
  ],
  category: 'fitness_machine',
};

export const TreadmillProfile: DeviceProfile = {
  id: 'treadmill',
  name: 'Treadmill',
  scanServices: [StandardServices.FitnessMachine],
  requiredServices: [StandardServices.FitnessMachine],
  autoSubscribe: [
    {
      serviceUUID: StandardServices.FitnessMachine,
      characteristicUUID: StandardCharacteristics.TreadmillData,
    },
  ],
  category: 'fitness_machine',
};

export const RowerProfile: DeviceProfile = {
  id: 'rower',
  name: 'Rowing Machine',
  scanServices: [StandardServices.FitnessMachine],
  requiredServices: [StandardServices.FitnessMachine],
  autoSubscribe: [
    {
      serviceUUID: StandardServices.FitnessMachine,
      characteristicUUID: StandardCharacteristics.RowerData,
    },
  ],
  category: 'fitness_machine',
};

export const RunningSpeedCadenceProfile: DeviceProfile = {
  id: 'running_speed_cadence',
  name: 'Running Speed & Cadence Sensor',
  scanServices: [StandardServices.RunningSpeedAndCadence],
  requiredServices: [StandardServices.RunningSpeedAndCadence],
  autoSubscribe: [
    {
      serviceUUID: StandardServices.RunningSpeedAndCadence,
      characteristicUUID: StandardCharacteristics.RSCMeasurement,
    },
  ],
  category: 'running',
};

export const WeightScaleProfile: DeviceProfile = {
  id: 'weight_scale',
  name: 'Weight Scale',
  scanServices: [StandardServices.WeightScale],
  requiredServices: [StandardServices.WeightScale],
  autoSubscribe: [
    {
      serviceUUID: StandardServices.WeightScale,
      characteristicUUID: StandardCharacteristics.WeightMeasurement,
    },
  ],
  category: 'weight_scale',
};

export const BloodPressureMonitorProfile: DeviceProfile = {
  id: 'blood_pressure_monitor',
  name: 'Blood Pressure Monitor',
  scanServices: [StandardServices.BloodPressure],
  requiredServices: [StandardServices.BloodPressure],
  autoSubscribe: [
    {
      serviceUUID: StandardServices.BloodPressure,
      characteristicUUID: StandardCharacteristics.BloodPressureMeasurement,
    },
  ],
  category: 'blood_pressure',
};

export const PulseOximeterProfile: DeviceProfile = {
  id: 'pulse_oximeter',
  name: 'Pulse Oximeter',
  scanServices: [StandardServices.PulseOximeter],
  requiredServices: [StandardServices.PulseOximeter],
  autoSubscribe: [
    {
      serviceUUID: StandardServices.PulseOximeter,
      characteristicUUID: StandardCharacteristics.PLXContinuous,
    },
  ],
  category: 'pulse_oximeter',
};

export const HealthThermometerProfile: DeviceProfile = {
  id: 'health_thermometer',
  name: 'Health Thermometer',
  scanServices: [StandardServices.HealthThermometer],
  requiredServices: [StandardServices.HealthThermometer],
  autoSubscribe: [
    {
      serviceUUID: StandardServices.HealthThermometer,
      characteristicUUID: StandardCharacteristics.TemperatureMeasurement,
    },
  ],
  autoRead: [
    {
      serviceUUID: StandardServices.HealthThermometer,
      characteristicUUID: StandardCharacteristics.TemperatureType,
    },
  ],
  category: 'thermometer',
};

export const GlucoseMonitorProfile: DeviceProfile = {
  id: 'glucose_monitor',
  name: 'Glucose Monitor',
  scanServices: [StandardServices.Glucose],
  requiredServices: [StandardServices.Glucose],
  autoSubscribe: [
    {
      serviceUUID: StandardServices.Glucose,
      characteristicUUID: StandardCharacteristics.GlucoseMeasurement,
    },
  ],
  category: 'glucose',
};

export const EnvironmentalSensorProfile: DeviceProfile = {
  id: 'environmental_sensor',
  name: 'Environmental Sensor',
  scanServices: [StandardServices.EnvironmentalSensing],
  requiredServices: [StandardServices.EnvironmentalSensing],
  autoSubscribe: [],
  autoRead: [
    {
      serviceUUID: StandardServices.EnvironmentalSensing,
      characteristicUUID: StandardCharacteristics.Temperature,
    },
    {
      serviceUUID: StandardServices.EnvironmentalSensing,
      characteristicUUID: StandardCharacteristics.Humidity,
    },
    {
      serviceUUID: StandardServices.EnvironmentalSensing,
      characteristicUUID: StandardCharacteristics.Pressure,
    },
  ],
  category: 'environmental',
};

// ─── Profile Registry ────────────────────────────────────────────────────────

const profileRegistry = new Map<string, DeviceProfile>();

// Register built-in profiles
const builtInProfiles: DeviceProfile[] = [
  HeartRateMonitorProfile,
  CyclingSpeedCadenceProfile,
  CyclingPowerMeterProfile,
  IndoorBikeProfile,
  TreadmillProfile,
  RowerProfile,
  RunningSpeedCadenceProfile,
  WeightScaleProfile,
  BloodPressureMonitorProfile,
  PulseOximeterProfile,
  HealthThermometerProfile,
  GlucoseMonitorProfile,
  EnvironmentalSensorProfile,
];

for (const profile of builtInProfiles) {
  profileRegistry.set(profile.id, profile);
}

/** Get a device profile by ID */
export function getProfile(profileId: string): DeviceProfile | undefined {
  return profileRegistry.get(profileId);
}

/** Register a custom device profile */
export function registerProfile(profile: DeviceProfile): void {
  profileRegistry.set(profile.id, profile);
}

/** Get all registered profiles */
export function getAllProfiles(): DeviceProfile[] {
  return Array.from(profileRegistry.values());
}

/** Find profiles that match a set of advertised service UUIDs */
export function matchProfiles(serviceUUIDs: string[]): DeviceProfile[] {
  const normalizedInput = new Set(
    serviceUUIDs.map((u) => u.toUpperCase().replace(/-/g, ''))
  );

  return getAllProfiles().filter((profile) =>
    profile.scanServices.some((scanUUID) => {
      const normalized = scanUUID.toUpperCase().replace(/-/g, '');
      return (
        normalizedInput.has(normalized) ||
        normalizedInput.has(
          `0000${normalized}00001000800000805F9B34FB`
        )
      );
    })
  );
}
