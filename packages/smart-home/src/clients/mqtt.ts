/**
 * MQTT client for smart home integration.
 *
 * Wraps `mqtt.js` (optional peer dependency) with:
 * - Home Assistant MQTT discovery parsing
 * - Zigbee2MQTT device state management
 * - Typed topic subscriptions
 * - JSON payload auto-parsing
 * - Connection state management
 *
 * Requires `mqtt` npm package to be installed. Uses WebSocket transport
 * (`wss://`) which is required for React Native compatibility.
 *
 * @example
 * ```ts
 * const mqtt = new MQTTClient({
 *   brokerUrl: 'wss://192.168.1.100:8884/mqtt',
 *   username: 'homeassistant',
 *   password: 'secret',
 * });
 *
 * await mqtt.connect();
 *
 * // Subscribe to Zigbee2MQTT device
 * mqtt.subscribe('zigbee2mqtt/living_room_sensor', (msg) => {
 *   console.log('Temperature:', msg.payload.temperature);
 * });
 *
 * // Publish a command
 * mqtt.publish('zigbee2mqtt/bedroom_light/set', { state: 'ON', brightness: 200 });
 * ```
 */

import type {
  MQTTConnectionConfig,
  MQTTConnectionState,
  MQTTMessage,
  MQTTSubscription,
  HADiscoveryComponent,
  HADiscoveryConfigBase,
  Z2MDeviceState,
  Z2MBridgeInfo,
  Z2MDevice,
} from '../types';
import { EventEmitter, type Unsubscribe } from '../utils/event-emitter';

// ─── Events ──────────────────────────────────────────────────────────────────

interface MQTTClientEvents {
  connectionStateChanged: MQTTConnectionState;
  message: MQTTMessage;
  discoveryUpdate: {
    component: HADiscoveryComponent;
    nodeId: string;
    objectId: string;
    config: HADiscoveryConfigBase | null; // null = removal
  };
  z2mDeviceState: {
    friendlyName: string;
    state: Z2MDeviceState;
  };
  z2mBridgeInfo: Z2MBridgeInfo;
  z2mDeviceList: Z2MDevice[];
  error: Error;
}

// ─── Lazy mqtt.js import ─────────────────────────────────────────────────────

type MqttPacketLike = {
  qos?: 0 | 1 | 2;
  retain?: boolean;
  properties?: MQTTMessage['properties'];
};

type MqttClient = {
  on(event: 'connect' | 'reconnect' | 'close', handler: () => void): void;
  on(event: 'error', handler: (err: Error) => void): void;
  on(
    event: 'message',
    handler: (topic: string, payload: Buffer, packet: MqttPacketLike) => void,
  ): void;
  subscribe(topic: string, options: { qos: 0 | 1 | 2 }): void;
  publish(
    topic: string,
    payload: string,
    options: { qos: 0 | 1 | 2; retain: boolean },
  ): void;
  unsubscribe(topic: string): void;
  end(force: boolean, opts: Record<string, unknown>, cb: () => void): void;
};

type MqttConnectFn = (url: string, options: Record<string, unknown>) => MqttClient;

let mqttConnect: MqttConnectFn | null = null;

async function getMqttConnect(): Promise<MqttConnectFn> {
  if (mqttConnect) return mqttConnect;
  try {
    const mqtt = await import('mqtt');
    mqttConnect = (mqtt.default?.connect ?? mqtt.connect) as MqttConnectFn;
    return mqttConnect;
  } catch {
    throw new Error(
      '@peripheral/smart-home: MQTT support requires the "mqtt" package. ' +
        'Install it with: npm install mqtt',
    );
  }
}

// ─── Client ──────────────────────────────────────────────────────────────────

export class MQTTClient extends EventEmitter<MQTTClientEvents> {
  private config: MQTTConnectionConfig;
  private client: MqttClient | null = null;
  private _connectionState: MQTTConnectionState = 'disconnected' as MQTTConnectionState;
  private topicCallbacks = new Map<string, Set<(msg: MQTTMessage) => void>>();
  private discoveryPrefix = 'homeassistant';
  private z2mPrefix = 'zigbee2mqtt';

  constructor(config: MQTTConnectionConfig) {
    super();
    this.config = config;
  }

  // ─── Connection lifecycle ────────────────────────────────────────────────

  get connectionState(): MQTTConnectionState {
    return this._connectionState;
  }

  get isConnected(): boolean {
    return this._connectionState === ('connected' as MQTTConnectionState);
  }

  async connect(): Promise<void> {
    if (this.client) {
      throw new Error('Already connected. Call disconnect() first.');
    }

    const connect = await getMqttConnect();
    this.setConnectionState('connecting' as MQTTConnectionState);

    return new Promise((resolve, reject) => {
      const client = connect(this.config.brokerUrl, {
        clientId: this.config.clientId ?? `peripheral_${Date.now().toString(36)}`,
        username: this.config.username,
        password: this.config.password,
        clean: this.config.clean ?? true,
        keepalive: this.config.keepalive ?? 60,
        reconnectPeriod: this.config.reconnectPeriod ?? 1000,
        connectTimeout: this.config.connectTimeout ?? 30_000,
        protocolVersion: this.config.protocolVersion ?? 5,
        will: this.config.will,
      });

      this.client = client;

      client.on('connect', () => {
        this.setConnectionState('connected' as MQTTConnectionState);
        resolve();
      });

      client.on('reconnect', () => {
        this.setConnectionState('reconnecting' as MQTTConnectionState);
      });

      client.on('close', () => {
        this.setConnectionState('disconnected' as MQTTConnectionState);
      });

      client.on('error', (err: Error) => {
        this.setConnectionState('error' as MQTTConnectionState);
        this.emit('error', err);
        if (!this.isConnected) reject(err);
      });

      client.on('message', (topic: string, payload: Buffer, packet: MqttPacketLike) => {
        this.handleMessage(topic, payload, packet);
      });
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.client) {
        resolve();
        return;
      }

      this.client.end(false, {}, () => {
        this.client = null;
        this.topicCallbacks.clear();
        this.setConnectionState('disconnected' as MQTTConnectionState);
        resolve();
      });
    });
  }

  // ─── Subscribe / Publish ────────────────────────────────────────────────

  /**
   * Subscribe to a topic with a typed callback.
   * Payload is auto-parsed as JSON when possible.
   */
  subscribe(
    topic: string,
    callback: (msg: MQTTMessage) => void,
    qos: 0 | 1 | 2 = 0,
  ): Unsubscribe {
    this.requireConnection();

    if (!this.topicCallbacks.has(topic)) {
      this.topicCallbacks.set(topic, new Set());
      this.client!.subscribe(topic, { qos });
    }

    this.topicCallbacks.get(topic)!.add(callback);

    return () => {
      const callbacks = this.topicCallbacks.get(topic);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.topicCallbacks.delete(topic);
          this.client?.unsubscribe(topic);
        }
      }
    };
  }

  /**
   * Subscribe to multiple topics at once.
   */
  subscribeMany(
    subscriptions: MQTTSubscription[],
    callback: (msg: MQTTMessage) => void,
  ): Unsubscribe {
    const unsubs = subscriptions.map((sub) =>
      this.subscribe(sub.topic, callback, sub.qos ?? 0),
    );
    return () => unsubs.forEach((u) => u());
  }

  /**
   * Publish a message. Objects are auto-serialized to JSON.
   */
  publish(
    topic: string,
    payload: string | Record<string, unknown>,
    options?: { qos?: 0 | 1 | 2; retain?: boolean },
  ): void {
    this.requireConnection();

    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    this.client!.publish(topic, data, {
      qos: options?.qos ?? 0,
      retain: options?.retain ?? false,
    });
  }

  /**
   * Unsubscribe from a topic entirely (removes all callbacks).
   */
  unsubscribe(topic: string): void {
    this.topicCallbacks.delete(topic);
    this.client?.unsubscribe(topic);
  }

  // ─── HA MQTT Discovery ──────────────────────────────────────────────────

  /**
   * Subscribe to Home Assistant MQTT discovery messages.
   * Parses discovery configs as they arrive.
   */
  subscribeDiscovery(prefix?: string): Unsubscribe {
    const p = prefix ?? this.discoveryPrefix;
    return this.subscribe(`${p}/+/+/+/config`, (msg) => {
      this.handleDiscoveryMessage(msg, p);
    });
  }

  // ─── Zigbee2MQTT ────────────────────────────────────────────────────────

  /**
   * Subscribe to Zigbee2MQTT bridge and device state updates.
   */
  subscribeZ2M(prefix?: string): Unsubscribe {
    const p = prefix ?? this.z2mPrefix;

    const unsubs = [
      // Bridge info
      this.subscribe(`${p}/bridge/info`, (msg) => {
        const info = this.parseJSON<Z2MBridgeInfo>(msg.payload);
        if (info) this.emit('z2mBridgeInfo', info);
      }),

      // Device list
      this.subscribe(`${p}/bridge/devices`, (msg) => {
        const devices = this.parseJSON<Z2MDevice[]>(msg.payload);
        if (devices) this.emit('z2mDeviceList', devices);
      }),

      // All device state updates (wildcard excluding bridge)
      this.subscribe(`${p}/+`, (msg) => {
        // Skip bridge topics
        const parts = msg.topic.split('/');
        const friendlyName = parts[parts.length - 1]!;
        if (friendlyName === 'bridge') return;

        const state = this.parseJSON<Z2MDeviceState>(msg.payload);
        if (state) {
          this.emit('z2mDeviceState', { friendlyName, state });
        }
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }

  /**
   * Send a command to a Zigbee2MQTT device.
   */
  z2mSetState(
    friendlyName: string,
    state: Partial<Z2MDeviceState>,
    prefix?: string,
  ): void {
    this.publish(`${prefix ?? this.z2mPrefix}/${friendlyName}/set`, state);
  }

  /**
   * Get Zigbee2MQTT device state (request).
   */
  z2mGetState(friendlyName: string, prefix?: string): void {
    this.publish(`${prefix ?? this.z2mPrefix}/${friendlyName}/get`, {
      state: '',
    });
  }

  /**
   * Send a Zigbee2MQTT bridge command (permit_join, restart, etc.).
   */
  z2mBridgeRequest(
    command: string,
    payload?: Record<string, unknown>,
    prefix?: string,
  ): void {
    this.publish(
      `${prefix ?? this.z2mPrefix}/bridge/request/${command}`,
      payload ?? {},
    );
  }

  // ─── Internals ──────────────────────────────────────────────────────────

  private handleMessage(topic: string, payload: Buffer, packet: MqttPacketLike): void {
    const msg: MQTTMessage = {
      topic,
      payload: payload.toString('utf-8'),
      qos: packet.qos ?? 0,
      retain: packet.retain ?? false,
      properties: packet.properties,
    };

    // Emit global message event
    this.emit('message', msg);

    // Call topic-specific callbacks (exact match)
    this.topicCallbacks.get(topic)?.forEach((cb) => cb(msg));

    // Call wildcard matches
    for (const [pattern, callbacks] of this.topicCallbacks) {
      if (pattern !== topic && this.topicMatches(pattern, topic)) {
        callbacks.forEach((cb) => cb(msg));
      }
    }
  }

  private handleDiscoveryMessage(msg: MQTTMessage, prefix: string): void {
    // Parse topic: homeassistant/<component>/<nodeID>/<objectID>/config
    const withoutPrefix = msg.topic.slice(prefix.length + 1);
    const parts = withoutPrefix.split('/');
    if (parts.length < 4 || parts[parts.length - 1] !== 'config') return;

    const component = parts[0] as HADiscoveryComponent;
    const nodeId = parts[1]!;
    const objectId = parts[2]!;

    // Empty payload = removal
    if (!msg.payload || msg.payload.trim() === '') {
      this.emit('discoveryUpdate', { component, nodeId, objectId, config: null });
      return;
    }

    const config = this.parseJSON<HADiscoveryConfigBase>(msg.payload);
    if (config) {
      this.emit('discoveryUpdate', { component, nodeId, objectId, config });
    }
  }

  /** MQTT topic wildcard matching (supports + and #). */
  private topicMatches(pattern: string, topic: string): boolean {
    const patternParts = pattern.split('/');
    const topicParts = topic.split('/');

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === '#') return true;
      if (patternParts[i] === '+') continue;
      if (i >= topicParts.length || patternParts[i] !== topicParts[i]) return false;
    }

    return patternParts.length === topicParts.length;
  }

  private parseJSON<T>(payload: string): T | null {
    try {
      return JSON.parse(payload) as T;
    } catch {
      return null;
    }
  }

  private setConnectionState(state: MQTTConnectionState): void {
    if (this._connectionState !== state) {
      this._connectionState = state;
      this.emit('connectionStateChanged', state);
    }
  }

  private requireConnection(): void {
    if (!this.client) {
      throw new Error('Not connected to MQTT broker. Call connect() first.');
    }
  }
}
