/**
 * @peripheral/smart-home
 *
 * React Native smart home integration — Home Assistant, MQTT, and HomeKit.
 *
 * Architecture:
 * - Home Assistant WebSocket (primary) — real-time state, 2000+ integrations
 * - Home Assistant REST — history, templates, batch queries
 * - MQTT — direct device control, Zigbee2MQTT, HA discovery
 * - HomeKit — iOS native module for Apple ecosystem
 *
 * @example
 * ```tsx
 * import {
 *   useHomeAssistant,
 *   useEntity,
 *   useEntities,
 *   useService,
 *   Light,
 *   lightTurnOn,
 *   lightTurnOff,
 * } from '@peripheral/smart-home';
 *
 * function App() {
 *   const { client, isConnected } = useHomeAssistant({
 *     url: 'http://192.168.1.100:8123',
 *     auth: { type: 'longLivedToken', token: 'eyJ...' },
 *   });
 *
 *   if (!isConnected) return null;
 *
 *   return <LightControl client={client} entityId="light.living_room" />;
 * }
 * ```
 */

// ─── Clients ─────────────────────────────────────────────────────────────────
export {
  HomeAssistantClient,
  HomeAssistantRest,
  MQTTClient,
  HomeKitClient,
} from './clients';
export type { HARestConfig } from './clients';

// ─── Hooks ───────────────────────────────────────────────────────────────────
export {
  useHomeAssistant,
  useEntity,
  useEntities,
  useAreas,
  useService,
  useAutomation,
  useHistory,
  useMQTT,
  useMQTTSubscription,
} from './hooks';

// ─── Device abstractions ─────────────────────────────────────────────────────
export {
  SmartDevice,
  Light,
  Climate,
  Lock,
  Cover,
  Fan,
  MediaPlayer,
  Vacuum,
  AlarmPanel,
  Sensor,
  BinarySensor,
  createDevice,
} from './devices';

// ─── Service call builders ───────────────────────────────────────────────────
export {
  // Generic
  turnOn,
  turnOff,
  toggle,
  // Light
  lightTurnOn,
  lightTurnOff,
  // Climate
  climateSetTemperature,
  climateSetHvacMode,
  climateSetFanMode,
  climateSetPresetMode,
  // Lock
  lockLock,
  lockUnlock,
  lockOpen,
  // Cover
  coverOpen,
  coverClose,
  coverStop,
  coverSetPosition,
  coverSetTiltPosition,
  // Fan
  fanSetPercentage,
  fanSetPresetMode,
  fanOscillate,
  fanSetDirection,
  // Media player
  mediaPlayerPlay,
  mediaPlayerPause,
  mediaPlayerStop,
  mediaPlayerNext,
  mediaPlayerPrevious,
  mediaPlayerSetVolume,
  mediaPlayerMute,
  mediaPlayerSelectSource,
  // Vacuum
  vacuumStart,
  vacuumStop,
  vacuumPause,
  vacuumReturnToBase,
  vacuumLocate,
  vacuumSetFanSpeed,
  // Alarm
  alarmArmHome,
  alarmArmAway,
  alarmArmNight,
  alarmDisarm,
  alarmTrigger,
  // Scene / Automation / Script
  activateScene,
  triggerAutomation,
  runScript,
} from './utils/service-calls';
export type { LightTurnOnOptions, HvacMode } from './utils/service-calls';

// ─── Entity helpers ──────────────────────────────────────────────────────────
export {
  extractDomain,
  extractObjectId,
  haStateToEntity,
  parseStateChangedEvent,
  isStateActive,
  isStateUnavailable,
  numericState,
  getAttribute,
  getFriendlyName,
  getDeviceClass,
  getUnitOfMeasurement,
  getIcon,
  filterByDomain,
  filterByArea,
  groupByDomain,
  groupByArea,
} from './utils/entities';

export { EventEmitter } from './utils/event-emitter';
export type { Unsubscribe } from './utils/event-emitter';

// ─── Types ───────────────────────────────────────────────────────────────────
export type {
  // Entities
  EntityDomain,
  SmartHomeEntity,
  SmartHomeArea,
  SmartHomeDevice,
  SmartHomeScene,
  SmartHomeAutomation,
  ServiceCall,
  ServiceTarget,
  StateChangedEvent,
  LightAttributes,
  ClimateAttributes,
  CoverAttributes,
  FanAttributes,
  LockAttributes,
  MediaPlayerAttributes,
  VacuumAttributes,
  AlarmAttributes,
  SensorAttributes,
  // Home Assistant
  HAConnectionConfig,
  HAAuthConfig,
  HAConnectionState,
  HAState,
  HAConfig,
  HAServiceDomain,
  HAAreaEntry,
  HADeviceEntry,
  HAEntityEntry,
  HAHistoryEntry,
  HAWebSocketCommand,
  HAWebSocketResult,
  HAWebSocketEvent,
  // MQTT
  MQTTConnectionConfig,
  MQTTConnectionState,
  MQTTMessage,
  MQTTSubscription,
  HADiscoveryComponent,
  HADiscoveryConfigBase,
  HADiscoveryDevice,
  HADiscoveryLightConfig,
  HADiscoverySensorConfig,
  Z2MDeviceState,
  Z2MBridgeInfo,
  Z2MDevice,
  Z2MExpose,
  // HomeKit
  HKHome,
  HKRoom,
  HKZone,
  HKAccessory,
  HKAccessoryCategory,
  HKService,
  HKCharacteristic,
  HKCharacteristicType,
  HKCharacteristicMetadata,
  HKCharacteristicProperty,
  HKActionSet,
  HKCharacteristicWriteAction,
  HKConnectionState,
  HomeKitNativeModule,
} from './types';
