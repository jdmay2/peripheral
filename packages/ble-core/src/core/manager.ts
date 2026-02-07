import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import BleManager from 'react-native-ble-manager';

import type {
  BleManagerOptions,
  ScanFilter,
  ScanResult,
  ConnectOptions,
  BleService,
  BleCharacteristic,
  BleDevice,
  CharacteristicNotification,
  WriteType,
  AdapterState,
} from '../types/ble';
import { ConnectionState } from '../types/ble';
import { CommandQueue } from './command-queue';
import { ConnectionStateMachine } from './state-machine';
import { ReconnectionManager } from './reconnection';
import { toDataView } from '../utils/bytes';
import { autoParse } from '../parsers/registry';
import { uuidsMatch } from '../types/gatt';

// ─── Event types ─────────────────────────────────────────────────────────────

export type PeripheralManagerEvents = {
  /** Raw notification data (before parsing) */
  onRawNotification: (notification: CharacteristicNotification) => void;
  /** Auto-parsed notification data */
  onParsedNotification: (data: {
    deviceId: string;
    characteristicUUID: string;
    serviceUUID: string;
    parsed: unknown;
    raw: number[];
  }) => void;
  /** Device found during scan */
  onDeviceFound: (device: ScanResult) => void;
  /** Connection state changed for a device */
  onConnectionStateChange: (
    deviceId: string,
    state: ConnectionState,
    prevState: ConnectionState
  ) => void;
  /** BLE adapter state changed */
  onAdapterStateChange: (state: AdapterState) => void;
  /** Error occurred */
  onError: (error: Error, context?: string) => void;
};

type EventKey = keyof PeripheralManagerEvents;
type EventCallback<K extends EventKey> = PeripheralManagerEvents[K];

// ─── Per-device context ──────────────────────────────────────────────────────

interface DeviceContext {
  id: string;
  name: string | null;
  rssi: number;
  mtu: number;
  services: BleService[];
  stateMachine: ConnectionStateMachine;
  reconnectionManager: ReconnectionManager;
  connectOptions: ConnectOptions;
}

// ─── Main manager class ──────────────────────────────────────────────────────

/**
 * PeripheralManager wraps react-native-ble-manager with:
 * - Serialized command queue (prevents Android GATT Error 133)
 * - Per-device connection state machines
 * - Auto-reconnection with exponential backoff
 * - Auto-parsing of standard GATT characteristics
 * - Typed event emitter
 */
export class PeripheralManager {
  private initialized = false;
  private queue: CommandQueue;
  private devices = new Map<string, DeviceContext>();
  private eventEmitter: NativeEventEmitter | null = null;
  private listeners = new Map<EventKey, Set<EventCallback<EventKey>>>();
  private nativeSubscriptions: Array<{ remove: () => void }> = [];

  constructor() {
    this.queue = new CommandQueue(10000);
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  /**
   * Initialize the BLE manager. Must be called before any other operations.
   */
  async initialize(options?: BleManagerOptions): Promise<void> {
    if (this.initialized) return;

    await BleManager.start({
      showAlert: options?.showAlert ?? true,
      forceLegacy: options?.forceLegacy ?? false,
    });

    this.eventEmitter = new NativeEventEmitter(
      NativeModules.BleManager
    );

    this.setupNativeListeners();
    this.initialized = true;
  }

  /**
   * Tear down the manager, cancel all reconnections, clear queue.
   */
  destroy(): void {
    for (const [, ctx] of this.devices) {
      ctx.reconnectionManager.cancel();
    }
    this.queue.clear();
    for (const sub of this.nativeSubscriptions) {
      sub.remove();
    }
    this.nativeSubscriptions = [];
    this.listeners.clear();
    this.devices.clear();
    this.initialized = false;
  }

  // ─── Scanning ────────────────────────────────────────────────────────────

  /**
   * Start scanning for BLE peripherals.
   */
  async startScan(filter?: ScanFilter): Promise<void> {
    this.ensureInitialized();

    const serviceUUIDs = filter?.services ?? [];
    const seconds = filter?.duration ? filter.duration / 1000 : 0;
    const allowDuplicates = filter?.allowDuplicates ?? false;

    await BleManager.scan({
      serviceUUIDs,
      seconds,
      allowDuplicates,
      matchMode: 1, // MATCH_MODE_AGGRESSIVE
      scanMode: 1, // SCAN_MODE_LOW_LATENCY
    });
  }

  /** Stop an ongoing scan */
  async stopScan(): Promise<void> {
    await BleManager.stopScan();
  }

  // ─── Connection ──────────────────────────────────────────────────────────

  /**
   * Connect to a peripheral, discover services, and optionally negotiate MTU.
   * Returns the fully connected BleDevice.
   */
  async connect(
    deviceId: string,
    options?: ConnectOptions
  ): Promise<BleDevice> {
    this.ensureInitialized();
    const opts: ConnectOptions = {
      requestMtu: 512,
      timeout: 15000,
      autoReconnect: true,
      ...options,
    };

    // Get or create device context
    let ctx = this.devices.get(deviceId);
    if (!ctx) {
      ctx = this.createDeviceContext(deviceId, opts);
      this.devices.set(deviceId, ctx);
    }

    const sm = ctx.stateMachine;

    return this.queue.enqueue(
      async () => {
        // Transition: Disconnected → Connecting
        const prevState = sm.state;
        sm.transition(ConnectionState.Connecting);
        this.emitConnectionStateChange(deviceId, sm.state, prevState);

        try {
          await BleManager.connect(deviceId);
        } catch (error) {
          sm.forceReset();
          throw error;
        }

        // Transition: Connecting → Discovering
        sm.transition(ConnectionState.Discovering);
        this.emitConnectionStateChange(deviceId, sm.state, ConnectionState.Connecting);

        const peripheralInfo = await BleManager.retrieveServices(deviceId);

        // Negotiate MTU on Android
        let mtu = 23;
        if (Platform.OS === 'android' && opts.requestMtu) {
          try {
            mtu = await BleManager.requestMTU(deviceId, opts.requestMtu);
          } catch {
            // MTU negotiation failure is non-fatal
            mtu = 23;
          }
        } else if (Platform.OS === 'ios') {
          mtu = 185; // iOS auto-negotiates
        }

        // Parse services
        const services = this.parseServices(peripheralInfo);
        ctx!.services = services;
        ctx!.mtu = mtu;
        ctx!.name = peripheralInfo.name ?? null;
        ctx!.rssi = peripheralInfo.rssi ?? -100;

        // Transition: Discovering → Ready
        sm.transition(ConnectionState.Ready);
        this.emitConnectionStateChange(deviceId, sm.state, ConnectionState.Discovering);

        return this.toBleDevice(ctx!);
      },
      { label: `connect:${deviceId}`, timeout: opts.timeout }
    );
  }

  /**
   * Disconnect from a peripheral.
   */
  async disconnect(deviceId: string): Promise<void> {
    const ctx = this.devices.get(deviceId);
    if (!ctx) return;

    ctx.reconnectionManager.cancel();

    if (ctx.stateMachine.canTransitionTo(ConnectionState.Disconnecting)) {
      ctx.stateMachine.transition(ConnectionState.Disconnecting);
    }

    await this.queue.enqueue(
      async () => {
        await BleManager.disconnect(deviceId);
        ctx.stateMachine.tryTransition(ConnectionState.Disconnected);
        this.emitConnectionStateChange(
          deviceId,
          ConnectionState.Disconnected,
          ConnectionState.Disconnecting
        );
      },
      { label: `disconnect:${deviceId}` }
    );
  }

  // ─── Read / Write / Subscribe ────────────────────────────────────────────

  /**
   * Read a characteristic value. Returns raw bytes.
   */
  async read(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string
  ): Promise<number[]> {
    return this.queue.enqueue(
      () => BleManager.read(deviceId, serviceUUID, characteristicUUID),
      { label: `read:${characteristicUUID}` }
    );
  }

  /**
   * Read and auto-parse a characteristic. Returns the parsed value
   * if a parser is registered, or raw bytes otherwise.
   */
  async readParsed<T = unknown>(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string
  ): Promise<T | number[]> {
    const raw = await this.read(deviceId, serviceUUID, characteristicUUID);
    const dv = toDataView(raw);
    const parsed = autoParse(characteristicUUID, dv);
    return (parsed as T) ?? raw;
  }

  /**
   * Write data to a characteristic.
   */
  async write(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string,
    data: number[],
    maxByteSize?: number
  ): Promise<void> {
    return this.queue.enqueue(
      () =>
        BleManager.write(
          deviceId,
          serviceUUID,
          characteristicUUID,
          data,
          maxByteSize
        ),
      { label: `write:${characteristicUUID}` }
    );
  }

  /**
   * Write data without response.
   */
  async writeWithoutResponse(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string,
    data: number[],
    maxByteSize?: number
  ): Promise<void> {
    return this.queue.enqueue(
      () =>
        BleManager.writeWithoutResponse(
          deviceId,
          serviceUUID,
          characteristicUUID,
          data,
          maxByteSize
        ),
      { label: `writeNoResp:${characteristicUUID}` }
    );
  }

  /**
   * Start notifications for a characteristic.
   * Parsed data will be emitted via onParsedNotification events.
   */
  async startNotifications(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string
  ): Promise<void> {
    return this.queue.enqueue(
      () =>
        BleManager.startNotification(
          deviceId,
          serviceUUID,
          characteristicUUID
        ),
      { label: `startNotify:${characteristicUUID}` }
    );
  }

  /**
   * Stop notifications for a characteristic.
   */
  async stopNotifications(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string
  ): Promise<void> {
    return this.queue.enqueue(
      () =>
        BleManager.stopNotification(
          deviceId,
          serviceUUID,
          characteristicUUID
        ),
      { label: `stopNotify:${characteristicUUID}` }
    );
  }

  /**
   * Read RSSI for a connected device.
   */
  async readRSSI(deviceId: string): Promise<number> {
    return this.queue.enqueue(() => BleManager.readRSSI(deviceId), {
      label: `readRSSI:${deviceId}`,
    });
  }

  // ─── Event handling ──────────────────────────────────────────────────────

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   */
  on<K extends EventKey>(
    event: K,
    callback: EventCallback<K>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback<EventKey>);
    return () => {
      this.listeners.get(event)?.delete(callback as EventCallback<EventKey>);
    };
  }

  // ─── Device info ─────────────────────────────────────────────────────────

  /** Get the current state for a device */
  getDeviceState(deviceId: string): ConnectionState {
    return (
      this.devices.get(deviceId)?.stateMachine.state ??
      ConnectionState.Disconnected
    );
  }

  /** Get the full device info (only if connected) */
  getDevice(deviceId: string): BleDevice | undefined {
    const ctx = this.devices.get(deviceId);
    if (!ctx || !ctx.stateMachine.isConnected) return undefined;
    return this.toBleDevice(ctx);
  }

  /** Get all known device IDs */
  getKnownDeviceIds(): string[] {
    return Array.from(this.devices.keys());
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        'PeripheralManager not initialized. Call initialize() first.'
      );
    }
  }

  private createDeviceContext(
    deviceId: string,
    options: ConnectOptions
  ): DeviceContext {
    const sm = new ConnectionStateMachine();
    const rm = new ReconnectionManager(options.reconnection);

    // Wire up reconnection events
    rm.onAttempt = (attempt, delay) => {
      this.emit('onError', new Error(`Reconnect attempt ${attempt}, delay ${delay}ms`), deviceId);
    };

    rm.onGiveUp = () => {
      sm.tryTransition(ConnectionState.Disconnected);
      this.emitConnectionStateChange(
        deviceId,
        ConnectionState.Disconnected,
        ConnectionState.Reconnecting
      );
    };

    return {
      id: deviceId,
      name: null,
      rssi: -100,
      mtu: 23,
      services: [],
      stateMachine: sm,
      reconnectionManager: rm,
      connectOptions: options,
    };
  }

  private setupNativeListeners(): void {
    if (!this.eventEmitter) return;

    // Device discovered during scan
    this.nativeSubscriptions.push(
      this.eventEmitter.addListener(
        'BleManagerDiscoverPeripheral',
        (peripheral: {
          id: string;
          name: string | null;
          rssi: number;
          advertising: Record<string, unknown>;
        }) => {
          const result: ScanResult = {
            id: peripheral.id,
            name: peripheral.name,
            rssi: peripheral.rssi,
            serviceUUIDs: [],
            advertising: peripheral.advertising as ScanResult['advertising'],
          };
          this.emit('onDeviceFound', result);
        }
      )
    );

    // Characteristic value update (notification/indication)
    this.nativeSubscriptions.push(
      this.eventEmitter.addListener(
        'BleManagerDidUpdateValueForCharacteristic',
        (data: {
          peripheral: string;
          characteristic: string;
          service: string;
          value: number[];
        }) => {
          const notification: CharacteristicNotification = {
            deviceId: data.peripheral,
            serviceUUID: data.service,
            characteristicUUID: data.characteristic,
            value: data.value,
          };

          // Emit raw notification
          this.emit('onRawNotification', notification);

          // Auto-parse and emit
          try {
            const dv = toDataView(data.value);
            const parsed = autoParse(data.characteristic, dv);
            if (parsed !== undefined) {
              this.emit('onParsedNotification', {
                deviceId: data.peripheral,
                characteristicUUID: data.characteristic,
                serviceUUID: data.service,
                parsed,
                raw: data.value,
              });
            }
          } catch (error) {
            this.emit(
              'onError',
              error instanceof Error ? error : new Error(String(error)),
              `parse:${data.characteristic}`
            );
          }
        }
      )
    );

    // Disconnect event
    this.nativeSubscriptions.push(
      this.eventEmitter.addListener(
        'BleManagerDisconnectPeripheral',
        (data: { peripheral: string }) => {
          const ctx = this.devices.get(data.peripheral);
          if (!ctx) return;

          const prevState = ctx.stateMachine.state;

          // If we were in Ready state, this is an unexpected disconnect
          if (prevState === ConnectionState.Ready) {
            ctx.stateMachine.tryTransition(ConnectionState.ConnectionLost);
            this.emitConnectionStateChange(
              data.peripheral,
              ConnectionState.ConnectionLost,
              prevState
            );

            // Start auto-reconnection if configured
            if (ctx.connectOptions.autoReconnect) {
              ctx.stateMachine.tryTransition(ConnectionState.Reconnecting);
              this.emitConnectionStateChange(
                data.peripheral,
                ConnectionState.Reconnecting,
                ConnectionState.ConnectionLost
              );

              ctx.reconnectionManager.start(async () => {
                await this.connect(data.peripheral, ctx.connectOptions);
              });
            }
          } else if (
            ctx.stateMachine.canTransitionTo(ConnectionState.Disconnected)
          ) {
            ctx.stateMachine.tryTransition(ConnectionState.Disconnected);
            this.emitConnectionStateChange(
              data.peripheral,
              ConnectionState.Disconnected,
              prevState
            );
          }
        }
      )
    );
  }

  private parseServices(peripheralInfo: {
    services?: Array<{ uuid: string }>;
    characteristics?: Array<{
      service: string;
      characteristic: string;
      properties: Record<string, unknown>;
      descriptors?: Array<{ uuid: string }>;
    }>;
  }): BleService[] {
    const serviceMap = new Map<string, BleService>();

    for (const svc of peripheralInfo.services ?? []) {
      serviceMap.set(svc.uuid, {
        uuid: svc.uuid,
        characteristics: [],
      });
    }

    for (const char of peripheralInfo.characteristics ?? []) {
      let service = serviceMap.get(char.service);
      if (!service) {
        service = { uuid: char.service, characteristics: [] };
        serviceMap.set(char.service, service);
      }

      const characteristic: BleCharacteristic = {
        uuid: char.characteristic,
        serviceUUID: char.service,
        properties: {
          read: !!char.properties?.Read,
          write: !!char.properties?.Write,
          writeWithoutResponse: !!char.properties?.WriteWithoutResponse,
          notify: !!char.properties?.Notify,
          indicate: !!char.properties?.Indicate,
        },
        descriptors: char.descriptors?.map((d) => ({
          uuid: d.uuid,
          characteristicUUID: char.characteristic,
          serviceUUID: char.service,
        })),
      };

      service.characteristics.push(characteristic);
    }

    return Array.from(serviceMap.values());
  }

  private toBleDevice(ctx: DeviceContext): BleDevice {
    return {
      id: ctx.id,
      name: ctx.name,
      rssi: ctx.rssi,
      mtu: ctx.mtu,
      services: ctx.services,
      state: ctx.stateMachine.state,
    };
  }

  private emitConnectionStateChange(
    deviceId: string,
    state: ConnectionState,
    prevState: ConnectionState
  ): void {
    this.emit('onConnectionStateChange', deviceId, state, prevState);
  }

  private emit<K extends EventKey>(
    event: K,
    ...args: Parameters<EventCallback<K>>
  ): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;
    for (const cb of callbacks) {
      try {
        (cb as (...a: unknown[]) => void)(...args);
      } catch {
        // Don't let listener errors propagate
      }
    }
  }
}

/**
 * Singleton instance. Import and use directly:
 *
 * ```ts
 * import { peripheralManager } from '@peripheral/ble-core';
 *
 * await peripheralManager.initialize();
 * const device = await peripheralManager.connect(deviceId);
 * ```
 */
export const peripheralManager = new PeripheralManager();
