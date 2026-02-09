# @peripherals/integration

Glue layer connecting BLE sensors to gesture recognition to smart home actions. One hook to go from raw IMU data to toggling your lights.

## Why this exists

Wiring `@peripherals/ble-core` → `@peripherals/gesture-engine` → `@peripherals/smart-home` by hand means managing three lifecycles, parsing raw BLE bytes into IMU samples, feeding them to the gesture engine, mapping recognized gestures to Home Assistant service calls, and handling reconnection. This package does all of it.

**What you get:**

- **`useIMUGestureControl`** — single React hook for the full BLE → gesture → smart home pipeline
- **IMU parsers** — factories for 3-axis, 6-axis, and 9-axis packed int16 LE sensor data
- **Gesture-action bridge** — map gestures to Home Assistant service calls with cooldowns and conditional logic
- **Action history** — track recent actions with execution latency metrics
- **Zero required dependencies** — all three `@peripherals/*` packages are optional peers; install only what you need

## Install

```bash
# Full pipeline (BLE → gestures → smart home)
npm install @peripherals/integration @peripherals/ble-core @peripherals/smart-home @peripherals/gesture-engine

# Just BLE → gestures (no smart home)
npm install @peripherals/integration @peripherals/ble-core @peripherals/gesture-engine

# Just gestures → smart home (no BLE)
npm install @peripherals/integration @peripherals/gesture-engine @peripherals/smart-home
```

## Quick start

```tsx
import { useIMUGestureControl } from '@peripherals/integration';
import { EngineState } from '@peripherals/gesture-engine';

function GestureControlledHome() {
  const {
    pipelineStatus,
    bridgeStatus,
    engineState,
    lastGesture,
    lastAction,
    start,
    stop,
    error,
  } = useIMUGestureControl({
    deviceId: 'AA:BB:CC:DD:EE:FF',
    serviceUUID: 'FFE0',
    characteristicUUID: 'FFE1',
    actionMap: {
      shake: { domain: 'light', service: 'toggle', data: { entity_id: 'light.living_room' } },
      flick: { domain: 'switch', service: 'toggle', data: { entity_id: 'switch.fan' } },
    },
    haConfig: {
      url: 'ws://homeassistant.local:8123',
      auth: { type: 'longLivedToken', token: 'YOUR_HA_TOKEN' },
    },
  });

  return (
    <View>
      <Button
        title={engineState === EngineState.Listening ? 'Stop' : 'Start'}
        onPress={engineState === EngineState.Listening ? stop : start}
      />
      {lastGesture && <Text>Last gesture: {lastGesture}</Text>}
      {lastAction && (
        <Text>
          Last action: {lastAction.serviceCall.domain}.{lastAction.serviceCall.service}
        </Text>
      )}
      <Text>Executed actions: {bridgeStatus.actionsExecuted}</Text>
    </View>
  );
}
```

## IMU parsers

Factory functions for common packed int16 little-endian IMU sensor formats:

```ts
import { createIMU6AxisParser, createIMU3AxisParser, createIMU9AxisParser } from '@peripherals/integration';

// MPU-6050 default: 12 bytes → ax, ay, az, gx, gy, gz
const parse6Axis = createIMU6AxisParser();

// Accelerometer only: 6 bytes → ax, ay, az
const parse3Axis = createIMU3AxisParser();

// MPU-9250 default: 18 bytes → ax, ay, az, gx, gy, gz, mx, my, mz
const parse9Axis = createIMU9AxisParser();
```

Custom scale factors:

```ts
// ±4g accel, ±500°/s gyro
const parser = createIMU6AxisParser(4.0, 500.0);
```

## Imperative API

For non-React usage or more control:

```ts
import { createIMUPipeline, createGestureActionBridge } from '@peripherals/integration';
import { peripheralManager } from '@peripherals/ble-core';
import { GestureEngine } from '@peripherals/gesture-engine';
import { HomeAssistantClient } from '@peripherals/smart-home';

const engine = new GestureEngine();
const haClient = new HomeAssistantClient({ url, auth });

// BLE → GestureEngine
const pipeline = createIMUPipeline(peripheralManager, engine, {
  deviceId: 'AA:BB:CC:DD:EE:FF',
  serviceUUID: 'FFE0',
  characteristicUUID: 'FFE1',
});

// GestureEngine → Home Assistant
const bridge = createGestureActionBridge(engine, haClient, {
  actionMap: {
    shake: { domain: 'light', service: 'toggle', data: { entity_id: 'light.living_room' } },
  },
  globalCooldownMs: 1000,
});

// Pipeline auto-subscribes when the BLE device reaches Ready state.
// The bridge starts listening immediately after creation.
pipeline.resume();

// Cleanup
bridge.destroy();
pipeline.destroy();
```

## Conditional actions

Map gestures to different actions based on runtime conditions:

```ts
const actionMap = {
  shake: {
    action: { domain: 'light', service: 'toggle', data: { entity_id: 'light.living_room' } },
    condition: () => isHome, // only trigger when home
  },
};
```

## Action history

The bridge tracks the last 20 actions with timestamps and execution latency:

```ts
const { bridgeStatus } = useIMUGestureControl(config);

// bridgeStatus.recentActions: Array<{ gestureId, serviceCall, timestamp, success }>
// bridgeStatus.lastActionExecutionMs: number | null
```

## Requirements

- React Native ≥ 0.73
- At least one of: `@peripherals/ble-core`, `@peripherals/gesture-engine`, `@peripherals/smart-home`
- See each sibling package for their specific requirements

## License

MIT
