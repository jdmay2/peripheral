/**
 * HomeKit client — JavaScript-side wrapper for the native Swift Expo Module.
 *
 * This client provides a typed interface over the native HomeKit bridge.
 * It requires a custom Expo Module implementing the HomeKitNativeModule
 * interface (Swift, wrapping HMHomeManager).
 *
 * When the native module is not available (Android, or module not installed),
 * all methods throw descriptive errors rather than silently failing.
 *
 * ## Setup guide
 *
 * 1. Create the native module:
 *    ```bash
 *    npx create-expo-module@latest --local expo-homekit
 *    ```
 *
 * 2. In `modules/expo-homekit/ios/ExpoHomekit.swift`, implement the
 *    HomeKitNativeModule interface wrapping HMHomeManager.
 *
 * 3. Add entitlement via config plugin:
 *    ```ts
 *    // plugins/withHomeKit.js
 *    const { withEntitlementsPlist } = require('@expo/config-plugins');
 *    module.exports = (config) =>
 *      withEntitlementsPlist(config, (mod) => {
 *        mod.modResults['com.apple.developer.homekit'] = true;
 *        return mod;
 *      });
 *    ```
 *
 * 4. Add NSHomeKitUsageDescription to app.json:
 *    ```json
 *    { "ios": { "infoPlist": {
 *      "NSHomeKitUsageDescription": "Control your smart home devices"
 *    }}}
 *    ```
 *
 * @example
 * ```ts
 * const homekit = new HomeKitClient();
 *
 * if (homekit.isAvailable) {
 *   const homes = await homekit.getHomes();
 *   const primary = homes.find(h => h.isPrimary);
 *   if (primary) {
 *     const accessories = await homekit.getAccessories(primary.uniqueIdentifier);
 *     // Control a light
 *     await homekit.writeCharacteristic(
 *       primary.uniqueIdentifier, accessoryId, serviceId, charId, true
 *     );
 *   }
 * }
 * ```
 */

import { Platform } from 'react-native';
import type {
  HKHome,
  HKAccessory,
  HKRoom,
  HKActionSet,
  HKConnectionState,
  HomeKitNativeModule,
} from '../types';
import { EventEmitter, type Unsubscribe } from '../utils/event-emitter';

// ─── Events ──────────────────────────────────────────────────────────────────

interface HomeKitClientEvents {
  connectionStateChanged: HKConnectionState;
  homesUpdated: HKHome[];
  accessoryReachabilityChanged: {
    homeId: string;
    accessoryId: string;
    isReachable: boolean;
  };
  characteristicValueChanged: {
    homeId: string;
    accessoryId: string;
    serviceId: string;
    characteristicId: string;
    value: unknown;
  };
  error: Error;
}

// ─── Native module resolution ────────────────────────────────────────────────

let nativeModule: HomeKitNativeModule | null = null;
let nativeModuleChecked = false;

function getNativeModule(): HomeKitNativeModule | null {
  if (nativeModuleChecked) return nativeModule;
  nativeModuleChecked = true;

  if (Platform.OS !== 'ios') return null;

  try {
    // Try to import the Expo Module. This name should match
    // what's registered in the native module's Module.swift.
    // Users must install/create the expo-homekit module separately.
    const mod = require('expo-homekit');
    nativeModule = mod.default ?? mod;
    return nativeModule;
  } catch {
    // Module not installed — this is expected on Android or
    // when the user hasn't created the native module yet.
    return null;
  }
}

// ─── Client ──────────────────────────────────────────────────────────────────

export class HomeKitClient extends EventEmitter<HomeKitClientEvents> {
  private _connectionState: HKConnectionState = 'unavailable' as HKConnectionState;
  private _isObserving = false;

  constructor() {
    super();
    if (getNativeModule()) {
      this._connectionState = 'loading' as HKConnectionState;
    }
  }

  // ─── Availability ───────────────────────────────────────────────────────

  /** Whether HomeKit is available on this device (iOS only + module installed). */
  get isAvailable(): boolean {
    return getNativeModule() !== null;
  }

  get connectionState(): HKConnectionState {
    return this._connectionState;
  }

  // ─── Home management ────────────────────────────────────────────────────

  /** Get all HomeKit homes. */
  async getHomes(): Promise<HKHome[]> {
    return this.callNative('getHomes');
  }

  /** Get the primary home. */
  async getPrimaryHome(): Promise<HKHome | null> {
    return this.callNative('getPrimaryHome');
  }

  // ─── Accessory management ───────────────────────────────────────────────

  /** Get all accessories in a home. */
  async getAccessories(homeId: string): Promise<HKAccessory[]> {
    return this.callNative('getAccessories', homeId);
  }

  /** Get a specific accessory. */
  async getAccessory(homeId: string, accessoryId: string): Promise<HKAccessory | null> {
    return this.callNative('getAccessory', homeId, accessoryId);
  }

  // ─── Characteristic control ─────────────────────────────────────────────

  /** Read a characteristic value. */
  async readCharacteristic(
    homeId: string,
    accessoryId: string,
    serviceId: string,
    characteristicId: string,
  ): Promise<unknown> {
    return this.callNative(
      'readCharacteristic',
      homeId,
      accessoryId,
      serviceId,
      characteristicId,
    );
  }

  /** Write a characteristic value. */
  async writeCharacteristic(
    homeId: string,
    accessoryId: string,
    serviceId: string,
    characteristicId: string,
    value: unknown,
  ): Promise<void> {
    return this.callNative(
      'writeCharacteristic',
      homeId,
      accessoryId,
      serviceId,
      characteristicId,
      value,
    );
  }

  // ─── Convenience methods ────────────────────────────────────────────────

  /** Turn a power-state characteristic on or off. */
  async setPowerState(
    homeId: string,
    accessoryId: string,
    serviceId: string,
    characteristicId: string,
    on: boolean,
  ): Promise<void> {
    return this.writeCharacteristic(homeId, accessoryId, serviceId, characteristicId, on);
  }

  // ─── Scenes / Action Sets ──────────────────────────────────────────────

  /** Get all action sets (scenes) in a home. */
  async getActionSets(homeId: string): Promise<HKActionSet[]> {
    return this.callNative('getActionSets', homeId);
  }

  /** Execute a scene. */
  async executeActionSet(homeId: string, actionSetId: string): Promise<void> {
    return this.callNative('executeActionSet', homeId, actionSetId);
  }

  // ─── Room management ────────────────────────────────────────────────────

  /** Get all rooms in a home. */
  async getRooms(homeId: string): Promise<HKRoom[]> {
    return this.callNative('getRooms', homeId);
  }

  /** Assign an accessory to a room. */
  async assignAccessoryToRoom(
    homeId: string,
    accessoryId: string,
    roomId: string,
  ): Promise<void> {
    return this.callNative('assignAccessoryToRoom', homeId, accessoryId, roomId);
  }

  // ─── Observation ────────────────────────────────────────────────────────

  /** Start observing home changes (native events → JS). */
  startObserving(): void {
    if (this._isObserving) return;
    const mod = this.requireNative();
    mod.startObservingHomeChanges();
    this._isObserving = true;
    this._connectionState = 'ready' as HKConnectionState;
    this.emit('connectionStateChanged', this._connectionState);
  }

  /** Stop observing home changes. */
  stopObserving(): void {
    if (!this._isObserving) return;
    const mod = getNativeModule();
    mod?.stopObservingHomeChanges();
    this._isObserving = false;
  }

  // ─── Internal ───────────────────────────────────────────────────────────

  private async callNative<T>(method: string, ...args: unknown[]): Promise<T> {
    const mod = this.requireNative();
    const fn = (mod as any)[method];
    if (typeof fn !== 'function') {
      throw new Error(
        `HomeKit native module does not implement "${method}". ` +
          'Ensure your expo-homekit module is up to date.',
      );
    }
    try {
      return await fn.call(mod, ...args);
    } catch (err) {
      const error =
        err instanceof Error
          ? err
          : new Error(`HomeKit native error: ${String(err)}`);
      this.emit('error', error);
      throw error;
    }
  }

  private requireNative(): HomeKitNativeModule {
    const mod = getNativeModule();
    if (!mod) {
      if (Platform.OS !== 'ios') {
        throw new Error(
          'HomeKit is only available on iOS. ' +
            'Use HomeAssistantClient for cross-platform smart home control.',
        );
      }
      throw new Error(
        'HomeKit native module not found. Create it with:\n' +
          '  npx create-expo-module@latest --local expo-homekit\n' +
          'Then implement the HomeKitNativeModule interface in Swift.',
      );
    }
    return mod;
  }
}
