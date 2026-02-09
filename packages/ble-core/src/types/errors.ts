/**
 * Typed BLE error codes for structured error handling.
 *
 * These cover the common failure modes encountered when working with
 * Bluetooth Low Energy peripherals on mobile platforms.
 */
export enum BleErrorCode {
  /** Android GATT error (error 133 or other native GATT failures) */
  GattError = 'gatt_error',
  /** Operation timed out */
  Timeout = 'timeout',
  /** Required Bluetooth permissions not granted */
  PermissionDenied = 'permission_denied',
  /** Device is not currently connected */
  NotConnected = 'not_connected',
  /** BLE manager not initialized — call initialize() first */
  NotInitialized = 'not_initialized',
  /** Device ID not found during scan or connection */
  DeviceNotFound = 'device_not_found',
  /** Requested characteristic not found on device */
  CharacteristicNotFound = 'characteristic_not_found',
  /** Requested service not found on device */
  ServiceNotFound = 'service_not_found',
  /** Write operation failed */
  WriteFailed = 'write_failed',
  /** Read operation failed */
  ReadFailed = 'read_failed',
  /** Failed to start/stop notifications */
  NotifyFailed = 'notify_failed',
  /** Scan operation failed */
  ScanFailed = 'scan_failed',
  /** Unclassified error */
  Unknown = 'unknown',
}

/**
 * Structured BLE error with machine-readable code and optional context.
 *
 * @example
 * ```ts
 * try {
 *   await peripheralManager.connect(deviceId);
 * } catch (err) {
 *   if (err instanceof BleError) {
 *     switch (err.code) {
 *       case BleErrorCode.Timeout:
 *         console.log('Connection timed out, retrying...');
 *         break;
 *       case BleErrorCode.PermissionDenied:
 *         console.log('Please grant Bluetooth permissions');
 *         break;
 *     }
 *   }
 * }
 * ```
 */
export class BleError extends Error {
  /** Machine-readable error code */
  readonly code: BleErrorCode;

  /** Device ID associated with the error (if applicable) */
  readonly deviceId?: string;

  /** Characteristic UUID associated with the error (if applicable) */
  readonly characteristicUUID?: string;

  /** The original native error (if wrapping a platform error) */
  readonly nativeError?: unknown;

  constructor(
    code: BleErrorCode,
    message: string,
    options?: {
      deviceId?: string;
      characteristicUUID?: string;
      nativeError?: unknown;
    }
  ) {
    super(message);
    this.name = 'BleError';
    this.code = code;
    this.deviceId = options?.deviceId;
    this.characteristicUUID = options?.characteristicUUID;
    this.nativeError = options?.nativeError;
  }
}
