import { useState, useCallback, useEffect, useRef } from 'react';
import type { ConnectOptions, BleDevice } from '../types/ble';
import { ConnectionState } from '../types/ble';
import { peripheralManager } from '../core/manager';

export interface UseDeviceResult {
  /** Connected device info, null if not connected */
  device: BleDevice | null;
  /** Current connection state */
  connectionState: ConnectionState;
  /** Connect to the device */
  connect: (options?: ConnectOptions) => Promise<BleDevice>;
  /** Disconnect from the device */
  disconnect: () => Promise<void>;
  /** Whether currently in a connected/ready state */
  isConnected: boolean;
  /** Whether a connection attempt is in progress */
  isConnecting: boolean;
  /** Last connection error */
  error: Error | null;
}

/**
 * Manage a single BLE device connection.
 *
 * ```tsx
 * const { device, connect, disconnect, isConnected } = useDevice(deviceId);
 *
 * // Connect with auto-reconnection
 * await connect({ autoReconnect: true });
 *
 * // Access discovered services
 * device?.services.forEach(svc => console.log(svc.uuid));
 * ```
 */
export function useDevice(deviceId: string): UseDeviceResult {
  const [device, setDevice] = useState<BleDevice | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Disconnected
  );
  const [error, setError] = useState<Error | null>(null);
  const deviceIdRef = useRef(deviceId);
  deviceIdRef.current = deviceId;

  useEffect(() => {
    // Sync initial state
    const state = peripheralManager.getDeviceState(deviceId);
    setConnectionState(state);
    if (state === ConnectionState.Ready) {
      setDevice(peripheralManager.getDevice(deviceId) ?? null);
    }

    const unsub = peripheralManager.on(
      'onConnectionStateChange',
      (id, newState) => {
        if (id !== deviceIdRef.current) return;
        setConnectionState(newState);

        if (newState === ConnectionState.Ready) {
          setDevice(peripheralManager.getDevice(id) ?? null);
        } else if (
          newState === ConnectionState.Disconnected ||
          newState === ConnectionState.ConnectionLost
        ) {
          setDevice(null);
        }
      }
    );

    return () => {
      unsub();
    };
  }, [deviceId]);

  const connect = useCallback(
    async (options?: ConnectOptions) => {
      setError(null);
      try {
        const dev = await peripheralManager.connect(
          deviceIdRef.current,
          options
        );
        setDevice(dev);
        return dev;
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Connection failed');
        setError(error);
        throw error;
      }
    },
    []
  );

  const disconnect = useCallback(async () => {
    setError(null);
    try {
      await peripheralManager.disconnect(deviceIdRef.current);
      setDevice(null);
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('Disconnect failed');
      setError(error);
      throw error;
    }
  }, []);

  return {
    device,
    connectionState,
    connect,
    disconnect,
    isConnected: connectionState === ConnectionState.Ready,
    isConnecting:
      connectionState === ConnectionState.Connecting ||
      connectionState === ConnectionState.Discovering ||
      connectionState === ConnectionState.Reconnecting,
    error,
  };
}
