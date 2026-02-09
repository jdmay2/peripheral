const mockBleManager = {
  start: jest.fn(),
  checkState: jest.fn(),
};

class MockNativeEventEmitter {
  constructor() {
    this.listeners = new Map();
  }

  addListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return {
      remove: () => {
        this.listeners.get(event)?.delete(callback);
      },
    };
  }

  emit(event, payload) {
    for (const callback of this.listeners.get(event) ?? []) {
      callback(payload);
    }
  }

  clear() {
    this.listeners.clear();
  }
}

const mockEmitter = new MockNativeEventEmitter();

jest.mock('react-native', () => ({
  NativeEventEmitter: jest.fn(() => mockEmitter),
  NativeModules: { BleManager: {} },
  Platform: { OS: 'ios' },
}));

jest.mock('react-native-ble-manager', () => ({
  __esModule: true,
  default: mockBleManager,
}));

const { PeripheralManager } = require('../lib/commonjs/core/manager');
const { AdapterState } = require('../lib/commonjs/types/ble');

describe('PeripheralManager adapter state events', () => {
  beforeEach(() => {
    mockEmitter.clear();
    jest.clearAllMocks();
  });

  it('emits an initial adapter state from checkState()', async () => {
    mockBleManager.start.mockResolvedValue(undefined);
    mockBleManager.checkState.mockResolvedValue({ state: 'on' });

    const manager = new PeripheralManager();
    const states = [];
    manager.on('onAdapterStateChange', (state) => states.push(state));

    await manager.initialize();

    expect(mockBleManager.start).toHaveBeenCalledTimes(1);
    expect(mockBleManager.checkState).toHaveBeenCalledTimes(1);
    expect(states).toEqual([AdapterState.PoweredOn]);

    manager.destroy();
  });

  it('normalizes native adapter state updates from emitter events', async () => {
    mockBleManager.start.mockResolvedValue(undefined);
    mockBleManager.checkState.mockResolvedValue(undefined);

    const manager = new PeripheralManager();
    const states = [];
    manager.on('onAdapterStateChange', (state) => states.push(state));

    await manager.initialize();

    mockEmitter.emit('BleManagerDidUpdateState', { state: 'off' });
    mockEmitter.emit('BleManagerDidUpdateState', 'turning_on');

    expect(states).toEqual([
      AdapterState.PoweredOff,
      AdapterState.Resetting,
    ]);

    manager.destroy();
  });
});
