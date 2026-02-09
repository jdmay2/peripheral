import { useState, useCallback, useEffect, useRef } from 'react';
import { peripheralManager } from '../core/manager';
import { ConnectionState } from '../types/ble';
import { StandardServices, StandardCharacteristics } from '../types/gatt';

export interface UseDeviceInfoResult {
  /** Manufacturer name string */
  manufacturer: string | null;
  /** Model number string */
  model: string | null;
  /** Serial number string */
  serial: string | null;
  /** Firmware revision string */
  firmware: string | null;
  /** Hardware revision string */
  hardware: string | null;
  /** Software revision string */
  software: string | null;
  /** System ID (if available) */
  systemId: { manufacturer: string; organizationallyUnique: string } | null;
  /** PnP ID (if available) */
  pnpId: {
    vendorIdSource: number;
    vendorId: number;
    productId: number;
    productVersion: number;
  } | null;
  /** Whether the initial read is in progress */
  isLoading: boolean;
  /** Last read error (null if all reads succeeded or skipped missing fields) */
  error: Error | null;
  /** Manually refresh all device info fields */
  refresh: () => Promise<void>;
}

/** DIS characteristic UUID → result field mapping */
const DIS_STRING_CHARS = [
  { uuid: StandardCharacteristics.ManufacturerName, field: 'manufacturer' },
  { uuid: StandardCharacteristics.ModelNumber, field: 'model' },
  { uuid: StandardCharacteristics.SerialNumber, field: 'serial' },
  { uuid: StandardCharacteristics.FirmwareRevision, field: 'firmware' },
  { uuid: StandardCharacteristics.HardwareRevision, field: 'hardware' },
  { uuid: StandardCharacteristics.SoftwareRevision, field: 'software' },
] as const;

/**
 * Read all Device Information Service (0x180A) characteristics.
 *
 * Gracefully skips fields that are not present on the device.
 * Reads are performed once on mount (when the device is Ready) and
 * can be triggered again via `refresh()`.
 *
 * @example
 * ```tsx
 * const { manufacturer, model, firmware, isLoading } = useDeviceInfo(deviceId);
 *
 * if (isLoading) return <Text>Loading...</Text>;
 * return (
 *   <View>
 *     <Text>{manufacturer} — {model}</Text>
 *     <Text>FW: {firmware}</Text>
 *   </View>
 * );
 * ```
 */
export function useDeviceInfo(deviceId: string): UseDeviceInfoResult {
  const [manufacturer, setManufacturer] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [serial, setSerial] = useState<string | null>(null);
  const [firmware, setFirmware] = useState<string | null>(null);
  const [hardware, setHardware] = useState<string | null>(null);
  const [software, setSoftware] = useState<string | null>(null);
  const [systemId, setSystemId] = useState<UseDeviceInfoResult['systemId']>(null);
  const [pnpId, setPnpId] = useState<UseDeviceInfoResult['pnpId']>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const deviceIdRef = useRef(deviceId);
  deviceIdRef.current = deviceId;

  const setters: Record<string, (v: string | null) => void> = {
    manufacturer: setManufacturer,
    model: setModel,
    serial: setSerial,
    firmware: setFirmware,
    hardware: setHardware,
    software: setSoftware,
  };

  const readAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const id = deviceIdRef.current;
    const svc = StandardServices.DeviceInformation;

    // Read all string characteristics in parallel, ignoring missing ones
    const stringResults = await Promise.allSettled(
      DIS_STRING_CHARS.map(async ({ uuid, field }) => {
        const result = await peripheralManager.readParsed<string>(
          id,
          svc,
          uuid
        );
        return { field, value: typeof result === 'string' ? result : null };
      })
    );

    for (const settled of stringResults) {
      if (settled.status === 'fulfilled' && settled.value.value != null) {
        const setter = setters[settled.value.field];
        if (setter) setter(settled.value.value);
      }
    }

    // System ID
    try {
      const sysResult = await peripheralManager.readParsed<
        UseDeviceInfoResult['systemId']
      >(id, svc, StandardCharacteristics.SystemId);
      if (sysResult && typeof sysResult === 'object' && 'manufacturer' in sysResult) {
        setSystemId(sysResult);
      }
    } catch {
      // SystemId not supported — skip
    }

    // PnP ID
    try {
      const pnpResult = await peripheralManager.readParsed<
        UseDeviceInfoResult['pnpId']
      >(id, svc, StandardCharacteristics.PnPId);
      if (pnpResult && typeof pnpResult === 'object' && 'vendorId' in pnpResult) {
        setPnpId(pnpResult);
      }
    } catch {
      // PnP ID not supported — skip
    }

    // Check if any reads failed (not counting missing characteristics)
    const failures = stringResults.filter((r) => r.status === 'rejected');
    if (failures.length === DIS_STRING_CHARS.length) {
      setError(new Error('Device Information Service not available'));
    }

    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const state = peripheralManager.getDeviceState(deviceId);
    if (state === ConnectionState.Ready) {
      void readAll();
    }

    const unsub = peripheralManager.on(
      'onConnectionStateChange',
      (devId, newState) => {
        if (devId !== deviceId) return;
        if (newState === ConnectionState.Ready) {
          void readAll();
        }
      }
    );

    return () => {
      unsub();
    };
  }, [deviceId, readAll]);

  return {
    manufacturer,
    model,
    serial,
    firmware,
    hardware,
    software,
    systemId,
    pnpId,
    isLoading,
    error,
    refresh: readAll,
  };
}
