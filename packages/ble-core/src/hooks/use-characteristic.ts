import { useState, useCallback, useEffect, useRef } from 'react';
import { peripheralManager } from '../core/manager';
import { toDataView } from '../utils/bytes';
import { autoParse } from '../parsers/registry';
import { uuidsMatch } from '../types/gatt';

export interface UseCharacteristicOptions {
  /** Auto-subscribe to notifications when the hook mounts (default: false) */
  autoSubscribe?: boolean;
}

export interface UseCharacteristicResult<T = unknown> {
  /** Latest parsed value (or raw bytes if no parser registered) */
  value: T | null;
  /** Raw byte values from the last read/notification */
  rawValue: number[] | null;
  /** Whether notifications are active */
  isSubscribed: boolean;
  /** Read the characteristic value */
  read: () => Promise<T | number[]>;
  /** Write data to the characteristic */
  write: (data: number[]) => Promise<void>;
  /** Write without response */
  writeWithoutResponse: (data: number[]) => Promise<void>;
  /** Start notifications */
  subscribe: () => Promise<void>;
  /** Stop notifications */
  unsubscribe: () => Promise<void>;
  /** Error from last operation */
  error: Error | null;
}

/**
 * Read, write, and subscribe to a BLE characteristic with auto-parsing.
 *
 * ```tsx
 * // Auto-parsed Heart Rate data
 * const { value, subscribe } = useCharacteristic<HeartRateMeasurement>(
 *   deviceId,
 *   '180D',  // Heart Rate Service
 *   '2A37',  // Heart Rate Measurement
 *   { autoSubscribe: true }
 * );
 *
 * // value.heartRate, value.rrIntervals, etc.
 * ```
 */
export function useCharacteristic<T = unknown>(
  deviceId: string,
  serviceUUID: string,
  characteristicUUID: string,
  options?: UseCharacteristicOptions
): UseCharacteristicResult<T> {
  const [value, setValue] = useState<T | null>(null);
  const [rawValue, setRawValue] = useState<number[] | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refs = useRef({ deviceId, serviceUUID, characteristicUUID });
  refs.current = { deviceId, serviceUUID, characteristicUUID };

  // Listen for notifications on this characteristic
  useEffect(() => {
    const unsubRaw = peripheralManager.on('onRawNotification', (notif) => {
      if (
        notif.deviceId !== refs.current.deviceId ||
        !uuidsMatch(notif.serviceUUID, refs.current.serviceUUID) ||
        !uuidsMatch(notif.characteristicUUID, refs.current.characteristicUUID)
      ) {
        return;
      }

      setRawValue(notif.value);

      // Try auto-parsing
      try {
        const dv = toDataView(notif.value);
        const parsed = autoParse(refs.current.characteristicUUID, dv);
        if (parsed !== undefined) {
          setValue(parsed as T);
        }
      } catch {
        // Parser error — raw value is still set
      }
    });

    return () => {
      unsubRaw();
    };
  }, []);

  // Auto-subscribe if requested
  useEffect(() => {
    if (!options?.autoSubscribe) return;

    let cancelled = false;

    const doSubscribe = async () => {
      try {
        await peripheralManager.startNotifications(
          deviceId,
          serviceUUID,
          characteristicUUID
        );
        if (!cancelled) setIsSubscribed(true);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err : new Error('Subscribe failed')
          );
        }
      }
    };

    doSubscribe();

    return () => {
      cancelled = true;
      peripheralManager
        .stopNotifications(deviceId, serviceUUID, characteristicUUID)
        .catch(() => {});
      setIsSubscribed(false);
    };
  }, [deviceId, serviceUUID, characteristicUUID, options?.autoSubscribe]);

  const read = useCallback(async () => {
    setError(null);
    try {
      const result = await peripheralManager.readParsed<T>(
        refs.current.deviceId,
        refs.current.serviceUUID,
        refs.current.characteristicUUID
      );

      if (Array.isArray(result)) {
        setRawValue(result);
        return result;
      } else {
        setValue(result as T);
        return result;
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Read failed');
      setError(error);
      throw error;
    }
  }, []);

  const write = useCallback(async (data: number[]) => {
    setError(null);
    try {
      await peripheralManager.write(
        refs.current.deviceId,
        refs.current.serviceUUID,
        refs.current.characteristicUUID,
        data
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Write failed');
      setError(error);
      throw error;
    }
  }, []);

  const writeWithoutResponse = useCallback(async (data: number[]) => {
    setError(null);
    try {
      await peripheralManager.writeWithoutResponse(
        refs.current.deviceId,
        refs.current.serviceUUID,
        refs.current.characteristicUUID,
        data
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Write failed');
      setError(error);
      throw error;
    }
  }, []);

  const subscribe = useCallback(async () => {
    setError(null);
    try {
      await peripheralManager.startNotifications(
        refs.current.deviceId,
        refs.current.serviceUUID,
        refs.current.characteristicUUID
      );
      setIsSubscribed(true);
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('Subscribe failed');
      setError(error);
      throw error;
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    try {
      await peripheralManager.stopNotifications(
        refs.current.deviceId,
        refs.current.serviceUUID,
        refs.current.characteristicUUID
      );
      setIsSubscribed(false);
    } catch {
      // Best effort
    }
  }, []);

  return {
    value,
    rawValue,
    isSubscribed,
    read,
    write,
    writeWithoutResponse,
    subscribe,
    unsubscribe,
    error,
  };
}
