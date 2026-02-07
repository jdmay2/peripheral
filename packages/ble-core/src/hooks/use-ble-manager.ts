import { useState, useEffect, useCallback, useRef } from 'react';
import type { BleManagerOptions, AdapterState } from '../types/ble';
import { peripheralManager } from '../core/manager';

export interface UseBleManagerResult {
  /** Whether the BLE manager is initialized and ready */
  isReady: boolean;
  /** Current BLE adapter state */
  adapterState: AdapterState | null;
  /** Any initialization error */
  error: Error | null;
  /** Manually re-initialize if needed */
  reinitialize: () => Promise<void>;
}

/**
 * Initialize the BLE manager and track adapter state.
 *
 * ```tsx
 * const { isReady, error } = useBleManager();
 *
 * if (!isReady) return <Text>Initializing BLE...</Text>;
 * if (error) return <Text>BLE Error: {error.message}</Text>;
 * ```
 */
export function useBleManager(
  options?: BleManagerOptions
): UseBleManagerResult {
  const [isReady, setIsReady] = useState(false);
  const [adapterState, setAdapterState] = useState<AdapterState | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const initialize = useCallback(async () => {
    try {
      setError(null);
      await peripheralManager.initialize(optionsRef.current);
      setIsReady(true);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('BLE initialization failed')
      );
    }
  }, []);

  useEffect(() => {
    initialize();

    const unsub = peripheralManager.on('onAdapterStateChange', (state) => {
      setAdapterState(state);
    });

    return () => {
      unsub();
    };
  }, [initialize]);

  return {
    isReady,
    adapterState,
    error,
    reinitialize: initialize,
  };
}
