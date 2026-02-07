/**
 * Connection lifecycle states.
 * Modeled as an explicit state machine to prevent invalid transitions.
 */
export enum ConnectionState {
  /** No connection attempt in progress */
  Disconnected = 'disconnected',
  /** Actively scanning for the device */
  Scanning = 'scanning',
  /** BLE connection being established */
  Connecting = 'connecting',
  /** GATT service/characteristic discovery in progress */
  Discovering = 'discovering',
  /** Fully connected with services discovered — ready for operations */
  Ready = 'ready',
  /** Graceful disconnect in progress */
  Disconnecting = 'disconnecting',
  /** Connection lost unexpectedly, reconnection may be attempted */
  ConnectionLost = 'connection_lost',
  /** Auto-reconnection in progress */
  Reconnecting = 'reconnecting',
}

/**
 * Valid state transitions. Any transition not listed here is a bug.
 */
export const VALID_TRANSITIONS: Record<ConnectionState, ConnectionState[]> = {
  [ConnectionState.Disconnected]: [
    ConnectionState.Scanning,
    ConnectionState.Connecting,
  ],
  [ConnectionState.Scanning]: [
    ConnectionState.Connecting,
    ConnectionState.Disconnected,
  ],
  [ConnectionState.Connecting]: [
    ConnectionState.Discovering,
    ConnectionState.Disconnected,
    ConnectionState.ConnectionLost,
  ],
  [ConnectionState.Discovering]: [
    ConnectionState.Ready,
    ConnectionState.Disconnected,
    ConnectionState.ConnectionLost,
  ],
  [ConnectionState.Ready]: [
    ConnectionState.Disconnecting,
    ConnectionState.ConnectionLost,
  ],
  [ConnectionState.Disconnecting]: [ConnectionState.Disconnected],
  [ConnectionState.ConnectionLost]: [
    ConnectionState.Reconnecting,
    ConnectionState.Disconnected,
  ],
  [ConnectionState.Reconnecting]: [
    ConnectionState.Connecting,
    ConnectionState.Disconnected,
  ],
};

/** Result from a BLE scan */
export interface ScanResult {
  /** Platform peripheral ID (MAC on Android, UUID on iOS) */
  id: string;
  /** Device advertised name, may be null */
  name: string | null;
  /** RSSI in dBm */
  rssi: number;
  /** Advertised service UUIDs */
  serviceUUIDs: string[];
  /** Raw manufacturer data as hex string */
  manufacturerData?: string;
  /** Raw advertising data */
  advertising: {
    localName?: string;
    serviceUUIDs?: string[];
    txPowerLevel?: number;
    manufacturerData?: Record<string, unknown>;
    serviceData?: Record<string, unknown>;
    isConnectable?: boolean;
  };
}

/** Discovered GATT service */
export interface BleService {
  uuid: string;
  characteristics: BleCharacteristic[];
}

/** Discovered GATT characteristic */
export interface BleCharacteristic {
  uuid: string;
  serviceUUID: string;
  properties: CharacteristicProperties;
  descriptors?: BleDescriptor[];
}

/** Characteristic property flags */
export interface CharacteristicProperties {
  read: boolean;
  write: boolean;
  writeWithoutResponse: boolean;
  notify: boolean;
  indicate: boolean;
}

/** Discovered GATT descriptor */
export interface BleDescriptor {
  uuid: string;
  characteristicUUID: string;
  serviceUUID: string;
}

/** A fully connected BLE peripheral with discovered services */
export interface BleDevice {
  /** Platform peripheral ID */
  id: string;
  /** Device name */
  name: string | null;
  /** Current RSSI */
  rssi: number;
  /** Negotiated MTU size */
  mtu: number;
  /** Discovered GATT services */
  services: BleService[];
  /** Current connection state */
  state: ConnectionState;
}

/** Scan filter options — inspired by Web Bluetooth API */
export interface ScanFilter {
  /** Filter by service UUIDs */
  services?: string[];
  /** Filter by exact device name */
  name?: string;
  /** Filter by device name prefix */
  namePrefix?: string;
  /** Minimum RSSI threshold in dBm */
  rssiThreshold?: number;
  /** Scan duration in milliseconds (0 = indefinite) */
  duration?: number;
  /** Allow duplicate reports for the same device */
  allowDuplicates?: boolean;
}

/** Options for connecting to a device */
export interface ConnectOptions {
  /** Request specific MTU size (Android only, iOS auto-negotiates) */
  requestMtu?: number;
  /** Connection timeout in milliseconds */
  timeout?: number;
  /** Auto-reconnect on unexpected disconnection */
  autoReconnect?: boolean;
  /** Reconnection strategy config */
  reconnection?: ReconnectionConfig;
}

/** Auto-reconnection configuration */
export interface ReconnectionConfig {
  /** Maximum number of reconnection attempts (default: 5) */
  maxAttempts?: number;
  /** Initial delay in ms before first retry (default: 1000) */
  baseDelay?: number;
  /** Maximum delay in ms between retries (default: 30000) */
  maxDelay?: number;
  /** Backoff multiplier (default: 2.0) */
  multiplier?: number;
  /** Add random jitter to prevent thundering herd (default: true) */
  jitter?: boolean;
}

/** BLE manager initialization options */
export interface BleManagerOptions {
  /** Show native BLE enable prompt on Android (default: true) */
  showAlert?: boolean;
  /** Force using legacy scanning on Android (default: false) */
  forceLegacy?: boolean;
}

/** Event types emitted by the BLE manager */
export type BleEventType =
  | 'stateChange'
  | 'deviceFound'
  | 'connectionStateChange'
  | 'characteristicValueChanged'
  | 'error';

/** BLE adapter state */
export enum AdapterState {
  Unknown = 'unknown',
  Resetting = 'resetting',
  Unsupported = 'unsupported',
  Unauthorized = 'unauthorized',
  PoweredOff = 'powered_off',
  PoweredOn = 'powered_on',
}

/** Write operation type */
export enum WriteType {
  WithResponse = 'write',
  WithoutResponse = 'writeWithoutResponse',
}

/** Notification data from a characteristic subscription */
export interface CharacteristicNotification {
  /** Peripheral ID */
  deviceId: string;
  /** Service UUID */
  serviceUUID: string;
  /** Characteristic UUID */
  characteristicUUID: string;
  /** Raw byte values */
  value: number[];
}
