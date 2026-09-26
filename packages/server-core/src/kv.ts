import { Redis } from "ioredis";

/**
 * Minimal key-value contract used for caches, rate limits, tickets and presence.
 * Production uses Redis/Valkey; tests and single-process dev use the in-memory store.
 */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  /** Atomically read and delete (single-use tickets). */
  take(key: string): Promise<string | null>;
  del(...keys: string[]): Promise<void>;
  /** Increment and (on first increment) set expiry. Returns the new value and remaining TTL. */
  incr(key: string, ttlSeconds: number): Promise<{ count: number; ttlSeconds: number }>;
  close(): Promise<void>;
}

export class RedisStore implements KeyValueStore {
  constructor(readonly redis: Redis) {}

  static connect(url: string): RedisStore {
    return new RedisStore(new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: false }));
  }

  get(key: string) {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    if (ttlSeconds) await this.redis.set(key, value, "EX", ttlSeconds);
    else await this.redis.set(key, value);
  }

  take(key: string) {
    return this.redis.getdel(key);
  }

  async del(...keys: string[]) {
    if (keys.length) await this.redis.del(...keys);
  }

  async incr(key: string, ttlSeconds: number) {
    const [[, count], [, ttl]] = (await this.redis.multi().incr(key).ttl(key).exec()) as [
      [null, number],
      [null, number],
    ];
    if (ttl < 0) {
      await this.redis.expire(key, ttlSeconds);
      return { count, ttlSeconds };
    }
    return { count, ttlSeconds: ttl };
  }

  async close() {
    await this.redis.quit();
  }
}

export class MemoryStore implements KeyValueStore {
  private readonly data = new Map<string, { value: string; expiresAt: number | null }>();

  constructor(private readonly now: () => number = Date.now) {}

  private live(key: string) {
    const entry = this.data.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= this.now()) {
      this.data.delete(key);
      return null;
    }
    return entry;
  }

  async get(key: string) {
    return this.live(key)?.value ?? null;
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    this.data.set(key, { value, expiresAt: ttlSeconds ? this.now() + ttlSeconds * 1000 : null });
  }

  async take(key: string) {
    const value = this.live(key)?.value ?? null;
    this.data.delete(key);
    return value;
  }

  async del(...keys: string[]) {
    for (const k of keys) this.data.delete(k);
  }

  async incr(key: string, ttlSeconds: number) {
    const entry = this.live(key);
    if (!entry) {
      this.data.set(key, { value: "1", expiresAt: this.now() + ttlSeconds * 1000 });
      return { count: 1, ttlSeconds };
    }
    const count = Number(entry.value) + 1;
    entry.value = String(count);
    const remaining =
      entry.expiresAt === null ? ttlSeconds : Math.ceil((entry.expiresAt - this.now()) / 1000);
    return { count, ttlSeconds: remaining };
  }

  async close() {
    this.data.clear();
  }
}
