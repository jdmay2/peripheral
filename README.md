# @peripherals

React Native monorepo for BLE peripheral management, smart home control, and IMU gesture recognition. Pure TypeScript, targeting Expo SDK 54+ with New Architecture support.

## Packages

| Package | Description | Install |
|---------|-------------|---------|
| [`@peripherals/ble-core`](packages/ble-core) | BLE connection management, typed GATT parsers, auto-reconnection, React hooks | `npm install @peripherals/ble-core` |
| [`@peripherals/smart-home`](packages/smart-home) | Home Assistant (WebSocket/REST), MQTT, HomeKit integration with React hooks | `npm install @peripherals/smart-home` |
| [`@peripherals/gesture-engine`](packages/gesture-engine) | IMU gesture recognition — threshold, DTW template matching, TFLite/ONNX ML | `npm install @peripherals/gesture-engine` |
| [`@peripherals/integration`](packages/integration) | Glue layer: BLE sensor → gesture recognition → smart home actions | `npm install @peripherals/integration` |

Packages are independent — install only what you need. The `integration` package chains all three together with a single React hook.

## Quick Start

```bash
# Install a package
npm install @peripherals/ble-core react-native-ble-manager

# Or install everything
npm install @peripherals/ble-core @peripherals/smart-home @peripherals/gesture-engine @peripherals/integration
```

## Requirements

- Node.js >= 18.0.0
- pnpm 10.x for repo development
- React Native ≥ 0.73 (0.83+ mandates New Architecture)
- React ≥ 18.0
- Expo SDK 54+ for the example app (`apps/example`)
- iOS 15.1+ / Android API 24+
- Physical device for BLE testing (no simulator support)

## Package Manager Policy

- This monorepo is **pnpm-first**.
- npm is fully supported for consuming published packages.
- Root `package.json` includes `workspaces` for npm tooling compatibility, but repo-level npm commands may still print warnings because `.npmrc` contains pnpm-specific keys.

## Development

```bash
pnpm install                  # Install dependencies
pnpm build                    # Build all packages
pnpm typecheck                # Type-check all packages
pnpm verify:repo              # Lint + typecheck + build + test
pnpm verify:pack              # Verify package tarball contents
pnpm verify:example-config    # Verify resolved Expo app config
pnpm changeset                # Create a changeset for your PR
pnpm version-packages         # Apply changesets (bump versions + changelogs)
pnpm release                  # Build + publish to npm
```

## Releases

This repo uses [Changesets](https://github.com/changesets/changesets) for versioning and publishing.

- Add a changeset in user-facing PRs: `pnpm changeset`
- GitHub Actions will open/update a release PR (version bumps + changelogs)
- Merging the release PR publishes to npm

To enable automated publishing, add a repository secret named `NPM_TOKEN` with an npm **automation token** that has publish access to the `@peripherals` scope.
If `NPM_TOKEN` is not set, the release workflow will skip publishing (but will still open the release PR).

## Device Permissions

See `docs/permissions.md` for iOS/Android permission requirements, runtime behavior, and manual validation scenarios.

## License

[MIT](LICENSE)
