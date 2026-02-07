/**
 * IMU Pipeline: BLE notifications -> gesture engine.
 *
 * Subscribes to a BLE IMU characteristic, parses raw bytes
 * into IMUSample format, and feeds them to a GestureEngine.
 * Handles lifecycle: subscribe on connect, pause on disconnect,
 * resume on reconnect.
 */

import {
  ConnectionState,
  uuidsMatch,
} from '@peripheral/ble-core';
import type { PeripheralManager, CharacteristicNotification } from '@peripheral/ble-core';
import type { GestureEngine } from '@peripheral/gesture-engine';
import type { IMUPipelineConfig, IMUPipelineHandle, IMUPipelineStatus } from '../types';
import { parseIMU6Axis } from '../parsers/imu-parser';

export function createIMUPipeline(
  manager: PeripheralManager,
  engine: GestureEngine,
  config: IMUPipelineConfig,
): IMUPipelineHandle {
  const {
    deviceId,
    serviceUUID,
    characteristicUUID,
    autoResumeOnReconnect = true,
  } = config;
  const parser = config.parser ?? parseIMU6Axis;

  let isSubscribed = false;
  let isPaused = false;
  let totalSamplesForwarded = 0;
  let lastError: Error | null = null;
  let destroyed = false;

  // ─── Notification handler ───────────────────────────────────────────────

  const handleNotification = (notif: CharacteristicNotification): void => {
    if (destroyed || isPaused) return;
    if (notif.deviceId !== deviceId) return;
    if (!uuidsMatch(notif.characteristicUUID, characteristicUUID)) return;

    try {
      const timestamp = Date.now();
      const samples = parser(notif.value, timestamp);
      if (samples.length > 0) {
        engine.feedSamples(samples);
        totalSamplesForwarded += samples.length;
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  };

  // ─── Connection state handler ───────────────────────────────────────────

  const handleConnectionStateChange = (
    id: string,
    state: ConnectionState,
    _prevState: ConnectionState,
  ): void => {
    if (destroyed || id !== deviceId) return;

    if (state === ConnectionState.Ready && autoResumeOnReconnect && !isPaused) {
      subscribeToNotifications().catch((err) => {
        lastError = err instanceof Error ? err : new Error(String(err));
      });
    } else if (
      state === ConnectionState.Disconnected ||
      state === ConnectionState.ConnectionLost
    ) {
      isSubscribed = false;
    }
  };

  // ─── BLE subscription management ───────────────────────────────────────

  async function subscribeToNotifications(): Promise<void> {
    if (destroyed || isSubscribed) return;

    try {
      await manager.startNotifications(deviceId, serviceUUID, characteristicUUID);
      isSubscribed = true;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      isSubscribed = false;
    }
  }

  async function unsubscribeFromNotifications(): Promise<void> {
    if (!isSubscribed) return;

    try {
      await manager.stopNotifications(deviceId, serviceUUID, characteristicUUID);
    } catch {
      // Best effort — device may already be disconnected
    }
    isSubscribed = false;
  }

  // ─── Wire up event listeners ────────────────────────────────────────────

  const unsubNotif = manager.on('onRawNotification', handleNotification);
  const unsubConn = manager.on('onConnectionStateChange', handleConnectionStateChange);

  // Auto-subscribe if device is already connected
  if (manager.getDeviceState(deviceId) === ConnectionState.Ready) {
    subscribeToNotifications().catch((err) => {
      lastError = err instanceof Error ? err : new Error(String(err));
    });
  }

  // ─── Public handle ─────────────────────────────────────────────────────

  return {
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      unsubNotif();
      unsubConn();
      unsubscribeFromNotifications();
    },

    pause: () => {
      isPaused = true;
    },

    resume: () => {
      isPaused = false;
      if (!isSubscribed && manager.getDeviceState(deviceId) === ConnectionState.Ready) {
        subscribeToNotifications().catch((err) => {
          lastError = err instanceof Error ? err : new Error(String(err));
        });
      }
    },

    getStatus: (): IMUPipelineStatus => ({
      isSubscribed,
      isDeviceConnected: manager.getDeviceState(deviceId) === ConnectionState.Ready,
      totalSamplesForwarded,
      lastError,
    }),
  };
}
