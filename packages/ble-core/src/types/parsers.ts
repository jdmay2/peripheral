// ─── Heart Rate ──────────────────────────────────────────────────────────────

export interface HeartRateMeasurement {
  /** Heart rate in BPM */
  heartRate: number;
  /** Whether skin contact is detected (null if sensor doesn't support) */
  sensorContact: boolean | null;
  /** Cumulative energy expended in kJ (if available) */
  energyExpended?: number;
  /** RR-intervals in milliseconds */
  rrIntervals: number[];
}

export enum BodySensorLocation {
  Other = 0,
  Chest = 1,
  Wrist = 2,
  Finger = 3,
  Hand = 4,
  EarLobe = 5,
  Foot = 6,
}

// ─── Blood Pressure ──────────────────────────────────────────────────────────

export interface BloodPressureMeasurement {
  /** Systolic pressure */
  systolic: number;
  /** Diastolic pressure */
  diastolic: number;
  /** Mean arterial pressure */
  meanArterialPressure: number;
  /** Unit: 'mmHg' or 'kPa' */
  unit: 'mmHg' | 'kPa';
  /** Timestamp if available */
  timestamp?: Date;
  /** Pulse rate in BPM if available */
  pulseRate?: number;
  /** User ID if available */
  userId?: number;
  /** Measurement status flags */
  status?: BloodPressureStatus;
}

export interface BloodPressureStatus {
  bodyMovement: boolean;
  cuffFitTooLoose: boolean;
  irregularPulse: boolean;
  pulseRateExceedsUpperLimit: boolean;
  pulseRateExceedsLowerLimit: boolean;
  improperMeasurementPosition: boolean;
}

// ─── Health Thermometer ──────────────────────────────────────────────────────

export interface TemperatureMeasurement {
  /** Temperature value */
  temperature: number;
  /** Unit: 'celsius' or 'fahrenheit' */
  unit: 'celsius' | 'fahrenheit';
  /** Timestamp if available */
  timestamp?: Date;
  /** Temperature type if available */
  temperatureType?: TemperatureType;
}

export enum TemperatureType {
  Armpit = 1,
  Body = 2,
  Ear = 3,
  Finger = 4,
  GastroIntestinal = 5,
  Mouth = 6,
  Rectum = 7,
  Toe = 8,
  Tympanum = 9,
}

// ─── Glucose ─────────────────────────────────────────────────────────────────

export interface GlucoseMeasurement {
  /** Sequence number */
  sequenceNumber: number;
  /** Base time */
  baseTime: Date;
  /** Time offset in minutes */
  timeOffset?: number;
  /** Concentration value */
  concentration?: number;
  /** Concentration unit: 'kg/L' or 'mol/L' */
  concentrationUnit?: 'kg/L' | 'mol/L';
  /** Sample type */
  type?: number;
  /** Sample location */
  location?: number;
  /** Sensor status annunciation flags */
  sensorStatus?: number;
}

// ─── Weight Scale & Body Composition ─────────────────────────────────────────

export interface WeightMeasurement {
  /** Weight value */
  weight: number;
  /** Unit: 'kg' or 'lb' */
  unit: 'kg' | 'lb';
  /** Timestamp if available */
  timestamp?: Date;
  /** User ID if available */
  userId?: number;
  /** BMI if available (0.1 resolution) */
  bmi?: number;
  /** Height in meters or inches if available */
  height?: number;
}

export interface BodyCompositionMeasurement {
  /** Body fat percentage (0.1% resolution) */
  bodyFatPercentage: number;
  /** Unit: 'kg' or 'lb' */
  unit: 'kg' | 'lb';
  /** Timestamp if available */
  timestamp?: Date;
  userId?: number;
  basalMetabolism?: number;
  musclePercentage?: number;
  muscleMass?: number;
  fatFreeMass?: number;
  softLeanMass?: number;
  bodyWaterMass?: number;
  impedance?: number;
  weight?: number;
  height?: number;
}

// ─── Environmental Sensing ───────────────────────────────────────────────────

export interface EnvironmentalData {
  /** Temperature in °C (0.01 resolution) */
  temperature?: number;
  /** Relative humidity in % (0.01 resolution) */
  humidity?: number;
  /** Pressure in Pa (0.1 resolution) */
  pressure?: number;
  /** UV index */
  uvIndex?: number;
  /** Elevation in meters (0.01 resolution) */
  elevation?: number;
}

// ─── Cycling Speed and Cadence ───────────────────────────────────────────────

export interface CSCMeasurement {
  /** Cumulative wheel revolutions (raw) */
  cumulativeWheelRevolutions?: number;
  /** Last wheel event time in 1/1024s units (raw) */
  lastWheelEventTime?: number;
  /** Cumulative crank revolutions (raw) */
  cumulativeCrankRevolutions?: number;
  /** Last crank event time in 1/1024s units (raw) */
  lastCrankEventTime?: number;
}

/** Computed values from delta between two CSC measurements */
export interface CSCComputed {
  /** Speed in km/h (requires wheel circumference) */
  speedKmh?: number;
  /** Cadence in RPM */
  cadenceRpm?: number;
}

// ─── Cycling Power ───────────────────────────────────────────────────────────

export interface CyclingPowerMeasurement {
  /** Instantaneous power in watts */
  instantaneousPower: number;
  /** Pedal power balance percentage (0–100) */
  pedalPowerBalance?: number;
  /** Whether balance is referenced to left pedal */
  pedalPowerBalanceReference?: 'left' | 'unknown';
  /** Accumulated torque in Nm (1/32 resolution) */
  accumulatedTorque?: number;
  /** Cumulative wheel revolutions */
  cumulativeWheelRevolutions?: number;
  /** Last wheel event time in 1/2048s */
  lastWheelEventTime?: number;
  /** Cumulative crank revolutions */
  cumulativeCrankRevolutions?: number;
  /** Last crank event time in 1/1024s */
  lastCrankEventTime?: number;
  /** Maximum force in newtons */
  maximumForce?: number;
  /** Minimum force in newtons */
  minimumForce?: number;
  /** Maximum torque in Nm */
  maximumTorque?: number;
  /** Minimum torque in Nm */
  minimumTorque?: number;
}

// ─── Running Speed and Cadence ───────────────────────────────────────────────

export interface RSCMeasurement {
  /** Instantaneous speed in m/s */
  speedMs: number;
  /** Instantaneous cadence in steps/min */
  cadence: number;
  /** Stride length in meters */
  strideLength?: number;
  /** Total distance in meters */
  totalDistance?: number;
  /** Whether the user is walking (false = running) */
  isWalking: boolean;
}

// ─── Fitness Machine (FTMS) ──────────────────────────────────────────────────

export interface IndoorBikeData {
  /** Instantaneous speed in km/h */
  speedKmh?: number;
  /** Average speed in km/h */
  averageSpeedKmh?: number;
  /** Instantaneous cadence in RPM */
  cadenceRpm?: number;
  /** Average cadence in RPM */
  averageCadenceRpm?: number;
  /** Total distance in meters */
  totalDistance?: number;
  /** Resistance level */
  resistanceLevel?: number;
  /** Instantaneous power in watts */
  powerWatts?: number;
  /** Average power in watts */
  averagePowerWatts?: number;
  /** Total energy in kcal */
  totalEnergy?: number;
  /** Energy per hour in kcal */
  energyPerHour?: number;
  /** Energy per minute in kcal */
  energyPerMinute?: number;
  /** Heart rate in BPM */
  heartRate?: number;
  /** Metabolic equivalent (0.1 MET resolution) */
  metabolicEquivalent?: number;
  /** Elapsed time in seconds */
  elapsedTime?: number;
  /** Remaining time in seconds */
  remainingTime?: number;
}

export interface TreadmillData {
  speedKmh?: number;
  averageSpeedKmh?: number;
  totalDistance?: number;
  inclination?: number;
  rampAngle?: number;
  positiveElevationGain?: number;
  negativeElevationGain?: number;
  instantaneousPace?: number;
  averagePace?: number;
  totalEnergy?: number;
  energyPerHour?: number;
  energyPerMinute?: number;
  heartRate?: number;
  metabolicEquivalent?: number;
  elapsedTime?: number;
  remainingTime?: number;
  forceOnBelt?: number;
  powerOutput?: number;
}

export interface RowerData {
  strokeRate?: number;
  strokeCount?: number;
  averageStrokeRate?: number;
  totalDistance?: number;
  instantaneousPace?: number;
  averagePace?: number;
  instantaneousPower?: number;
  averagePower?: number;
  resistanceLevel?: number;
  totalEnergy?: number;
  energyPerHour?: number;
  energyPerMinute?: number;
  heartRate?: number;
  metabolicEquivalent?: number;
  elapsedTime?: number;
  remainingTime?: number;
}

/** FTMS Control Point result codes */
export enum FTMSResultCode {
  Success = 0x01,
  OpCodeNotSupported = 0x02,
  InvalidParameter = 0x03,
  OperationFailed = 0x04,
  ControlNotPermitted = 0x05,
}

// ─── Pulse Oximeter ──────────────────────────────────────────────────────────

export interface PLXSpotCheckMeasurement {
  /** SpO2 percentage */
  spo2: number;
  /** Pulse rate in BPM */
  pulseRate: number;
  /** Timestamp if available */
  timestamp?: Date;
  /** Measurement status flags */
  measurementStatus?: number;
  /** Device and sensor status */
  deviceAndSensorStatus?: number;
  /** Pulse amplitude index */
  pulseAmplitudeIndex?: number;
}

export interface PLXContinuousMeasurement {
  /** Normal SpO2 */
  spo2: number;
  /** Normal pulse rate */
  pulseRate: number;
  /** Fast SpO2 (if available) */
  spo2Fast?: number;
  /** Fast pulse rate (if available) */
  pulseRateFast?: number;
  /** Slow SpO2 (if available) */
  spo2Slow?: number;
  /** Slow pulse rate (if available) */
  pulseRateSlow?: number;
  /** Measurement status */
  measurementStatus?: number;
  /** Device and sensor status */
  deviceAndSensorStatus?: number;
  /** Pulse amplitude index */
  pulseAmplitudeIndex?: number;
}

// ─── Battery ─────────────────────────────────────────────────────────────────

export interface BatteryLevel {
  /** Battery percentage 0–100 */
  level: number;
}

// ─── Device Information ──────────────────────────────────────────────────────

export interface DeviceInformation {
  manufacturerName?: string;
  modelNumber?: string;
  serialNumber?: string;
  hardwareRevision?: string;
  firmwareRevision?: string;
  softwareRevision?: string;
  systemId?: { manufacturer: string; organizationallyUnique: string };
  pnpId?: {
    vendorIdSource: number;
    vendorId: number;
    productId: number;
    productVersion: number;
  };
}
