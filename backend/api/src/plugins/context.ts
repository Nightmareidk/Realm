import { Platform } from "@realm/contracts";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Deps } from "../deps";
import { unauthorized } from "../lib/errors";
import {
  type ClientContext,
  type ResolvedSession,
  resolveSession,
  SESSION_COOKIE,
  SESSION_TTL_MS,
} from "../lib/sessions";

declare module "fastify" {
  interface FastifyRequest {
    client: ClientContext;
    auth: ResolvedSession | null;
    /** How the caller authenticated — cookie auth is subject to Origin (CSRF) checks. */
    authVia: "cookie" | "bearer" | null;
  }
}

/** `X-Realm-Client: ios/1.2.0` → platform `ios`. Absent or unknown → `web`. */
function parseClient(req: FastifyRequest): ClientContext {
  const header = req.headers["x-realm-client"];
  const raw = typeof header === "string" ? header.split("/")[0]?.toLowerCase() : undefined;
  const parsed = Platform.safeParse(raw);
  const platform = parsed.success ? parsed.data : "web";
  const isNative = platform !== "web";
  return {
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    platform,
    isNative,
    device: isNative ? deviceName(req.headers["x-realm-device"]) : undefined,
  };
}

/**
 * The phone's name as the app reports it, kept to letters, numbers and simple punctuation: it's
 * shown back to the account's owner in their session list, so nothing in it can be markup.
 */
function deviceName(header: string | string[] | undefined): string | undefined {
  if (typeof header !== "string") return undefined;
  const clean = header
    .replace(/[^\p{L}\p{N} ._()'+-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
  return clean || undefined;
}

export function sessionCookieOptions(deps: Deps) {
  return {
    httpOnly: true,
    secure: deps.config.isProduction,
    sameSite: "lax" as const,
    path: "/",
    domain: deps.config.REALM_COOKIE_DOMAIN,
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

export function registerContext(app: FastifyInstance, deps: Deps) {
  app.decorateRequest("client", null as unknown as ClientContext);
  app.decorateRequest("auth", null);
  app.decorateRequest("authVia", null);

  app.addHook("onRequest", async (req, reply) => {
    req.client = parseClient(req);

    const bearer = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    const cookie = req.cookies[SESSION_COOKIE];
    const token = bearer ?? cookie;
    if (!token) return;

    const peek = req.method === "GET" && req.headers["x-realm-peek"] === "1";
    const session = await resolveSession(deps, token, { peek });
    if (!session) {
      // Stale cookie: clear it so the browser stops sending it.
      if (!bearer && cookie)
        reply.clearCookie(SESSION_COOKIE, { path: "/", domain: deps.config.REALM_COOKIE_DOMAIN });
      return;
    }
    req.auth = session;
    req.authVia = bearer ? "bearer" : "cookie";
    if (session.renewedToken && req.authVia === "cookie") {
      reply.setCookie(SESSION_COOKIE, session.renewedToken, sessionCookieOptions(deps));
    }
  });
}

/** preHandler guard for authenticated routes. */
export async function requireAuth(req: FastifyRequest) {
  if (!req.auth) throw unauthorized();
}

export function authOf(req: FastifyRequest): ResolvedSession {
  if (!req.auth) throw unauthorized();
  return req.auth;
}
