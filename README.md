# @peripheral

React Native monorepo for BLE peripheral management, smart home control, and IMU gesture recognition. Pure TypeScript, targeting Expo SDK 54/55 with New Architecture support.

## Packages

| Package | Description | Install |
|---------|-------------|---------|
| [`@peripheral/ble-core`](packages/ble-core) | BLE connection management, typed GATT parsers, auto-reconnection, React hooks | `npm install @peripheral/ble-core` |
| [`@peripheral/smart-home`](packages/smart-home) | Home Assistant (WebSocket/REST), MQTT, HomeKit integration with React hooks | `npm install @peripheral/smart-home` |
| [`@peripheral/gesture-engine`](packages/gesture-engine) | IMU gesture recognition — threshold, DTW template matching, TFLite/ONNX ML | `npm install @peripheral/gesture-engine` |
| [`@peripheral/integration`](packages/integration) | Glue layer: BLE sensor → gesture recognition → smart home actions | `npm install @peripheral/integration` |

Packages are independent — install only what you need. The `integration` package chains all three together with a single React hook.

## Quick Start

```bash
# Install a package
npm install @peripheral/ble-core react-native-ble-manager

# Or install everything
npm install @peripheral/ble-core @peripheral/smart-home @peripheral/gesture-engine @peripheral/integration
```

## Requirements

- React Native ≥ 0.73 (0.83+ mandates New Architecture)
- React ≥ 18.0
- Expo SDK 53+ (dev builds, not Expo Go — required for BLE)
- iOS 15.1+ / Android API 24+
- Physical device for BLE testing (no simulator support)

## Development

```bash
pnpm install                  # Install dependencies
pnpm build                    # Build all packages
pnpm typecheck                # Type-check all packages
pnpm changeset                # Create a changeset for your PR
pnpm version-packages         # Apply changesets (bump versions + changelogs)
pnpm release                  # Build + publish to npm
```

## License

[MIT](LICENSE)
