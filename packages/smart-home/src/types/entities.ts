/**
 * Universal smart home entity model.
 * Maps cleanly to Home Assistant entities, HomeKit accessories,
 * and MQTT discovery devices.
 */

// ─── Entity domains ──────────────────────────────────────────────────────────

export type EntityDomain =
  | 'light'
  | 'switch'
  | 'climate'
  | 'lock'
  | 'cover'
  | 'fan'
  | 'media_player'
  | 'sensor'
  | 'binary_sensor'
  | 'camera'
  | 'vacuum'
  | 'alarm_control_panel'
  | 'automation'
  | 'scene'
  | 'script'
  | 'input_boolean'
  | 'input_number'
  | 'input_select'
  | 'number'
  | 'select'
  | 'button'
  | 'humidifier'
  | 'water_heater';

// ─── Base entity ─────────────────────────────────────────────────────────────

export interface SmartHomeEntity {
  /** Unique entity ID (e.g., "light.living_room") */
  entityId: string;
  /** Domain extracted from entity ID */
  domain: EntityDomain;
  /** Human-friendly display name */
  friendlyName: string;
  /** Current state string (e.g., "on", "off", "22.5", "locked") */
  state: string;
  /** Full attribute map */
  attributes: Record<string, unknown>;
  /** Last state change ISO timestamp */
  lastChanged: string;
  /** Last attribute update ISO timestamp */
  lastUpdated: string;
  /** Optional area/room ID */
  areaId?: string;
  /** Optional device ID */
  deviceId?: string;
}

// ─── Domain-specific attributes ──────────────────────────────────────────────

export interface LightAttributes {
  brightness?: number; // 0–255
  color_temp?: number; // mireds
  color_temp_kelvin?: number;
  hs_color?: [number, number]; // [hue 0–360, saturation 0–100]
  rgb_color?: [number, number, number];
  rgbw_color?: [number, number, number, number];
  xy_color?: [number, number];
  color_mode?: string;
  supported_color_modes?: string[];
  min_mireds?: number;
  max_mireds?: number;
  effect?: string;
  effect_list?: string[];
}

export interface ClimateAttributes {
  temperature?: number;
  target_temp_high?: number;
  target_temp_low?: number;
  current_temperature?: number;
  current_humidity?: number;
  hvac_action?: 'heating' | 'cooling' | 'drying' | 'idle' | 'off' | 'fan';
  hvac_modes?: string[];
  fan_mode?: string;
  fan_modes?: string[];
  preset_mode?: string;
  preset_modes?: string[];
  swing_mode?: string;
  swing_modes?: string[];
  min_temp?: number;
  max_temp?: number;
}

export interface CoverAttributes {
  current_position?: number; // 0–100
  current_tilt_position?: number;
  device_class?:
    | 'awning'
    | 'blind'
    | 'curtain'
    | 'damper'
    | 'door'
    | 'garage'
    | 'gate'
    | 'shade'
    | 'shutter'
    | 'window';
}

export interface FanAttributes {
  percentage?: number; // 0–100
  preset_mode?: string;
  preset_modes?: string[];
  oscillating?: boolean;
  direction?: 'forward' | 'reverse';
  percentage_step?: number;
}

export interface LockAttributes {
  is_locked?: boolean;
  is_locking?: boolean;
  is_unlocking?: boolean;
  is_jammed?: boolean;
  changed_by?: string;
  code_format?: string;
}

export interface MediaPlayerAttributes {
  media_title?: string;
  media_artist?: string;
  media_album_name?: string;
  media_content_type?: string;
  media_duration?: number;
  media_position?: number;
  media_position_updated_at?: string;
  volume_level?: number; // 0.0–1.0
  is_volume_muted?: boolean;
  source?: string;
  source_list?: string[];
  sound_mode?: string;
  sound_mode_list?: string[];
  shuffle?: boolean;
  repeat?: 'off' | 'all' | 'one';
}

export interface VacuumAttributes {
  status?: string;
  battery_level?: number;
  fan_speed?: string;
  fan_speed_list?: string[];
}

export interface AlarmAttributes {
  code_arm_required?: boolean;
  code_format?: 'number' | 'text';
  changed_by?: string;
}

export interface SensorAttributes {
  device_class?: string;
  state_class?: 'measurement' | 'total' | 'total_increasing';
  unit_of_measurement?: string;
  native_value?: unknown;
}

// ─── Area / Device ───────────────────────────────────────────────────────────

export interface SmartHomeArea {
  areaId: string;
  name: string;
  /** Optional floor ID */
  floorId?: string;
  /** Optional icon */
  icon?: string;
  /** Aliases for voice control */
  aliases?: string[];
}

export interface SmartHomeDevice {
  deviceId: string;
  name: string;
  manufacturer?: string;
  model?: string;
  swVersion?: string;
  hwVersion?: string;
  areaId?: string;
  /** All entity IDs belonging to this device */
  entityIds: string[];
  /** Connection identifiers (MAC, serial, etc.) */
  connections: Array<[string, string]>;
  /** Identifier tuples (domain, id) */
  identifiers: Array<[string, string]>;
  /** Via device ID (e.g., hub) */
  viaDeviceId?: string;
}

// ─── Scene / Automation ──────────────────────────────────────────────────────

export interface SmartHomeScene {
  entityId: string;
  name: string;
  /** Entity states captured in the scene */
  entities?: Record<string, Record<string, unknown>>;
}

export interface SmartHomeAutomation {
  entityId: string;
  name: string;
  state: 'on' | 'off';
  lastTriggered?: string;
}

// ─── Service call ────────────────────────────────────────────────────────────

export interface ServiceCall {
  domain: string;
  service: string;
  serviceData?: Record<string, unknown>;
  target?: ServiceTarget;
}

export interface ServiceTarget {
  entityId?: string | string[];
  deviceId?: string | string[];
  areaId?: string | string[];
}

// ─── Event ───────────────────────────────────────────────────────────────────

export interface StateChangedEvent {
  entityId: string;
  newState: SmartHomeEntity | null;
  oldState: SmartHomeEntity | null;
}
