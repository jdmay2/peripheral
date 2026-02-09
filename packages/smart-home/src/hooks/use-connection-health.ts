import { useState, useEffect, useRef } from 'react';
import type { HomeAssistantClient } from '../clients/home-assistant';
import type { HAConnectionState } from '../types';

export interface UseConnectionHealthResult {
  /** Whether the client is currently connected */
  isConnected: boolean;
  /** Current connection state */
  connectionState: HAConnectionState;
  /** Timestamp of last successful ping (null if never pinged) */
  lastPing: number | null;
  /** Number of reconnect attempts since last stable connection */
  reconnectAttempts: number;
  /** Measured round-trip latency in milliseconds (null if not yet measured) */
  latencyMs: number | null;
}

/**
 * Monitor connection health of a Home Assistant client.
 *
 * Performs periodic pings (default: 30s) to measure latency
 * and detect stale connections. Tracks reconnect attempts.
 *
 * @example
 * ```tsx
 * const { isConnected, latencyMs, reconnectAttempts } = useConnectionHealth(client);
 *
 * return (
 *   <Text>
 *     {isConnected ? `Connected (${latencyMs}ms)` : `Reconnecting (attempt ${reconnectAttempts})`}
 *   </Text>
 * );
 * ```
 */
export function useConnectionHealth(
  client: HomeAssistantClient,
  options?: { pingIntervalMs?: number },
): UseConnectionHealthResult {
  const pingInterval = options?.pingIntervalMs ?? 30000;

  const [isConnected, setIsConnected] = useState(client.isConnected);
  const [connectionState, setConnectionState] = useState<HAConnectionState>(
    client.connectionState,
  );
  const [lastPing, setLastPing] = useState<number | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const attemptsRef = useRef(0);

  useEffect(() => {
    const unsubState = client.on('connectionStateChanged', (state) => {
      setConnectionState(state);
      const connected = state === ('connected' as HAConnectionState);
      setIsConnected(connected);

      if (connected) {
        attemptsRef.current = 0;
        setReconnectAttempts(0);
      } else if (state === ('reconnecting' as HAConnectionState)) {
        attemptsRef.current += 1;
        setReconnectAttempts(attemptsRef.current);
      }
    });

    return () => {
      unsubState();
    };
  }, [client]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    async function ping() {
      if (!client.isConnected) return;

      const start = Date.now();
      try {
        // Use getConfig as a lightweight ping (any command that returns quickly)
        await client.getConfig();
        const elapsed = Date.now() - start;
        setLatencyMs(elapsed);
        setLastPing(Date.now());
      } catch {
        // Ping failed — connection may be stale
        setLatencyMs(null);
      }
    }

    // Initial ping
    void ping();

    timer = setInterval(() => {
      void ping();
    }, pingInterval);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [client, pingInterval]);

  return {
    isConnected,
    connectionState,
    lastPing,
    reconnectAttempts,
    latencyMs,
  };
}
