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
  /**
   * Wrong passwords across all of Realm: past this, someone is likely trying stolen password
   * lists (credential stuffing), and the owner gets an email. Nothing is blocked by it.
   */
  loginFailuresAll: { bucket: "auth:login:fail:all", limit: 100, windowSeconds: 600 },
  verify: { bucket: "auth:verify:user", limit: 10, windowSeconds: 900 },
  resend: { bucket: "auth:resend:user", limit: 3, windowSeconds: 900 },
  forgotIp: { bucket: "auth:forgot:ip", limit: 5, windowSeconds: 3600 },
  forgotEmail: { bucket: "auth:forgot:email", limit: 3, windowSeconds: 3600 },
  reset: { bucket: "auth:reset:ip", limit: 10, windowSeconds: 3600 },
  gatewayTicket: { bucket: "gateway:ticket:user", limit: 30, windowSeconds: 60 },
  ageCheck: { bucket: "auth:age:ip", limit: 20, windowSeconds: 3600 },
  usernameCheck: { bucket: "auth:username:ip", limit: 120, windowSeconds: 60 },
  // Spaces: generous for a friend group, tight against scripts.
  spaceCreate: { bucket: "space:create:user", limit: 10, windowSeconds: 3600 },
  roomCreate: { bucket: "space:room:user", limit: 30, windowSeconds: 3600 },
  inviteCreate: { bucket: "space:invite:user", limit: 30, windowSeconds: 3600 },
  inviteAccept: { bucket: "space:join:user", limit: 30, windowSeconds: 3600 },
  invitePreview: { bucket: "space:invite-preview:ip", limit: 120, windowSeconds: 60 },
  messageSend: { bucket: "chat:send:user", limit: 30, windowSeconds: 30 },
  messageEdit: { bucket: "chat:edit:user", limit: 30, windowSeconds: 60 },
  /** Bursts: a person typing fast never hits this; a script does. */
  messageFlood: { bucket: "chat:flood:user", limit: 8, windowSeconds: 10 },
  /** Links from accounts under a day old or unverified: a few at a time. */
  newAccountLinks: { bucket: "chat:links:new", limit: 3, windowSeconds: 600 },
  upload: { bucket: "media:upload:user", limit: 60, windowSeconds: 3600 },
  report: { bucket: "safety:report:user", limit: 20, windowSeconds: 3600 },
  modAction: { bucket: "safety:mod:user", limit: 60, windowSeconds: 600 },
  voiceJoin: { bucket: "voice:join:user", limit: 30, windowSeconds: 600 },
  pushToken: { bucket: "push:token:user", limit: 20, windowSeconds: 3600 },
  /** New conversations: plenty for a person, too few for cold-message spam. */
  dmOpen: { bucket: "dm:open:user", limit: 20, windowSeconds: 3600 },
  dmChange: { bucket: "dm:change:user", limit: 60, windowSeconds: 600 },
  react: { bucket: "chat:react:user", limit: 60, windowSeconds: 60 },
  // Posts and Clips: a busy evening of posting is fine, a bot's flood isn't.
  postCreate: { bucket: "post:create:user", limit: 30, windowSeconds: 3600 },
  commentCreate: { bucket: "post:comment:user", limit: 30, windowSeconds: 300 },
  follow: { bucket: "social:follow:user", limit: 120, windowSeconds: 3600 },
  search: { bucket: "social:search:key", limit: 60, windowSeconds: 60 },
  // Themes: saving drafts while designing is frequent; reviews and adding themes less so.
  themeSave: { bucket: "theme:save:user", limit: 60, windowSeconds: 3600 },
  themeReview: { bucket: "theme:review:user", limit: 20, windowSeconds: 3600 },
  themeGet: { bucket: "theme:get:user", limit: 120, windowSeconds: 3600 },
  themeStore: { bucket: "theme:store:key", limit: 120, windowSeconds: 60 },
} satisfies Record<string, RateLimitRule>;
