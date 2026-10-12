import { eq, schema } from "@realm/db";
import { sha256Hex } from "@realm/server-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  browser,
  createTestApp,
  newAccount,
  sessionCookie,
  type TestContext,
} from "../../test/helpers";

let t: TestContext;

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t.close();
});

let ip = 0;
/** Each simulated sign-up comes from its own IP (registration is limited to 5/hour/IP). */
const nextIp = () => `10.0.${Math.floor(++ip / 250)}.${ip % 250}`;

async function register(account = newAccount(), remoteAddress = nextIp()) {
  const res = await t.app.inject({
    method: "POST",
    url: "/v1/auth/register",
    headers: browser(),
    payload: account,
    remoteAddress,
  });
  return { res, account, cookie: sessionCookie(res) };
}

function codeFrom(email: string): string {
  const mail = t.mailer.last(email);
  const code = mail?.text.match(/code is: (\d{6})/)?.[1];
  if (!code) throw new Error(`no verification code mailed to ${email}`);
  return code;
}

function tokenFrom(email: string, path: string): string {
  const mail = t.mailer.last(email);
  const token = mail?.text.match(new RegExp(`${path}\\?token=([\\w-]+)`))?.[1];
  if (!token) throw new Error(`no ${path} link mailed to ${email}`);
  return token;
}

describe("registration", () => {
  it("creates an account, a session cookie, and sends a verification email", async () => {
    const { res, account, cookie } = await register();
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user.username).toBe(account.username);
    expect(body.user.emailVerified).toBe(false);
    expect(body.token).toBeUndefined(); // web clients never see the token
    expect(cookie).toBeTruthy();
    const setCookie = String(res.headers["set-cookie"]);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(t.mailer.last(account.email)?.subject).toMatch(/verify/i);
  });

  it("gives native clients a bearer token instead of a cookie", async () => {
    const res = await t.app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "x-realm-client": "ios/1.0.0" },
      payload: newAccount(),
    });
    expect(res.statusCode).toBe(201);
    const { token, session } = res.json();
    expect(typeof token).toBe("string");
    expect(session.platform).toBe("ios");
    expect(sessionCookie(res)).toBeUndefined();

    const me = await t.app.inject({
      method: "GET",
      url: "/v1/users/@me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.statusCode).toBe(200);
  });

  it("rejects taken usernames case-insensitively and taken emails", async () => {
    const { account } = await register();
    const dupeName = await register(newAccount({ username: account.username.toUpperCase() }));
    expect(dupeName.res.json().error.code).toBe("USERNAME_TAKEN");
    const dupeEmail = await register(newAccount({ email: account.email.toUpperCase() }));
    expect(dupeEmail.res.json().error.code).toBe("EMAIL_TAKEN");
  });

  it("rejects under-13s, reserved names, and weak passwords with field details", async () => {
    const young = await register(newAccount({ birthDate: new Date().toISOString().slice(0, 10) }));
    expect(young.res.statusCode).toBe(400);
    expect(young.res.json().error.code).toBe("VALIDATION_FAILED");
    expect(young.res.json().error.details.issues[0].path).toEqual(["birthDate"]);

    const reserved = await register(newAccount({ username: "admin" }));
    expect(reserved.res.json().error.code).toBe("USERNAME_RESERVED");

    const weak = await register(newAccount({ password: "short" }));
    expect(weak.res.json().error.details.issues[0].path).toEqual(["password"]);
  });

  it("rate-limits sign-ups per IP", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++)
      statuses.push((await register(newAccount(), "192.0.2.99")).res.statusCode);
    expect(statuses.slice(0, 5).every((s) => s === 201)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});

describe("login & sessions", () => {
  it("logs in with username or email, and rejects wrong passwords uniformly", async () => {
    const { account } = await register();
    for (const login of [account.username, account.email.toUpperCase()]) {
      const res = await t.app.inject({
        method: "POST",
        url: "/v1/auth/login",
        headers: browser(),
        payload: { login, password: account.password },
      });
      expect(res.statusCode).toBe(200);
    }
    const wrong = await t.app.inject({
      method: "POST",
      url: "/v1/auth/login",
      headers: browser(),
      payload: { login: account.username, password: "not the password" },
    });
    const unknown = await t.app.inject({
      method: "POST",
      url: "/v1/auth/login",
      headers: browser(),
      payload: { login: "nobody_here", password: "whatever-password" },
    });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json().error.message).toBe(unknown.json().error.message);
  });

  it("lists sessions, revokes one, and logs out", async () => {
    const { account, cookie: first } = await register();
    const second = await t.app.inject({
      method: "POST",
      url: "/v1/auth/login",
      headers: { ...browser(), "user-agent": "Mozilla/5.0 (Windows NT 10.0) Firefox/140.0" },
      payload: { login: account.username, password: account.password },
    });
    const secondCookie = sessionCookie(second);

    const list = await t.app.inject({
      method: "GET",
      url: "/v1/auth/sessions",
      headers: browser(first),
    });
    const sessions = list.json().sessions as { id: string; current: boolean; deviceName: string }[];
    expect(sessions).toHaveLength(2);
    expect(sessions.filter((s) => s.current)).toHaveLength(1);
    expect(sessions.some((s) => s.deviceName === "Firefox on Windows")).toBe(true);

    const other = sessions.find((s) => !s.current);
    const revoke = await t.app.inject({
      method: "DELETE",
      url: `/v1/auth/sessions/${other?.id}`,
      headers: browser(first),
    });
    expect(revoke.statusCode).toBe(204);
    const afterRevoke = await t.app.inject({
      method: "GET",
      url: "/v1/users/@me",
      headers: browser(secondCookie),
    });
    expect(afterRevoke.statusCode).toBe(401);

    const logout = await t.app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      headers: browser(first),
    });
    expect(logout.statusCode).toBe(204);
    const afterLogout = await t.app.inject({
      method: "GET",
      url: "/v1/users/@me",
      headers: browser(first),
    });
    expect(afterLogout.statusCode).toBe(401);
  });

  it("never extends a session when the web server only peeks at it", async () => {
    const { cookie } = await register();
    if (!cookie) throw new Error("no session cookie");
    // Bring the session near its end, inside the window where it would normally be extended.
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    await t.deps.db
      .update(schema.sessions)
      .set({ expiresAt: soon })
      .where(eq(schema.sessions.tokenHash, sha256Hex(cookie)));
    await t.deps.kv.del(`sess:${sha256Hex(cookie)}`);

    const peek = await t.app.inject({
      method: "GET",
      url: "/v1/users/@me",
      headers: { ...browser(cookie), "x-realm-peek": "1" },
    });
    expect(peek.statusCode).toBe(200);
    expect(sessionCookie(peek)).toBeUndefined();

    const visit = await t.app.inject({
      method: "GET",
      url: "/v1/users/@me",
      headers: browser(cookie),
    });
    expect(visit.statusCode).toBe(200);
    expect(sessionCookie(visit)).toBe(cookie);
  });

  it("blocks cookie-authenticated mutations from foreign or missing origins (CSRF)", async () => {
    const { cookie } = await register();
    const foreign = await t.app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      headers: { origin: "https://evil.example", cookie: `realm_session=${cookie}` },
    });
    expect(foreign.statusCode).toBe(403);
    const missing = await t.app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      headers: { cookie: `realm_session=${cookie}` },
    });
    expect(missing.statusCode).toBe(403);
  });
});

describe("email verification", () => {
  it("verifies with the mailed 6-digit code", async () => {
    const { account, cookie } = await register();
    const bad = await t.app.inject({
      method: "POST",
      url: "/v1/auth/email/verify",
      headers: browser(cookie),
      payload: { code: "000000" === codeFrom(account.email) ? "111111" : "000000" },
    });
    expect(bad.json().error.code).toBe("INVALID_CODE");

    const ok = await t.app.inject({
      method: "POST",
      url: "/v1/auth/email/verify",
      headers: browser(cookie),
      payload: { code: codeFrom(account.email) },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().emailVerified).toBe(true);
  });

  it("verifies with the mailed link without being signed in", async () => {
    const { account } = await register();
    const res = await t.app.inject({
      method: "POST",
      url: "/v1/auth/email/verify",
      headers: browser(),
      payload: { token: tokenFrom(account.email, "/verify") },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().emailVerified).toBe(true);
  });

  it("locks a code after too many wrong attempts", async () => {
    const { account, cookie } = await register();
    const real = codeFrom(account.email);
    const wrong = real === "123456" ? "654321" : "123456";
    for (let i = 0; i < 5; i++) {
      await t.app.inject({
        method: "POST",
        url: "/v1/auth/email/verify",
        headers: browser(cookie),
        payload: { code: wrong },
      });
    }
    const res = await t.app.inject({
      method: "POST",
      url: "/v1/auth/email/verify",
      headers: browser(cookie),
      payload: { code: real },
    });
    expect(res.json().error.code).toBe("INVALID_CODE");
  });
});

describe("password reset", () => {
  it("never reveals whether an email has an account", async () => {
    const res = await t.app.inject({
      method: "POST",
      url: "/v1/auth/password/forgot",
      headers: browser(),
      payload: { email: "no-such-person@example.com" },
    });
    expect(res.statusCode).toBe(202);
  });

  it("resets with a single-use link and signs out every session", async () => {
    const { account, cookie } = await register();
    await t.app.inject({
      method: "POST",
      url: "/v1/auth/password/forgot",
      headers: browser(),
      payload: { email: account.email },
    });
    const token = tokenFrom(account.email, "/reset");
    const newPassword = "an entirely new passphrase";

    const reset = await t.app.inject({
      method: "POST",
      url: "/v1/auth/password/reset",
      headers: browser(),
      payload: { token, password: newPassword },
    });
    expect(reset.statusCode).toBe(204);

    const reuse = await t.app.inject({
      method: "POST",
      url: "/v1/auth/password/reset",
      headers: browser(),
      payload: { token, password: "yet another passphrase" },
    });
    expect(reuse.json().error.code).toBe("TOKEN_INVALID");

    const oldSession = await t.app.inject({
      method: "GET",
      url: "/v1/users/@me",
      headers: browser(cookie),
    });
    expect(oldSession.statusCode).toBe(401);

    const login = await t.app.inject({
      method: "POST",
      url: "/v1/auth/login",
      headers: browser(),
      payload: { login: account.email, password: newPassword },
    });
    expect(login.statusCode).toBe(200);
  });
});

describe("gateway tickets & releases", () => {
  it("issues single-use gateway tickets to signed-in users only", async () => {
    const anon = await t.app.inject({
      method: "POST",
      url: "/v1/gateway/tickets",
      headers: browser(),
    });
    expect(anon.statusCode).toBe(401);
    const { cookie } = await register();
    const res = await t.app.inject({
      method: "POST",
      url: "/v1/gateway/tickets",
      headers: browser(cookie),
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().ticket.length).toBeGreaterThan(30);
  });

  it("lists every native platform as coming soon", async () => {
    const res = await t.app.inject({ method: "GET", url: "/v1/releases" });
    const platforms = res
      .json()
      .releases.map((r: { platform: string; status: string }) => [r.platform, r.status]);
    expect(platforms).toEqual([
      ["windows", "coming_soon"],
      ["macos", "coming_soon"],
      ["linux", "coming_soon"],
      ["android", "coming_soon"],
      ["ios", "coming_soon"],
    ]);
  });
});

describe("sign-up's steps and the recovery details", () => {
  it("asks the age first and holds an under-age browser for a day, also on register", async () => {
    const remoteAddress = nextIp();
    const adult = await t.app.inject({
      method: "POST",
      url: "/v1/auth/age-check",
      headers: browser(),
      payload: { birthDate: "2001-04-12" },
      remoteAddress,
    });
    expect(adult.statusCode).toBe(204);

    const young = new Date();
    young.setUTCFullYear(young.getUTCFullYear() - 10);
    const child = await t.app.inject({
      method: "POST",
      url: "/v1/auth/age-check",
      headers: browser(),
      payload: { birthDate: young.toISOString().slice(0, 10) },
      remoteAddress,
    });
    expect(child.statusCode).toBe(403);
    expect(child.json().error.code).toBe("UNDER_AGE");
    const hold = child.cookies.find((c) => c.name === "realm_age_hold");
    expect(hold?.httpOnly).toBe(true);

    const retry = await t.app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { ...browser(), cookie: `realm_age_hold=${hold?.value}` },
      payload: newAccount(),
      remoteAddress,
    });
    expect(retry.statusCode).toBe(403);
    expect(retry.json().error.code).toBe("UNDER_AGE");

    const forged = await t.app.inject({
      method: "POST",
      url: "/v1/auth/age-check",
      headers: { ...browser(), cookie: `realm_age_hold=${Date.now()}.forged` },
      payload: { birthDate: "2001-04-12" },
      remoteAddress,
    });
    expect(forged.statusCode).toBe(204);
  });

  it("says whether a username is free, taken, reserved or not allowed", async () => {
    const { account } = await register();
    const check = async (username: string) =>
      (
        await t.app.inject({
          method: "GET",
          url: `/v1/auth/username-available?username=${encodeURIComponent(username)}`,
          headers: browser(),
        })
      ).json();
    expect(await check(account.username.toUpperCase())).toEqual({
      available: false,
      reason: "taken",
    });
    expect(await check("admin")).toEqual({ available: false, reason: "reserved" });
    expect(await check("a b")).toEqual({ available: false, reason: "invalid" });
    expect(await check(`fresh_${Date.now() % 100000}`)).toEqual({ available: true });
  });

  it("refuses common passwords and the account's own name as a password", async () => {
    const common = await register(newAccount({ password: "1234567890" }));
    expect(common.res.json().error.code).toBe("PASSWORD_TOO_COMMON");
    const own = newAccount();
    const named = await register({ ...own, password: `${own.username}2026` });
    expect(named.res.json().error.code).toBe("PASSWORD_TOO_COMMON");
  });

  it("keeps the colour picked on sign-up", async () => {
    const { cookie } = await register({ ...newAccount(), accent: "orchid" } as never);
    const settings = await t.app.inject({
      method: "GET",
      url: "/v1/users/@me/settings",
      headers: browser(cookie),
    });
    expect(settings.json().accent).toBe("orchid");
  });

  it("answers a verification link opened after verifying as success, not as broken", async () => {
    const { account, cookie } = await register();
    const token = tokenFrom(account.email, "/verify");
    await t.app.inject({
      method: "POST",
      url: "/v1/auth/email/verify",
      headers: browser(cookie),
      payload: { code: codeFrom(account.email) },
    });
    const late = await t.app.inject({
      method: "POST",
      url: "/v1/auth/email/verify",
      headers: browser(),
      payload: { token },
    });
    expect(late.statusCode).toBe(200);
    expect(late.json().emailVerified).toBe(true);
  });

  it("reports a reset link's state without using it up", async () => {
    const { account } = await register();
    await t.app.inject({
      method: "POST",
      url: "/v1/auth/password/forgot",
      headers: browser(),
      payload: { email: account.email },
    });
    const token = tokenFrom(account.email, "/reset");
    const status = async (tk: string) =>
      (
        await t.app.inject({
          method: "GET",
          url: `/v1/auth/password/reset/status?token=${tk}`,
          headers: browser(),
        })
      ).json().status;
    expect(await status(token)).toBe("valid");
    expect(await status(token)).toBe("valid");
    await t.app.inject({
      method: "POST",
      url: "/v1/auth/password/reset",
      headers: browser(),
      payload: { token, password: "a brand new passphrase" },
    });
    expect(await status(token)).toBe("used");
    expect(await status("x".repeat(43))).toBe("invalid");
  });
});
