# @peripheral/ble-core

React Native BLE peripheral management with typed GATT parsers, auto-reconnection, command queue, and React hooks.

## Why this exists

Every React Native BLE app reinvents the same things: connection state machines, retry logic, GATT byte parsing, and Android GATT Error 133 workarounds. This package handles all of it so you can focus on your app.

**What you get:**

- **React hooks** — `useBleManager`, `useScan`, `useDevice`, `useCharacteristic`
- **Auto-parsed GATT data** — Heart Rate, Blood Pressure, FTMS, Cycling Power, and 30+ characteristics parsed to typed objects
- **Command queue** — Serialized BLE operations prevent Android GATT Error 133
- **Auto-reconnection** — Exponential backoff with jitter, configurable per-device
- **Connection state machine** — Explicit states with validated transitions
- **Device profiles** — Scan for "Heart Rate Monitors" instead of UUIDs

## Install

```bash
npm install @peripheral/ble-core react-native-ble-manager
# or
pnpm add @peripheral/ble-core react-native-ble-manager
```

### Expo

Add the config plugin in `app.json`:

```json
{
  "plugins": [
    [
      "react-native-ble-manager",
      {
        "isBackgroundEnabled": true,
        "neverForLocation": true
      }
    ]
  ]
}
```

Build a dev client (BLE does not work in Expo Go):

```bash
npx expo run:ios
# or
eas build --profile development --platform ios
```

## Quick start

```tsx
import {
  useBleManager,
  useScan,
  useDevice,
  useCharacteristic,
} from '@peripheral/ble-core';
import type { HeartRateMeasurement } from '@peripheral/ble-core';

function App() {
  const { isReady } = useBleManager();
  const { devices, startScan, stopScan } = useScan();

  if (!isReady) return <Text>Initializing BLE...</Text>;

  return (
    <>
      <Button title="Scan" onPress={() => startScan({ services: ['180D'] })} />
      {devices.map((d) => (
        <HeartRateDevice key={d.id} deviceId={d.id} />
      ))}
    </>
  );
}

function HeartRateDevice({ deviceId }: { deviceId: string }) {
  const { connect, disconnect, isConnected } = useDevice(deviceId);

  // Auto-subscribe to Heart Rate Measurement notifications
  const { value } = useCharacteristic<HeartRateMeasurement>(
    deviceId,
    '180D',
    '2A37',
    { autoSubscribe: true }
  );

  return (
    <View>
      <Button
        title={isConnected ? 'Disconnect' : 'Connect'}
        onPress={isConnected ? disconnect : () => connect()}
      />
      {value && <Text>HR: {value.heartRate} BPM</Text>}
      {value?.rrIntervals.length > 0 && (
        <Text>RR: {value.rrIntervals.map((r) => r.toFixed(0)).join(', ')}ms</Text>
      )}
    </View>
  );
}
```

## Auto-parsing

When you subscribe to a characteristic, the library automatically parses the raw bytes based on the Bluetooth SIG GATT specification. Supported profiles:

| Profile | Service UUID | Parsed Type |
|---------|-------------|-------------|
| Heart Rate | `0x180D` | `HeartRateMeasurement` |
| Blood Pressure | `0x1810` | `BloodPressureMeasurement` |
| Health Thermometer | `0x1809` | `TemperatureMeasurement` |
| Glucose | `0x1808` | `GlucoseMeasurement` |
| Weight Scale | `0x181D` | `WeightMeasurement` |
| Body Composition | `0x181B` | `BodyCompositionMeasurement` |
| Cycling Speed & Cadence | `0x1816` | `CSCMeasurement` |
| Cycling Power | `0x1818` | `CyclingPowerMeasurement` |
| Running Speed & Cadence | `0x1814` | `RSCMeasurement` |
| FTMS Indoor Bike | `0x1826` | `IndoorBikeData` |
| FTMS Treadmill | `0x1826` | `TreadmillData` |
| FTMS Rower | `0x1826` | `RowerData` |
| Pulse Oximeter | `0x1822` | `PLXSpotCheckMeasurement` / `PLXContinuousMeasurement` |
| Environmental Sensing | `0x181A` | Temperature, Humidity, Pressure, UV, Elevation |
| Battery | `0x180F` | `BatteryLevel` |
| Device Information | `0x180A` | String fields + `SystemId` + `PnPId` |

### Register custom parsers

```ts
import { registerParser } from '@peripheral/ble-core';

registerParser({
  characteristicUUID: 'FFE1',
  serviceUUID: 'FFE0',
  name: 'My Custom Sensor',
  parse: (data: DataView) => ({
    value: data.getUint16(0, true) * 0.01,
  }),
});
```

## Connection management

### Auto-reconnection

```ts
const { connect } = useDevice(deviceId);

await connect({
  autoReconnect: true,
  reconnection: {
    maxAttempts: 5,
    baseDelay: 1000,
    maxDelay: 30000,
    multiplier: 2.0,
    jitter: true,
  },
});
```

### Connection state machine

States: `Disconnected` → `Connecting` → `Discovering` → `Ready` → `Disconnecting` → `Disconnected`

On unexpected disconnect: `Ready` → `ConnectionLost` → `Reconnecting` → `Connecting` → ...

### Command queue

All BLE operations are automatically serialized to prevent Android GATT Error 133. No configuration needed.

## Fitness Machine (FTMS) control

```ts
import {
  buildFTMSRequestControl,
  buildFTMSSetTargetPower,
  buildFTMSSetSimulation,
} from '@peripheral/ble-core';

const { write } = useCharacteristic(deviceId, '1826', '2AD9');

// Take control of the trainer
await write(buildFTMSRequestControl());

// Set target power to 200W
await write(buildFTMSSetTargetPower(200));

// Set simulation: 0 m/s wind, 5% grade, 0.004 CRR, 0.51 Cw
await write(buildFTMSSetSimulation(0, 5, 0.004, 0.51));
```

## Device profiles

```ts
import { matchProfiles, HeartRateMonitorProfile } from '@peripheral/ble-core';

// Find which profiles match a device's advertised services
const profiles = matchProfiles(device.serviceUUIDs);
// → [HeartRateMonitorProfile]

// Use profile to auto-subscribe on connect
for (const sub of profile.autoSubscribe) {
  await peripheralManager.startNotifications(deviceId, sub.serviceUUID, sub.characteristicUUID);
}
```

## Imperative API

For non-React use or advanced control:

```ts
import { peripheralManager } from '@peripheral/ble-core';

await peripheralManager.initialize();
const device = await peripheralManager.connect(deviceId);

// Subscribe to auto-parsed data
peripheralManager.on('onParsedNotification', ({ characteristicUUID, parsed }) => {
  console.log(characteristicUUID, parsed);
});

await peripheralManager.startNotifications(deviceId, '180D', '2A37');
```

## Requirements

- React Native ≥ 0.73
- Expo SDK ≥ 52 (with dev client, not Expo Go)
- `react-native-ble-manager` ≥ 11.0.0
- iOS 15.1+ / Android API 24+
- Physical device (BLE does not work in simulators/emulators)

## License

MIT
