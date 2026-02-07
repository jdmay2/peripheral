import { useState, useEffect, useCallback } from 'react';
import { HomeAssistantRest, type HARestConfig } from '../clients/home-assistant-rest';
import type { HAHistoryEntry } from '../types';

interface UseHistoryOptions {
  /** Entity ID to fetch history for. */
  entityId: string;
  /** Start time (ISO 8601). Defaults to 24 hours ago. */
  start?: string;
  /** End time (ISO 8601). Defaults to now. */
  end?: string;
  /** Auto-fetch on mount (default: true). */
  autoFetch?: boolean;
  /** Skip attributes in response (default: true, faster). */
  noAttributes?: boolean;
}

interface UseHistoryReturn {
  /** History entries for the entity. */
  history: HAHistoryEntry[];
  /** Whether history is being fetched. */
  isLoading: boolean;
  /** Fetch error. */
  error: Error | null;
  /** Manually trigger a fetch. */
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch entity state history from the HA REST API.
 *
 * @example
 * ```tsx
 * function TemperatureChart({ entityId }: { entityId: string }) {
 *   const { history, isLoading } = useHistory(restConfig, {
 *     entityId,
 *     start: new Date(Date.now() - 7 * 86400_000).toISOString(),
 *   });
 *
 *   if (isLoading) return <ActivityIndicator />;
 *   return <LineChart data={history.map(h => parseFloat(h.state))} />;
 * }
 * ```
 */
export function useHistory(
  restConfig: HARestConfig,
  options: UseHistoryOptions,
): UseHistoryReturn {
  const [history, setHistory] = useState<HAHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rest = new HomeAssistantRest(restConfig);
      const result = await rest.getHistory(options.entityId, {
        start: options.start,
        end: options.end,
        noAttributes: options.noAttributes !== false,
      });
      // getHistory returns array of arrays (one per entity)
      setHistory(result[0] ?? []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [restConfig.url, restConfig.token, options.entityId, options.start, options.end]);

  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchHistory();
    }
  }, [fetchHistory, options.autoFetch]);

  return { history, isLoading, error, refresh: fetchHistory };
}
