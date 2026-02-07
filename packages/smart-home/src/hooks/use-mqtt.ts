import { useState, useEffect, useRef, useCallback } from 'react';
import { MQTTClient } from '../clients/mqtt';
import type { MQTTConnectionConfig, MQTTConnectionState, MQTTMessage } from '../types';
import type { Unsubscribe } from '../utils/event-emitter';

interface UseMQTTReturn {
  /** The MQTT client instance. Stable reference. */
  client: MQTTClient;
  /** Current connection state. */
  connectionState: MQTTConnectionState;
  /** Whether connected. */
  isConnected: boolean;
  /** Last error. */
  error: Error | null;
  /** Publish a message (auto-serializes objects to JSON). */
  publish: (
    topic: string,
    payload: string | Record<string, unknown>,
    options?: { qos?: 0 | 1 | 2; retain?: boolean },
  ) => void;
  /** Reconnect to the broker. */
  reconnect: () => Promise<void>;
  /** Disconnect. */
  disconnect: () => Promise<void>;
}

/**
 * Hook to manage an MQTT connection.
 * Automatically connects on mount and disconnects on unmount.
 *
 * @example
 * ```tsx
 * function MQTTDemo() {
 *   const { client, isConnected, publish } = useMQTT({
 *     brokerUrl: 'wss://192.168.1.100:8884/mqtt',
 *     username: 'homeassistant',
 *     password: 'secret',
 *   });
 *
 *   useEffect(() => {
 *     if (!isConnected) return;
 *     const unsub = client.subscribe('zigbee2mqtt/sensor', (msg) => {
 *       console.log('Received:', msg.payload);
 *     });
 *     return unsub;
 *   }, [client, isConnected]);
 *
 *   return (
 *     <Button
 *       title="Light On"
 *       onPress={() => publish('zigbee2mqtt/light/set', { state: 'ON' })}
 *     />
 *   );
 * }
 * ```
 */
export function useMQTT(config: MQTTConnectionConfig): UseMQTTReturn {
  const clientRef = useRef<MQTTClient | null>(null);
  const [connectionState, setConnectionState] = useState<MQTTConnectionState>(
    'disconnected' as MQTTConnectionState,
  );
  const [error, setError] = useState<Error | null>(null);

  if (!clientRef.current) {
    clientRef.current = new MQTTClient(config);
  }
  const client = clientRef.current;

  useEffect(() => {
    const unsubState = client.on('connectionStateChanged', (state) => {
      setConnectionState(state);
    });

    const unsubError = client.on('error', (err) => {
      setError(err);
    });

    client.connect().catch((err) => setError(err));

    return () => {
      unsubState();
      unsubError();
      client.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const publish = useCallback(
    (
      topic: string,
      payload: string | Record<string, unknown>,
      options?: { qos?: 0 | 1 | 2; retain?: boolean },
    ) => {
      client.publish(topic, payload, options);
    },
    [client],
  );

  const reconnect = useCallback(async () => {
    setError(null);
    await client.disconnect();
    await client.connect();
  }, [client]);

  const disconnect = useCallback(async () => {
    await client.disconnect();
  }, [client]);

  return {
    client,
    connectionState,
    isConnected: connectionState === ('connected' as MQTTConnectionState),
    error,
    publish,
    reconnect,
    disconnect,
  };
}

// ─── useMQTTSubscription ─────────────────────────────────────────────────────

interface UseMQTTSubscriptionOptions {
  /** QoS level (default: 0). */
  qos?: 0 | 1 | 2;
  /** Auto-parse JSON payloads (default: true). */
  parseJSON?: boolean;
}

interface UseMQTTSubscriptionReturn<T = unknown> {
  /** Last received message. */
  message: MQTTMessage | null;
  /** Last parsed payload (if parseJSON is true). */
  data: T | null;
  /** Number of messages received. */
  messageCount: number;
}

/**
 * Hook to subscribe to a single MQTT topic.
 * Automatically subscribes/unsubscribes with component lifecycle.
 *
 * @example
 * ```tsx
 * function TemperatureDisplay({ client }: { client: MQTTClient }) {
 *   const { data } = useMQTTSubscription<{ temperature: number }>(
 *     client,
 *     'zigbee2mqtt/temp_sensor',
 *   );
 *
 *   return <Text>Temperature: {data?.temperature ?? '--'}°C</Text>;
 * }
 * ```
 */
export function useMQTTSubscription<T = unknown>(
  client: MQTTClient,
  topic: string,
  options?: UseMQTTSubscriptionOptions,
): UseMQTTSubscriptionReturn<T> {
  const [message, setMessage] = useState<MQTTMessage | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [messageCount, setMessageCount] = useState(0);

  const parseJSON = options?.parseJSON !== false;

  useEffect(() => {
    if (!client.isConnected) return;

    const unsub = client.subscribe(
      topic,
      (msg) => {
        setMessage(msg);
        setMessageCount((c) => c + 1);

        if (parseJSON) {
          try {
            setData(JSON.parse(msg.payload) as T);
          } catch {
            setData(msg.payload as unknown as T);
          }
        }
      },
      options?.qos ?? 0,
    );

    return unsub;
  }, [client, client.isConnected, topic, options?.qos, parseJSON]);

  return { message, data, messageCount };
}
