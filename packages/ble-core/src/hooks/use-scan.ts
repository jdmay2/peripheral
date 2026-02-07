import { useState, useCallback, useEffect, useRef } from 'react';
import type { ScanFilter, ScanResult } from '../types/ble';
import { peripheralManager } from '../core/manager';

export interface UseScanResult {
  /** Discovered devices (deduplicated by ID, latest RSSI) */
  devices: ScanResult[];
  /** Whether a scan is currently active */
  isScanning: boolean;
  /** Start scanning */
  startScan: (filter?: ScanFilter) => Promise<void>;
  /** Stop scanning */
  stopScan: () => Promise<void>;
  /** Clear the device list */
  clearDevices: () => void;
}

/**
 * Scan for BLE peripherals with automatic deduplication.
 *
 * ```tsx
 * const { devices, isScanning, startScan, stopScan } = useScan();
 *
 * // Scan for heart rate monitors
 * await startScan({ services: ['180D'] });
 * ```
 */
export function useScan(): UseScanResult {
  const [devices, setDevices] = useState<ScanResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const deviceMapRef = useRef(new Map<string, ScanResult>());

  useEffect(() => {
    const unsub = peripheralManager.on('onDeviceFound', (device) => {
      deviceMapRef.current.set(device.id, device);
      setDevices(Array.from(deviceMapRef.current.values()));
    });

    return () => {
      unsub();
    };
  }, []);

  const startScan = useCallback(async (filter?: ScanFilter) => {
    setIsScanning(true);
    try {
      await peripheralManager.startScan(filter);

      // Auto-stop after duration
      if (filter?.duration && filter.duration > 0) {
        setTimeout(() => {
          setIsScanning(false);
        }, filter.duration);
      }
    } catch (error) {
      setIsScanning(false);
      throw error;
    }
  }, []);

  const stopScan = useCallback(async () => {
    await peripheralManager.stopScan();
    setIsScanning(false);
  }, []);

  const clearDevices = useCallback(() => {
    deviceMapRef.current.clear();
    setDevices([]);
  }, []);

  return { devices, isScanning, startScan, stopScan, clearDevices };
}
