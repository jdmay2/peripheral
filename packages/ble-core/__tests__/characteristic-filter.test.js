describe('useCharacteristic notification filtering', () => {
  function setupHook() {
    jest.resetModules();

    const setValue = jest.fn();
    const setRawValue = jest.fn();
    let notificationHandler = null;
    let stateCall = 0;

    jest.doMock('react', () => ({
      useState: jest.fn((initialValue) => {
        stateCall += 1;
        if (stateCall === 1) return [initialValue, setValue];
        if (stateCall === 2) return [initialValue, setRawValue];
        return [initialValue, jest.fn()];
      }),
      useCallback: (fn) => fn,
      useEffect: (effect) => {
        effect();
      },
      useRef: (value) => ({ current: value }),
    }));

    jest.doMock('../lib/commonjs/core/manager', () => ({
      peripheralManager: {
        on: jest.fn((_event, callback) => {
          notificationHandler = callback;
          return jest.fn();
        }),
        startNotifications: jest.fn(),
        stopNotifications: jest.fn(),
        readParsed: jest.fn(),
        write: jest.fn(),
        writeWithoutResponse: jest.fn(),
      },
    }));

    jest.doMock('../lib/commonjs/types/gatt', () => ({
      uuidsMatch: (left, right) => left === right,
    }));

    jest.doMock('../lib/commonjs/utils/bytes', () => ({
      toDataView: () => ({}),
    }));

    jest.doMock('../lib/commonjs/parsers/registry', () => ({
      autoParse: () => undefined,
    }));

    const { useCharacteristic } = require('../lib/commonjs/hooks/use-characteristic');
    useCharacteristic('device-1', 'service-1', 'char-1', { autoSubscribe: false });

    return { notificationHandler, setRawValue };
  }

  it('ignores notifications when service UUID does not match', () => {
    const { notificationHandler, setRawValue } = setupHook();

    notificationHandler({
      deviceId: 'device-1',
      serviceUUID: 'service-other',
      characteristicUUID: 'char-1',
      value: [1, 2, 3],
    });

    expect(setRawValue).not.toHaveBeenCalled();
  });

  it('accepts notifications only when device + service + characteristic all match', () => {
    const { notificationHandler, setRawValue } = setupHook();

    notificationHandler({
      deviceId: 'device-1',
      serviceUUID: 'service-1',
      characteristicUUID: 'char-1',
      value: [4, 5, 6],
    });

    expect(setRawValue).toHaveBeenCalledWith([4, 5, 6]);
  });
});
