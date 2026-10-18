/**
 * Attacks people actually try against apps like Realm, each one played against the real API and
 * shown to fail: injection, cross-site tricks, guessing passwords, stolen or forged sessions,
 * reaching other people's things, oversized or poisoned requests, and peeking at private files.
 * docs/SECURITY.md lists what each protection is.
 */
import { Limits } from "@realm/server-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  browser,
  createTestApp,
  newAccount,
  sessionCookie,
  type TestContext,
  WEB_ORIGIN,
} from "./test/helpers";

let t: TestContext;

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t.close();
});

let ip = 0;
const nextIp = () => `10.77.${Math.floor(++ip / 250)}.${ip % 250}`;

async function person(overrides: Partial<Record<string, string>> = {}) {
  const account = newAccount(overrides);
  const res = await t.app.inject({
    method: "POST",
    url: "/v1/auth/register",
    headers: browser(),
    payload: account,
    remoteAddress: nextIp(),
  });
  const cookie = sessionCookie(res);
  if (!cookie) throw new Error("no session");
  return { cookie, id: res.json().user.id as string, ...account };
}

type Method = "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
const call = (cookie: string | undefined, method: Method, url: string, payload?: unknown) =>
  t.app.inject({
    method,
    url: `/v1${url}`,
    headers: browser(cookie),
    remoteAddress: nextIp(),
    ...(payload === undefined ? {} : { payload: payload as object }),
  });

const login = (who: string, password: string, extra: Record<string, string> = {}, from?: string) =>
  t.app.inject({
    method: "POST",
    url: "/v1/auth/login",
    headers: { ...browser(), ...extra },
    payload: { login: who, password },
    remoteAddress: from ?? nextIp(),
  });

describe("injection", () => {
  it("treats SQL in search and sign-in as plain text", async () => {
    await person({ displayName: "Injection Target" });
    const search = await call(undefined, "GET", `/search?q=${encodeURIComponent("zz' OR '1'='1")}`);
    expect(search.statusCode).toBe(200);
    expect(search.json().users).toEqual([]);
    const dropped = await call(
      undefined,
      "GET",
      `/search?q=${encodeURIComponent("%'; DROP TABLE users; --")}`,
    );
    expect(dropped.statusCode).toBe(200);
    // Still there, still working.
    expect((await person()).id).toBeTruthy();

    const sneaky = await login("' OR 1=1 --", "anything");
    expect(sneaky.statusCode).toBe(401);
  });

  it("stores script tags as words, served as JSON that browsers won't run", async () => {
    const noor = await person();
    const xss = '<script>alert("hi")</script><img src=x onerror=alert(1)>';
    const made = await call(noor.cookie, "POST", "/posts", { kind: "text", caption: xss });
    expect(made.statusCode).toBe(201);
    expect(made.json().caption).toBe(xss);
    expect(made.headers["content-type"]).toMatch(/^application\/json/);
    expect(made.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("refuses requests that try to poison objects (prototype pollution)", async () => {
    const noor = await person();
    const res = await t.app.inject({
      method: "POST",
      url: "/v1/posts",
      headers: { ...browser(noor.cookie), "content-type": "application/json" },
      payload: '{"kind":"text","caption":"hi","__proto__":{"isAdmin":true}}',
      remoteAddress: nextIp(),
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("cross-site tricks", () => {
  it("refuses a signed-in action sent from another website (CSRF)", async () => {
    const noor = await person();
    const evil = await t.app.inject({
      method: "POST",
      url: "/v1/posts",
      headers: { origin: "https://evil.example", cookie: `realm_session=${noor.cookie}` },
      payload: { kind: "text", caption: "posted by a stranger's page" },
    });
    expect(evil.statusCode).toBe(403);
    const blind = await t.app.inject({
      method: "POST",
      url: "/v1/posts",
      headers: { cookie: `realm_session=${noor.cookie}` },
      payload: { kind: "text", caption: "no origin at all" },
    });
    expect(blind.statusCode).toBe(403);
  });

  it("sends headers that stop framing (clickjacking) and content sniffing", async () => {
    const res = await t.app.inject({ method: "GET", url: "/health" });
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["strict-transport-security"]).toMatch(/max-age=/);
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("guessing passwords", () => {
  it("answers the same for a wrong password and an account that doesn't exist", async () => {
    const noor = await person();
    const wrong = await login(noor.username, "not the password at all");
    const nobody = await login("nobody_here_at_all", "not the password at all");
    expect(wrong.statusCode).toBe(nobody.statusCode);
    expect(wrong.json().error).toMatchObject({
      code: nobody.json().error.code,
      message: nobody.json().error.message,
    });
    // Asking for a reset says the same either way, and mails nobody who isn't there.
    const before = t.mailer.outbox.length;
    const reset = await call(undefined, "POST", "/auth/password/forgot", {
      email: "nobody-at-all@example.com",
    });
    expect(reset.statusCode).toBe(202);
    expect(t.mailer.outbox.length).toBe(before);
  });

  it("pauses an account after repeated wrong passwords and tells its owner", async () => {
    const noor = await person();
    const codes: number[] = [];
    for (let i = 0; i < 9; i++)
      codes.push((await login(noor.username, `guess number ${i}`)).statusCode);
    expect(codes.slice(0, 8).every((c) => c === 401)).toBe(true);
    expect(codes[8]).toBe(429);
    // Even the right password waits out the pause: the guesser can't get lucky.
    expect((await login(noor.username, noor.password)).statusCode).toBe(429);
    const mails = t.mailer.outbox.filter(
      (m) => m.to === noor.email && /kept trying to sign in/.test(m.subject),
    );
    expect(mails).toHaveLength(1);
  });

  it("slows down one address trying many accounts", async () => {
    const from = "10.88.0.1";
    const codes: number[] = [];
    for (let i = 0; i < 21; i++) {
      codes.push((await login(`spray_target_${i}`, "Summer2026!", {}, from)).statusCode);
    }
    expect(codes.at(-1)).toBe(429);
  });

  it("emails the owner when wrong passwords flood in across Realm", async () => {
    const rule = Limits.loginFailuresAll as { limit: number };
    const was = rule.limit;
    rule.limit = 3;
    (t.deps.config as { REALM_ALERT_EMAIL?: string }).REALM_ALERT_EMAIL = "owner@example.com";
    try {
      for (let i = 0; i < 5; i++) await login(`stuffing_${i}`, "leaked password 123");
      const alerts = t.mailer.outbox.filter(
        (m) => m.to === "owner@example.com" && /many wrong passwords/.test(m.subject),
      );
      expect(alerts).toHaveLength(1);
    } finally {
      rule.limit = was;
    }
  });

  it("emails people when their account signs in from a new device", async () => {
    const noor = await person();
    const chrome = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0" };
    expect((await login(noor.username, noor.password, chrome)).statusCode).toBe(200);
    expect((await login(noor.username, noor.password, chrome)).statusCode).toBe(200);
    const mails = t.mailer.outbox.filter(
      (m) => m.to === noor.email && /New sign-in/.test(m.subject),
    );
    expect(mails).toHaveLength(1);
    expect(mails[0]?.text).toContain("Chrome on Windows");
  });
});

describe("stolen or forged sessions", () => {
  it("refuses a made-up token, and a session once it's signed out", async () => {
    const fake = await t.app.inject({
      method: "GET",
      url: "/v1/users/@me",
      headers: { authorization: `Bearer ${"a".repeat(43)}` },
    });
    expect(fake.statusCode).toBe(401);

    const noor = await person();
    expect((await call(noor.cookie, "POST", "/auth/logout")).statusCode).toBe(204);
    expect((await call(noor.cookie, "GET", "/users/@me")).statusCode).toBe(401);
  });

  it("keeps session cookies out of reach of page scripts and other sites", async () => {
    const res = await t.app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: browser(),
      payload: newAccount(),
      remoteAddress: nextIp(),
    });
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it("can't make itself verified, suspended-proof or someone else by editing its profile", async () => {
    const noor = await person();
    const res = await call(noor.cookie, "PATCH", "/users/@me", {
      displayName: "Noor Edited",
      emailVerified: true,
      status: "active",
      id: "1",
      teen: false,
    });
    expect(res.statusCode).toBe(200);
    const me = (await call(noor.cookie, "GET", "/users/@me")).json();
    expect(me).toMatchObject({ id: noor.id, displayName: "Noor Edited", emailVerified: false });
  });
});

describe("reaching other people's things", () => {
  it("can't change or delete someone else's post", async () => {
    const noor = await person();
    const kenji = await person();
    const post = (
      await call(noor.cookie, "POST", "/posts", { kind: "text", caption: "mine" })
    ).json();
    expect(
      (await call(kenji.cookie, "PATCH", `/posts/${post.id}`, { caption: "hacked" })).statusCode,
    ).toBe(403);
    expect((await call(kenji.cookie, "DELETE", `/posts/${post.id}`)).statusCode).toBe(403);
    expect((await call(noor.cookie, "GET", `/posts/${post.id}`)).json().caption).toBe("mine");
  });

  it("can't read a conversation it isn't in, or a Space's reports without being a moderator", async () => {
    const noor = await person();
    const kenji = await person();
    const stranger = await person();
    const space = (
      await call(noor.cookie, "POST", "/communities", { name: "Private Lobby" })
    ).json();
    const invite = (await call(noor.cookie, "POST", `/communities/${space.id}/invites`, {})).json();
    await call(kenji.cookie, "POST", `/invites/${invite.code}`);
    const dm = (
      await call(noor.cookie, "POST", "/users/@me/channels", { recipientIds: [kenji.id] })
    ).json();
    await call(noor.cookie, "POST", `/channels/${dm.id}/messages`, { content: "just us" });

    const peek = await call(stranger.cookie, "GET", `/channels/${dm.id}/messages`);
    expect([403, 404]).toContain(peek.statusCode);
    const room = space.channels[0].id as string;
    expect([403, 404]).toContain(
      (await call(stranger.cookie, "GET", `/channels/${room}/messages`)).statusCode,
    );
    expect((await call(kenji.cookie, "GET", `/communities/${space.id}/reports`)).statusCode).toBe(
      403,
    );
  });

  it("won't walk out of the files folder (path traversal)", async () => {
    for (const path of ["/v1/media/local/..%2F..%2F.env", "/v1/media/local/../../package.json"]) {
      const res = await t.app.inject({ method: "GET", url: path });
      expect([400, 403, 404]).toContain(res.statusCode);
      expect(res.body).not.toMatch(/DATABASE_URL|"dependencies"/);
    }
  });
});

describe("floods and oversized requests", () => {
  it("refuses a request body over 1 MB", async () => {
    const noor = await person();
    const res = await call(noor.cookie, "POST", "/posts", {
      kind: "text",
      caption: "x".repeat(2 * 1024 * 1024),
    });
    expect(res.statusCode).toBe(413);
  });

  it("limits how many accounts one address can make", async () => {
    const from = "10.66.0.1";
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await t.app.inject({
        method: "POST",
        url: "/v1/auth/register",
        headers: { origin: WEB_ORIGIN },
        payload: newAccount(),
        remoteAddress: from,
      });
      codes.push(res.statusCode);
    }
    expect(codes.slice(0, 5).every((c) => c === 201)).toBe(true);
    expect(codes[5]).toBe(429);
  });
});
