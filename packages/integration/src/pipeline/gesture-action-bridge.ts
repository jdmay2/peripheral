/**
 * Gesture-Action Bridge: gesture events -> smart home service calls.
 *
 * Listens for accepted gesture recognition events and executes
 * corresponding Home Assistant service calls with per-gesture
 * and global cooldowns.
 */

import type { GestureEngine, RecognitionResult } from '@peripheral/gesture-engine';
import type { HomeAssistantClient, ServiceCall } from '@peripheral/smart-home';
import type {
  GestureActionBridgeConfig,
  GestureActionBridgeHandle,
  GestureActionBridgeStatus,
  GestureActionMap,
} from '../types';

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
  let destroyed = false;

  const lastGestureActionTime = new Map<string, number>();

  // ─── Gesture handler ──────────────────────────────────────────────────

  const handleResult = (result: RecognitionResult): void => {
    if (destroyed) return;
    if (acceptedOnly && !result.accepted) return;
    if (!result.gestureId) return;

    const gestureId = result.gestureId;
    const calls = actionMap[gestureId];
    if (!calls) {
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

    // Execute action(s)
    const callArray = Array.isArray(calls) ? calls : [calls];
    for (const call of callArray) {
      executeAction(gestureId, call);
    }

    lastActionTimestamp = now;
    lastGestureId = gestureId;
    lastGestureActionTime.set(gestureId, now);
  };

  async function executeAction(gestureId: string, call: ServiceCall): Promise<void> {
    try {
      await haClient.executeServiceCall(call);
      actionsExecuted++;
      onActionExecuted?.(gestureId, call);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      onActionError?.(gestureId, error);
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
    }),
  };
}
