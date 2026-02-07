import { ConnectionState, VALID_TRANSITIONS } from '../types/ble';

export type StateChangeListener = (
  newState: ConnectionState,
  prevState: ConnectionState
) => void;

/**
 * Explicit connection state machine.
 *
 * Enforces valid state transitions and emits change events.
 * Invalid transitions throw — this surfaces bugs early rather than
 * letting the system reach inconsistent states.
 */
export class ConnectionStateMachine {
  private _state: ConnectionState = ConnectionState.Disconnected;
  private listeners = new Set<StateChangeListener>();

  get state(): ConnectionState {
    return this._state;
  }

  /**
   * Transition to a new state.
   * @throws If the transition is not valid from the current state.
   */
  transition(newState: ConnectionState): void {
    const validTargets = VALID_TRANSITIONS[this._state];
    if (!validTargets?.includes(newState)) {
      throw new Error(
        `Invalid BLE state transition: ${this._state} → ${newState}. ` +
          `Valid transitions from ${this._state}: [${validTargets?.join(', ') ?? 'none'}]`
      );
    }

    const prevState = this._state;
    this._state = newState;

    for (const listener of this.listeners) {
      try {
        listener(newState, prevState);
      } catch {
        // Don't let listener errors break the state machine
      }
    }
  }

  /**
   * Try to transition to a new state. Returns false if invalid
   * instead of throwing.
   */
  tryTransition(newState: ConnectionState): boolean {
    try {
      this.transition(newState);
      return true;
    } catch {
      return false;
    }
  }

  /** Force-reset to Disconnected state (e.g., on fatal error). */
  forceReset(): void {
    const prevState = this._state;
    this._state = ConnectionState.Disconnected;
    for (const listener of this.listeners) {
      try {
        listener(ConnectionState.Disconnected, prevState);
      } catch {
        // swallow
      }
    }
  }

  /** Check if a transition to the given state would be valid */
  canTransitionTo(state: ConnectionState): boolean {
    return VALID_TRANSITIONS[this._state]?.includes(state) ?? false;
  }

  /** Subscribe to state changes */
  onStateChange(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Check convenience properties */
  get isConnected(): boolean {
    return this._state === ConnectionState.Ready;
  }

  get isConnecting(): boolean {
    return (
      this._state === ConnectionState.Connecting ||
      this._state === ConnectionState.Discovering ||
      this._state === ConnectionState.Reconnecting
    );
  }

  get isDisconnected(): boolean {
    return this._state === ConnectionState.Disconnected;
  }
}
