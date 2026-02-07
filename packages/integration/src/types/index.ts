/**
 * Types for the @peripheral/integration package.
 */

import type { IMUSample, RecognitionResult, GestureEngineConfig, EngineState } from '@peripheral/gesture-engine';
import type { ServiceCall, HAConnectionConfig } from '@peripheral/smart-home';

// ─── IMU Pipeline ────────────────────────────────────────────────────────────

/** Custom parser function: raw BLE bytes -> IMUSample array */
export type IMUParserFn = (value: number[], timestamp: number) => IMUSample[];

/** Configuration for createIMUPipeline() */
export interface IMUPipelineConfig {
  /** BLE peripheral device ID */
  deviceId: string;
  /** Service UUID containing the IMU characteristic */
  serviceUUID: string;
  /** Characteristic UUID for IMU data notifications */
  characteristicUUID: string;
  /** Custom parser function. Defaults to parseIMU6Axis if omitted. */
  parser?: IMUParserFn;
  /** Whether to auto-resume subscription on reconnect. Default: true. */
  autoResumeOnReconnect?: boolean;
}

/** Status of the IMU pipeline */
export interface IMUPipelineStatus {
  /** Whether actively subscribed to BLE notifications */
  isSubscribed: boolean;
  /** Whether the BLE device is connected */
  isDeviceConnected: boolean;
  /** Total samples fed to the gesture engine */
  totalSamplesForwarded: number;
  /** Last error encountered */
  lastError: Error | null;
}

/** Handle returned by createIMUPipeline */
export interface IMUPipelineHandle {
  /** Stop the pipeline and unsubscribe from BLE */
  destroy: () => void;
  /** Pause forwarding samples (notifications still received) */
  pause: () => void;
  /** Resume forwarding samples */
  resume: () => void;
  /** Get current pipeline status */
  getStatus: () => IMUPipelineStatus;
}

// ─── Gesture-Action Bridge ───────────────────────────────────────────────────

/** Map of gesture IDs to smart-home service calls */
export type GestureActionMap = Record<string, ServiceCall | ServiceCall[]>;

/** Configuration for createGestureActionBridge() */
export interface GestureActionBridgeConfig {
  /** Action map: gestureId -> ServiceCall(s) to execute */
  actionMap: GestureActionMap;
  /** Minimum cooldown between actions for the same gesture (ms). Default: 2000. */
  cooldownMs?: number;
  /** Global cooldown between any action (ms). Default: 500. */
  globalCooldownMs?: number;
  /** Whether to execute actions only for accepted gestures. Default: true. */
  acceptedOnly?: boolean;
  /** Callback before executing an action (return false to cancel). */
  onBeforeAction?: (gestureId: string, result: RecognitionResult) => boolean;
  /** Callback after successful action execution. */
  onActionExecuted?: (gestureId: string, serviceCall: ServiceCall) => void;
  /** Callback on action execution error. */
  onActionError?: (gestureId: string, error: Error) => void;
}

/** Status of the gesture-action bridge */
export interface GestureActionBridgeStatus {
  /** Number of actions executed */
  actionsExecuted: number;
  /** Number of actions skipped (cooldown, no mapping, etc.) */
  actionsSkipped: number;
  /** Timestamp of last action */
  lastActionTimestamp: number | null;
  /** Last executed gesture ID */
  lastGestureId: string | null;
}

/** Handle returned by createGestureActionBridge */
export interface GestureActionBridgeHandle {
  /** Stop listening for gestures */
  destroy: () => void;
  /** Update the action map at runtime */
  updateActionMap: (map: GestureActionMap) => void;
  /** Get bridge status */
  getStatus: () => GestureActionBridgeStatus;
}

// ─── Combined hook ───────────────────────────────────────────────────────────

/** Configuration for useIMUGestureControl */
export interface IMUGestureControlConfig {
  /** BLE device ID to subscribe to */
  deviceId: string;
  /** Service UUID for IMU data */
  serviceUUID: string;
  /** Characteristic UUID for IMU notifications */
  characteristicUUID: string;
  /** Custom IMU parser */
  parser?: IMUParserFn;
  /** Gesture engine configuration */
  engineConfig?: GestureEngineConfig;
  /** Gesture-to-action mapping */
  actionMap?: GestureActionMap;
  /** Home Assistant connection config */
  haConfig?: HAConnectionConfig;
  /** Cooldown between actions (ms). Default: 2000 */
  cooldownMs?: number;
}

/** Return value from useIMUGestureControl */
export interface IMUGestureControlResult {
  /** Current pipeline status */
  pipelineStatus: IMUPipelineStatus;
  /** Current bridge status */
  bridgeStatus: GestureActionBridgeStatus;
  /** Current gesture engine state */
  engineState: EngineState;
  /** Whether the BLE device is connected */
  isDeviceConnected: boolean;
  /** Whether HA is connected */
  isHAConnected: boolean;
  /** Last recognized gesture */
  lastGesture: RecognitionResult | null;
  /** Last executed action */
  lastAction: { gestureId: string; serviceCall: ServiceCall } | null;
  /** Start the pipeline */
  start: () => void;
  /** Stop the pipeline */
  stop: () => void;
  /** Pause gesture recognition */
  pause: () => void;
  /** Resume gesture recognition */
  resume: () => void;
  /** Update the action map */
  updateActionMap: (map: GestureActionMap) => void;
  /** The gesture engine instance for direct access */
  engine: import('@peripheral/gesture-engine').GestureEngine;
  /** The HA client instance for direct access */
  haClient: import('@peripheral/smart-home').HomeAssistantClient | null;
  /** Error from any subsystem */
  error: Error | null;
}
