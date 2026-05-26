import { EventEmitter } from 'events';
import type { BackendEventMap } from '../../shared/events';

export class EventBus<T> extends EventEmitter {
  emitTyped<K extends keyof T>(event: K, payload: T[K]): boolean {
    return this.emit(event as string, payload);
  }

  onTyped<K extends keyof T>(event: K, handler: (payload: T[K]) => void): this {
    return this.on(event as string, handler);
  }

  offTyped<K extends keyof T>(event: K, handler: (payload: T[K]) => void): this {
    return this.off(event as string, handler);
  }
}

let instance: EventBus<BackendEventMap> | null = null;

function getEventBus(): EventBus<BackendEventMap> {
  if (!instance) {
    instance = new EventBus<BackendEventMap>();
  }
  return instance;
}

function resetEventBus(): void {
  instance = null;
}

export { getEventBus, resetEventBus };
