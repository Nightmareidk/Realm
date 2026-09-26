import type { KeyValueStore } from "./kv";

export interface RateLimitRule {
  /** Bucket name, e.g. "auth:login:ip". */
  bucket: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

/** Fixed-window counter. Cheap, predictable, and good enough at the edge of each route. */
export class RateLimiter {
  constructor(private readonly store: KeyValueStore) {}

  async hit(rule: RateLimitRule, key: string): Promise<RateLimitResult> {
    const { count, ttlSeconds } = await this.store.incr(
      `rl:${rule.bucket}:${key}`,
      rule.windowSeconds,
    );
    return {
      allowed: count <= rule.limit,
      limit: rule.limit,
      remaining: Math.max(0, rule.limit - count),
      resetSeconds: ttlSeconds,
    };
  }

  async reset(rule: RateLimitRule, key: string): Promise<void> {
    await this.store.del(`rl:${rule.bucket}:${key}`);
  }
}

/** Route budgets in one place so they're easy to audit and tune. */
export const Limits = {
  global: { bucket: "global:ip", limit: 600, windowSeconds: 60 },
  register: { bucket: "auth:register:ip", limit: 5, windowSeconds: 3600 },
  loginIp: { bucket: "auth:login:ip", limit: 20, windowSeconds: 900 },
  loginAccount: { bucket: "auth:login:account", limit: 8, windowSeconds: 900 },
  verify: { bucket: "auth:verify:user", limit: 10, windowSeconds: 900 },
  resend: { bucket: "auth:resend:user", limit: 3, windowSeconds: 900 },
  forgotIp: { bucket: "auth:forgot:ip", limit: 5, windowSeconds: 3600 },
  forgotEmail: { bucket: "auth:forgot:email", limit: 3, windowSeconds: 3600 },
  reset: { bucket: "auth:reset:ip", limit: 10, windowSeconds: 3600 },
  gatewayTicket: { bucket: "gateway:ticket:user", limit: 30, windowSeconds: 60 },
} satisfies Record<string, RateLimitRule>;
