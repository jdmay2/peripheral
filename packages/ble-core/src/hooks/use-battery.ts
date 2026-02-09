import { useState, useCallback, useEffect, useRef } from 'react';
import { peripheralManager } from '../core/manager';
import { ConnectionState } from '../types/ble';
import { StandardServices, StandardCharacteristics } from '../types/gatt';
import type { BatteryLevel } from '../types/parsers';

export interface UseBatteryResult {
  /** Battery level percentage 0–100, null if not yet read */
  level: number | null;
  /** Last read error */
  error: Error | null;
  /** Manually refresh battery level */
  refresh: () => Promise<void>;
}

/**
 * Read and subscribe to Battery Level (0x2A19) for a connected device.
 *
 * - Reads the initial value on mount (when device is Ready).
 * - Subscribes to notifications for live updates.
 * - Auto-refreshes when the device reconnects.
 *
 * @example
 * ```tsx
 * const { level, error, refresh } = useBattery(deviceId);
 *
 * return <Text>Battery: {level ?? '—'}%</Text>;
 * ```
 */
export function useBattery(deviceId: string): UseBatteryResult {
  const [level, setLevel] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const deviceIdRef = useRef(deviceId);
  deviceIdRef.current = deviceId;

  const readBattery = useCallback(async () => {
    try {
      setError(null);
      const result = await peripheralManager.readParsed<BatteryLevel>(
        deviceIdRef.current,
        StandardServices.Battery,
        StandardCharacteristics.BatteryLevel
      );
      if (result && typeof result === 'object' && 'level' in result) {
        setLevel(result.level);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to read battery'));
    }
  }, []);

  useEffect(() => {
    const id = deviceId;

    // Read initial value if already connected
    const state = peripheralManager.getDeviceState(id);
    if (state === ConnectionState.Ready) {
      void readBattery();
    }

    // Subscribe to notifications for live updates
    let notifStarted = false;

    async function startNotify() {
      try {
        await peripheralManager.startNotifications(
          id,
          StandardServices.Battery,
          StandardCharacteristics.BatteryLevel
        );
        notifStarted = true;
      } catch {
        // Battery notification may not be supported — not an error
      }
    }

    if (state === ConnectionState.Ready) {
      void startNotify();
    }

    // Listen for parsed notifications
    const unsubNotif = peripheralManager.on('onParsedNotification', (data) => {
      if (
        data.deviceId !== id ||
        data.characteristicUUID.toUpperCase() !==
          StandardCharacteristics.BatteryLevel.toUpperCase()
      )
        return;

      const parsed = data.parsed as BatteryLevel | undefined;
      if (parsed && typeof parsed.level === 'number') {
        setLevel(parsed.level);
      }
    });

    // Re-read + resubscribe on reconnect
    const unsubState = peripheralManager.on(
      'onConnectionStateChange',
      (devId, newState) => {
        if (devId !== id) return;
        if (newState === ConnectionState.Ready) {
          void readBattery();
          void startNotify();
        }
      }
    );

    return () => {
      unsubNotif();
      unsubState();
      if (notifStarted) {
        void peripheralManager
          .stopNotifications(
            id,
            StandardServices.Battery,
            StandardCharacteristics.BatteryLevel
          )
          .catch(() => {});
      }
    };
  }, [deviceId, readBattery]);

  return { level, error, refresh: readBattery };
}
