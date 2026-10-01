import { Redis } from "ioredis";

/**
 * Fan-out of realtime events from the API/workers to gateway nodes.
 * Topics: `user:{id}`, `channel:{id}`, `community:{id}`.
 * The interface is deliberately tiny so Redis pub/sub can be swapped for NATS later.
 */
export interface BusEvent {
  type: string;
  data: unknown;
  /** Optional recipients filter the gateway applies (e.g. DM recipients). */
  userIds?: string[];
}

export type BusHandler = (topic: string, event: BusEvent) => void;

export interface EventBus {
  publish(topic: string, event: BusEvent): Promise<void>;
  subscribe(topic: string, handler: BusHandler): Promise<() => Promise<void>>;
  close(): Promise<void>;
}

export class MemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, Set<BusHandler>>();
  /** Every event published, for assertions in tests. */
  readonly published: { topic: string; event: BusEvent }[] = [];

  async publish(topic: string, event: BusEvent) {
    this.published.push({ topic, event });
    for (const h of this.handlers.get(topic) ?? []) h(topic, event);
  }

  async subscribe(topic: string, handler: BusHandler) {
    let set = this.handlers.get(topic);
    if (!set) {
      set = new Set();
      this.handlers.set(topic, set);
    }
    set.add(handler);
    return async () => {
      set.delete(handler);
    };
  }

  async close() {
    this.handlers.clear();
  }
}

export class RedisEventBus implements EventBus {
  private readonly pub: Redis;
  private readonly sub: Redis;
  private readonly handlers = new Map<string, Set<BusHandler>>();

  constructor(url: string) {
    this.pub = new Redis(url);
    this.sub = new Redis(url);
    this.sub.on("message", (topic: string, raw: string) => {
      const set = this.handlers.get(topic);
      if (!set?.size) return;
      let event: BusEvent;
      try {
        event = JSON.parse(raw) as BusEvent;
      } catch {
        return;
      }
      // One failing subscriber mustn't stop the others, or take the process down with it.
      for (const h of set) {
        try {
          h(topic, event);
        } catch (err) {
          console.error(`event bus: a handler for ${topic} failed`, err);
        }
      }
    });
  }

  async publish(topic: string, event: BusEvent) {
    await this.pub.publish(topic, JSON.stringify(event));
  }

  async subscribe(topic: string, handler: BusHandler) {
    let set = this.handlers.get(topic);
    if (!set) {
      set = new Set();
      this.handlers.set(topic, set);
      await this.sub.subscribe(topic);
    }
    set.add(handler);
    return async () => {
      set.delete(handler);
      if (set.size === 0) {
        this.handlers.delete(topic);
        await this.sub.unsubscribe(topic);
      }
    };
  }

  async close() {
    await Promise.all([this.pub.quit(), this.sub.quit()]);
  }
}
