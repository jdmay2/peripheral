/**
 * Combined hook: BLE -> gesture recognition -> smart home control.
 *
 * Manages the full pipeline lifecycle in a single hook.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { peripheralManager, ConnectionState } from '@peripheral/ble-core';
import { GestureEngine } from '@peripheral/gesture-engine';
import type { RecognitionResult, EngineState } from '@peripheral/gesture-engine';
import { HomeAssistantClient } from '@peripheral/smart-home';
import type { ServiceCall } from '@peripheral/smart-home';

import { createIMUPipeline } from '../pipeline/imu-pipeline';
import { createGestureActionBridge } from '../pipeline/gesture-action-bridge';
import type {
  IMUGestureControlConfig,
  IMUGestureControlResult,
  IMUPipelineStatus,
  GestureActionBridgeStatus,
  GestureActionMap,
} from '../types';

const DEFAULT_PIPELINE_STATUS: IMUPipelineStatus = {
  isSubscribed: false,
  isDeviceConnected: false,
  totalSamplesForwarded: 0,
  lastError: null,
};

const DEFAULT_BRIDGE_STATUS: GestureActionBridgeStatus = {
  actionsExecuted: 0,
  actionsSkipped: 0,
  lastActionTimestamp: null,
  lastGestureId: null,
};

export function useIMUGestureControl(
  config: IMUGestureControlConfig,
): IMUGestureControlResult {
  // ─── Stable references ──────────────────────────────────────────────────

  const engineRef = useRef<GestureEngine | null>(null);
  const haClientRef = useRef<HomeAssistantClient | null>(null);
  const pipelineRef = useRef<ReturnType<typeof createIMUPipeline> | null>(null);
  const bridgeRef = useRef<ReturnType<typeof createGestureActionBridge> | null>(null);

  // ─── State ──────────────────────────────────────────────────────────────

  const [pipelineStatus, setPipelineStatus] = useState<IMUPipelineStatus>(DEFAULT_PIPELINE_STATUS);
  const [bridgeStatus, setBridgeStatus] = useState<GestureActionBridgeStatus>(DEFAULT_BRIDGE_STATUS);
  const [engineState, setEngineState] = useState<EngineState>('idle' as EngineState);
  const [isDeviceConnected, setIsDeviceConnected] = useState(false);
  const [isHAConnected, setIsHAConnected] = useState(false);
  const [lastGesture, setLastGesture] = useState<RecognitionResult | null>(null);
  const [lastAction, setLastAction] = useState<{
    gestureId: string;
    serviceCall: ServiceCall;
  } | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // ─── Initialize engine (once) ───────────────────────────────────────────

  if (!engineRef.current) {
    engineRef.current = new GestureEngine(config.engineConfig);
  }
  const engine = engineRef.current;

  // ─── Initialize HA client ───────────────────────────────────────────────

  useEffect(() => {
    if (!config.haConfig) return;

    const client = new HomeAssistantClient(config.haConfig);
    haClientRef.current = client;

    const unsubState = client.on('connectionStateChanged', (state) => {
      setIsHAConnected(state === ('connected' as any));
    });
    const unsubError = client.on('error', setError);

    client.connect().catch(setError);

    return () => {
      unsubState();
      unsubError();
      client.disconnect();
      haClientRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- connect once on mount

  // ─── Track engine state ─────────────────────────────────────────────────

  useEffect(() => {
    const unsubs = [
      engine.on('stateChanged', setEngineState),
      engine.on('gesture', (result) => setLastGesture(result)),
      engine.on('error', setError),
    ];
    return () => {
      unsubs.forEach((u) => u());
      engine.dispose();
      engineRef.current = null;
    };
  }, [engine]);

  // ─── Track BLE connection state ─────────────────────────────────────────

  useEffect(() => {
    const unsub = peripheralManager.on(
      'onConnectionStateChange',
      (id: string, state: ConnectionState) => {
        if (id !== config.deviceId) return;
        setIsDeviceConnected(state === ConnectionState.Ready);
      },
    );

    setIsDeviceConnected(
      peripheralManager.getDeviceState(config.deviceId) === ConnectionState.Ready,
    );

    return unsub;
  }, [config.deviceId]);

  // ─── Create IMU pipeline ────────────────────────────────────────────────

  useEffect(() => {
    const pipeline = createIMUPipeline(peripheralManager, engine, {
      deviceId: config.deviceId,
      serviceUUID: config.serviceUUID,
      characteristicUUID: config.characteristicUUID,
      parser: config.parser,
    });
    pipelineRef.current = pipeline;

    const statusInterval = setInterval(() => {
      setPipelineStatus(pipeline.getStatus());
    }, 1000);

    return () => {
      clearInterval(statusInterval);
      pipeline.destroy();
      pipelineRef.current = null;
    };
  }, [engine, config.deviceId, config.serviceUUID, config.characteristicUUID, config.parser]);

  // ─── Create gesture-action bridge ───────────────────────────────────────

  useEffect(() => {
    const haClient = haClientRef.current;
    if (!haClient || !config.actionMap) return;

    const bridge = createGestureActionBridge(engine, haClient, {
      actionMap: config.actionMap,
      cooldownMs: config.cooldownMs,
      onActionExecuted: (gestureId, serviceCall) => {
        setLastAction({ gestureId, serviceCall });
      },
      onActionError: (_gestureId, err) => {
        setError(err);
      },
    });
    bridgeRef.current = bridge;

    const statusInterval = setInterval(() => {
      setBridgeStatus(bridge.getStatus());
    }, 1000);

    return () => {
      clearInterval(statusInterval);
      bridge.destroy();
      bridgeRef.current = null;
    };
  }, [engine, config.actionMap, config.cooldownMs]);

  // ─── Controls ─────────────────────────────────────────────────────────

  const start = useCallback(() => {
    engine.start();
    pipelineRef.current?.resume();
  }, [engine]);

  const stop = useCallback(() => {
    engine.stop();
    pipelineRef.current?.pause();
  }, [engine]);

  const pause = useCallback(() => {
    engine.pause();
  }, [engine]);

  const resume = useCallback(() => {
    engine.resume();
  }, [engine]);

  const updateActionMap = useCallback((map: GestureActionMap) => {
    bridgeRef.current?.updateActionMap(map);
  }, []);

  return {
    pipelineStatus,
    bridgeStatus,
    engineState,
    isDeviceConnected,
    isHAConnected,
    lastGesture,
    lastAction,
    start,
    stop,
    pause,
    resume,
    updateActionMap,
    engine,
    haClient: haClientRef.current,
    error,
  };
}
