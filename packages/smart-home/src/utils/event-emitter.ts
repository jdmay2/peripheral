/**
 * Minimal typed event emitter. No external dependencies.
 */
export type Listener<T> = (data: T) => void;
export type Unsubscribe = () => void;

export class EventEmitter<Events extends Record<string, any>> {
  private listeners = new Map<keyof Events, Set<Listener<any>>>();

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): Unsubscribe {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => this.off(event, listener);
  }

  once<K extends keyof Events>(event: K, listener: Listener<Events[K]>): Unsubscribe {
    const wrapper: Listener<Events[K]> = (data) => {
      this.off(event, wrapper);
      listener(data);
    };
    return this.on(event, wrapper);
  }

  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    this.listeners.get(event)?.forEach((fn) => {
      try {
        fn(data);
      } catch (err) {
        console.error(`[EventEmitter] Error in "${String(event)}" listener:`, err);
      }
    });
  }

  removeAllListeners(event?: keyof Events): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  listenerCount(event: keyof Events): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
