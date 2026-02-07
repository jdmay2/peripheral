/**
 * MQTT types for smart home integration.
 * Supports both direct MQTT and Home Assistant MQTT discovery.
 */

// ─── Connection config ───────────────────────────────────────────────────────

export interface MQTTConnectionConfig {
  /** Broker URL — must use wss:// for React Native (e.g., "wss://broker:8884/mqtt") */
  brokerUrl: string;
  /** Client ID (auto-generated if not provided) */
  clientId?: string;
  /** Username for authentication */
  username?: string;
  /** Password for authentication */
  password?: string;
  /** Clean session (default: true) */
  clean?: boolean;
  /** Keep-alive interval in seconds (default: 60) */
  keepalive?: number;
  /** Reconnect period in ms (default: 1000, 0 to disable) */
  reconnectPeriod?: number;
  /** Connection timeout in ms (default: 30000) */
  connectTimeout?: number;
  /** MQTT protocol version (default: 5) */
  protocolVersion?: 4 | 5;
  /** Will message for ungraceful disconnect */
  will?: {
    topic: string;
    payload: string;
    qos: 0 | 1 | 2;
    retain: boolean;
  };
}

export enum MQTTConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Reconnecting = 'reconnecting',
  Error = 'error',
}

// ─── MQTT message types ──────────────────────────────────────────────────────

export interface MQTTMessage {
  topic: string;
  payload: string;
  qos: 0 | 1 | 2;
  retain: boolean;
  /** MQTT 5.0 properties */
  properties?: {
    userProperties?: Record<string, string>;
    messageExpiryInterval?: number;
    responseTopic?: string;
    correlationData?: Buffer;
    contentType?: string;
  };
}

export interface MQTTSubscription {
  topic: string;
  qos?: 0 | 1 | 2;
}

// ─── HA MQTT Discovery ───────────────────────────────────────────────────────

/**
 * Home Assistant MQTT discovery config.
 * Discovery topic format: homeassistant/<component>/<nodeID>/<objectID>/config
 *
 * Supported components: alarm_control_panel, binary_sensor, button, camera,
 * climate, cover, device_tracker, fan, humidifier, light, lock, number,
 * scene, select, sensor, siren, switch, text, update, vacuum, valve, water_heater
 */
export type HADiscoveryComponent =
  | 'alarm_control_panel'
  | 'binary_sensor'
  | 'button'
  | 'camera'
  | 'climate'
  | 'cover'
  | 'device_tracker'
  | 'fan'
  | 'humidifier'
  | 'light'
  | 'lock'
  | 'number'
  | 'scene'
  | 'select'
  | 'sensor'
  | 'siren'
  | 'switch'
  | 'text'
  | 'update'
  | 'vacuum'
  | 'valve'
  | 'water_heater';

/** Base discovery config shared by all components */
export interface HADiscoveryConfigBase {
  /** Unique ID for the entity (required for entity registry) */
  unique_id?: string;
  /** Display name */
  name?: string;
  /** Object ID for entity_id generation */
  object_id?: string;
  /** State topic */
  state_topic?: string;
  /** Command topic */
  command_topic?: string;
  /** Availability topic(s) */
  availability_topic?: string;
  availability?: Array<{
    topic: string;
    payload_available?: string;
    payload_not_available?: string;
    value_template?: string;
  }>;
  /** Availability mode when using list */
  availability_mode?: 'all' | 'any' | 'latest';
  /** Payload values */
  payload_on?: string;
  payload_off?: string;
  payload_available?: string;
  payload_not_available?: string;
  /** Value template (Jinja2) */
  value_template?: string;
  /** Command template */
  command_template?: string;
  /** Device information */
  device?: HADiscoveryDevice;
  /** Entity category */
  entity_category?: 'config' | 'diagnostic';
  /** Icon */
  icon?: string;
  /** QoS level */
  qos?: 0 | 1 | 2;
  /** Retain flag */
  retain?: boolean;
  /** Encoding */
  encoding?: string;
  /** Enabled by default */
  enabled_by_default?: boolean;
}

/** Device info within discovery config */
export interface HADiscoveryDevice {
  identifiers?: string | string[];
  connections?: Array<[string, string]>;
  name?: string;
  manufacturer?: string;
  model?: string;
  sw_version?: string;
  hw_version?: string;
  via_device?: string;
  suggested_area?: string;
  configuration_url?: string;
}

// ─── Light discovery config ──────────────────────────────────────────────────

export interface HADiscoveryLightConfig extends HADiscoveryConfigBase {
  brightness_command_topic?: string;
  brightness_state_topic?: string;
  brightness_scale?: number;
  brightness_value_template?: string;
  color_temp_command_topic?: string;
  color_temp_state_topic?: string;
  color_temp_value_template?: string;
  hs_command_topic?: string;
  hs_state_topic?: string;
  rgb_command_topic?: string;
  rgb_state_topic?: string;
  xy_command_topic?: string;
  xy_state_topic?: string;
  effect_command_topic?: string;
  effect_state_topic?: string;
  effect_list?: string[];
  min_mireds?: number;
  max_mireds?: number;
  on_command_type?: 'last' | 'first' | 'brightness';
  schema?: 'default' | 'json' | 'template';
  supported_color_modes?: string[];
  color_mode?: boolean;
}

// ─── Sensor discovery config ─────────────────────────────────────────────────

export interface HADiscoverySensorConfig extends HADiscoveryConfigBase {
  device_class?: string;
  state_class?: 'measurement' | 'total' | 'total_increasing';
  unit_of_measurement?: string;
  suggested_display_precision?: number;
  force_update?: boolean;
  expire_after?: number;
  last_reset_value_template?: string;
}

// ─── Zigbee2MQTT types ───────────────────────────────────────────────────────

/** Zigbee2MQTT device state (published to zigbee2mqtt/<friendly_name>) */
export interface Z2MDeviceState {
  state?: 'ON' | 'OFF';
  brightness?: number;
  color_temp?: number;
  color?: { x: number; y: number } | { hue: number; saturation: number };
  temperature?: number;
  humidity?: number;
  pressure?: number;
  battery?: number;
  linkquality?: number;
  occupancy?: boolean;
  contact?: boolean;
  water_leak?: boolean;
  [key: string]: unknown;
}

/** Zigbee2MQTT bridge info (published to zigbee2mqtt/bridge/info) */
export interface Z2MBridgeInfo {
  version: string;
  commit: string;
  coordinator: {
    type: string;
    meta: Record<string, unknown>;
  };
  network: {
    channel: number;
    pan_id: number;
    extended_pan_id: number[];
  };
  log_level: string;
  permit_join: boolean;
  permit_join_timeout?: number;
}

/** Zigbee2MQTT device list entry */
export interface Z2MDevice {
  ieee_address: string;
  friendly_name: string;
  type: 'Coordinator' | 'Router' | 'EndDevice';
  definition?: {
    model: string;
    vendor: string;
    description: string;
    exposes: Z2MExpose[];
  };
  power_source?: string;
  network_address: number;
  interview_completed: boolean;
  supported: boolean;
}

/** Zigbee2MQTT expose definition */
export interface Z2MExpose {
  type: 'binary' | 'numeric' | 'enum' | 'text' | 'composite' | 'list' | 'light' | 'switch' | 'fan' | 'cover' | 'lock' | 'climate';
  name?: string;
  property?: string;
  access?: number;
  values?: string[];
  value_min?: number;
  value_max?: number;
  value_step?: number;
  unit?: string;
  features?: Z2MExpose[];
}
