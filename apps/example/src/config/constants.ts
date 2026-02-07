/**
 * Default configuration constants for the example app.
 */

/** Common IMU service UUID (custom BLE services often use this range) */
export const DEFAULT_IMU_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';

/** Common IMU characteristic UUID for notifications */
export const DEFAULT_IMU_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

/** Default sensor sample rate in Hz */
export const DEFAULT_SAMPLE_RATE = 50;

/** Default gesture engine config */
export const DEFAULT_ENGINE_CONFIG = {
  sampleRate: DEFAULT_SAMPLE_RATE,
  axes: 6 as const,
  lowPassCutoff: 20,
  highPassCutoff: 0.3,
};
