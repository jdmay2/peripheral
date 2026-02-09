const { createGestureActionBridge } = require('../lib/commonjs/pipeline/gesture-action-bridge');

function createMockEngine() {
  const listeners = new Map();
  return {
    on(event, callback) {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event).add(callback);
      return () => {
        listeners.get(event)?.delete(callback);
      };
    },
    emit(event, payload) {
      for (const callback of listeners.get(event) ?? []) {
        callback(payload);
      }
    },
  };
}

describe('createGestureActionBridge', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('enforces cooldowns and tracks executed/skipped action history', async () => {
    const engine = createMockEngine();
    const haClient = { executeServiceCall: jest.fn().mockResolvedValue(undefined) };

    const bridge = createGestureActionBridge(engine, haClient, {
      actionMap: {
        shake: { domain: 'light', service: 'toggle' },
      },
      cooldownMs: 2000,
      globalCooldownMs: 500,
    });

    const result = { accepted: true, gestureId: 'shake' };

    engine.emit('gesture', result);
    await Promise.resolve();

    engine.emit('gesture', result);
    await Promise.resolve();

    jest.setSystemTime(new Date('2026-01-01T00:00:03.000Z'));
    engine.emit('gesture', result);
    await Promise.resolve();

    expect(haClient.executeServiceCall).toHaveBeenCalledTimes(2);

    const status = bridge.getStatus();
    expect(status.actionsExecuted).toBe(2);
    expect(status.actionsSkipped).toBe(1);
    expect(status.recentActions).toHaveLength(2);
    expect(status.recentActions[0].serviceCall.domain).toBe('light');
    expect(status.recentActions[1].serviceCall.service).toBe('toggle');

    bridge.destroy();
    engine.emit('gesture', result);
    await Promise.resolve();
    expect(haClient.executeServiceCall).toHaveBeenCalledTimes(2);
  });
});
