type Handler<T> = (payload: T) => void;

export class EventBus<E extends Record<string, unknown>> {
  private handlers = new Map<keyof E, Set<Handler<never>>>();

  on<K extends keyof E>(key: K, fn: Handler<E[K]>): () => void {
    let set = this.handlers.get(key);
    if (!set) {
      set = new Set();
      this.handlers.set(key, set);
    }
    set.add(fn as Handler<never>);
    return () => set!.delete(fn as Handler<never>);
  }

  emit<K extends keyof E>(key: K, payload: E[K]): void {
    const set = this.handlers.get(key);
    if (!set) return;
    for (const fn of [...set]) (fn as Handler<E[K]>)(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}
