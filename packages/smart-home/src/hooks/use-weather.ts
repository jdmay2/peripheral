import { useState, useEffect } from 'react';
import type { HomeAssistantClient } from '../clients/home-assistant';
import type { SmartHomeEntity } from '../types';

export interface UseWeatherResult {
  /** Current temperature */
  temperature: number | undefined;
  /** Current humidity percentage */
  humidity: number | undefined;
  /** Current weather condition (e.g., "sunny", "rainy") */
  condition: string | undefined;
  /** Forecast entries */
  forecast: Array<Record<string, unknown>>;
  /** The raw weather entity */
  entity: SmartHomeEntity | null;
}

/**
 * Access weather data from a Home Assistant weather entity.
 *
 * If no entityId is provided, the first `weather.*` entity found is used.
 *
 * @example
 * ```tsx
 * const { temperature, condition, humidity } = useWeather(client);
 *
 * return (
 *   <Text>{condition}: {temperature}° — {humidity}% humidity</Text>
 * );
 * ```
 */
export function useWeather(
  client: HomeAssistantClient,
  entityId?: string,
): UseWeatherResult {
  const [entity, setEntity] = useState<SmartHomeEntity | null>(null);

  useEffect(() => {
    function update() {
      const entities = client.getEntities();

      if (entityId) {
        setEntity(entities.get(entityId) ?? null);
      } else {
        // Find first weather entity
        for (const e of entities.values()) {
          if (e.domain === 'weather') {
            setEntity(e);
            return;
          }
        }
        setEntity(null);
      }
    }

    update();

    const unsub = client.on('entitiesUpdated', () => {
      update();
    });

    return () => {
      unsub();
    };
  }, [client, entityId]);

  return {
    temperature: entity?.attributes.temperature as number | undefined,
    humidity: entity?.attributes.humidity as number | undefined,
    condition: entity?.state !== 'unavailable' ? entity?.state : undefined,
    forecast: (entity?.attributes.forecast as Array<Record<string, unknown>>) ?? [],
    entity,
  };
}
