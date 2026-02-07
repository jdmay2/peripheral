import { useState, useEffect, useMemo } from 'react';
import type { HomeAssistantClient } from '../clients/home-assistant';
import type { SmartHomeArea, SmartHomeEntity } from '../types';

interface AreaWithEntities extends SmartHomeArea {
  /** All entities in this area. */
  entities: SmartHomeEntity[];
  /** Number of entities. */
  entityCount: number;
  /** Number of active entities (on, open, unlocked, etc.). */
  activeCount: number;
}

interface UseAreasReturn {
  /** All areas with entity counts. */
  areas: AreaWithEntities[];
  /** Whether areas are being loaded. */
  isLoading: boolean;
  /** Error during area fetch. */
  error: Error | null;
  /** Refresh areas from the registry. */
  refresh: () => Promise<void>;
}

const ACTIVE_STATES = new Set([
  'on', 'home', 'open', 'unlocked', 'playing', 'cleaning',
  'heat', 'cool', 'heat_cool', 'auto',
]);

/**
 * Hook to fetch and track areas with live entity counts.
 *
 * @example
 * ```tsx
 * function AreaList() {
 *   const { areas, isLoading } = useAreas(client);
 *
 *   return areas.map(area => (
 *     <View key={area.areaId}>
 *       <Text>{area.name}</Text>
 *       <Text>{area.activeCount} / {area.entityCount} active</Text>
 *     </View>
 *   ));
 * }
 * ```
 */
export function useAreas(client: HomeAssistantClient): UseAreasReturn {
  const [rawAreas, setRawAreas] = useState<SmartHomeArea[]>([]);
  const [allEntities, setAllEntities] = useState<Map<string, SmartHomeEntity>>(
    () => client.getEntities(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAreas = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const areas = await client.getAreas();
      setRawAreas(areas);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAreas();

    const unsub = client.on('entitiesUpdated', (entities) => {
      setAllEntities(entities);
    });

    return unsub;
  }, [client]); // eslint-disable-line react-hooks/exhaustive-deps

  const areas = useMemo(() => {
    return rawAreas.map((area) => {
      const entities: SmartHomeEntity[] = [];
      for (const entity of allEntities.values()) {
        if (entity.areaId === area.areaId) {
          entities.push(entity);
        }
      }

      return {
        ...area,
        entities,
        entityCount: entities.length,
        activeCount: entities.filter((e) => ACTIVE_STATES.has(e.state)).length,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [rawAreas, allEntities]);

  return { areas, isLoading, error, refresh: fetchAreas };
}
