import { useState, useEffect, useRef, useCallback } from 'react';
import { HomeAssistantClient } from '../clients/home-assistant';
import type { HAConnectionConfig, HAConnectionState } from '../types';

interface UseHomeAssistantReturn {
  /** The HA client instance. Stable reference across renders. */
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
  const clientRef = useRef<HomeAssistantClient | null>(null);
  const [connectionState, setConnectionState] = useState<HAConnectionState>(
    'disconnected' as HAConnectionState,
  );
  const [error, setError] = useState<Error | null>(null);
  const [haVersion, setHaVersion] = useState<string | null>(null);

  // Stable client reference
  if (!clientRef.current) {
    clientRef.current = new HomeAssistantClient(config);
  }
  const client = clientRef.current;

  useEffect(() => {
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
