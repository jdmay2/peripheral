/**
 * Home Assistant WebSocket client.
 *
 * Wraps the official `home-assistant-js-websocket` package with:
 * - Typed entity management via SmartHomeEntity
 * - Real-time state change subscriptions
 * - Area/device/entity registry queries
 * - Auto-reconnection (handled by upstream lib)
 * - Service call helpers
 *
 * @example
 * ```ts
 * const ha = new HomeAssistantClient({
 *   url: 'http://192.168.1.100:8123',
 *   auth: { type: 'longLivedToken', token: 'eyJ...' },
 * });
 *
 * await ha.connect();
 *
 * // Subscribe to all state changes
 * ha.onStateChanged((event) => {
 *   console.log(`${event.entityId}: ${event.newState?.state}`);
 * });
 *
 * // Control a light
 * await ha.callService('light', 'turn_on', {
 *   target: { entityId: 'light.living_room' },
 *   serviceData: { brightness: 200 },
 * });
 *
 * // Get all entities
 * const entities = ha.getEntities();
 * ```
 */

import {
  createConnection,
  createLongLivedTokenAuth,
  subscribeEntities,
  callService,
  getStates,
  type Connection,
  type HassEntities,
  type HassEntity,
  ERR_HASS_HOST_REQUIRED,
  ERR_INVALID_AUTH,
  ERR_CONNECTION_LOST,
  ERR_CANNOT_CONNECT,
  ERR_INVALID_HTTPS_TO_HTTP,
} from 'home-assistant-js-websocket';

import type {
  HAConnectionConfig,
  HAConnectionState,
  HAAreaEntry,
  HADeviceEntry,
  HAEntityEntry,
  HAConfig,
  HAServiceDomain,
  SmartHomeEntity,
  SmartHomeArea,
  SmartHomeDevice,
  StateChangedEvent,
  ServiceCall,
  ServiceTarget,
} from '../types';
import { EventEmitter, type Unsubscribe } from '../utils/event-emitter';
import { haStateToEntity, parseStateChangedEvent } from '../utils/entities';

// ─── Events ──────────────────────────────────────────────────────────────────

interface HAClientEvents {
  connectionStateChanged: HAConnectionState;
  stateChanged: StateChangedEvent;
  entitiesUpdated: Map<string, SmartHomeEntity>;
  error: Error;
}

// ─── Client ──────────────────────────────────────────────────────────────────

export class HomeAssistantClient extends EventEmitter<HAClientEvents> {
  private config: HAConnectionConfig;
  private connection: Connection | null = null;
  private entities = new Map<string, SmartHomeEntity>();
  private entitiesUnsubscribe: Unsubscribe | null = null;
  private _connectionState: HAConnectionState = 'disconnected' as HAConnectionState;
  private _haVersion: string | null = null;

  constructor(config: HAConnectionConfig) {
    super();
    this.config = config;
  }

  // ─── Connection lifecycle ────────────────────────────────────────────────

  get connectionState(): HAConnectionState {
    return this._connectionState;
  }

  get haVersion(): string | null {
    return this._haVersion;
  }

  get isConnected(): boolean {
    return this._connectionState === ('connected' as HAConnectionState);
  }

  async connect(): Promise<void> {
    if (this.connection) {
      throw new Error('Already connected. Call disconnect() first.');
    }

    this.setConnectionState('connecting' as HAConnectionState);

    try {
      let auth;
      if (this.config.auth.type === 'longLivedToken') {
        auth = createLongLivedTokenAuth(this.config.url, this.config.auth.token);
      } else {
        // For OAuth2, construct auth object manually
        auth = {
          wsUrl: `${this.config.url.replace('http', 'ws')}/api/websocket`,
          accessToken: this.config.auth.accessToken,
          expired: false,
          expires: Date.now() + 3600_000,
          refreshAccessToken: async () => {
            // OAuth2 refresh would go here
            throw new Error('OAuth2 token refresh not yet implemented');
          },
        } as any;
      }

      this.setConnectionState('authenticating' as HAConnectionState);

      const connection = await createConnection({ auth });

      this.connection = connection;
      this._haVersion = (connection as any).haVersion ?? null;

      // Set up reconnection handlers
      connection.addEventListener('ready', () => {
        this.setConnectionState('connected' as HAConnectionState);
      });

      connection.addEventListener('disconnected', () => {
        if (this.config.autoReconnect !== false) {
          this.setConnectionState('reconnecting' as HAConnectionState);
        } else {
          this.setConnectionState('disconnected' as HAConnectionState);
        }
      });

      connection.addEventListener('reconnect-error', () => {
        this.emit('error', new Error('Reconnection failed'));
      });

      // Subscribe to entity state updates
      this.subscribeToEntities();

      this.setConnectionState('connected' as HAConnectionState);
    } catch (err) {
      this.setConnectionState('error' as HAConnectionState);
      const error = this.mapConnectionError(err);
      this.emit('error', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.entitiesUnsubscribe) {
      this.entitiesUnsubscribe();
      this.entitiesUnsubscribe = null;
    }

    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }

    this.entities.clear();
    this.setConnectionState('disconnected' as HAConnectionState);
  }

  // ─── Entity management ──────────────────────────────────────────────────

  /** Get all tracked entities as a Map. */
  getEntities(): Map<string, SmartHomeEntity> {
    return new Map(this.entities);
  }

  /** Get a single entity by ID. */
  getEntity(entityId: string): SmartHomeEntity | undefined {
    return this.entities.get(entityId);
  }

  /** Get all entities matching a domain (e.g., 'light'). */
  getEntitiesByDomain(domain: string): SmartHomeEntity[] {
    const result: SmartHomeEntity[] = [];
    for (const entity of this.entities.values()) {
      if (entity.domain === domain) result.push(entity);
    }
    return result;
  }

  /** Subscribe to state changes for specific entity IDs. */
  onEntityStateChanged(
    entityIds: string | string[],
    callback: (event: StateChangedEvent) => void,
  ): Unsubscribe {
    const ids = new Set(Array.isArray(entityIds) ? entityIds : [entityIds]);
    return this.on('stateChanged', (event) => {
      if (ids.has(event.entityId)) callback(event);
    });
  }

  /** Subscribe to all state changes. */
  onStateChanged(callback: (event: StateChangedEvent) => void): Unsubscribe {
    return this.on('stateChanged', callback);
  }

  // ─── Service calls ──────────────────────────────────────────────────────

  /** Call a Home Assistant service. */
  async callService(
    domain: string,
    service: string,
    options?: {
      serviceData?: Record<string, unknown>;
      target?: ServiceTarget;
    },
  ): Promise<unknown> {
    this.requireConnection();

    const target = options?.target
      ? {
          entity_id: options.target.entityId,
          device_id: options.target.deviceId,
          area_id: options.target.areaId,
        }
      : undefined;

    return callService(
      this.connection!,
      domain,
      service,
      options?.serviceData,
      target as any,
    );
  }

  /** Execute a ServiceCall object (from the service-calls builders). */
  async executeServiceCall(call: ServiceCall): Promise<unknown> {
    return this.callService(call.domain, call.service, {
      serviceData: call.serviceData,
      target: call.target,
    });
  }

  // ─── Registry queries ───────────────────────────────────────────────────

  /** Fetch all areas from the area registry. */
  async getAreas(): Promise<SmartHomeArea[]> {
    this.requireConnection();
    const result = await this.sendCommand<HAAreaEntry[]>({
      type: 'config/area_registry/list',
    });
    return result.map((a) => ({
      areaId: a.area_id,
      name: a.name,
      floorId: a.floor_id ?? undefined,
      icon: a.icon ?? undefined,
      aliases: a.aliases,
    }));
  }

  /** Fetch all devices from the device registry. */
  async getDevices(): Promise<SmartHomeDevice[]> {
    this.requireConnection();
    const result = await this.sendCommand<HADeviceEntry[]>({
      type: 'config/device_registry/list',
    });
    return result.map((d) => ({
      deviceId: d.id,
      name: d.name_by_user ?? d.name ?? 'Unknown',
      manufacturer: d.manufacturer ?? undefined,
      model: d.model ?? undefined,
      swVersion: d.sw_version ?? undefined,
      hwVersion: d.hw_version ?? undefined,
      areaId: d.area_id ?? undefined,
      entityIds: [],
      connections: d.connections,
      identifiers: d.identifiers,
      viaDeviceId: d.via_device_id ?? undefined,
    }));
  }

  /** Fetch entity registry entries. */
  async getEntityRegistry(): Promise<HAEntityEntry[]> {
    this.requireConnection();
    return this.sendCommand<HAEntityEntry[]>({
      type: 'config/entity_registry/list',
    });
  }

  /** Fetch Home Assistant config. */
  async getConfig(): Promise<HAConfig> {
    this.requireConnection();
    return this.sendCommand<HAConfig>({ type: 'get_config' });
  }

  /** Fetch all available service definitions. */
  async getServices(): Promise<Record<string, HAServiceDomain>> {
    this.requireConnection();
    return this.sendCommand<Record<string, HAServiceDomain>>({
      type: 'get_services',
    });
  }

  /** Fetch states via REST-style get_states command. */
  async fetchAllStates(): Promise<SmartHomeEntity[]> {
    this.requireConnection();
    const states = await getStates(this.connection!);
    return states.map((s: any) => haStateToEntity(s as any));
  }

  // ─── WebSocket commands ─────────────────────────────────────────────────

  /** Subscribe to a specific event type. Returns unsubscribe function. */
  async subscribeEvents(
    eventType: string,
    callback: (eventData: Record<string, unknown>) => void,
  ): Promise<Unsubscribe> {
    this.requireConnection();

    const unsub = await this.connection!.subscribeEvents(
      (event: any) => callback(event.data),
      eventType,
    );

    return () => unsub();
  }

  /** Subscribe to trigger-based events. */
  async subscribeTrigger(
    trigger: Record<string, unknown>,
    callback: (event: Record<string, unknown>) => void,
  ): Promise<Unsubscribe> {
    this.requireConnection();

    const unsub = await this.connection!.subscribeMessage(
      (msg: any) => callback(msg),
      { type: 'subscribe_trigger', trigger },
    );

    return () => unsub();
  }

  /** Fire a custom event. */
  async fireEvent(
    eventType: string,
    eventData?: Record<string, unknown>,
  ): Promise<void> {
    this.requireConnection();
    await this.sendCommand({
      type: 'fire_event',
      event_type: eventType,
      event_data: eventData,
    });
  }

  /** Send a raw WebSocket command. */
  async sendCommand<T = unknown>(command: Record<string, unknown> & { type: string }): Promise<T> {
    this.requireConnection();
    return this.connection!.sendMessagePromise(command) as Promise<T>;
  }

  // ─── Internal ───────────────────────────────────────────────────────────

  private subscribeToEntities(): void {
    if (!this.connection) return;

    // subscribeEntities provides efficient delta-based entity tracking
    const unsub = subscribeEntities(this.connection, (hassEntities: HassEntities) => {
      const previousEntities = new Map(this.entities);
      this.entities.clear();

      for (const [entityId, hassEntity] of Object.entries(hassEntities)) {
        const entity = this.hassEntityToSmartHome(hassEntity);
        this.entities.set(entityId, entity);

        // Detect state changes
        const previous = previousEntities.get(entityId);
        if (
          previous &&
          (previous.state !== entity.state ||
            previous.lastUpdated !== entity.lastUpdated)
        ) {
          this.emit('stateChanged', {
            entityId,
            newState: entity,
            oldState: previous,
          });
        } else if (!previous) {
          // New entity appeared
          this.emit('stateChanged', {
            entityId,
            newState: entity,
            oldState: null,
          });
        }
      }

      // Detect removed entities
      for (const [entityId, previous] of previousEntities) {
        if (!this.entities.has(entityId)) {
          this.emit('stateChanged', {
            entityId,
            newState: null,
            oldState: previous,
          });
        }
      }

      this.emit('entitiesUpdated', new Map(this.entities));
    });

    // subscribeEntities returns an unsubscribe function directly
    this.entitiesUnsubscribe = unsub as any;
  }

  private hassEntityToSmartHome(hassEntity: HassEntity): SmartHomeEntity {
    return haStateToEntity({
      entity_id: hassEntity.entity_id,
      state: hassEntity.state,
      attributes: hassEntity.attributes,
      last_changed: hassEntity.last_changed,
      last_updated: hassEntity.last_updated,
      context: hassEntity.context,
    });
  }

  private setConnectionState(state: HAConnectionState): void {
    if (this._connectionState !== state) {
      this._connectionState = state;
      this.emit('connectionStateChanged', state);
    }
  }

  private requireConnection(): void {
    if (!this.connection) {
      throw new Error('Not connected to Home Assistant. Call connect() first.');
    }
  }

  private mapConnectionError(err: unknown): Error {
    if (typeof err === 'number') {
      switch (err) {
        case ERR_HASS_HOST_REQUIRED:
          return new Error('Home Assistant host URL is required');
        case ERR_INVALID_AUTH:
          return new Error('Invalid authentication credentials');
        case ERR_CONNECTION_LOST:
          return new Error('Connection to Home Assistant lost');
        case ERR_CANNOT_CONNECT:
          return new Error('Cannot connect to Home Assistant');
        case ERR_INVALID_HTTPS_TO_HTTP:
          return new Error('Cannot connect from HTTPS to HTTP');
        default:
          return new Error(`Home Assistant connection error: code ${err}`);
      }
    }
    return err instanceof Error ? err : new Error(String(err));
  }
}
