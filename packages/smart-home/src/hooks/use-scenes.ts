import { useState, useEffect, useCallback } from 'react';
import type { HomeAssistantClient } from '../clients/home-assistant';
import type { SmartHomeEntity } from '../types';

export interface UseScenesResult {
  /** All scene entities */
  scenes: SmartHomeEntity[];
  /** Activate a scene by entity ID */
  activateScene: (entityId: string) => Promise<void>;
  /** Whether the initial fetch is in progress */
  isLoading: boolean;
}

/**
 * Manage Home Assistant scenes.
 *
 * @example
 * ```tsx
 * const { scenes, activateScene, isLoading } = useScenes(client);
 *
 * return scenes.map(scene => (
 *   <Button key={scene.entityId} onPress={() => activateScene(scene.entityId)}>
 *     {scene.friendlyName}
 *   </Button>
 * ));
 * ```
 */
export function useScenes(client: HomeAssistantClient): UseScenesResult {
  const [scenes, setScenes] = useState<SmartHomeEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    function updateScenes() {
      const entities = client.getEntities();
      const sceneEntities: SmartHomeEntity[] = [];
      for (const entity of entities.values()) {
        if (entity.domain === 'scene') {
          sceneEntities.push(entity);
        }
      }
      setScenes(sceneEntities);
      setIsLoading(false);
    }

    // Initial load
    updateScenes();

    // Subscribe to entity updates
    const unsub = client.on('entitiesUpdated', () => {
      updateScenes();
    });

    return () => {
      unsub();
    };
  }, [client]);

  const activateScene = useCallback(
    async (entityId: string) => {
      await client.callService('scene', 'turn_on', {
        target: { entityId },
      });
    },
    [client],
  );

  return { scenes, activateScene, isLoading };
}
