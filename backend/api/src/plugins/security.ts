import { Limits } from "@realm/server-core";
import type { FastifyInstance } from "fastify";
import type { Deps } from "../deps";
import { AppError, rateLimited } from "../lib/errors";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function registerSecurity(app: FastifyInstance, deps: Deps) {
  const allowedOrigins = new Set([new URL(deps.config.REALM_WEB_ORIGIN).origin]);

  app.addHook("onRequest", async (req, reply) => {
    // Coarse per-IP budget in front of every route.
    const global = await deps.limiter.hit(Limits.global, req.ip);
    if (!global.allowed) {
      reply.header("Retry-After", global.resetSeconds);
      throw rateLimited(global.resetSeconds);
    }
  });

  // CSRF: browsers always send Origin on cross-site unsafe requests. A mutation from a
  // foreign origin is rejected; a cookie-authenticated mutation with no Origin is rejected.
  // Native clients (bearer tokens) send no Origin and carry no ambient credentials.
  app.addHook("preHandler", async (req) => {
    if (SAFE_METHODS.has(req.method)) return;
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.has(origin)) {
      throw new AppError(403, "FORBIDDEN", "Cross-origin request blocked");
    }
    if (!origin && req.authVia === "cookie") {
      throw new AppError(403, "FORBIDDEN", "Missing Origin header");
    }
  });
}

/** Hit a named rate-limit rule and throw 429 when exhausted. */
export async function enforceLimit(
  deps: Deps,
  rule: (typeof Limits)[keyof typeof Limits],
  key: string,
): Promise<void> {
  const result = await deps.limiter.hit(rule, key);
  if (!result.allowed) throw rateLimited(result.resetSeconds);
}
