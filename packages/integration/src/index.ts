/**
 * @peripherals/integration
 *
 * Glue layer connecting BLE sensors -> gesture recognition -> smart home actions.
 * Eliminates boilerplate wiring between @peripherals packages.
 *
 * All three @peripherals packages are optional peer dependencies:
 * - @peripherals/ble-core: required for createIMUPipeline
 * - @peripherals/gesture-engine: required for createIMUPipeline + createGestureActionBridge
 * - @peripherals/smart-home: required for createGestureActionBridge
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
