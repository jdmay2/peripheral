import { useState, useEffect, useRef } from 'react';
import { peripheralManager } from '../core/manager';
import { ConnectionState } from '../types/ble';

/** RSSI signal quality bands */
export type SignalQuality = 'excellent' | 'good' | 'fair' | 'poor';

export interface UseRSSIOptions {
  /** Polling interval in milliseconds (default: 5000) */
  pollInterval?: number;
  /** Whether polling is enabled (default: true) */
  enabled?: boolean;
}

export interface UseRSSIResult {
  /** Current RSSI in dBm, null if not yet read */
  rssi: number | null;
  /** Qualitative signal quality based on RSSI thresholds */
  signalQuality: SignalQuality | null;
  /** Last read error */
  error: Error | null;
}

/**
 * Map an RSSI value to a human-readable signal quality band.
 *
 * - **Excellent**: > -50 dBm (very close range)
 * - **Good**: > -70 dBm (typical room distance)
 * - **Fair**: > -85 dBm (edge of reliable range)
 * - **Poor**: ≤ -85 dBm (likely to experience dropouts)
 */
function mapSignalQuality(rssi: number): SignalQuality {
  if (rssi > -50) return 'excellent';
  if (rssi > -70) return 'good';
  if (rssi > -85) return 'fair';
  return 'poor';
}

/**
 * Poll RSSI for a connected BLE device at a configurable interval.
 *
 * @example
 * ```tsx
 * const { rssi, signalQuality } = useRSSI(deviceId, { pollInterval: 3000 });
 *
 * return <Text>Signal: {signalQuality} ({rssi} dBm)</Text>;
 * ```
 */
export function useRSSI(
  deviceId: string,
  options?: UseRSSIOptions
): UseRSSIResult {
  const pollInterval = options?.pollInterval ?? 5000;
  const enabled = options?.enabled ?? true;

  const [rssi, setRssi] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const deviceIdRef = useRef(deviceId);
  deviceIdRef.current = deviceId;

  useEffect(() => {
    if (!enabled) return;

    const id = deviceId;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function poll() {
      const state = peripheralManager.getDeviceState(id);
      if (state !== ConnectionState.Ready) return;

      try {
        const value = await peripheralManager.readRSSI(id);
        setRssi(value);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to read RSSI'));
      }
    }

    // Initial read
    void poll();

    // Start polling
    timer = setInterval(() => {
      void poll();
    }, pollInterval);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [deviceId, pollInterval, enabled]);

  const signalQuality = rssi != null ? mapSignalQuality(rssi) : null;

  return { rssi, signalQuality, error };
}
