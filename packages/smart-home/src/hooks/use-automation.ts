import { useMemo, useCallback } from 'react';
import type { HomeAssistantClient } from '../clients/home-assistant';
import { useEntity } from './use-entity';
import type { SmartHomeAutomation } from '../types';

interface UseAutomationReturn {
  /** Automation metadata. */
  automation: SmartHomeAutomation | null;
  /** Whether the automation is enabled. */
  isEnabled: boolean;
  /** Last time the automation was triggered. */
  lastTriggered: string | null;
  /** Trigger the automation manually. */
  trigger: () => Promise<void>;
  /** Enable the automation. */
  enable: () => Promise<void>;
  /** Disable the automation. */
  disable: () => Promise<void>;
  /** Toggle enabled/disabled. */
  toggleEnabled: () => Promise<void>;
}

/**
 * Hook to track and control a Home Assistant automation.
 *
 * @example
 * ```tsx
 * function AutomationCard({ entityId }: { entityId: string }) {
 *   const { automation, isEnabled, lastTriggered, trigger, toggleEnabled } =
 *     useAutomation(client, entityId);
 *
 *   return (
 *     <View>
 *       <Text>{automation?.name}</Text>
 *       <Switch value={isEnabled} onValueChange={toggleEnabled} />
 *       <Button title="Trigger Now" onPress={trigger} />
 *       <Text>Last: {lastTriggered ?? 'Never'}</Text>
 *     </View>
 *   );
 * }
 * ```
 */
export function useAutomation(
  client: HomeAssistantClient,
  entityId: string,
): UseAutomationReturn {
  const { entity, callService } = useEntity(client, entityId);

  const automation = useMemo<SmartHomeAutomation | null>(() => {
    if (!entity) return null;
    return {
      entityId: entity.entityId,
      name: entity.friendlyName,
      state: entity.state as 'on' | 'off',
      lastTriggered: entity.attributes.last_triggered as string | undefined,
    };
  }, [entity]);

  const trigger = useCallback(
    () => callService('trigger'),
    [callService],
  );

  const enable = useCallback(
    () => callService('turn_on'),
    [callService],
  );

  const disable = useCallback(
    () => callService('turn_off'),
    [callService],
  );

  const toggleEnabled = useCallback(
    () => callService('toggle'),
    [callService],
  );

  return {
    automation,
    isEnabled: entity?.state === 'on',
    lastTriggered: (entity?.attributes.last_triggered as string) ?? null,
    trigger,
    enable,
    disable,
    toggleEnabled,
  };
}
