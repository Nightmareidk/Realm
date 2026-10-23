import {
  isMinor,
  type LoginBody,
  type RegisterBody,
  TEEN_USER_SETTINGS,
  Username,
  type UsernameAvailability,
} from "@realm/contracts";
import { and, desc, eq, gt, isNull, schema, sql } from "@realm/db";
import {
  hashPassword,
  hmacHex,
  Limits,
  randomNumericCode,
  randomToken,
  safeEqual,
  screenPassword,
  sha256Hex,
  timingSafeDummyVerify,
  verifyPassword,
} from "@realm/server-core";
import type { Deps } from "../../deps";
import { AppError, badRequest, conflict, rateLimited } from "../../lib/errors";
import { RESERVED_MESSAGE, whyReserved } from "../../lib/handles";
import { alertOwnerOnce } from "../../lib/owner-alerts";
import { type ClientContext, createSession, revokeAllSessions } from "../../lib/sessions";
import {
  newSignInEmail,
  passwordChangedEmail,
  passwordResetEmail,
  signInPausedEmail,
  verificationEmail,
} from "./emails";

const { users, userSettings, emailVerifications, passwordResets, securityEvents, sessions } =
  schema;

const VERIFICATION_TTL_MS = 15 * 60 * 1000;
const VERIFICATION_MAX_ATTEMPTS = 5;
const RESET_TTL_MS = 60 * 60 * 1000;

type UserRow = typeof users.$inferSelect;

/** True when `err` (or the driver error it wraps) is a unique violation on a matching constraint. */
function violates(err: unknown, constraint: RegExp): boolean {
  for (let e: unknown = err; e instanceof Error; e = e.cause) {
    if (
      constraint.test(e.message) ||
      constraint.test(String((e as { constraint_name?: string }).constraint_name ?? ""))
    ) {
      return true;
    }
  }
  return false;
}

export class AuthService {
  constructor(private readonly deps: Deps) {}

  private link(path: string, token: string) {
    const url = new URL(path, this.deps.config.REALM_WEB_ORIGIN);
    url.searchParams.set("token", token);
    return url.toString();
  }

  private async logEvent(
    userId: bigint,
    type: (typeof securityEvents.$inferInsert)["type"],
    client: ClientContext,
    sessionId?: bigint,
  ) {
    await this.deps.db
      .insert(securityEvents)
      .values({ id: this.deps.ids.next(), userId, type, sessionId, ip: client.ip });
  }

  /** Mail failures must never fail the request (or reveal anything); they're logged. */
  private sendMail(mail: Parameters<Deps["mailer"]["send"]>[0]) {
    this.deps.mailer.send(mail).catch((err) => this.deps.logger.error({ err }, "mail send failed"));
  }

  /**
   * Refuses passwords attackers try first: common ones, trivial patterns, the person's own name,
   * and (when switched on) passwords found in breaches.
   */
  private async screen(password: string, related: string[]) {
    const result = await screenPassword(password, {
      related,
      pwned: this.deps.config.REALM_PWNED_PASSWORDS,
    });
    if (result === "common") {
      throw badRequest(
        "PASSWORD_TOO_COMMON",
        "That password is one of the first ones people guess. Pick something less common.",
      );
    }
    if (result === "breached") {
      throw badRequest(
        "PASSWORD_BREACHED",
        "That password has shown up in a data breach, so it's easy to guess. Pick another one.",
      );
    }
  }

  async register(body: RegisterBody, client: ClientContext) {
    const kept = await whyReserved(this.deps.db, body.username);
    if (kept) throw conflict("USERNAME_RESERVED", RESERVED_MESSAGE[kept]);
    const email = body.email.toLowerCase();
    await this.screen(body.password, [body.username, email.split("@")[0] ?? ""]);

    const existing = await this.deps.db
      .select({ username: users.username, email: users.email })
      .from(users)
      .where(sql`lower(${users.username}) = ${body.username} or lower(${users.email}) = ${email}`)
      .limit(2);
    if (existing.some((u) => u.email.toLowerCase() === email)) {
      throw conflict("EMAIL_TAKEN", "An account with that email already exists");
    }
    if (existing.some((u) => u.username.toLowerCase() === body.username)) {
      throw conflict("USERNAME_TAKEN", "That username is taken");
    }

    const passwordHash = await hashPassword(body.password);
    const code = randomNumericCode();
    const verifyToken = randomToken();
    const userId = this.deps.ids.next();

    const { user, session, token } = await this.deps.db
      .transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({
            id: userId,
            username: body.username,
            displayName: body.displayName,
            email,
            passwordHash,
            birthDate: body.birthDate,
          })
          .returning();
        if (!user) throw new Error("user insert returned nothing");
        await tx.insert(userSettings).values({
          userId,
          accent: body.accent ?? "mint",
          // Under 18: private profile, DMs from friends, requests from friends of friends.
          ...(isMinor(body.birthDate) ? TEEN_USER_SETTINGS : {}),
        });
        await tx.insert(emailVerifications).values({
          id: this.deps.ids.next(),
          userId,
          email,
          codeHash: hmacHex(this.deps.config.REALM_SECRET, code),
          tokenHash: sha256Hex(verifyToken),
          expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
        });
        const { session, token } = await createSession(this.deps, tx, userId, client);
        return { user, session, token };
      })
      .catch((err: unknown) => {
        // Two concurrent sign-ups racing past the pre-check hit the unique index instead.
        if (violates(err, /users_(username|email)_key/)) {
          throw conflict("CONFLICT", "That username or email was just taken");
        }
        throw err;
      });

    await this.logEvent(userId, "register", client, session.id);
    this.sendMail(verificationEmail({ to: email, code, link: this.link("/verify", verifyToken) }));
    return { user, session, token };
  }

  async login(body: LoginBody, client: ClientContext) {
    const login = body.login.trim().toLowerCase();
    await this.enforce(Limits.loginIp, client.ip);
    try {
      await this.enforce(Limits.loginAccount, login);
    } catch (err) {
      await this.warnPaused(login);
      throw err;
    }

    const column = login.includes("@") ? users.email : users.username;
    const [user] = await this.deps.db
      .select()
      .from(users)
      .where(sql`lower(${column}) = ${login}`)
      .limit(1);

    if (!user) {
      await timingSafeDummyVerify(body.password);
      await this.countFailure();
      throw new AppError(401, "INVALID_CREDENTIALS", "Wrong username/email or password");
    }
    const ok = await verifyPassword(user.passwordHash, body.password);
    if (!ok) {
      await this.logEvent(user.id, "login_failed", client);
      await this.countFailure();
      throw new AppError(401, "INVALID_CREDENTIALS", "Wrong username/email or password");
    }
    if (user.status === "suspended") {
      throw new AppError(403, "ACCOUNT_SUSPENDED", "This account is suspended");
    }
    if (user.status !== "active") {
      throw new AppError(401, "INVALID_CREDENTIALS", "Wrong username/email or password");
    }

    await this.deps.limiter.reset(Limits.loginAccount, login);
    const { session, token } = await createSession(this.deps, this.deps.db, user.id, client);
    await this.logEvent(user.id, "login", client, session.id);
    await this.tellIfNewDevice(user, session);
    return { user, session, token };
  }

  /**
   * A sign-in from a device this account has never used (by its name in the session list, like
   * "Chrome on Windows") gets an email, so a stolen password shows up straight away. The very
   * first sign-in after sign-up doesn't count.
   */
  private async tellIfNewDevice(
    user: typeof users.$inferSelect,
    session: typeof sessions.$inferSelect,
  ) {
    const [seen] = await this.deps.db
      .select({
        total: sql<number>`count(*)::int`,
        same: sql<number>`count(*) filter (where ${sessions.deviceName} = ${session.deviceName})::int`,
      })
      .from(sessions)
      .where(and(eq(sessions.userId, user.id), sql`${sessions.id} <> ${session.id}`));
    if (!seen || Number(seen.total) === 0 || Number(seen.same) > 0) return;
    this.sendMail(newSignInEmail({ to: user.email, device: session.deviceName, when: new Date() }));
  }

  /** Sign-in attempts to one account just got paused: tell its owner, once per pause. */
  private async warnPaused(login: string) {
    const column = login.includes("@") ? users.email : users.username;
    const [user] = await this.deps.db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(sql`lower(${column}) = ${login}`)
      .limit(1);
    if (!user) return;
    const window = Limits.loginAccount.windowSeconds;
    const { count } = await this.deps.kv.incr(`login-paused-mail:${user.id}`, window);
    if (count === 1) {
      this.sendMail(signInPausedEmail({ to: user.email, minutes: Math.round(window / 60) }));
    }
  }

  /**
   * Wrong passwords across all of Realm. A sudden flood means someone is trying stolen password
   * lists against many accounts: the owner gets one email per hour while it lasts.
   */
  private async countFailure() {
    const flood = await this.deps.limiter.hit(Limits.loginFailuresAll, "all");
    if (flood.allowed) return;
    const hour = new Date().toISOString().slice(0, 13);
    await alertOwnerOnce(this.deps, `login-flood:${hour}`, {
      subject: "Realm: many wrong passwords right now",
      text: [
        `In the last ${Limits.loginFailuresAll.windowSeconds / 60} minutes more than ${Limits.loginFailuresAll.limit} sign-ins to Realm failed with a wrong password. That usually means someone is trying passwords leaked from other sites against many accounts.`,
        "",
        "Realm is already slowing them down: each address and each account can only try a few times before it's paused, and account owners are emailed when theirs is targeted.",
        "",
        'Worth doing: look at the server\'s log for the addresses involved, and see docs/SECURITY.md ("If Realm is attacked") for the next steps.',
      ].join("\n"),
    }).catch((err) => this.deps.logger.error({ err }, "login flood alert failed"));
  }

  async verifyEmailWithCode(userId: bigint, code: string, client: ClientContext) {
    await this.enforce(Limits.verify, userId.toString());
    const user = await this.getUser(userId);
    if (user.emailVerifiedAt) return user;

    const [pending] = await this.deps.db
      .select()
      .from(emailVerifications)
      .where(
        and(
          eq(emailVerifications.userId, userId),
          eq(emailVerifications.email, user.email),
          isNull(emailVerifications.consumedAt),
        ),
      )
      .orderBy(desc(emailVerifications.id))
      .limit(1);

    if (!pending || pending.attempts >= VERIFICATION_MAX_ATTEMPTS) {
      throw badRequest("INVALID_CODE", "That code isn't valid anymore. Request a new one.");
    }
    if (pending.expiresAt.getTime() <= Date.now()) {
      throw badRequest("CODE_EXPIRED", "That code expired. Request a new one.");
    }
    if (!safeEqual(pending.codeHash, hmacHex(this.deps.config.REALM_SECRET, code))) {
      await this.deps.db
        .update(emailVerifications)
        .set({ attempts: sql`${emailVerifications.attempts} + 1` })
        .where(eq(emailVerifications.id, pending.id));
      throw badRequest("INVALID_CODE", "That code doesn't match. Check the email and try again.");
    }
    return this.markVerified(user, client);
  }

  /**
   * The emailed link. Looked up whether or not it was used, so a link opened after verifying with
   * the code (or pre-opened by a mail scanner) answers "already verified" instead of failing.
   */
  async verifyEmailWithToken(token: string, client: ClientContext) {
    const [pending] = await this.deps.db
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.tokenHash, sha256Hex(token)))
      .limit(1);
    if (!pending) throw badRequest("TOKEN_INVALID", "This link isn't valid.");
    const user = await this.getUser(pending.userId);
    if (user.email !== pending.email) {
      throw badRequest(
        "TOKEN_OLD_EMAIL",
        "This link is for an email address you've since changed.",
      );
    }
    if (user.emailVerifiedAt) return user;
    if (pending.consumedAt) {
      throw badRequest(
        "TOKEN_SUPERSEDED",
        "There's a newer email. Use the link or code in the latest one.",
      );
    }
    if (pending.expiresAt.getTime() <= Date.now()) {
      throw badRequest("CODE_EXPIRED", "This link expired. Links work for 15 minutes.");
    }
    return this.markVerified(user, client);
  }

  private async markVerified(user: UserRow, client: ClientContext) {
    const now = new Date();
    const updated = await this.deps.db.transaction(async (tx) => {
      await tx
        .update(emailVerifications)
        .set({ consumedAt: now })
        .where(eq(emailVerifications.userId, user.id));
      const [u] = await tx
        .update(users)
        .set({ emailVerifiedAt: now })
        .where(eq(users.id, user.id))
        .returning();
      return u ?? user;
    });
    await this.logEvent(user.id, "email_verified", client);
    return updated;
  }

  async resendVerification(userId: bigint) {
    await this.enforce(Limits.resend, userId.toString());
    const user = await this.getUser(userId);
    if (user.emailVerifiedAt) return;

    const code = randomNumericCode();
    const token = randomToken();
    await this.deps.db.transaction(async (tx) => {
      await tx
        .update(emailVerifications)
        .set({ consumedAt: new Date() })
        .where(and(eq(emailVerifications.userId, userId), isNull(emailVerifications.consumedAt)));
      await tx.insert(emailVerifications).values({
        id: this.deps.ids.next(),
        userId,
        email: user.email,
        codeHash: hmacHex(this.deps.config.REALM_SECRET, code),
        tokenHash: sha256Hex(token),
        expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
      });
    });
    this.sendMail(verificationEmail({ to: user.email, code, link: this.link("/verify", token) }));
  }

  /** Always succeeds from the caller's point of view — no account enumeration. */
  async forgotPassword(email: string, client: ClientContext) {
    await this.enforce(Limits.forgotIp, client.ip);
    const normalized = email.toLowerCase();
    await this.enforce(Limits.forgotEmail, normalized);

    const [user] = await this.deps.db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${normalized}`)
      .limit(1);
    if (user?.status !== "active") return;

    const token = randomToken();
    await this.deps.db.insert(passwordResets).values({
      tokenHash: sha256Hex(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    });
    await this.logEvent(user.id, "password_reset_requested", client);
    this.sendMail(passwordResetEmail({ to: user.email, link: this.link("/reset", token) }));
  }

  /** A reset link's state, read without using it up, so the page can say so before any typing. */
  async resetTokenStatus(token: string): Promise<"valid" | "expired" | "used" | "invalid"> {
    const [reset] = await this.deps.db
      .select()
      .from(passwordResets)
      .where(eq(passwordResets.tokenHash, sha256Hex(token)))
      .limit(1);
    if (!reset) return "invalid";
    if (reset.usedAt) return "used";
    if (reset.expiresAt.getTime() <= Date.now()) return "expired";
    return "valid";
  }

  async resetPassword(token: string, password: string, client: ClientContext) {
    await this.enforce(Limits.reset, client.ip);
    const tokenHash = sha256Hex(token);
    const now = new Date();
    const [reset] = await this.deps.db
      .select()
      .from(passwordResets)
      .where(
        and(
          eq(passwordResets.tokenHash, tokenHash),
          isNull(passwordResets.usedAt),
          gt(passwordResets.expiresAt, now),
        ),
      )
      .limit(1);
    if (!reset) throw badRequest("TOKEN_INVALID", "This reset link isn't valid anymore.");
    const owner = await this.getUser(reset.userId);
    await this.screen(password, [owner.username, owner.email.split("@")[0] ?? ""]);

    const passwordHash = await hashPassword(password);
    const user = await this.deps.db.transaction(async (tx) => {
      // Single use: the conditional update wins exactly once even under a race.
      const claimed = await tx
        .update(passwordResets)
        .set({ usedAt: now })
        .where(and(eq(passwordResets.tokenHash, tokenHash), isNull(passwordResets.usedAt)))
        .returning();
      if (claimed.length === 0)
        throw badRequest("TOKEN_INVALID", "This reset link was already used.");
      const [u] = await tx
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, reset.userId))
        .returning();
      await revokeAllSessions(this.deps, tx, reset.userId);
      return u;
    });
    if (!user) throw badRequest("TOKEN_INVALID", "This reset link isn't valid anymore.");
    await this.logEvent(user.id, "password_reset", client);
    this.sendMail(passwordChangedEmail({ to: user.email }));
  }

  async changePassword(
    userId: bigint,
    sessionId: bigint,
    current: string,
    next: string,
    client: ClientContext,
  ) {
    await this.enforce(Limits.loginAccount, `change:${userId}`);
    const user = await this.getUser(userId);
    if (!(await verifyPassword(user.passwordHash, current))) {
      throw new AppError(401, "INVALID_CREDENTIALS", "That isn't your current password.");
    }
    await this.screen(next, [user.username, user.email.split("@")[0] ?? ""]);
    const passwordHash = await hashPassword(next);
    await this.deps.db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash }).where(eq(users.id, userId));
      await revokeAllSessions(this.deps, tx, userId, sessionId);
    });
    await this.logEvent(userId, "password_changed", client, sessionId);
    this.sendMail(passwordChangedEmail({ to: user.email }));
  }

  /** Whether a username can be taken (as someone types it on sign-up). */
  async usernameAvailability(raw: string): Promise<UsernameAvailability> {
    const parsed = Username.safeParse(raw.toLowerCase());
    if (!parsed.success) return { available: false, reason: "invalid" };
    if (await whyReserved(this.deps.db, parsed.data))
      return { available: false, reason: "reserved" };
    const [taken] = await this.deps.db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.username}) = ${parsed.data}`)
      .limit(1);
    return taken ? { available: false, reason: "taken" } : { available: true };
  }

  async getUser(userId: bigint): Promise<UserRow> {
    const [user] = await this.deps.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new AppError(401, "UNAUTHORIZED", "Sign in to continue");
    return user;
  }

  private async enforce(rule: (typeof Limits)[keyof typeof Limits], key: string) {
    const r = await this.deps.limiter.hit(rule, key);
    if (!r.allowed) throw rateLimited(r.resetSeconds);
  }
}
