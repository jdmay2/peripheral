export type Listener<T> = (data: T) => void;
export type Unsubscribe = () => void;

export class EventEmitter<Events extends Record<string, any>> {
  private listeners = new Map<keyof Events, Set<Listener<any>>>();

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): Unsubscribe {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return () => this.off(event, listener);
  }

  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    this.listeners.get(event)?.forEach((fn) => {
      try { fn(data); } catch (err) { console.error(`[GestureEngine] Event error:`, err); }
    });
  }

  removeAllListeners(event?: keyof Events): void {
    if (event) this.listeners.delete(event);
    else this.listeners.clear();
  }
}
