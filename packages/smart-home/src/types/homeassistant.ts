/**
 * Home Assistant WebSocket and REST API types.
 * Based on the official HA WebSocket API specification.
 */

// ─── Connection config ───────────────────────────────────────────────────────

export interface HAConnectionConfig {
  /** Home Assistant base URL (e.g., "http://192.168.1.100:8123") */
  url: string;
  /** Authentication method */
  auth: HAAuthConfig;
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** WebSocket connection timeout in ms (default: 10000) */
  timeout?: number;
}

export type HAAuthConfig =
  | { type: 'longLivedToken'; token: string }
  | { type: 'oauth2'; accessToken: string; refreshToken?: string };

// ─── WebSocket message types ─────────────────────────────────────────────────

/** Outgoing WebSocket command */
export interface HAWebSocketCommand {
  id: number;
  type: string;
  [key: string]: unknown;
}

/** Incoming WebSocket result */
export interface HAWebSocketResult {
  id: number;
  type: 'result';
  success: boolean;
  result?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

/** Incoming WebSocket event */
export interface HAWebSocketEvent {
  id: number;
  type: 'event';
  event: {
    event_type: string;
    data: Record<string, unknown>;
    origin: string;
    time_fired: string;
    context: {
      id: string;
      parent_id: string | null;
      user_id: string | null;
    };
  };
}

/** Auth required message (first message from server) */
export interface HAAuthRequired {
  type: 'auth_required';
  ha_version: string;
}

/** Auth OK response */
export interface HAAuthOk {
  type: 'auth_ok';
  ha_version: string;
}

/** Auth invalid response */
export interface HAAuthInvalid {
  type: 'auth_invalid';
  message: string;
}

export type HAIncomingMessage =
  | HAWebSocketResult
  | HAWebSocketEvent
  | HAAuthRequired
  | HAAuthOk
  | HAAuthInvalid
  | { type: 'pong'; id: number };

// ─── WebSocket command types ─────────────────────────────────────────────────

export type HASubscribeEventsCommand = {
  type: 'subscribe_events';
  event_type?: string;
};

export type HACallServiceCommand = {
  type: 'call_service';
  domain: string;
  service: string;
  service_data?: Record<string, unknown>;
  target?: {
    entity_id?: string | string[];
    device_id?: string | string[];
    area_id?: string | string[];
  };
};

export type HAGetStatesCommand = {
  type: 'get_states';
};

export type HAGetServicesCommand = {
  type: 'get_services';
};

export type HAGetConfigCommand = {
  type: 'get_config';
};

export type HAPingCommand = {
  type: 'ping';
};

export type HASubscribeTriggerCommand = {
  type: 'subscribe_trigger';
  trigger: Record<string, unknown>;
};

export type HAFireEventCommand = {
  type: 'fire_event';
  event_type: string;
  event_data?: Record<string, unknown>;
};

// ─── REST API types ──────────────────────────────────────────────────────────

/** HA state object from REST API / WebSocket get_states */
export interface HAState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
  context: {
    id: string;
    parent_id: string | null;
    user_id: string | null;
  };
}

/** HA service definition from get_services */
export interface HAServiceDomain {
  [service: string]: {
    name?: string;
    description?: string;
    fields: Record<
      string,
      {
        name?: string;
        description?: string;
        required?: boolean;
        example?: unknown;
        selector?: Record<string, unknown>;
      }
    >;
    target?: {
      entity?: { domain?: string | string[] };
      device?: Record<string, unknown>;
      area?: Record<string, unknown>;
    };
  };
}

/** HA config from get_config */
export interface HAConfig {
  latitude: number;
  longitude: number;
  elevation: number;
  unit_system: {
    length: string;
    mass: string;
    temperature: string;
    volume: string;
  };
  location_name: string;
  time_zone: string;
  components: string[];
  version: string;
  state: 'NOT_RUNNING' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'FINAL_WRITE';
}

/** Area registry entry */
export interface HAAreaEntry {
  area_id: string;
  name: string;
  floor_id?: string | null;
  icon?: string | null;
  aliases?: string[];
  picture?: string | null;
}

/** Device registry entry */
export interface HADeviceEntry {
  id: string;
  name: string | null;
  name_by_user: string | null;
  manufacturer: string | null;
  model: string | null;
  sw_version: string | null;
  hw_version: string | null;
  area_id: string | null;
  connections: Array<[string, string]>;
  identifiers: Array<[string, string]>;
  via_device_id: string | null;
  disabled_by: string | null;
  config_entries: string[];
}

/** Entity registry entry */
export interface HAEntityEntry {
  entity_id: string;
  name: string | null;
  icon: string | null;
  platform: string;
  device_id: string | null;
  area_id: string | null;
  disabled_by: string | null;
  hidden_by: string | null;
  unique_id: string;
  original_name: string | null;
}

/** History API response */
export interface HAHistoryEntry {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

// ─── Connection state ────────────────────────────────────────────────────────

export enum HAConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Authenticating = 'authenticating',
  Connected = 'connected',
  Reconnecting = 'reconnecting',
  Error = 'error',
}
