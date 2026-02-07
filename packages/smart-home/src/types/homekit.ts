/**
 * HomeKit types for the native Swift Expo Module bridge.
 *
 * These types mirror the HMHomeManager → HMHome → HMAccessory → HMService →
 * HMCharacteristic hierarchy. The native module sends/receives these as
 * serialized JSON across the bridge.
 */

// ─── HomeKit home hierarchy ──────────────────────────────────────────────────

export interface HKHome {
  uniqueIdentifier: string;
  name: string;
  isPrimary: boolean;
  rooms: HKRoom[];
  zones: HKZone[];
  accessories: HKAccessory[];
  actionSets: HKActionSet[];
}

export interface HKRoom {
  uniqueIdentifier: string;
  name: string;
  accessoryIds: string[];
}

export interface HKZone {
  uniqueIdentifier: string;
  name: string;
  roomIds: string[];
}

// ─── HomeKit accessory ───────────────────────────────────────────────────────

export interface HKAccessory {
  uniqueIdentifier: string;
  name: string;
  category: HKAccessoryCategory;
  isReachable: boolean;
  isBridged: boolean;
  firmwareVersion?: string;
  manufacturer?: string;
  model?: string;
  services: HKService[];
  /** Room this accessory is assigned to */
  roomId?: string;
  /** Whether this is a Matter device */
  isMatterAccessory?: boolean;
}

export type HKAccessoryCategory =
  | 'other'
  | 'securitySystem'
  | 'bridge'
  | 'door'
  | 'doorLock'
  | 'fan'
  | 'garageDoorOpener'
  | 'lightbulb'
  | 'outlet'
  | 'programmableSwitch'
  | 'sensor'
  | 'switch'
  | 'thermostat'
  | 'window'
  | 'windowCovering'
  | 'camera'
  | 'videoDoorbell'
  | 'airPurifier'
  | 'humidifier'
  | 'dehumidifier'
  | 'sprinkler'
  | 'faucet'
  | 'showerHead'
  | 'television'
  | 'router';

// ─── HomeKit service + characteristic ────────────────────────────────────────

export interface HKService {
  uniqueIdentifier: string;
  serviceType: string;
  name?: string;
  isPrimary: boolean;
  characteristics: HKCharacteristic[];
}

export interface HKCharacteristic {
  uniqueIdentifier: string;
  characteristicType: HKCharacteristicType;
  value: unknown;
  properties: HKCharacteristicProperty[];
  metadata?: HKCharacteristicMetadata;
}

export interface HKCharacteristicMetadata {
  minimumValue?: number;
  maximumValue?: number;
  stepValue?: number;
  format?: string;
  units?: string;
  validValues?: number[];
  description?: string;
}

export type HKCharacteristicProperty =
  | 'readable'
  | 'writable'
  | 'supportsEventNotification'
  | 'hidden'
  | 'readOnly';

/** Common HomeKit characteristic types (maps to HMCharacteristicType constants) */
export type HKCharacteristicType =
  // Power & state
  | 'powerState'
  | 'inUse'
  | 'active'
  | 'statusActive'
  | 'outletInUse'
  // Lighting
  | 'brightness'
  | 'hue'
  | 'saturation'
  | 'colorTemperature'
  // Climate
  | 'currentTemperature'
  | 'targetTemperature'
  | 'currentHeatingCooling'
  | 'targetHeatingCooling'
  | 'currentRelativeHumidity'
  | 'targetRelativeHumidity'
  | 'coolingThreshold'
  | 'heatingThreshold'
  // Cover / window
  | 'currentPosition'
  | 'targetPosition'
  | 'positionState'
  | 'holdPosition'
  | 'currentHorizontalTilt'
  | 'targetHorizontalTilt'
  | 'currentVerticalTilt'
  | 'targetVerticalTilt'
  // Door / lock
  | 'currentDoorState'
  | 'targetDoorState'
  | 'currentLockMechanismState'
  | 'targetLockMechanismState'
  | 'lockManagementAutoSecureTimeout'
  // Fan
  | 'rotationDirection'
  | 'rotationSpeed'
  | 'swingMode'
  // Sensors
  | 'currentLightLevel'
  | 'motionDetected'
  | 'occupancyDetected'
  | 'contactState'
  | 'smokeDetected'
  | 'carbonMonoxideDetected'
  | 'carbonDioxideLevel'
  | 'airQuality'
  | 'leakDetected'
  // Security
  | 'securitySystemCurrentState'
  | 'securitySystemTargetState'
  // Battery
  | 'batteryLevel'
  | 'chargingState'
  | 'statusLowBattery'
  // General
  | 'name'
  | 'identify'
  | 'obstruction'
  | 'statusFault'
  | 'statusTampered'
  | string; // Allow custom types

// ─── HomeKit scenes / action sets ────────────────────────────────────────────

export interface HKActionSet {
  uniqueIdentifier: string;
  name: string;
  type: 'userDefined' | 'homeArrival' | 'homeDeparture' | 'sleep' | 'wakeUp';
  actions: HKCharacteristicWriteAction[];
}

export interface HKCharacteristicWriteAction {
  characteristicId: string;
  targetValue: unknown;
}

// ─── Native module interface ─────────────────────────────────────────────────

/**
 * The contract for the native Swift Expo Module.
 * Implement this interface in the iOS-side module.
 */
export interface HomeKitNativeModule {
  // Home management
  getHomes(): Promise<HKHome[]>;
  getPrimaryHome(): Promise<HKHome | null>;

  // Accessory management
  getAccessories(homeId: string): Promise<HKAccessory[]>;
  getAccessory(homeId: string, accessoryId: string): Promise<HKAccessory | null>;

  // Characteristic control
  readCharacteristic(
    homeId: string,
    accessoryId: string,
    serviceId: string,
    characteristicId: string
  ): Promise<unknown>;

  writeCharacteristic(
    homeId: string,
    accessoryId: string,
    serviceId: string,
    characteristicId: string,
    value: unknown
  ): Promise<void>;

  // Scenes
  getActionSets(homeId: string): Promise<HKActionSet[]>;
  executeActionSet(homeId: string, actionSetId: string): Promise<void>;

  // Room management
  getRooms(homeId: string): Promise<HKRoom[]>;
  assignAccessoryToRoom(
    homeId: string,
    accessoryId: string,
    roomId: string
  ): Promise<void>;

  // Events → JS
  startObservingHomeChanges(): void;
  stopObservingHomeChanges(): void;
}

// ─── Connection state ────────────────────────────────────────────────────────

export enum HKConnectionState {
  Unavailable = 'unavailable',
  Loading = 'loading',
  Ready = 'ready',
  Error = 'error',
}
