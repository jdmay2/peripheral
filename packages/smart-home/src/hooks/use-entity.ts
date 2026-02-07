import { useState, useEffect, useMemo, useCallback } from 'react';
import type { HomeAssistantClient } from '../clients/home-assistant';
import type { SmartHomeEntity, ServiceCall } from '../types';
import { createDevice, type SmartDevice } from '../devices';

interface UseEntityReturn<T extends SmartDevice = SmartDevice> {
  /** Raw entity data. */
  entity: SmartHomeEntity | null;
  /** Typed device wrapper with domain-specific properties. */
  device: T | null;
  /** Current state string. */
  state: string | null;
  /** Whether the entity exists and is available. */
  isAvailable: boolean;
  /** Execute a service call against this entity's domain. */
  callService: (
    service: string,
    serviceData?: Record<string, unknown>,
  ) => Promise<void>;
  /** Execute a pre-built ServiceCall. */
  executeServiceCall: (call: ServiceCall) => Promise<void>;
}

/**
 * Hook that tracks a single entity's state in real-time.
 * Returns both raw entity data and a typed device wrapper.
 *
 * @example
 * ```tsx
 * function LightControl({ entityId }: { entityId: string }) {
 *   const { device, callService, isAvailable } = useEntity<Light>(client, entityId);
 *
 *   if (!isAvailable) return <Text>Unavailable</Text>;
 *
 *   return (
 *     <View>
 *       <Text>{device?.friendlyName}: {device?.isOn ? 'On' : 'Off'}</Text>
 *       <Text>Brightness: {device?.brightnessPercent}%</Text>
 *       <Button
 *         title="Toggle"
 *         onPress={() => callService('toggle')}
 *       />
 *     </View>
 *   );
 * }
 * ```
 */
export function useEntity<T extends SmartDevice = SmartDevice>(
  client: HomeAssistantClient,
  entityId: string,
): UseEntityReturn<T> {
  const [entity, setEntity] = useState<SmartHomeEntity | null>(() =>
    client.getEntity(entityId) ?? null,
  );

  useEffect(() => {
    // Initialize with current state
    const current = client.getEntity(entityId);
    if (current) setEntity(current);

    // Subscribe to changes
    const unsub = client.onEntityStateChanged(entityId, (event) => {
      setEntity(event.newState);
    });

    return unsub;
  }, [client, entityId]);

  const device = useMemo(
    () => (entity ? (createDevice(entity) as T) : null),
    [entity],
  );

  const callService = useCallback(
    async (service: string, serviceData?: Record<string, unknown>) => {
      const domain = entityId.split('.')[0]!;
      await client.callService(domain, service, {
        target: { entityId },
        serviceData,
      });
    },
    [client, entityId],
  );

  const executeServiceCall = useCallback(
    async (call: ServiceCall) => {
      await client.executeServiceCall(call);
    },
    [client],
  );

  return {
    entity,
    device,
    state: entity?.state ?? null,
    isAvailable:
      entity != null &&
      entity.state !== 'unavailable' &&
      entity.state !== 'unknown',
    callService,
    executeServiceCall,
  };
}
