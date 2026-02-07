/**
 * Standard Bluetooth SIG 16-bit service UUIDs.
 * Full 128-bit UUID: 0000XXXX-0000-1000-8000-00805F9B34FB
 */
export const StandardServices = {
  GenericAccess: '1800',
  GenericAttribute: '1801',
  ImmediateAlert: '1802',
  LinkLoss: '1803',
  TxPower: '1804',
  CurrentTime: '1805',
  Glucose: '1808',
  HealthThermometer: '1809',
  DeviceInformation: '180A',
  HeartRate: '180D',
  Battery: '180F',
  BloodPressure: '1810',
  AlertNotification: '1811',
  HumanInterfaceDevice: '1812',
  RunningSpeedAndCadence: '1814',
  AutomationIO: '1815',
  CyclingSpeedAndCadence: '1816',
  CyclingPower: '1818',
  LocationAndNavigation: '1819',
  EnvironmentalSensing: '181A',
  BodyComposition: '181B',
  UserData: '181C',
  WeightScale: '181D',
  BondManagement: '181E',
  ContinuousGlucoseMonitoring: '181F',
  FitnessMachine: '1826',
  PulseOximeter: '1822',
  // LE Audio services
  PublishedAudioCapabilities: '1850',
  AudioStreamControl: '184E',
  BroadcastAudioScan: '184F',
  VolumeControl: '1844',
  MediaControl: '1848',
  CoordinatedSetIdentification: '1846',
} as const;

/**
 * Standard Bluetooth SIG 16-bit characteristic UUIDs.
 */
export const StandardCharacteristics = {
  // Device Information
  ManufacturerName: '2A29',
  ModelNumber: '2A24',
  SerialNumber: '2A25',
  HardwareRevision: '2A27',
  FirmwareRevision: '2A26',
  SoftwareRevision: '2A28',
  SystemId: '2A23',
  PnPId: '2A50',

  // Battery
  BatteryLevel: '2A19',

  // Heart Rate
  HeartRateMeasurement: '2A37',
  BodySensorLocation: '2A38',
  HeartRateControlPoint: '2A39',

  // Blood Pressure
  BloodPressureMeasurement: '2A35',
  IntermediateCuffPressure: '2A36',
  BloodPressureFeature: '2A49',

  // Health Thermometer
  TemperatureMeasurement: '2A1C',
  TemperatureType: '2A1D',
  IntermediateTemperature: '2A1E',
  MeasurementInterval: '2A21',

  // Glucose
  GlucoseMeasurement: '2A18',
  GlucoseMeasurementContext: '2A34',
  GlucoseFeature: '2A51',
  RecordAccessControlPoint: '2A52',

  // Weight Scale & Body Composition
  WeightMeasurement: '2A9D',
  WeightScaleFeature: '2A9E',
  BodyCompositionMeasurement: '2A9C',
  BodyCompositionFeature: '2A9B',

  // Environmental Sensing
  Temperature: '2A6E',
  Humidity: '2A6F',
  Pressure: '2A6D',
  UVIndex: '2A76',
  Elevation: '2A6C',

  // Cycling Speed and Cadence
  CSCMeasurement: '2A5B',
  CSCFeature: '2A5C',

  // Cycling Power
  CyclingPowerMeasurement: '2A63',
  CyclingPowerFeature: '2A65',
  SensorLocation: '2A5D',
  CyclingPowerControlPoint: '2A66',

  // Running Speed and Cadence
  RSCMeasurement: '2A53',
  RSCFeature: '2A54',

  // Fitness Machine
  FitnessMachineFeature: '2ACC',
  TreadmillData: '2ACD',
  CrossTrainerData: '2ACE',
  StepClimberData: '2ACF',
  StairClimberData: '2AD0',
  RowerData: '2AD1',
  IndoorBikeData: '2AD2',
  TrainingStatus: '2AD3',
  SupportedSpeedRange: '2AD4',
  SupportedInclinationRange: '2AD5',
  SupportedResistanceLevelRange: '2AD6',
  SupportedPowerRange: '2AD8',
  FitnessMachineControlPoint: '2AD9',
  FitnessMachineStatus: '2ADA',

  // Pulse Oximeter
  PLXSpotCheck: '2A5E',
  PLXContinuous: '2A5F',
  PLXFeatures: '2A60',

  // Descriptors
  ClientCharacteristicConfiguration: '2902',
  CharacteristicPresentationFormat: '2904',
} as const;

/** Convert a 16-bit UUID to full 128-bit Bluetooth SIG UUID */
export function toFullUUID(short: string): string {
  const hex = short.toUpperCase().replace('0X', '');
  return `0000${hex}-0000-1000-8000-00805F9B34FB`;
}

/** Convert a 128-bit Bluetooth SIG UUID back to 16-bit shorthand, or null if not a SIG UUID */
export function toShortUUID(full: string): string | null {
  const upper = full.toUpperCase();
  const match = upper.match(
    /^0000([0-9A-F]{4})-0000-1000-8000-00805F9B34FB$/
  );
  return match ? match[1]! : null;
}

/** Normalize a UUID to uppercase without dashes for comparison */
export function normalizeUUID(uuid: string): string {
  return uuid.toUpperCase().replace(/-/g, '');
}

/** Check if two UUIDs refer to the same characteristic/service */
export function uuidsMatch(a: string, b: string): boolean {
  // Handle 16-bit vs 128-bit comparison
  const normA = normalizeUUID(a.length === 4 ? toFullUUID(a) : a);
  const normB = normalizeUUID(b.length === 4 ? toFullUUID(b) : b);
  return normA === normB;
}

/** GATT parser function signature */
export type GattParser<T> = (data: DataView) => T;

/** Registry entry for a GATT characteristic parser */
export interface GattParserEntry<T = unknown> {
  /** 16-bit characteristic UUID */
  characteristicUUID: string;
  /** 16-bit service UUID this characteristic belongs to */
  serviceUUID: string;
  /** Human-readable name */
  name: string;
  /** Parser function */
  parse: GattParser<T>;
}
