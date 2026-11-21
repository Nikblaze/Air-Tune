import type { StringEntity } from "./scene/StringEntity";

export type Events = {
  stringCreated: { string: StringEntity };
  stringPlucked: { stringId: number; t: number; velocity: number; direction: 1 | -1 };
  stringRemoved: { stringId: number };
};

export interface Bus {
  on<K extends keyof Events>(type: K, fn: (payload: Events[K]) => void): () => void;
  emit<K extends keyof Events>(type: K, payload: Events[K]): void;
}

/** Tiny typed pub/sub. Factory so tests get an isolated bus. */
export function createBus(): Bus {
  // Loosely typed store; the public Bus signature is what enforces payload types.
  const handlers: Record<string, Set<(p: never) => void>> = {};
  return {
    on(type, fn) {
      const set = (handlers[type] ??= new Set());
      set.add(fn as (p: never) => void);
      return () => void set.delete(fn);
    },
    emit(type, payload) {
      // Copy so a handler that unsubscribes mid-emit doesn't skip its neighbours.
      for (const fn of [...(handlers[type] ?? [])]) (fn as (p: Events[typeof type]) => void)(payload);
    },
  };
}

export const bus = createBus();
