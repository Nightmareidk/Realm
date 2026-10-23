import { eq, schema } from "@realm/db";
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
const register = (overrides: Partial<Record<string, string>> = {}) =>
  t.app.inject({
    method: "POST",
    url: "/v1/auth/register",
    headers: browser(),
    payload: newAccount(overrides),
    remoteAddress: `10.90.${Math.floor(++ip / 250)}.${ip % 250}`,
  });
async function person(overrides: Partial<Record<string, string>> = {}) {
  const res = await register(overrides);
  const cookie = sessionCookie(res);
  if (!cookie) throw new Error(`no session: ${res.body}`);
  return { cookie, id: res.json().user.id as string, username: res.json().user.username as string };
}
type Method = "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
const call = (cookie: string | undefined, method: Method, url: string, payload?: unknown) =>
  t.app.inject({
    method,
    url: `/v1${url}`,
    headers: browser(cookie),
    ...(payload === undefined ? {} : { payload: payload as object }),
  });
const makeStaff = (id: string, role: "admin" | "moderator") =>
  t.deps.db
    .update(schema.users)
    .set({ staffRole: role })
    .where(eq(schema.users.id, BigInt(id)));

describe("famous names", () => {
  it("keeps famous names and near copies back at sign-up, but not fan accounts", async () => {
    for (const username of [
      "sabrinacarpenter",
      "the_real.sabrina_carpenter",
      "ninja.official",
      "realm_support",
    ]) {
      const res = await register({ username });
      expect(res.json().error?.code, username).toBe("USERNAME_RESERVED");
    }
    expect((await register({ username: "sabrinacarpenter_fan" })).statusCode).toBe(201);
  });
});

describe("admin", () => {
  it("hides itself from anyone who isn't staff", async () => {
    const noor = await person();
    expect((await call(noor.cookie, "GET", "/admin/overview")).statusCode).toBe(404);
  });

  it("verifies on request, records why, and lets only admins give the badge", async () => {
    const boss = await person();
    const mod = await person();
    const star = await person();
    await makeStaff(boss.id, "admin");
    await makeStaff(mod.id, "moderator");

    const asked = await call(star.cookie, "POST", "/users/@me/verification", {
      kind: "notable",
      realName: "Star Person",
      category: "Musician",
      links: ["https://example.com/star"],
    });
    expect(asked.json()).toMatchObject({ canApply: false, request: { status: "pending" } });

    const queue = (await call(boss.cookie, "GET", "/admin/verification")).json().items;
    const mine = queue.find((r: { user: { id: string } }) => r.user.id === star.id);
    expect(mine).toBeTruthy();
    // A moderator can't verify anyone.
    expect(
      (await call(mod.cookie, "POST", `/admin/verification/${mine.id}`, { approve: true }))
        .statusCode,
    ).toBe(404);
    expect(
      (await call(boss.cookie, "POST", `/admin/verification/${mine.id}`, { approve: true }))
        .statusCode,
    ).toBe(204);
    const profile = (await call(boss.cookie, "GET", `/users/${star.username}/profile`)).json();
    expect(profile.user.verified).toBe("notable");

    // A kept-back name goes only to a verified account, by an admin.
    const renamed = await call(boss.cookie, "PATCH", `/admin/users/${star.id}`, {
      username: "sabrinacarpenter",
      reason: "Their real account",
    });
    expect(renamed.statusCode, renamed.body).toBe(200);
    const log = (await call(boss.cookie, "GET", "/admin/log")).json().items;
    expect(
      log.some((a: { action: string; reason: string }) => a.reason === "Their real account"),
    ).toBe(true);
  });

  it("suspends with a reason, and never lets staff lock themselves out", async () => {
    const mod = await person();
    const troll = await person();
    await makeStaff(mod.id, "moderator");
    const noReason = await call(mod.cookie, "PATCH", `/admin/users/${troll.id}`, {
      status: "suspended",
    });
    expect(noReason.statusCode).toBe(400);
    const done = await call(mod.cookie, "PATCH", `/admin/users/${troll.id}`, {
      status: "suspended",
      reason: "Spam",
    });
    expect(done.json()).toMatchObject({ status: "suspended" });
    // Signed out at once.
    expect((await call(troll.cookie, "GET", "/users/@me")).statusCode).toBe(401);
    const self = await call(mod.cookie, "PATCH", `/admin/users/${mod.id}`, {
      status: "suspended",
      reason: "oops",
    });
    expect(self.statusCode).toBe(403);
  });
});

describe("Realm's own music library", () => {
  const MP3 = Buffer.concat([Buffer.from("ID3"), Buffer.alloc(400)]);
  async function uploadSong(cookie: string, extra: Record<string, unknown> = {}) {
    return call(cookie, "POST", "/media/uploads", {
      kind: "audio",
      mimeType: "audio/mpeg",
      sizeBytes: MP3.length,
      durationMs: 7 * 60 * 1000,
      ...extra,
    });
  }

  it("lets admins add full songs everyone can find and use, and take them out again", async () => {
    const boss = await person();
    const noor = await person();
    await makeStaff(boss.id, "admin");

    // Seven minutes is too long for a voice message, and only admins upload library tracks.
    expect((await uploadSong(noor.cookie)).statusCode).toBe(400);
    expect((await uploadSong(noor.cookie, { purpose: "track" })).statusCode).toBe(404);

    const ticket = (await uploadSong(boss.cookie, { purpose: "track" })).json();
    await t.app.inject({
      method: "PUT",
      url: ticket.uploadUrl.replace(/^\/api/, ""),
      headers: { "content-type": "audio/mpeg" },
      payload: MP3,
    });
    expect(
      (await call(boss.cookie, "POST", `/media/${ticket.mediaId}/complete`, {})).statusCode,
    ).toBe(200);

    const added = await call(boss.cookie, "POST", "/admin/tracks", {
      mediaId: ticket.mediaId,
      title: "Realm Nights",
      artist: "Realm House Band",
      licence: "own",
    });
    expect(added.statusCode).toBe(201);
    expect(added.json().sound).toMatchObject({ title: "Realm Nights", licence: "Realm's own" });
    const id = added.json().sound.id as string;

    // Anyone finds it first in search, and in Music's "New on Realm".
    const found = (await call(noor.cookie, "GET", "/sounds?q=realm%20nights")).json().items;
    expect(found[0]?.id).toBe(id);
    const home = (await call(noor.cookie, "GET", "/music/home")).json();
    expect(home.featured.map((s: { id: string }) => s.id)).toContain(id);
    // Not someone else's: a moderator can't add tracks.
    expect((await call(noor.cookie, "GET", "/admin/tracks")).statusCode).toBe(404);

    // Taken out: gone from search.
    await call(boss.cookie, "PUT", `/admin/tracks/${id}/hidden`, { hidden: true });
    const after = (await call(noor.cookie, "GET", "/sounds?q=realm%20nights")).json().items;
    expect(after.some((s: { id: string }) => s.id === id)).toBe(false);
  });
});
