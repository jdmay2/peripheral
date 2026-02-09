/**
 * Gesture-Action Bridge: gesture events -> smart home service calls.
 *
 * Listens for accepted gesture recognition events and executes
 * corresponding Home Assistant service calls with per-gesture
 * and global cooldowns.
 *
 * Supports conditional actions via GestureActionEntry, maintains
 * a recent action history, and tracks execution latency.
 */

import type { GestureEngine, RecognitionResult } from '@peripherals/gesture-engine';
import type { HomeAssistantClient, ServiceCall } from '@peripherals/smart-home';
import type {
  GestureActionBridgeConfig,
  GestureActionBridgeHandle,
  GestureActionBridgeStatus,
  GestureActionMap,
  GestureActionEntry,
  ActionHistoryEntry,
} from '../types';

/** Type guard: is the action map entry a GestureActionEntry (has `action` property)? */
function isGestureActionEntry(
  entry: ServiceCall | ServiceCall[] | GestureActionEntry,
): entry is GestureActionEntry {
  return (
    typeof entry === 'object' &&
    !Array.isArray(entry) &&
    'action' in entry
  );
}

const MAX_HISTORY = 20;

export function createGestureActionBridge(
  engine: GestureEngine,
  haClient: HomeAssistantClient,
  config: GestureActionBridgeConfig,
): GestureActionBridgeHandle {
  const {
    cooldownMs = 2000,
    globalCooldownMs = 500,
    acceptedOnly = true,
    onBeforeAction,
    onActionExecuted,
    onActionError,
  } = config;

  let actionMap: GestureActionMap = { ...config.actionMap };
  let actionsExecuted = 0;
  let actionsSkipped = 0;
  let lastActionTimestamp: number | null = null;
  let lastGestureId: string | null = null;
  let lastActionExecutionMs: number | null = null;
  let destroyed = false;

  const recentActions: ActionHistoryEntry[] = [];
  const lastGestureActionTime = new Map<string, number>();

  // ─── Gesture handler ──────────────────────────────────────────────────

  const handleResult = (result: RecognitionResult): void => {
    if (destroyed) return;
    if (acceptedOnly && !result.accepted) return;
    if (!result.gestureId) return;

    const gestureId = result.gestureId;
    const mapEntry = actionMap[gestureId];
    if (!mapEntry) {
      actionsSkipped++;
      return;
    }

    const now = Date.now();

    // Global cooldown
    if (lastActionTimestamp !== null && now - lastActionTimestamp < globalCooldownMs) {
      actionsSkipped++;
      return;
    }

    // Per-gesture cooldown
    const lastTime = lastGestureActionTime.get(gestureId);
    if (lastTime !== undefined && now - lastTime < cooldownMs) {
      actionsSkipped++;
      return;
    }

    // Before-action hook
    if (onBeforeAction && !onBeforeAction(gestureId, result)) {
      actionsSkipped++;
      return;
    }

    // Resolve the service calls from the map entry
    let calls: ServiceCall[];
    if (isGestureActionEntry(mapEntry)) {
      // Check condition guard
      if (mapEntry.condition && !mapEntry.condition(gestureId, result)) {
        actionsSkipped++;
        return;
      }
      calls = Array.isArray(mapEntry.action) ? mapEntry.action : [mapEntry.action];
    } else {
      calls = Array.isArray(mapEntry) ? mapEntry : [mapEntry];
    }

    // Execute action(s)
    for (const call of calls) {
      executeAction(gestureId, call);
    }

    lastActionTimestamp = now;
    lastGestureId = gestureId;
    lastGestureActionTime.set(gestureId, now);
  };

  async function executeAction(gestureId: string, call: ServiceCall): Promise<void> {
    const startTime = Date.now();
    try {
      await haClient.executeServiceCall(call);
      const elapsed = Date.now() - startTime;
      lastActionExecutionMs = elapsed;
      actionsExecuted++;
      onActionExecuted?.(gestureId, call);

      // Record in history
      recordAction(gestureId, call, true);
    } catch (err) {
      lastActionExecutionMs = Date.now() - startTime;
      const error = err instanceof Error ? err : new Error(String(err));
      onActionError?.(gestureId, error);

      // Record failure in history
      recordAction(gestureId, call, false);
    }
  }

  function recordAction(gestureId: string, serviceCall: ServiceCall, success: boolean): void {
    recentActions.push({
      gestureId,
      serviceCall,
      timestamp: Date.now(),
      success,
    });
    // Keep circular buffer bounded
    while (recentActions.length > MAX_HISTORY) {
      recentActions.shift();
    }
  }

  // ─── Wire up ──────────────────────────────────────────────────────────

  const eventName = acceptedOnly ? 'gesture' : 'result';
  const unsub = engine.on(eventName, handleResult);

  // ─── Handle ───────────────────────────────────────────────────────────

  return {
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      unsub();
    },

    updateActionMap: (map: GestureActionMap) => {
      actionMap = { ...map };
    },

    getStatus: (): GestureActionBridgeStatus => ({
      actionsExecuted,
      actionsSkipped,
      lastActionTimestamp,
      lastGestureId,
      recentActions: [...recentActions],
      lastActionExecutionMs,
    }),
  };
}
