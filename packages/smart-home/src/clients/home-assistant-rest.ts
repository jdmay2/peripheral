/**
 * Home Assistant REST API client.
 *
 * Complements the WebSocket client for operations better suited to HTTP:
 * - History queries
 * - Logbook entries
 * - Template rendering
 * - Camera proxies
 * - Check API health
 *
 * The WebSocket client should be preferred for real-time operations
 * (state subscriptions, service calls). Use REST for stateless queries.
 *
 * @example
 * ```ts
 * const rest = new HomeAssistantRest({
 *   url: 'http://192.168.1.100:8123',
 *   token: 'eyJ...',
 * });
 *
 * // Check if HA is running
 * const ok = await rest.checkApi();
 *
 * // Get history for an entity
 * const history = await rest.getHistory('sensor.temperature', {
 *   start: '2025-01-01T00:00:00Z',
 *   end: '2025-01-02T00:00:00Z',
 * });
 * ```
 */

import type { HAState, HAConfig, HAHistoryEntry } from '../types';

// ─── Config ──────────────────────────────────────────────────────────────────

export interface HARestConfig {
  /** Home Assistant base URL (e.g., "http://192.168.1.100:8123") */
  url: string;
  /** Long-Lived Access Token */
  token: string;
  /** Request timeout in ms (default: 10000) */
  timeout?: number;
}

// ─── Client ──────────────────────────────────────────────────────────────────

export class HomeAssistantRest {
  private baseUrl: string;
  private token: string;
  private timeout: number;

  constructor(config: HARestConfig) {
    this.baseUrl = config.url.replace(/\/+$/, '');
    this.token = config.token;
    this.timeout = config.timeout ?? 10_000;
  }

  // ─── API health ─────────────────────────────────────────────────────────

  /** Check if the HA API is reachable. Returns true if running. */
  async checkApi(): Promise<boolean> {
    try {
      const res = await this.get<{ message: string }>('/api/');
      return res.message === 'API running.';
    } catch {
      return false;
    }
  }

  // ─── States ─────────────────────────────────────────────────────────────

  /** Get all entity states. */
  async getStates(): Promise<HAState[]> {
    return this.get<HAState[]>('/api/states');
  }

  /** Get state for a single entity. */
  async getState(entityId: string): Promise<HAState> {
    return this.get<HAState>(`/api/states/${entityId}`);
  }

  // ─── Config ─────────────────────────────────────────────────────────────

  /** Get Home Assistant configuration. */
  async getConfig(): Promise<HAConfig> {
    return this.get<HAConfig>('/api/config');
  }

  // ─── Services ───────────────────────────────────────────────────────────

  /** Call a service via REST. */
  async callService(
    domain: string,
    service: string,
    data?: Record<string, unknown>,
  ): Promise<HAState[]> {
    return this.post<HAState[]>(
      `/api/services/${domain}/${service}`,
      data ?? {},
    );
  }

  // ─── History ────────────────────────────────────────────────────────────

  /**
   * Get state history for entities.
   *
   * @param entityId - Optional entity ID to filter (comma-separated for multiple)
   * @param options - Time range and filtering options
   */
  async getHistory(
    entityId?: string,
    options?: {
      /** ISO 8601 start timestamp */
      start?: string;
      /** ISO 8601 end timestamp */
      end?: string;
      /** Minimal response (skip attributes, default: true) */
      minimalResponse?: boolean;
      /** Skip state of "not changed" (default: true) */
      significantChangesOnly?: boolean;
      /** Max number of results per entity */
      noAttributes?: boolean;
    },
  ): Promise<HAHistoryEntry[][]> {
    const params = new URLSearchParams();
    if (entityId) params.set('filter_entity_id', entityId);
    if (options?.end) params.set('end_time', options.end);
    if (options?.minimalResponse !== false) params.set('minimal_response', '');
    if (options?.significantChangesOnly !== false) params.set('significant_changes_only', '');
    if (options?.noAttributes) params.set('no_attributes', '');

    const timestamp = options?.start ?? new Date(Date.now() - 86400_000).toISOString();
    const query = params.toString();
    return this.get<HAHistoryEntry[][]>(
      `/api/history/period/${timestamp}${query ? `?${query}` : ''}`,
    );
  }

  // ─── Logbook ────────────────────────────────────────────────────────────

  /** Get logbook entries. */
  async getLogbook(options?: {
    start?: string;
    end?: string;
    entityId?: string;
  }): Promise<
    Array<{
      when: string;
      name: string;
      message: string;
      entity_id?: string;
      domain?: string;
    }>
  > {
    const params = new URLSearchParams();
    if (options?.entityId) params.set('entity', options.entityId);
    if (options?.end) params.set('end_time', options.end);

    const timestamp = options?.start ?? new Date(Date.now() - 86400_000).toISOString();
    const query = params.toString();
    return this.get(`/api/logbook/${timestamp}${query ? `?${query}` : ''}`);
  }

  // ─── Template ───────────────────────────────────────────────────────────

  /** Render a Jinja2 template on the HA server. */
  async renderTemplate(template: string): Promise<string> {
    return this.post<string>('/api/template', { template }, 'text');
  }

  // ─── Error log ──────────────────────────────────────────────────────────

  /** Get the HA error log as plain text. */
  async getErrorLog(): Promise<string> {
    return this.get<string>('/api/error_log', 'text');
  }

  // ─── Camera proxy ───────────────────────────────────────────────────────

  /** Get camera proxy image URL (add token as query param). */
  getCameraProxyUrl(entityId: string): string {
    return `${this.baseUrl}/api/camera_proxy/${entityId}?token=${this.token}`;
  }

  // ─── HTTP helpers ───────────────────────────────────────────────────────

  private async get<T>(path: string, responseType: 'json' | 'text' = 'json'): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'GET',
        headers: this.headers(),
        // AbortController.signal types clash between DOM and RN globals
        signal: controller.signal as unknown as NonNullable<RequestInit['signal']>,
      });

      if (!res.ok) {
        throw new Error(`HA REST error ${res.status}: ${await res.text()}`);
      }

      return responseType === 'text'
        ? ((await res.text()) as unknown as T)
        : ((await res.json()) as T);
    } finally {
      clearTimeout(timer);
    }
  }

  private async post<T>(
    path: string,
    body: unknown,
    responseType: 'json' | 'text' = 'json',
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
        // AbortController.signal types clash between DOM and RN globals
        signal: controller.signal as unknown as NonNullable<RequestInit['signal']>,
      });

      if (!res.ok) {
        throw new Error(`HA REST error ${res.status}: ${await res.text()}`);
      }

      return responseType === 'text'
        ? ((await res.text()) as unknown as T)
        : ((await res.json()) as T);
    } finally {
      clearTimeout(timer);
    }
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }
}
