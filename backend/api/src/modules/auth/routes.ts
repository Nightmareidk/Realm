import {
  AgeCheckBody,
  AuthResult,
  ageInYears,
  ChangePasswordBody,
  ForgotPasswordBody,
  GatewayTicket,
  LoginBody,
  Limits as ProductLimits,
  RegisterBody,
  ResetPasswordBody,
  ResetTokenStatus,
  SelfUser,
  SessionInfo,
  Snowflake,
  UsernameAvailability,
  VerifyEmailBody,
} from "@realm/contracts";
import { and, desc, eq, gt, isNull, schema } from "@realm/db";
import { hmacHex, Limits, randomToken, safeEqual, sha256Hex } from "@realm/server-core";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Deps } from "../../deps";
import { AppError, badRequest, notFound } from "../../lib/errors";
import { toSelfUser, toSessionInfo } from "../../lib/serialize";
import { revokeAllSessions, revokeSession, SESSION_COOKIE } from "../../lib/sessions";
import { authOf, requireAuth, sessionCookieOptions } from "../../plugins/context";
import { enforceLimit } from "../../plugins/security";
import { AuthService } from "./service";

const { sessions } = schema;
const GATEWAY_TICKET_TTL_SECONDS = 60;

/**
 * After a birthday under the minimum age, this browser waits a day before trying again (FTC COPPA
 * FAQ H.3: a cookie so a child can't just go back and enter another age). Signed, HttpOnly, and
 * enforced here on register as well as on the age check.
 */
const AGE_HOLD_COOKIE = "realm_age_hold";
const AGE_HOLD_SECONDS = 24 * 60 * 60;
const underAge = () =>
  new AppError(403, "UNDER_AGE", `Realm is for people ${ProductLimits.minimumAgeYears} and older.`);

export const authRoutes =
  (deps: Deps): FastifyPluginAsyncZod =>
  async (app) => {
    const service = new AuthService(deps);

    const holdActive = (req: FastifyRequest) => {
      const raw = req.cookies[AGE_HOLD_COOKIE];
      const [at, sig] = raw?.split(".") ?? [];
      if (!at || !sig || !safeEqual(sig, hmacHex(deps.config.REALM_SECRET, `age:${at}`)))
        return false;
      return Date.now() - Number(at) < AGE_HOLD_SECONDS * 1000;
    };
    const setHold = (reply: FastifyReply) => {
      const at = String(Date.now());
      reply.setCookie(AGE_HOLD_COOKIE, `${at}.${hmacHex(deps.config.REALM_SECRET, `age:${at}`)}`, {
        httpOnly: true,
        secure: deps.config.isProduction,
        sameSite: "lax",
        path: "/",
        domain: deps.config.REALM_COOKIE_DOMAIN,
        maxAge: AGE_HOLD_SECONDS,
      });
    };

    /** Sign-up's first question: only the birthday, before anything personal is asked. */
    app.post("/age-check", { schema: { body: AgeCheckBody } }, async (req, reply) => {
      await enforceLimit(deps, Limits.ageCheck, req.ip);
      if (holdActive(req)) throw underAge();
      const age = ageInYears(req.body.birthDate);
      if (age > 120 || age < 0) {
        throw badRequest("BIRTHDATE_INVALID", "Enter your real date of birth.");
      }
      if (age < ProductLimits.minimumAgeYears) {
        setHold(reply);
        throw underAge();
      }
      return reply.status(204).send();
    });

    app.get(
      "/username-available",
      {
        schema: {
          querystring: z.object({ username: z.string().max(64) }),
          response: { 200: UsernameAvailability },
        },
      },
      async (req) => {
        await enforceLimit(deps, Limits.usernameCheck, req.ip);
        return service.usernameAvailability(req.query.username);
      },
    );

    /** Web gets an HttpOnly cookie only; native clients also get the token in the body. */
    function issue(
      req: FastifyRequest,
      reply: FastifyReply,
      r: Awaited<ReturnType<AuthService["login"]>>,
    ): AuthResult {
      if (!req.client.isNative) {
        reply.setCookie(SESSION_COOKIE, r.token, sessionCookieOptions(deps));
      }
      return {
        user: toSelfUser(r.user),
        session: toSessionInfo(r.session, r.session.id),
        ...(req.client.isNative ? { token: r.token } : {}),
      };
    }

    app.post(
      "/register",
      { schema: { body: RegisterBody, response: { 201: AuthResult } } },
      async (req, reply) => {
        if (holdActive(req)) throw underAge();
        await enforceLimit(deps, Limits.register, req.ip);
        const result = await service.register(req.body, req.client);
        return reply.status(201).send(issue(req, reply, result));
      },
    );

    app.post(
      "/login",
      { schema: { body: LoginBody, response: { 200: AuthResult } } },
      async (req, reply) => issue(req, reply, await service.login(req.body, req.client)),
    );

    app.post("/logout", { preHandler: requireAuth }, async (req, reply) => {
      const auth = authOf(req);
      await revokeSession(deps, auth.userId, auth.sessionId);
      reply.clearCookie(SESSION_COOKIE, { path: "/", domain: deps.config.REALM_COOKIE_DOMAIN });
      return reply.status(204).send();
    });

    app.post(
      "/email/verify",
      { schema: { body: VerifyEmailBody, response: { 200: SelfUser } } },
      async (req) => {
        if ("token" in req.body) {
          return toSelfUser(await service.verifyEmailWithToken(req.body.token, req.client));
        }
        const auth = authOf(req);
        return toSelfUser(
          await service.verifyEmailWithCode(auth.userId, req.body.code, req.client),
        );
      },
    );

    app.post("/email/resend", { preHandler: requireAuth }, async (req, reply) => {
      await service.resendVerification(authOf(req).userId);
      return reply.status(204).send();
    });

    app.post("/password/forgot", { schema: { body: ForgotPasswordBody } }, async (req, reply) => {
      await service.forgotPassword(req.body.email, req.client);
      return reply.status(202).send();
    });

    app.get(
      "/password/reset/status",
      {
        schema: {
          querystring: z.object({ token: z.string().min(20).max(200) }),
          response: { 200: ResetTokenStatus },
        },
      },
      async (req) => {
        await enforceLimit(deps, Limits.reset, req.ip);
        return { status: await service.resetTokenStatus(req.query.token) };
      },
    );

    app.post("/password/reset", { schema: { body: ResetPasswordBody } }, async (req, reply) => {
      await service.resetPassword(req.body.token, req.body.password, req.client);
      reply.clearCookie(SESSION_COOKIE, { path: "/", domain: deps.config.REALM_COOKIE_DOMAIN });
      return reply.status(204).send();
    });

    app.post(
      "/password/change",
      { preHandler: requireAuth, schema: { body: ChangePasswordBody } },
      async (req, reply) => {
        const auth = authOf(req);
        await service.changePassword(
          auth.userId,
          auth.sessionId,
          req.body.currentPassword,
          req.body.newPassword,
          req.client,
        );
        return reply.status(204).send();
      },
    );

    app.get(
      "/sessions",
      {
        preHandler: requireAuth,
        schema: { response: { 200: z.object({ sessions: z.array(SessionInfo) }) } },
      },
      async (req) => {
        const auth = authOf(req);
        const rows = await deps.db
          .select()
          .from(sessions)
          .where(
            and(
              eq(sessions.userId, auth.userId),
              isNull(sessions.revokedAt),
              gt(sessions.expiresAt, new Date()),
            ),
          )
          .orderBy(desc(sessions.lastActiveAt));
        return { sessions: rows.map((s) => toSessionInfo(s, auth.sessionId)) };
      },
    );

    app.delete(
      "/sessions/:id",
      { preHandler: requireAuth, schema: { params: z.object({ id: Snowflake }) } },
      async (req, reply) => {
        const auth = authOf(req);
        const revoked = await revokeSession(deps, auth.userId, BigInt(req.params.id));
        if (!revoked) throw notFound("Session");
        return reply.status(204).send();
      },
    );

    app.delete("/sessions", { preHandler: requireAuth }, async (req) => {
      const auth = authOf(req);
      const revoked = await revokeAllSessions(deps, deps.db, auth.userId, auth.sessionId);
      return { revoked };
    });
  };

export const gatewayRoutes =
  (deps: Deps): FastifyPluginAsyncZod =>
  async (app) => {
    // Web clients can't attach an HttpOnly cookie to a cross-origin WebSocket reliably;
    // they trade it here for a single-use, 60-second ticket they send in IDENTIFY.
    app.post(
      "/tickets",
      { preHandler: requireAuth, schema: { response: { 201: GatewayTicket } } },
      async (req, reply) => {
        const auth = authOf(req);
        await enforceLimit(deps, Limits.gatewayTicket, auth.userId.toString());
        const ticket = randomToken();
        await deps.kv.set(
          `gwt:${sha256Hex(ticket)}`,
          JSON.stringify({ userId: auth.userId.toString(), sessionId: auth.sessionId.toString() }),
          GATEWAY_TICKET_TTL_SECONDS,
        );
        return reply.status(201).send({
          ticket,
          expiresAt: new Date(Date.now() + GATEWAY_TICKET_TTL_SECONDS * 1000).toISOString(),
        });
      },
    );
  };
