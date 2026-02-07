import { useState, useCallback } from 'react';
import type { HomeAssistantClient } from '../clients/home-assistant';
import type { ServiceCall, ServiceTarget } from '../types';

interface UseServiceReturn {
  /** Execute a service call. */
  callService: (
    domain: string,
    service: string,
    options?: {
      serviceData?: Record<string, unknown>;
      target?: ServiceTarget;
    },
  ) => Promise<unknown>;
  /** Execute a pre-built ServiceCall object. */
  execute: (call: ServiceCall) => Promise<unknown>;
  /** Whether a service call is in progress. */
  isLoading: boolean;
  /** Last error from a service call. */
  error: Error | null;
  /** Clear the error state. */
  clearError: () => void;
}

/**
 * Hook for executing Home Assistant service calls with loading/error state.
 *
 * @example
 * ```tsx
 * function LightControls({ entityId }: { entityId: string }) {
 *   const { execute, isLoading, error } = useService(client);
 *
 *   return (
 *     <View>
 *       <Button
 *         title="Turn On"
 *         disabled={isLoading}
 *         onPress={() => execute(lightTurnOn(entityId, { brightness: 200 }))}
 *       />
 *       <Button
 *         title="Turn Off"
 *         disabled={isLoading}
 *         onPress={() => execute(lightTurnOff(entityId))}
 *       />
 *       {error && <Text style={{ color: 'red' }}>{error.message}</Text>}
 *     </View>
 *   );
 * }
 * ```
 */
export function useService(client: HomeAssistantClient): UseServiceReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const callService = useCallback(
    async (
      domain: string,
      service: string,
      options?: {
        serviceData?: Record<string, unknown>;
        target?: ServiceTarget;
      },
    ): Promise<unknown> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await client.callService(domain, service, options);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [client],
  );

  const execute = useCallback(
    async (call: ServiceCall): Promise<unknown> => {
      return callService(call.domain, call.service, {
        serviceData: call.serviceData,
        target: call.target,
      });
    },
    [callService],
  );

  const clearError = useCallback(() => setError(null), []);

  return { callService, execute, isLoading, error, clearError };
}
