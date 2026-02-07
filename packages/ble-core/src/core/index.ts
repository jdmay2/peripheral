export { CommandQueue } from './command-queue';
export { ConnectionStateMachine } from './state-machine';
export { ReconnectionManager } from './reconnection';
export { PeripheralManager, peripheralManager } from './manager';
export type { PeripheralManagerEvents } from './manager';
export type {
  ReconnectAttemptCallback,
  ReconnectSuccessCallback,
  ReconnectFailureCallback,
  ReconnectGiveUpCallback,
} from './reconnection';
export type { StateChangeListener } from './state-machine';
