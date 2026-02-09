import type {
  SmartHomeEntity,
  EntityDomain,
  HAState,
  StateChangedEvent,
} from '../types';

// ─── Domain extraction ───────────────────────────────────────────────────────

const KNOWN_DOMAINS = new Set<EntityDomain>([
  'light', 'switch', 'climate', 'lock', 'cover', 'fan', 'media_player',
  'sensor', 'binary_sensor', 'camera', 'vacuum', 'alarm_control_panel',
  'automation', 'scene', 'script', 'input_boolean', 'input_number',
  'input_select', 'number', 'select', 'button', 'humidifier', 'water_heater',
  'person', 'weather',
]);

/**
 * Extract domain from an entity ID (e.g., "light.living_room" → "light").
 */
export function extractDomain(entityId: string): EntityDomain {
  const dot = entityId.indexOf('.');
  if (dot === -1) return 'sensor';
  const domain = entityId.substring(0, dot);
  return (KNOWN_DOMAINS.has(domain as EntityDomain) ? domain : 'sensor') as EntityDomain;
}

/**
 * Extract object ID from entity ID (e.g., "light.living_room" → "living_room").
 */
export function extractObjectId(entityId: string): string {
  const dot = entityId.indexOf('.');
  return dot === -1 ? entityId : entityId.substring(dot + 1);
}

// ─── State conversion ────────────────────────────────────────────────────────

/**
 * Convert a Home Assistant state object to our universal SmartHomeEntity.
 */
export function haStateToEntity(haState: HAState): SmartHomeEntity {
  return {
    entityId: haState.entity_id,
    domain: extractDomain(haState.entity_id),
    friendlyName:
      (haState.attributes.friendly_name as string) ??
      extractObjectId(haState.entity_id).replace(/_/g, ' '),
    state: haState.state,
    attributes: haState.attributes,
    lastChanged: haState.last_changed,
    lastUpdated: haState.last_updated,
    areaId: haState.attributes.area_id as string | undefined,
    deviceId: haState.attributes.device_id as string | undefined,
  };
}

/**
 * Convert an HA state_changed event into our StateChangedEvent.
 */
export function parseStateChangedEvent(
  eventData: Record<string, unknown>,
): StateChangedEvent {
  const entityId = eventData.entity_id as string;
  const newState = eventData.new_state
    ? haStateToEntity(eventData.new_state as HAState)
    : null;
  const oldState = eventData.old_state
    ? haStateToEntity(eventData.old_state as HAState)
    : null;
  return { entityId, newState, oldState };
}

// ─── State checks ────────────────────────────────────────────────────────────

/** True if entity state is "on", "home", "open", "unlocked", "playing", etc. */
export function isStateActive(entity: SmartHomeEntity): boolean {
  const active = new Set(['on', 'home', 'open', 'unlocked', 'playing', 'above_horizon']);
  return active.has(entity.state);
}

/** True if entity state is "unavailable" or "unknown". */
export function isStateUnavailable(entity: SmartHomeEntity): boolean {
  return entity.state === 'unavailable' || entity.state === 'unknown';
}

/** Parse numeric state safely. Returns undefined if not a valid number. */
export function numericState(entity: SmartHomeEntity): number | undefined {
  const n = parseFloat(entity.state);
  return Number.isFinite(n) ? n : undefined;
}

// ─── Attribute helpers ───────────────────────────────────────────────────────

/** Get a typed attribute value. */
export function getAttribute<T>(
  entity: SmartHomeEntity,
  key: string,
): T | undefined {
  return entity.attributes[key] as T | undefined;
}

/** Get friendly name, falling back to formatted object ID. */
export function getFriendlyName(entity: SmartHomeEntity): string {
  return entity.friendlyName;
}

/** Get device class (sensor, binary_sensor, cover, etc.). */
export function getDeviceClass(entity: SmartHomeEntity): string | undefined {
  return entity.attributes.device_class as string | undefined;
}

/** Get unit of measurement for sensor entities. */
export function getUnitOfMeasurement(entity: SmartHomeEntity): string | undefined {
  return entity.attributes.unit_of_measurement as string | undefined;
}

/** Get icon from attributes. */
export function getIcon(entity: SmartHomeEntity): string | undefined {
  return entity.attributes.icon as string | undefined;
}

// ─── Filtering helpers ───────────────────────────────────────────────────────

/** Filter entities by domain. */
export function filterByDomain(
  entities: SmartHomeEntity[],
  domain: EntityDomain,
): SmartHomeEntity[] {
  return entities.filter((e) => e.domain === domain);
}

/** Filter entities by area ID. */
export function filterByArea(
  entities: SmartHomeEntity[],
  areaId: string,
): SmartHomeEntity[] {
  return entities.filter((e) => e.areaId === areaId);
}

/** Group entities by domain. */
export function groupByDomain(
  entities: SmartHomeEntity[],
): Record<EntityDomain, SmartHomeEntity[]> {
  const groups = {} as Record<EntityDomain, SmartHomeEntity[]>;
  for (const entity of entities) {
    if (!groups[entity.domain]) groups[entity.domain] = [];
    groups[entity.domain].push(entity);
  }
  return groups;
}

/** Group entities by area. */
export function groupByArea(
  entities: SmartHomeEntity[],
): Record<string, SmartHomeEntity[]> {
  const groups: Record<string, SmartHomeEntity[]> = {};
  for (const entity of entities) {
    const area = entity.areaId ?? '__unassigned__';
    if (!groups[area]) groups[area] = [];
    groups[area].push(entity);
  }
  return groups;
}

// ─── Additional helpers ─────────────────────────────────────────────────────

/**
 * Format an entity state with its unit of measurement.
 * E.g., "22.5 °C", "65 %", or "on" (if no unit).
 */
export function formatEntityState(entity: SmartHomeEntity): string {
  const unit = entity.attributes.unit_of_measurement as string | undefined;
  return unit ? `${entity.state} ${unit}` : entity.state;
}

/**
 * Check if an entity is available (not "unavailable" or "unknown").
 */
export function isEntityAvailable(entity: SmartHomeEntity): boolean {
  return entity.state !== 'unavailable' && entity.state !== 'unknown';
}

/** Parse the lastChanged ISO timestamp to a Date object. */
export function getLastChanged(entity: SmartHomeEntity): Date {
  return new Date(entity.lastChanged);
}

/** Parse the lastUpdated ISO timestamp to a Date object. */
export function getLastUpdated(entity: SmartHomeEntity): Date {
  return new Date(entity.lastUpdated);
}
