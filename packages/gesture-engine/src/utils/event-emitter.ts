export type Listener<T> = (data: T) => void;
export type Unsubscribe = () => void;

export class EventEmitter<Events extends object> {
  private listeners = new Map<keyof Events, Set<Listener<unknown>>>();

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): Unsubscribe {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener as Listener<unknown>);
    return () => this.off(event, listener);
  }

  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void {
    this.listeners.get(event)?.delete(listener as Listener<unknown>);
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    this.listeners.get(event)?.forEach((fn) => {
      try {
        (fn as Listener<Events[K]>)(data);
      } catch (err) {
        console.error(`[GestureEngine] Event error:`, err);
      }
    });
  }

  removeAllListeners(event?: keyof Events): void {
    if (event) this.listeners.delete(event);
    else this.listeners.clear();
  }
}
