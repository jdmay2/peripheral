# Device Permissions and Validation

This project targets BLE-first React Native apps. BLE permissions and behavior differ by platform and OS version.

## Permission Matrix

| Platform | Permission | Required For | Where Configured |
|---|---|---|---|
| iOS | `NSBluetoothAlwaysUsageDescription` | BLE scanning, connect, notifications | `apps/example/app.json` (`expo.ios.infoPlist`) |
| iOS | `UIBackgroundModes: ["bluetooth-central"]` | Background BLE central operations | `apps/example/app.json` (`expo.ios.infoPlist`) |
| iOS | `NSHomeKitUsageDescription` | HomeKit access (only if using `HomeKitClient`) | App config when HomeKit module is enabled |
| Android (API 31+) | `android.permission.BLUETOOTH_SCAN` | BLE scanning | `apps/example/app.json` (`expo.android.permissions`) |
| Android (API 31+) | `android.permission.BLUETOOTH_CONNECT` | BLE connect and GATT operations | `apps/example/app.json` (`expo.android.permissions`) |
| Android (API <= 30) | `android.permission.ACCESS_FINE_LOCATION` | BLE scan visibility on older Android | `apps/example/app.json` (`expo.android.permissions`) |
| Android | `android.permission.BLUETOOTH` / `android.permission.BLUETOOTH_ADMIN` | Legacy BLE compatibility permissions | Added by Expo + plugin resolution |

## Runtime Permission Behavior

- `useBleManager()` requests runtime permissions on Android by default.
- Android SDK >= 31 requests `BLUETOOTH_SCAN` and `BLUETOOTH_CONNECT`.
- Android SDK <= 30 requests `ACCESS_FINE_LOCATION`.
- You can disable auto-request with `requestPermissionsOnInitialize: false` and handle permission prompts manually.

## Required Build Context

- BLE does not work in Expo Go.
- Use a dev build (`expo run:ios`, `expo run:android`, or EAS development build).
- Validate on physical devices (simulators/emulators do not provide BLE radio behavior).

## Manual Validation Checklist

1. Android first launch: grant BLE permissions and verify scanner can discover peripherals.
2. Android deny path: deny once and verify app surfaces a clear initialization error.
3. Android "Don’t ask again" path: verify app fails gracefully and points user to system settings.
4. iOS first launch: allow Bluetooth permission and verify scan/connect/notify works.
5. iOS deny path: deny Bluetooth and verify app surfaces the permission failure cleanly.
6. End-to-end pipeline: scanner -> sensor -> gestures -> smart home action on a real device.
7. Background behavior (if enabled): verify reconnection/notification behavior when app is backgrounded.

## Notes

- HomeKit functionality is iOS-only and requires a custom native module (`expo-homekit`) plus entitlement setup.
- Keep permission copy user-facing and specific to actual BLE use in your app.
