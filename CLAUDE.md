# CLAUDE.md — @peripheral monorepo

React Native Expo monorepo (pnpm + Turborepo + Changesets) for BLE peripheral management, smart home control, and IMU gesture recognition. Pure TypeScript, ESM + CJS via `react-native-builder-bob`. Targets Expo SDK 54/55 New Architecture.

```txt
peripheral/
├── .changeset/config.json       # linked versioning for @peripheral/*
├── .npmrc                       # node-linker=hoisted (mandatory for Metro)
├── turbo.json                   # build pipeline: ^build dep ordering, cached
├── pnpm-workspace.yaml          # packages/*, apps/*
├── packages/
│   ├── ble-core/                # @peripheral/ble-core
│   ├── smart-home/              # @peripheral/smart-home
│   ├── gesture-engine/          # @peripheral/gesture-engine
│   ├── integration/             # @peripheral/integration — glue layer (BLE → gestures → smart home)
│   ├── eslint-config/           # shared ESLint
│   └── typescript-config/       # shared tsconfig (strict, ES2020, bundler resolution)
└── apps/
    └── example/                 # Expo dev build app (SDK 54, New Architecture, 5-tab demo)
```

## Tooling and commands

| Tool        | Version | Notes                                                      |
| ----------- | ------- | ---------------------------------------------------------- |
| pnpm        | 10.29.2 | `node-linker=hoisted` in `.npmrc` — **required** for Metro |
| Turborepo   | 2.8.3   | `turbo build` with `^build` dep ordering + remote caching  |
| Changesets  | 2.29.8  | `"linked": [["@peripheral/*"]]`, `"access": "public"`      |
| builder-bob | 0.40.17 | ESM (`{"esm": true}`) + CJS + `.d.ts` to `lib/`            |
| TypeScript  | 5.9+    | Strict, `noUncheckedIndexedAccess`, bundler resolution     |

```bash
pnpm install                  # install (hoisted)
pnpm build                    # build all packages (turbo, cached)
pnpm typecheck                # type-check all
pnpm changeset                # create changeset for PR
pnpm version-packages         # apply changesets → bump + changelogs
pnpm release                  # build + publish to npm
```

Each package exports via the `"react-native"` condition **before** `"import"`/`"require"` — critical for Metro resolution:

```json
{
  "react-native": "./src/index.ts",
  "import": {
    "types": "./lib/typescript/module/src/index.d.ts",
    "default": "./lib/module/index.js"
  },
  "require": {
    "types": "./lib/typescript/commonjs/src/index.d.ts",
    "default": "./lib/commonjs/index.js"
  }
}
```

---

## @peripheral/ble-core

BLE connection management + GATT data parsing. Wraps `react-native-ble-manager` (peer dep ≥11.0.0) with state machine, command queue, reconnection, and typed parsers for 30+ Bluetooth SIG characteristics.

Chosen over `react-native-ble-plx` — ble-plx crashes on New Architecture (issue #1277, unresolved); ble-manager confirmed working in v12.x with built-in Expo config plugin.

```txt
react-native-ble-manager (native)
    ▼
PeripheralManager (singleton)
    ├── ConnectionStateMachine — disconnected → connecting → discovering → ready → disconnecting
    ├── CommandQueue — serialized BLE ops (prevents Android GATT Error 133)
    ├── ReconnectionManager — exponential backoff (1s base, 5 attempts, 1.5× multiplier)
    └── GATT Parser Registry — auto-parse by characteristic UUID
```

### ble-core source layout

| Directory   | Contents                                                                                                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/`     | `manager.ts` (PeripheralManager singleton), `state-machine.ts` (5-state FSM), `command-queue.ts` (FIFO, concurrency=1), `reconnection.ts` (backoff + jitter)                      |
| `parsers/`  | heart-rate, blood-pressure, cycling (CSC + power), fitness-machine (FTMS), glucose, health-thermometer, environmental, pulse-oximeter, running (RSC), weight-scale, current-time, `registry.ts` |
| `profiles/` | 13 device profiles: HeartRateMonitor, CyclingPower, IndoorBike, Treadmill, Rower, RSC, WeightScale, BloodPressure, PulseOximeter, CSC, HealthThermometer, GlucoseMonitor, EnvironmentalSensor |
| `hooks/`    | `useBleManager()`, `useScan(filter?)`, `useDevice(id)`, `useCharacteristic(device, opts)`, `useBattery(id)`, `useRSSI(id, opts)`, `useDeviceInfo(id)`                              |
| `types/`    | ConnectionState enum, GATT UUID constants (StandardServices, StandardCharacteristics), 15+ parsed data interfaces, `BleErrorCode` + `BleError` typed errors                       |
| `utils/`    | `bytes.ts` (DataView helpers, base64 decode), `ieee11073.ts` (SFLOAT/FLOAT decoders), `uuid.ts` (validate/expand/shorten), `advertising.ts` (manufacturer/service data parsing)    |

### ble-core key APIs

- **`PeripheralManager`** / **`peripheralManager`** — scan, connect, disconnect, read, write, notify
- **`autoParse(uuid, dataView)`** — auto-detect and parse any registered GATT characteristic
- **`getParser(uuid)`** / **`registerParser(uuid, fn)`** — extensible parser registry
- **GATT parsers** — `parseHeartRateMeasurement`, `parseIndoorBikeData`, `parseCyclingPowerMeasurement`, `parseBloodPressureMeasurement`, etc.
- **FTMS builders** — `buildFTMSSetTargetPower`, `buildFTMSSetSimulation`, `buildFTMSRequestControl`
- **RACP builders** — `buildRACPReportAll`, `buildRACPDeleteAll` (glucose records)
- **Profiles** — `matchProfiles(serviceUUIDs)` returns matching device profiles
- **`BleError`** / **`BleErrorCode`** — typed errors with 13 codes (`gatt_error`, `timeout`, `permission_denied`, etc.)
- **UUID utils** — `isValidUUID()`, `expandShortUUID()`, `shortenUUID()`, `isSigUUID()`
- **Advertising utils** — `parseManufacturerData()`, `parseServiceData()`, `getAdvertisedTxPower()`, `isConnectable()`
- **New hooks** — `useBattery(id)`, `useRSSI(id, opts)`, `useDeviceInfo(id)`
- **Current Time parsers** — `parseCurrentTime()`, `parseLocalTimeInfo()`, `parseReferenceTimeInfo()`

### GATT parsing gotchas

- **FTMS Indoor Bike (0x2AD2)**: bit 0 has **inverted semantics** — 0 means field IS present
- **IEEE 11073 SFLOAT**: check specials (NaN=0x07FF, ±∞) **before** sign extension
- **CSC vs CPS timers**: CSC = 1/1024s, CPS = 1/2048s resolution
- **Sentinels**: uint16→0xFFFF, sint16→0x7FFF, uint8→0xFF = "not available"
- All multi-byte values are **little-endian**

---

## @peripheral/smart-home

Smart home integration via Home Assistant (primary), MQTT, and HomeKit. HA is the universal bridge (2000+ integrations). Alexa has no mobile API; Google Home APIs are beta-only; HomeKit is iOS-only.

```txt
HomeAssistantClient (WebSocket) ──► real-time state subscriptions, service calls
HomeAssistantRest ─────────────► history, templates, one-shot queries
MQTTClient (mqtt.js via wss://) ──► direct device control, Zigbee2MQTT, HA discovery
HomeKitClient (interface only) ──► iOS: requires custom Swift Expo Module for HMHomeManager
```

### smart-home source layout

| Directory  | Contents                                                                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clients/` | `home-assistant.ts` (WebSocket, wraps `home-assistant-js-websocket` ^9.6.0), `home-assistant-rest.ts`, `mqtt.ts` (MQTT 5.0), `homekit.ts` (interface)             |
| `devices/` | 18 typed abstractions: Light, Climate, Lock, Cover, Fan, MediaPlayer, Vacuum, AlarmPanel, Sensor, BinarySensor, Scene, Weather, Camera, Person, InputBoolean, InputNumber, InputSelect, Script |
| `hooks/`   | `useHomeAssistant(config)`, `useEntity(id)`, `useEntities(filter?)`, `useAreas()`, `useService()`, `useAutomation()`, `useHistory(id, period)`, `useMQTT(config)`, `useScenes()`, `useWeather(entityId?)`, `useConnectionHealth(config)` |
| `types/`   | `entities.ts`, `homeassistant.ts` (HA WS/REST), `mqtt.ts` (MQTT + Z2M + HA discovery), `homekit.ts` (HK hierarchy)                                                |
| `utils/`   | `service-calls.ts` (50+ builders: `lightTurnOn`, `climateSetTemperature`, `lockLock`, `vacuumStart`, notifications, input helpers, script, etc.), `entities.ts` (filter/group/parse helpers + `formatEntityState()`, `isEntityAvailable()`, `getLastChanged()`, `getLastUpdated()`) |

### smart-home key APIs

- **`HomeAssistantClient`** — `connect()`, `callService()`, `subscribeEntities()`, `subscribeEvents()`, `getStates()`, `getAreas()`, `getDevices()`
- **`HomeAssistantRest`** — `getStates()`, `callService()`, `getHistory()`, `renderTemplate()`
- **`MQTTClient`** — `connect()`, `publish()`, `subscribe()`, `publishDiscovery()`, `getZ2MDevices()`, `setZ2MDeviceState()`
- **Service call builders** — `lightTurnOn({brightness, colorTemp, rgbColor})`, `climateSetHvacMode()`, `coverSetPosition()`, `alarmArmHome()`, `activateScene()`, `triggerAutomation()`, etc.
- **Entity helpers** — `extractDomain()`, `filterByDomain()`, `groupByArea()`, `isStateActive()`, `numericState()`, `formatEntityState()`, `isEntityAvailable()`, `getLastChanged()`, `getLastUpdated()`
- **New hooks** — `useScenes()`, `useWeather(entityId?)`, `useConnectionHealth({ pingIntervalMs? })`

### smart-home deps

- **Required**: `home-assistant-js-websocket` ^9.6.0
- **Optional peer**: `mqtt` (for MQTTClient)
- HomeKit `HomeKitClient` is interface-only — consumer implements Swift native module

---

## @peripheral/gesture-engine

IMU gesture recognition from BLE wearable sensors. Three-tier classification + six-layer false positive mitigation. Pure TypeScript, ~4,300 lines. No required native deps.

```txt
feedSamples([IMUSample...])
    ▼
PreprocessingPipeline (Butterworth LP 20Hz + HP 0.3Hz gravity removal)
    ▼
CircularBuffer (Float64Array, stride-based, ~10s)
    ▼
Segmenter (sliding window 1–3s, 50% overlap, SMA onset + activity classifier)
    ▼
┌─ ThresholdClassifier (tap/shake/flick/longPress/rotation — always runs in parallel)
├─ DTWClassifier (Sakoe-Chiba banded, rotation-invariant magnitude mode)
└─ MLClassifier (TFLite via react-native-fast-tflite or ONNX — optional)
    ▼
FalsePositiveGuard (6 layers)
    ▼
RecognitionResult { gestureId, confidence, accepted, rejectionReason }
```

### gesture-engine source layout

| Directory      | Contents                                                                                                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `classifiers/` | `threshold.ts` (tap/doubleTap/shake/flick/longPress/rotation via peak detection), `dtw.ts` (Sakoe-Chiba DTW, rotation-invariant, multi-template voting + template management), `ml-inference.ts` (lazy TFLite/ONNX wrapper) |
| `pipeline/`    | `segmenter.ts` (sliding window + SMA onset + activity classification), `false-positive-guard.ts` (6-layer FP mitigation), `recorder.ts` (5-step recording workflow)                |
| `engine/`      | `GestureEngine` — full orchestrator: preprocess → buffer → segment → classify → FP guard → emit; `gesture-sequencer.ts` (ordered multi-gesture sequences)                          |
| `features/`    | Time-domain (mean, variance, RMS, ZCR, SMA, jerk, IQR, energy, correlations) + frequency-domain (built-in Radix-2 FFT, dominant freq, spectral energy/entropy/centroid)            |
| `hooks/`       | `useGestureEngine`, `useGestureRecognition`, `useGestureRecorder`, `useActivityContext`, `useGestureLibrary`, `useSensorVisualization`, `useGestureStats`, `useGestureCalibration` |
| `types/`       | IMUSample, IMUWindow, FeatureVector, GestureClass, RecognitionResult, EngineState, GestureEngineConfig (50+ options)                                                               |
| `utils/`       | `circular-buffer.ts` (Float64Array ring, zero-GC), `filters.ts` (Butterworth/Biquad), `event-emitter.ts`                                                                           |

### Classification tiers

| Tier | Classifier          | Training                       | Accuracy    | Use case                     |
| ---- | ------------------- | ------------------------------ | ----------- | ---------------------------- |
| 1    | ThresholdClassifier | None — configure thresholds    | ~90% simple | tap, doubleTap, shake, flick, longPress, rotation |
| 2    | DTWClassifier       | 5–20 recorded templates        | 93–98%      | swipe, circle, custom        |
| 3    | MLClassifier        | Offline Python → .tflite/.onnx | 99%+        | Production, 10–20+ classes   |

**DTW**: Sakoe-Chiba band (~10% width), rotation-invariant mode (√(ax²+ay²+az²) for ring rotation), auto-calibration via `engine.calibrate()`, consistency scoring for recording quality.

**ML**: Lazy loads `react-native-fast-tflite` (JSI, CoreML/NNAPI) or `onnxruntime-react-native`. Supports explicit noise class index for rejection.

### False positive mitigation (6 layers)

Target: **<0.02 FP/hour**, 91% TP rate (CHI 2022, 500+ participants).

1. **Context gating** — disable at high activity; geofence to home
2. **Activation gesture** — most effective layer; idle until "wake" gesture → 5s armed window
3. **Noise class** — ML trained with explicit "not a gesture" class
4. **Adaptive thresholds** — +10% per FP report, relax after 20+ consecutive TPs
5. **Progressive cooldown** — 2s → 4s → 8s on consecutive FPs, cap 60s, recalibration after 5 FPs
6. **Rate limit** — max 10/min, 500ms deduplication

### Recording workflow

`GestureRecorder`: countdown (3s) → capture (2.5s × 5 reps) → auto-trim silence → DTW consistency check (≥70% to accept). Emits: `phaseChanged`, `countdownTick`, `recordingCompleted`, `sessionCompleted`, `repQuality`.

### gesture-engine key APIs

- **`GestureEngine`** — `start()`, `stop()`, `pause()`, `feedSamples()`, `registerGesture()`, `registerThresholdGesture()`, `calibrate()`, `exportLibrary()`, `importLibrary()`, `reportFalsePositive()`, `getDiagnostics()`
- **`GestureRecorder`** — `startSession()`, `feedSamples()`, `finalizeSession()`, `discardLastRepetition()`
- **`FalsePositiveGuard`** — `evaluate(result, activity)`, `arm()`, `disarm()`, `getMetrics()`, `getGestureMetrics(gestureId)`
- **`GestureSequencer`** — `registerSequence()`, `feedGesture()`, `reset()` — ordered multi-gesture sequences with per-step timeouts
- **Template management** — `deleteTemplate()`, `getTemplates()`, `getTemplateCount()`, `clearGesture()` (on DTWClassifier + GestureEngine)
- **New hooks** — `useGestureStats(engine)`, `useGestureCalibration(engine)`
- **Signal processing** — `PreprocessingPipeline`, `CircularBuffer`, `BiquadFilter`, `butterworthLowPass/HighPass()`
- **Feature extraction** — `extractFeatures(window, includeFrequency)` → flat `number[]` for ML input

### gesture-engine deps

- **Optional peers**: `react-native-fast-tflite` (Tier 3 TFLite), `onnxruntime-react-native` (Tier 3 ONNX)
- Tiers 1 + 2 need zero native dependencies

---

## @peripheral/integration

Thin glue layer eliminating boilerplate when chaining the three packages together (BLE → gestures → smart home). All three `@peripheral/*` packages are optional peer dependencies — consumers install only what they need.

```txt
BLE Notification → IMU Parser → GestureEngine → Action Bridge → Home Assistant
     ↑                                              ↑
createIMUPipeline()                    createGestureActionBridge()
     └──────────── useIMUGestureControl() ──────────┘
```

### integration source layout

| Directory    | Contents                                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------------------------- |
| `types/`     | `IMUPipelineConfig`, `GestureActionBridgeConfig`, `IMUGestureControlConfig`, `GestureActionMap`, `IMUParserFn`, `GestureActionEntry` (conditional actions), `ActionHistoryEntry` |
| `parsers/`   | `createIMU6AxisParser()`, `createIMU3AxisParser()`, `createIMU9AxisParser()` — factories for common packed int16 LE IMU formats (3/6/9-axis) |
| `pipeline/`  | `createIMUPipeline(manager, engine, config)`, `createGestureActionBridge(engine, haClient, config)` — imperative APIs |
| `hooks/`     | `useIMUGestureControl(config)` — single React hook combining full BLE→gesture→smart home lifecycle                    |

### integration key APIs

- **`createIMUPipeline(manager, engine, config)`** — subscribes to BLE IMU characteristic, parses bytes, feeds to GestureEngine, auto-resubscribes on reconnect
- **`createGestureActionBridge(engine, haClient, config)`** — maps gesture events to HA service calls with per-gesture and global cooldowns; supports conditional actions via `GestureActionEntry`, tracks action history (last 20) + execution latency
- **`useIMUGestureControl(config)`** — combined hook returning `{ pipelineStatus, bridgeStatus, engineState, lastGesture, lastAction, recentActions, lastActionExecutionMs, lastSampleLatencyMs, start, stop, error }`
- **`createIMU6AxisParser(accelScale?, gyroScale?)`** — factory for 12-byte 6-axis data (MPU-6050 defaults)
- **`createIMU3AxisParser(accelScale?)`** — factory for 6-byte 3-axis data
- **`createIMU9AxisParser(accelScale?, gyroScale?, magScale?)`** — factory for 18-byte 9-axis data (MPU-9250 defaults: accel+gyro+mag)

---

## Example App (`apps/example/`)

Expo Router app (SDK 54, New Architecture) demonstrating all packages across 5 tabs.

| Tab       | Packages Used       | Key Hooks                                                          |
| --------- | ------------------- | ------------------------------------------------------------------ |
| Scanner   | ble-core            | `useBleManager`, `useScan`, `useDevice`, `matchProfiles`           |
| Sensor    | ble-core, gesture   | `useCharacteristic`, `useGestureEngine`, `useSensorVisualization`  |
| Gestures  | gesture-engine      | `useGestureRecorder`, `useGestureRecognition`, `useGestureLibrary` |
| Home      | smart-home          | `useHomeAssistant`, `useEntities`, `useService`, `useAreas`        |
| Pipeline  | integration (all 4) | `useIMUGestureControl` — single hook for full chain                |

```bash
cd apps/example
npx expo prebuild --clean   # generate native projects
npx expo run:ios            # or run:android (requires physical BLE device)
```

---

## Cross-package composition

Packages are independent but chain: `ble-core` reads raw IMU data → `gesture-engine` classifies → `smart-home` triggers actions. The `integration` package provides ready-made glue.

```typescript
// Manual composition:
const { rawValue } = useCharacteristic(deviceId, serviceUUID, charUUID, { autoSubscribe: true });
useEffect(() => { engine.feedSamples(parseIMU6Axis(rawValue, Date.now())); }, [rawValue]);
engine.on('gesture', (r) => haClient.callService('light', 'toggle', { entity_id: 'light.living_room' }));

// Or use the integration hook:
const { lastGesture, lastAction, start, stop } = useIMUGestureControl({
  deviceId, serviceUUID, characteristicUUID,
  actionMap: { shake: toggle('light.living_room') },
  haConfig: { url, auth: { type: 'longLivedToken', token } },
});
```

## Platform compatibility

| Requirement   | Value                                                    |
| ------------- | -------------------------------------------------------- |
| React Native  | ≥ 0.73 (0.83+ mandates New Architecture)                 |
| React         | ≥ 18.0 (19.2+ for RN 0.83+)                             |
| Expo SDK      | 53+ (54 stable; 55 removes Legacy Architecture)          |
| iOS / Android | 15.1+ / API 24+                                          |
| BLE testing   | **Physical device only** — no simulator/emulator support |

Expo requires **dev builds** (not Expo Go) for BLE. Config plugin adds `NSBluetoothAlwaysUsageDescription` and `UIBackgroundModes: ["bluetooth-central"]`. Background scanning must specify service UUIDs. HomeKit needs `com.apple.developer.homekit` entitlement + custom Swift Expo Module.

## Conventions

- **TypeScript**: strict, no `any`, JSDoc on public APIs, barrel `index.ts` at each directory
- **Hooks**: `useXxx`, return objects not arrays
- **Parsers**: `parseXxxMeasurement(dataView)` — DataView in, typed object out, little-endian, checks sentinels
- **Builders**: `buildXxx` (FTMS/RACP), `xxxYyy` (service calls like `lightTurnOn`)
- **Events**: typed `EventEmitter<{eventName: PayloadType}>` pattern
- **Naming**: `@peripheral/` scope, PascalCase interfaces, `XxxClient` for clients
- **Exports**: `"react-native"` condition first in `package.json` exports map

## Not in scope (yet)

- **Native modules** — HomeKit Swift, Google Home Kotlin, BLE peripheral mode are interface-only
- **Tests, CI/CD** — no test suites or pipeline yet
- **Direct Matter** — `@matter/react-native` experimental; use platform hubs
- **Oura Ring BLE** — proprietary batch-sync; use REST API v2 or separate BLE IMU

## Key decisions

| Decision                     | Rationale                                                         |
| ---------------------------- | ----------------------------------------------------------------- |
| `ble-manager` over `ble-plx` | ble-plx crashes on New Arch (#1277); ble-manager v12.x confirmed  |
| Home Assistant as bridge     | 2000+ integrations; Alexa no mobile API, Google beta, HK iOS-only |
| DTW for MVP classifier       | 5–10 templates, no training, 93–98% accuracy                      |
| Butterworth over moving avg  | Proper frequency cutoffs; gravity removal via HP 0.3Hz            |
| Float64Array circular buffer | Stride-based, cache-friendly, zero GC during streaming            |
| 6-layer FP mitigation        | Single threshold ≈ 1 FP/hr; layered <0.02/hr (CHI 2022)           |
| pnpm + `node-linker=hoisted` | pnpm default breaks Metro; hoisted preserves store benefits       |
