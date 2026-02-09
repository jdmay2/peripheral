import { useState, useEffect, useCallback, useMemo } from 'react';
import { HomeAssistantClient } from '../clients/home-assistant';
import type { HAConnectionConfig, HAConnectionState } from '../types';

interface UseHomeAssistantReturn {
  /** The HA client instance. Stable until config changes. */
  client: HomeAssistantClient;
  /** Current connection state. */
  connectionState: HAConnectionState;
  /** Whether connected and ready. */
  isConnected: boolean;
  /** HA server version (available after connect). */
  haVersion: string | null;
  /** Last connection error, if any. */
  error: Error | null;
  /** Manually trigger reconnect. */
  reconnect: () => Promise<void>;
  /** Disconnect and clean up. */
  disconnect: () => Promise<void>;
}

/**
 * Hook to manage a Home Assistant WebSocket connection.
 *
 * Creates and manages the lifecycle of a HomeAssistantClient.
 * Automatically connects on mount and disconnects on unmount.
 *
 * @example
 * ```tsx
 * function App() {
 *   const { client, isConnected, connectionState, error } = useHomeAssistant({
 *     url: 'http://192.168.1.100:8123',
 *     auth: { type: 'longLivedToken', token: 'eyJ...' },
 *   });
 *
 *   if (!isConnected) return <Text>Connecting... ({connectionState})</Text>;
 *   return <HomeScreen client={client} />;
 * }
 * ```
 */
export function useHomeAssistant(
  config: HAConnectionConfig,
): UseHomeAssistantReturn {
  const configSignature = useMemo(() => JSON.stringify(config), [config]);
  const client = useMemo(
    () =>
      new HomeAssistantClient(
        JSON.parse(configSignature) as HAConnectionConfig,
      ),
    [configSignature],
  );
  const [connectionState, setConnectionState] = useState<HAConnectionState>(
    'disconnected' as HAConnectionState,
  );
  const [error, setError] = useState<Error | null>(null);
  const [haVersion, setHaVersion] = useState<string | null>(null);

  useEffect(() => {
    setConnectionState(client.connectionState);
    setHaVersion(client.haVersion);
    setError(null);

    const unsubState = client.on('connectionStateChanged', (state) => {
      setConnectionState(state);
    });

    const unsubError = client.on('error', (err) => {
      setError(err);
    });

    // Auto-connect
    client
      .connect()
      .then(() => setHaVersion(client.haVersion))
      .catch((err) => setError(err));

    return () => {
      unsubState();
      unsubError();
      client.disconnect();
    };
  }, [client]);

  const reconnect = useCallback(async () => {
    setError(null);
    try {
      await client.disconnect();
      await client.connect();
      setHaVersion(client.haVersion);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [client]);

  const disconnect = useCallback(async () => {
    await client.disconnect();
  }, [client]);

  return {
    client,
    connectionState,
    isConnected: connectionState === ('connected' as HAConnectionState),
    haVersion,
    error,
    reconnect,
    disconnect,
  };
}
