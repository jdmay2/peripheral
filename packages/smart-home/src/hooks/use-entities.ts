import { useState, useEffect, useMemo } from 'react';
import type { HomeAssistantClient } from '../clients/home-assistant';
import type { SmartHomeEntity, EntityDomain } from '../types';
import { createDevice, type SmartDevice } from '../devices';

interface UseEntitiesOptions {
  /** Filter by domain (e.g., "light", "switch"). */
  domain?: EntityDomain;
  /** Filter by area ID. */
  areaId?: string;
  /** Explicit list of entity IDs to track. */
  entityIds?: string[];
  /** Custom filter function. */
  filter?: (entity: SmartHomeEntity) => boolean;
}

interface UseEntitiesReturn {
  /** All matching entities as raw data. */
  entities: SmartHomeEntity[];
  /** All matching entities as typed device wrappers. */
  devices: SmartDevice[];
  /** Map of entity ID → entity. */
  entityMap: Map<string, SmartHomeEntity>;
  /** Number of matching entities. */
  count: number;
  /** Whether any entity is currently "on" / active. */
  anyActive: boolean;
  /** Number of active entities. */
  activeCount: number;
}

const ACTIVE_STATES = new Set([
  'on', 'home', 'open', 'unlocked', 'playing', 'cleaning',
  'heat', 'cool', 'heat_cool', 'auto', 'dry', 'fan_only',
]);

/**
 * Hook to track multiple entities with optional filtering.
 * Efficiently re-renders only when matching entities change.
 *
 * @example
 * ```tsx
 * // All lights
 * const { devices, anyActive, activeCount } = useEntities(client, {
 *   domain: 'light',
 * });
 *
 * // Specific entities
 * const { entities } = useEntities(client, {
 *   entityIds: ['sensor.temperature', 'sensor.humidity'],
 * });
 *
 * // Custom filter — all entities in the living room
 * const { devices } = useEntities(client, {
 *   areaId: 'living_room',
 * });
 * ```
 */
export function useEntities(
  client: HomeAssistantClient,
  options?: UseEntitiesOptions,
): UseEntitiesReturn {
  const domain = options?.domain;
  const areaId = options?.areaId;
  const entityIds = options?.entityIds;
  const filter = options?.filter;

  const [allEntities, setAllEntities] = useState<Map<string, SmartHomeEntity>>(
    () => client.getEntities(),
  );

  useEffect(() => {
    const unsub = client.on('entitiesUpdated', (entities) => {
      setAllEntities(entities);
    });

    // Initialize with current state
    setAllEntities(client.getEntities());

    return unsub;
  }, [client]);

  const filtered = useMemo(() => {
    const entities: SmartHomeEntity[] = [];

    for (const entity of allEntities.values()) {
      // Apply filters
      if (domain && entity.domain !== domain) continue;
      if (areaId && entity.areaId !== areaId) continue;
      if (entityIds && !entityIds.includes(entity.entityId)) continue;
      if (filter && !filter(entity)) continue;

      entities.push(entity);
    }

    // Sort by friendly name for stable ordering
    entities.sort((a, b) => a.friendlyName.localeCompare(b.friendlyName));

    return entities;
  }, [allEntities, domain, areaId, entityIds, filter]);

  const devices = useMemo(
    () => filtered.map((e) => createDevice(e)),
    [filtered],
  );

  const entityMap = useMemo(
    () => new Map(filtered.map((e) => [e.entityId, e])),
    [filtered],
  );

  const activeCount = useMemo(
    () => filtered.filter((e) => ACTIVE_STATES.has(e.state)).length,
    [filtered],
  );

  return {
    entities: filtered,
    devices,
    entityMap,
    count: filtered.length,
    anyActive: activeCount > 0,
    activeCount,
  };
}
