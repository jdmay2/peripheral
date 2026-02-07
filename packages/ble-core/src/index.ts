// ─── Core ────────────────────────────────────────────────────────────────────
export {
  PeripheralManager,
  peripheralManager,
  CommandQueue,
  ConnectionStateMachine,
  ReconnectionManager,
} from './core';
export type {
  PeripheralManagerEvents,
  StateChangeListener,
  ReconnectAttemptCallback,
  ReconnectSuccessCallback,
  ReconnectFailureCallback,
  ReconnectGiveUpCallback,
} from './core';

// ─── Types ───────────────────────────────────────────────────────────────────
export {
  ConnectionState,
  VALID_TRANSITIONS,
  AdapterState,
  WriteType,
  StandardServices,
  StandardCharacteristics,
  toFullUUID,
  toShortUUID,
  normalizeUUID,
  uuidsMatch,
  BodySensorLocation,
  TemperatureType,
  FTMSResultCode,
} from './types';
export type {
  ScanResult,
  ScanFilter,
  ConnectOptions,
  ReconnectionConfig,
  BleManagerOptions,
  BleDevice,
  BleService,
  BleCharacteristic,
  BleDescriptor,
  CharacteristicProperties,
  CharacteristicNotification,
  BleEventType,
  GattParser,
  GattParserEntry,
  // Parsed data types
  HeartRateMeasurement,
  BloodPressureMeasurement,
  BloodPressureStatus,
  TemperatureMeasurement,
  GlucoseMeasurement,
  WeightMeasurement,
  BodyCompositionMeasurement,
  EnvironmentalData,
  CSCMeasurement,
  CSCComputed,
  CyclingPowerMeasurement,
  RSCMeasurement,
  IndoorBikeData,
  TreadmillData,
  RowerData,
  PLXSpotCheckMeasurement,
  PLXContinuousMeasurement,
  BatteryLevel,
  DeviceInformation,
} from './types';

// ─── Parsers ─────────────────────────────────────────────────────────────────
export {
  // Individual parsers
  parseHeartRateMeasurement,
  parseBodySensorLocation,
  parseBloodPressureMeasurement,
  parseTemperatureMeasurement,
  parseGlucoseMeasurement,
  parseWeightMeasurement,
  parseBodyCompositionMeasurement,
  parseTemperature,
  parseHumidity,
  parsePressure,
  parseUVIndex,
  parseElevation,
  bundleEnvironmentalData,
  parseBatteryLevel,
  parseDeviceInfoString,
  parseSystemId,
  parsePnPId,
  parseCSCMeasurement,
  computeCSCValues,
  parseCyclingPowerMeasurement,
  parseRSCMeasurement,
  parseIndoorBikeData,
  parseTreadmillData,
  parseRowerData,
  parsePLXSpotCheck,
  parsePLXContinuous,
  // FTMS control point
  FTMSOpCode,
  buildFTMSRequestControl,
  buildFTMSStart,
  buildFTMSStop,
  buildFTMSSetTargetPower,
  buildFTMSSetResistance,
  buildFTMSSetSimulation,
  parseFTMSControlPointResponse,
  // RACP (Glucose)
  RACPOpCode,
  RACPOperator,
  buildRACPReportAll,
  buildRACPReportCount,
  buildRACPDeleteAll,
  buildRACPAbort,
  // Registry
  getParser,
  autoParse,
  registerParser,
  getAllParsers,
  hasParser,
} from './parsers';

// ─── Hooks ───────────────────────────────────────────────────────────────────
export { useBleManager, useScan, useDevice, useCharacteristic } from './hooks';
export type {
  UseBleManagerResult,
  UseScanResult,
  UseDeviceResult,
  UseCharacteristicResult,
  UseCharacteristicOptions,
} from './hooks';

// ─── Profiles ────────────────────────────────────────────────────────────────
export {
  getProfile,
  registerProfile,
  getAllProfiles,
  matchProfiles,
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
} from './profiles';
export type { DeviceProfile, DeviceCategory } from './profiles';

// ─── Utils ───────────────────────────────────────────────────────────────────
export {
  toDataView,
  base64ToDataView,
  toHexString,
  getUint24LE,
  getInt24LE,
  parseDateTime,
  DATE_TIME_LENGTH,
  isUint16NotAvailable,
  isInt16NotAvailable,
  isUint8NotAvailable,
  decodeSFLOAT,
  readSFLOAT,
  decodeFLOAT,
  readFLOAT,
} from './utils';
