# Contributing to @peripherals

Thank you for your interest in contributing. This guide covers the development workflow and conventions used in this monorepo.

## Prerequisites

- Node.js >= 18.0.0
- pnpm 10.x (`corepack enable` will activate it from the `packageManager` field)
- A physical iOS or Android device for BLE testing (simulators and emulators do not support Bluetooth)

## Getting Started

```bash
git clone https://github.com/jdmay2/peripheral.git
cd peripheral
pnpm install
pnpm verify:repo
pnpm verify:example-config
```

## Monorepo Structure

```
peripheral/
  packages/
    ble-core/          # @peripherals/ble-core
    smart-home/        # @peripherals/smart-home
    gesture-engine/    # @peripherals/gesture-engine
    integration/       # @peripherals/integration
    eslint-config/     # Shared ESLint config (internal)
    typescript-config/  # Shared TypeScript config (internal)
  apps/
    example/           # Expo demo app
```

Packages are built with `react-native-builder-bob` and produce three outputs: ESM (`lib/module`), CommonJS (`lib/commonjs`), and TypeScript declarations (`lib/typescript`).

## Development Workflow

1. Create a branch from `main`.
2. Make your changes.
3. Run full verification:
   ```bash
   pnpm verify:repo
   pnpm verify:pack
   pnpm verify:example-config
   ```
4. If your change affects users (new API, bug fix, behavior change), create a changeset:
   ```bash
   pnpm changeset
   ```
   Follow the prompts to describe your change and select a bump level (patch, minor, major).
5. Commit your changes and open a pull request.

## Commit Messages

Use imperative mood and keep the first line under 72 characters:

```
Add gyroscope support to ThresholdClassifier
Fix reconnection timeout handling in PeripheralManager
Update Home Assistant WebSocket client to handle auth refresh
```

## Code Style

- **TypeScript strict mode** with `noUncheckedIndexedAccess` enabled
- No `any` types -- use `unknown` and narrow with type guards
- JSDoc comments on all public APIs
- Barrel `index.ts` at each directory level
- Hooks return objects, not arrays
- Parsers follow the pattern: `parseXxxMeasurement(dataView: DataView) => TypedResult`
- Service call builders follow: `xxxYyy(options) => ServiceCall` (e.g., `lightTurnOn`)
- Event emitters use typed `EventEmitter<{ eventName: PayloadType }>` pattern

## Testing

This repository follows a **hybrid verification model**:

- Automated checks for linting, type safety, build artifacts, and non-device unit tests
- Manual physical-device validation for BLE permission and radio behavior

BLE functionality requires a physical device. The example app at `apps/example` serves as the manual integration test surface:

```bash
cd apps/example
npx expo prebuild --clean
npx expo run:ios   # or run:android
```

Automated test suite:

```bash
pnpm verify:repo
```

Permission and runtime validation checklist is documented in `docs/permissions.md`.

## Pull Request Process

1. Fill out the PR template completely.
2. Ensure `pnpm verify:repo`, `pnpm verify:pack`, and `pnpm verify:example-config` pass.
3. Add a changeset if the change is user-facing.
4. Update the relevant package README if the public API changed.
5. One approval is required before merging.

## Releases

Releases are automated with Changesets via GitHub Actions.

1. Merge PRs with changesets into `main`.
2. A "release" PR is opened automatically to bump versions and update changelogs.
3. Merging the release PR publishes new versions to npm.

Publishing from CI requires a repository secret named `NPM_TOKEN` (npm automation token with publish access for the `@peripherals` scope).
If `NPM_TOKEN` is not set, the release workflow will skip publishing.

## Reporting Issues

Use the issue templates when opening new issues:

- **Bug Report** -- for broken behavior or errors
- **Feature Request** -- for new capabilities or API changes

For general questions, use [Discussions](https://github.com/jdmay2/peripheral/discussions).

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
