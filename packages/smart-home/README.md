# @peripheral/smart-home

React Native smart home integration — Home Assistant, MQTT, and HomeKit.

## Architecture

| Layer | Transport | Coverage | Use case |
|---|---|---|---|
| **Home Assistant WebSocket** | `ws://` | 2,000+ integrations | Primary hub — real-time state, service calls |
| **Home Assistant REST** | `http://` | Same | History, templates, batch queries |
| **MQTT** | `wss://` | Direct devices, Zigbee2MQTT | Low-latency device control, HA discovery |
| **HomeKit** | Native (iOS only) | Apple ecosystem | Siri, Matter commissioning, local control |

## Installation

```bash
npm install @peripheral/smart-home home-assistant-js-websocket

# Optional: MQTT support
npm install mqtt
```

## Quick start — Home Assistant

```tsx
import {
  useHomeAssistant,
  useEntity,
  useService,
  Light,
  lightTurnOn,
  lightTurnOff,
} from '@peripheral/smart-home';

function App() {
  const { client, isConnected, connectionState } = useHomeAssistant({
    url: 'http://192.168.1.100:8123',
    auth: { type: 'longLivedToken', token: 'eyJ...' },
  });

  if (!isConnected) return <Text>Status: {connectionState}</Text>;
  return <LightControl client={client} entityId="light.living_room" />;
}

function LightControl({ client, entityId }) {
  const { device, isAvailable } = useEntity<Light>(client, entityId);
  const { execute, isLoading } = useService(client);

  if (!isAvailable) return <Text>Unavailable</Text>;

  return (
    <View>
      <Text>{device.friendlyName}: {device.isOn ? 'On' : 'Off'}</Text>
      <Text>Brightness: {device.brightnessPercent}%</Text>
      <Button
        title={device.isOn ? 'Turn Off' : 'Turn On'}
        disabled={isLoading}
        onPress={() =>
          execute(device.isOn ? lightTurnOff(entityId) : lightTurnOn(entityId, { brightness: 200 }))
        }
      />
    </View>
  );
}
```

## Hooks reference

### `useHomeAssistant(config)` — Connection management

```ts
const { client, isConnected, connectionState, haVersion, error, reconnect, disconnect } =
  useHomeAssistant({
    url: 'http://192.168.1.100:8123',
    auth: { type: 'longLivedToken', token: 'eyJ...' },
  });
```

Auto-connects on mount, disconnects on unmount. Wraps `home-assistant-js-websocket` with typed entity tracking.

### `useEntity<T>(client, entityId)` — Single entity tracking

```ts
const { entity, device, state, isAvailable, callService, executeServiceCall } =
  useEntity<Light>(client, 'light.kitchen');

// device is a typed Light with .isOn, .brightness, .colorTemp, etc.
```

### `useEntities(client, options)` — Multi-entity tracking

```ts
// All lights
const { devices, anyActive, activeCount } = useEntities(client, { domain: 'light' });

// Specific entities
const { entities } = useEntities(client, {
  entityIds: ['sensor.temperature', 'sensor.humidity'],
});

// By area
const { devices } = useEntities(client, { areaId: 'living_room' });

// Custom filter
const { entities } = useEntities(client, {
  filter: (e) => e.attributes.device_class === 'temperature',
});
```

### `useAreas(client)` — Areas with entity counts

```ts
const { areas, isLoading } = useAreas(client);
// Each area has: name, areaId, entities[], entityCount, activeCount
```

### `useService(client)` — Service call execution

```ts
const { callService, execute, isLoading, error } = useService(client);

// Direct call
await callService('light', 'turn_on', {
  target: { entityId: 'light.kitchen' },
  serviceData: { brightness: 200 },
});

// Using service call builders
await execute(lightTurnOn('light.kitchen', { brightness: 200 }));
await execute(climateSetTemperature('climate.thermostat', 22));
await execute(lockUnlock('lock.front_door', '1234'));
```

### `useAutomation(client, entityId)` — Automation control

```ts
const { automation, isEnabled, lastTriggered, trigger, enable, disable, toggleEnabled } =
  useAutomation(client, 'automation.morning_routine');
```

### `useHistory(restConfig, options)` — State history

```ts
const { history, isLoading, refresh } = useHistory(
  { url: 'http://ha:8123', token: 'eyJ...' },
  { entityId: 'sensor.temperature', start: '2025-01-01T00:00:00Z' },
);
```

### `useMQTT(config)` — MQTT connection

```ts
const { client, isConnected, publish } = useMQTT({
  brokerUrl: 'wss://192.168.1.100:8884/mqtt',
  username: 'user',
  password: 'pass',
});
```

### `useMQTTSubscription<T>(client, topic)` — Topic subscription

```ts
const { data, messageCount } = useMQTTSubscription<{ temperature: number }>(
  client,
  'zigbee2mqtt/temp_sensor',
);
// data?.temperature automatically parsed from JSON
```

## Device abstractions

Each domain has a typed wrapper with domain-specific properties:

| Class | Domain | Key properties |
|---|---|---|
| `Light` | `light` | `isOn`, `brightness`, `brightnessPercent`, `colorTemp`, `rgbColor`, `supportsColor` |
| `Climate` | `climate` | `hvacMode`, `currentTemperature`, `targetTemperature`, `isHeating`, `isCooling`, `presetModes` |
| `Lock` | `lock` | `isLocked`, `isUnlocked`, `isJammed`, `requiresCode` |
| `Cover` | `cover` | `isOpen`, `isClosed`, `currentPosition`, `deviceClass` |
| `Fan` | `fan` | `isOn`, `percentage`, `isOscillating`, `direction` |
| `MediaPlayer` | `media_player` | `isPlaying`, `mediaTitle`, `volume`, `volumePercent`, `source`, `sourceList` |
| `Vacuum` | `vacuum` | `isCleaning`, `isDocked`, `batteryLevel`, `fanSpeed` |
| `AlarmPanel` | `alarm_control_panel` | `isArmedHome`, `isArmedAway`, `isDisarmed`, `isTriggered` |
| `Sensor` | `sensor` | `numericValue`, `unitOfMeasurement`, `formattedState`, `deviceClass` |
| `BinarySensor` | `binary_sensor` | `isOn`, `displayState` (context-aware: "Open"/"Closed", "Detected"/"Clear") |

```ts
import { createDevice, Light, Climate } from '@peripheral/smart-home';

const entity = client.getEntity('light.kitchen');
const light = createDevice(entity) as Light;
console.log(light.supportsColor, light.brightnessPercent);
```

## Service call builders

Pre-built, typed service call objects for every common operation:

```ts
import {
  lightTurnOn,        // brightness, color, transition
  lightTurnOff,
  climateSetTemperature,
  climateSetHvacMode,
  lockLock,
  lockUnlock,
  coverOpen,
  coverSetPosition,
  fanSetPercentage,
  mediaPlayerPlay,
  mediaPlayerSetVolume,
  vacuumStart,
  vacuumReturnToBase,
  alarmArmHome,
  alarmDisarm,
  activateScene,
  triggerAutomation,
  runScript,
  // ... and more
} from '@peripheral/smart-home';

await client.executeServiceCall(
  lightTurnOn('light.kitchen', {
    brightness: 200,
    colorTempKelvin: 3000,
    transition: 2,
  })
);
```

## MQTT with Zigbee2MQTT

```tsx
function Z2MExample() {
  const { client, isConnected } = useMQTT({ brokerUrl: 'wss://ha:8884/mqtt' });

  useEffect(() => {
    if (!isConnected) return;

    // Subscribe to all Z2M devices + bridge info
    const unsub = client.subscribeZ2M();

    client.on('z2mDeviceState', ({ friendlyName, state }) => {
      console.log(`${friendlyName}:`, state.temperature, state.humidity);
    });

    return unsub;
  }, [client, isConnected]);

  const toggleLight = () => {
    client.z2mSetState('bedroom_light', { state: 'TOGGLE' });
  };

  return <Button title="Toggle" onPress={toggleLight} />;
}
```

## MQTT HA Discovery

```ts
const unsub = client.subscribeDiscovery();

client.on('discoveryUpdate', ({ component, nodeId, objectId, config }) => {
  console.log(`Discovered ${component}: ${config?.name}`);
  // Automatically registers devices in HA via MQTT
});
```

## HomeKit (iOS only)

HomeKit requires a custom Expo native module. The package provides the JS interface and types.

### Setup

1. Create the native module: `npx create-expo-module@latest --local expo-homekit`
2. Implement `HomeKitNativeModule` in Swift (wrapping `HMHomeManager`)
3. Add entitlement via config plugin and `NSHomeKitUsageDescription`

### Usage

```ts
import { HomeKitClient } from '@peripheral/smart-home';

const homekit = new HomeKitClient();

if (homekit.isAvailable) {
  const homes = await homekit.getHomes();
  const primary = homes.find(h => h.isPrimary);
  const accessories = await homekit.getAccessories(primary.uniqueIdentifier);

  // Execute a scene
  const scenes = await homekit.getActionSets(primary.uniqueIdentifier);
  await homekit.executeActionSet(primary.uniqueIdentifier, scenes[0].uniqueIdentifier);
}
```

## Entity utilities

```ts
import {
  extractDomain,       // "light.kitchen" → "light"
  isStateActive,       // "on" | "open" | "unlocked" | "playing" → true
  isStateUnavailable,  // "unavailable" | "unknown" → true
  numericState,        // "22.5" → 22.5
  filterByDomain,      // filter entity array by domain
  filterByArea,        // filter entity array by area
  groupByDomain,       // group entities into Record<domain, entity[]>
  groupByArea,         // group entities into Record<areaId, entity[]>
} from '@peripheral/smart-home';
```

## Imperative client usage

The clients can be used without React hooks for non-React contexts:

```ts
import { HomeAssistantClient, MQTTClient } from '@peripheral/smart-home';

const ha = new HomeAssistantClient({
  url: 'http://192.168.1.100:8123',
  auth: { type: 'longLivedToken', token: 'eyJ...' },
});

await ha.connect();

// Subscribe to state changes
ha.onStateChanged((event) => {
  console.log(`${event.entityId}: ${event.newState?.state}`);
});

// Subscribe to specific entities
ha.onEntityStateChanged(['light.kitchen', 'sensor.temp'], (event) => {
  console.log(event);
});

// Registry queries
const areas = await ha.getAreas();
const devices = await ha.getDevices();
const config = await ha.getConfig();

// Raw WebSocket commands
await ha.sendCommand({ type: 'config/area_registry/list' });

// Custom event subscriptions
const unsub = await ha.subscribeEvents('state_changed', (data) => {
  console.log('State changed:', data);
});

// Fire custom events
await ha.fireEvent('my_custom_event', { key: 'value' });
```

## Requirements

- React Native ≥ 0.73
- `home-assistant-js-websocket` ≥ 9.0.0 (required peer)
- `mqtt` ≥ 5.0.0 (optional, for MQTT features)
- Home Assistant ≥ 2024.1 (WebSocket API)
- iOS only: custom Expo Module for HomeKit

## Recommended architecture

For most apps, **Home Assistant as the universal bridge** gives the broadest device coverage:

```
┌─────────────────────────────────────────────┐
│                React Native App              │
├──────────┬──────────┬──────────┬────────────┤
│ useEntity│ useMQTT  │ useAreas │ HomeKit*   │
├──────────┴──────────┴──────────┴────────────┤
│        @peripheral/smart-home               │
├─────────────────┬──────────┬────────────────┤
│ HA WebSocket    │ MQTT     │ HomeKit Native │
├─────────────────┴──────────┴────────────────┤
│            Home Assistant                    │
├──────┬──────┬──────┬──────┬─────┬───────────┤
│Zigbee│Z-Wave│Matter│ Hue  │Wi-Fi│ 2000+ ... │
└──────┴──────┴──────┴──────┴─────┴───────────┘
```

*HomeKit provides iOS-native Siri integration and direct Matter commissioning without HA.

## License

MIT
