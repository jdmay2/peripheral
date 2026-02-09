jest.mock('@peripherals/ble-core', () => {
  const ConnectionState = {
    Idle: 'idle',
    Connecting: 'connecting',
    Discovering: 'discovering',
    Ready: 'ready',
    Disconnecting: 'disconnecting',
    Disconnected: 'disconnected',
    ConnectionLost: 'connection_lost',
    Error: 'error',
  };

  return {
    ConnectionState,
    uuidsMatch: (left, right) => left === right,
  };
});

const { createIMUPipeline } = require('../lib/commonjs/pipeline/imu-pipeline');
const { ConnectionState } = require('@peripherals/ble-core');

describe('createIMUPipeline lifecycle', () => {
  it('subscribes, pauses/resumes, and re-subscribes on reconnect', async () => {
    const listeners = {};
    const manager = {
      on: jest.fn((event, callback) => {
        listeners[event] = callback;
        return () => {
          delete listeners[event];
        };
      }),
      startNotifications: jest.fn().mockResolvedValue(undefined),
      stopNotifications: jest.fn().mockResolvedValue(undefined),
      getDeviceState: jest.fn().mockReturnValue(ConnectionState.Ready),
    };
    const engine = { feedSamples: jest.fn() };
    const parser = jest.fn(() => [
      { ax: 1, ay: 2, az: 3, timestamp: Date.now() },
    ]);

    const pipeline = createIMUPipeline(manager, engine, {
      deviceId: 'device-1',
      serviceUUID: 'service-1',
      characteristicUUID: 'char-1',
      parser,
    });
    await Promise.resolve();

    expect(manager.startNotifications).toHaveBeenCalledTimes(1);
    expect(manager.startNotifications).toHaveBeenCalledWith(
      'device-1',
      'service-1',
      'char-1',
    );

    listeners.onRawNotification({
      deviceId: 'device-1',
      serviceUUID: 'service-1',
      characteristicUUID: 'char-1',
      value: [1, 2, 3],
    });
    expect(parser).toHaveBeenCalledTimes(1);
    expect(engine.feedSamples).toHaveBeenCalledTimes(1);

    listeners.onRawNotification({
      deviceId: 'device-1',
      serviceUUID: 'service-1',
      characteristicUUID: 'other-char',
      value: [4, 5, 6],
    });
    expect(engine.feedSamples).toHaveBeenCalledTimes(1);

    pipeline.pause();
    listeners.onRawNotification({
      deviceId: 'device-1',
      serviceUUID: 'service-1',
      characteristicUUID: 'char-1',
      value: [7, 8, 9],
    });
    expect(engine.feedSamples).toHaveBeenCalledTimes(1);

    pipeline.resume();
    listeners.onRawNotification({
      deviceId: 'device-1',
      serviceUUID: 'service-1',
      characteristicUUID: 'char-1',
      value: [10, 11, 12],
    });
    expect(engine.feedSamples).toHaveBeenCalledTimes(2);

    listeners.onConnectionStateChange(
      'device-1',
      ConnectionState.Disconnected,
      ConnectionState.Ready,
    );
    expect(pipeline.getStatus().isSubscribed).toBe(false);

    listeners.onConnectionStateChange(
      'device-1',
      ConnectionState.Ready,
      ConnectionState.Disconnected,
    );
    await Promise.resolve();
    expect(manager.startNotifications).toHaveBeenCalledTimes(2);

    pipeline.destroy();
    expect(manager.stopNotifications).toHaveBeenCalledWith(
      'device-1',
      'service-1',
      'char-1',
    );
  });
});
