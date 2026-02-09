/**
 * @peripheral/integration
 *
 * Glue layer connecting BLE sensors -> gesture recognition -> smart home actions.
 * Eliminates boilerplate wiring between @peripheral packages.
 *
 * All three @peripheral packages are optional peer dependencies:
 * - @peripheral/ble-core: required for createIMUPipeline
 * - @peripheral/gesture-engine: required for createIMUPipeline + createGestureActionBridge
 * - @peripheral/smart-home: required for createGestureActionBridge
 */

// ─── Pipeline ───────────────────────────────────────────────────────────────
export { createIMUPipeline } from './pipeline/imu-pipeline';
export { createGestureActionBridge } from './pipeline/gesture-action-bridge';

// ─── Parsers ────────────────────────────────────────────────────────────────
export {
  createIMU6AxisParser,
  createIMU3AxisParser,
  createIMU9AxisParser,
  parseIMU6Axis,
  parseIMU3Axis,
  parseIMU9Axis,
} from './parsers';

// ─── Hooks ──────────────────────────────────────────────────────────────────
export { useIMUGestureControl } from './hooks';

// ─── Types ──────────────────────────────────────────────────────────────────
export type {
  IMUParserFn,
  IMUPipelineConfig,
  IMUPipelineStatus,
  IMUPipelineHandle,
  GestureActionEntry,
  GestureActionMap,
  GestureActionBridgeConfig,
  GestureActionBridgeStatus,
  GestureActionBridgeHandle,
  ActionHistoryEntry,
  IMUGestureControlConfig,
  IMUGestureControlResult,
} from './types';
