import type { Platform } from "@realm/contracts";
import { and, type Executor, eq, gt, isNull, ne, schema } from "@realm/db";
import { describeUserAgent, randomToken, sha256Hex } from "@realm/server-core";
import type { Deps } from "../deps";

const { sessions, users } = schema;

export const SESSION_COOKIE = "realm_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Extend a session when less than this remains (sliding expiry). */
const RENEW_THRESHOLD_MS = 15 * 24 * 60 * 60 * 1000;
/** Don't write `last_active_at` more often than this. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const CACHE_TTL_SECONDS = 60;

export interface ClientContext {
  ip: string;
  userAgent: string | undefined;
  platform: Platform;
  /** Native clients receive their token in the response body; web never does. */
  isNative: boolean;
}

export interface ResolvedSession {
  sessionId: bigint;
  userId: bigint;
  tokenHash: string;
  expiresAt: number;
  /** Set when the session was extended during this request — re-issue the cookie. */
  renewedToken?: string;
}

interface CachedSession {
  sessionId: string;
  userId: string;
  expiresAt: number;
  lastActiveAt: number;
}

const cacheKey = (tokenHash: string) => `sess:${tokenHash}`;

export async function createSession(
  deps: Deps,
  tx: Executor,
  userId: bigint,
  client: ClientContext,
): Promise<{ token: string; session: typeof sessions.$inferSelect }> {
  const token = randomToken();
  const [session] = await tx
    .insert(sessions)
    .values({
      id: deps.ids.next(),
      tokenHash: sha256Hex(token),
      userId,
      platform: client.platform,
      deviceName: describeUserAgent(client.userAgent),
      ipCreated: client.ip,
      userAgent: client.userAgent?.slice(0, 512),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    })
    .returning();
  if (!session) throw new Error("session insert returned nothing");
  return { token, session };
}

/** Validates a raw session token. Returns null for unknown, expired, revoked, or inactive users. */
export async function resolveSession(deps: Deps, token: string): Promise<ResolvedSession | null> {
  if (token.length < 20 || token.length > 200) return null;
  const tokenHash = sha256Hex(token);
  const now = Date.now();

  let cached: CachedSession | null = null;
  const raw = await deps.kv.get(cacheKey(tokenHash));
  if (raw) {
    try {
      cached = JSON.parse(raw) as CachedSession;
    } catch {
      // A damaged cache entry is only a cache miss: drop it and read the database.
      await deps.kv.del(cacheKey(tokenHash));
    }
  }

  if (!cached) {
    const [row] = await deps.db
      .select({
        id: sessions.id,
        userId: sessions.userId,
        expiresAt: sessions.expiresAt,
        lastActiveAt: sessions.lastActiveAt,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date(now)),
          eq(users.status, "active"),
        ),
      )
      .limit(1);
    if (!row) return null;
    cached = {
      sessionId: row.id.toString(),
      userId: row.userId.toString(),
      expiresAt: row.expiresAt.getTime(),
      lastActiveAt: row.lastActiveAt.getTime(),
    };
    await deps.kv.set(cacheKey(tokenHash), JSON.stringify(cached), CACHE_TTL_SECONDS);
  }

  if (cached.expiresAt <= now) return null;

  const resolved: ResolvedSession = {
    sessionId: BigInt(cached.sessionId),
    userId: BigInt(cached.userId),
    tokenHash,
    expiresAt: cached.expiresAt,
  };

  const renew = cached.expiresAt - now < RENEW_THRESHOLD_MS;
  const touch = now - cached.lastActiveAt > TOUCH_INTERVAL_MS;
  if (renew || touch) {
    const expiresAt = renew ? new Date(now + SESSION_TTL_MS) : new Date(cached.expiresAt);
    await deps.db
      .update(sessions)
      .set({ lastActiveAt: new Date(now), expiresAt })
      .where(eq(sessions.id, resolved.sessionId));
    await deps.kv.del(cacheKey(tokenHash));
    resolved.expiresAt = expiresAt.getTime();
    if (renew) resolved.renewedToken = token;
  }

  return resolved;
}

export async function revokeSession(
  deps: Deps,
  userId: bigint,
  sessionId: bigint,
): Promise<boolean> {
  const [row] = await deps.db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId), isNull(sessions.revokedAt)))
    .returning({ tokenHash: sessions.tokenHash });
  if (row) await deps.kv.del(cacheKey(row.tokenHash));
  return Boolean(row);
}

/** Revokes every session of a user, optionally keeping one (the caller's). */
export async function revokeAllSessions(
  deps: Deps,
  tx: Executor,
  userId: bigint,
  exceptSessionId?: bigint,
): Promise<number> {
  const rows = await tx
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
        exceptSessionId ? ne(sessions.id, exceptSessionId) : undefined,
      ),
    )
    .returning({ tokenHash: sessions.tokenHash });
  await deps.kv.del(...rows.map((r) => cacheKey(r.tokenHash)));
  return rows.length;
}
