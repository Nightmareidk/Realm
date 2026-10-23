import { schema } from "@realm/db";
import { NoopPusher, type Pusher } from "@realm/server-core";
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
async function person(overrides: Partial<Record<string, string>> = {}) {
  const account = newAccount(overrides);
  const res = await t.app.inject({
    method: "POST",
    url: "/v1/auth/register",
    headers: browser(),
    payload: account,
    remoteAddress: `10.30.${Math.floor(++ip / 250)}.${ip % 250}`,
  });
  const cookie = sessionCookie(res);
  if (!cookie) throw new Error("no session");
  return { cookie, id: res.json().user.id as string };
}

type Method = "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
const call = (cookie: string | undefined, method: Method, url: string, payload?: unknown) =>
  t.app.inject({
    method,
    url: `/v1${url}`,
    headers: browser(cookie),
    ...(payload === undefined ? {} : { payload: payload as object }),
  });

// A 2×3 PNG, built by hand: the signature and an IHDR with its size.
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from([0, 0, 0, 13]),
  Buffer.from("IHDR"),
  Buffer.from([0, 0, 0, 2, 0, 0, 0, 3, 8, 6, 0, 0, 0]),
  Buffer.alloc(40),
]);

/** Ask for a ticket, PUT the bytes the way a browser would, then finish. */
async function upload(
  cookie: string,
  kind: "image" | "audio" | "file",
  bytes: Buffer,
  mimeType: string,
  extra: Record<string, unknown> = {},
) {
  const ticket = await call(cookie, "POST", "/media/uploads", {
    kind,
    mimeType,
    sizeBytes: bytes.length,
    ...extra,
  });
  expect(ticket.statusCode).toBe(201);
  const { mediaId, uploadUrl } = ticket.json();
  const put = await t.app.inject({
    method: "PUT",
    url: uploadUrl.replace(/^\/api/, ""),
    headers: { "content-type": mimeType },
    payload: bytes,
  });
  expect(put.statusCode).toBe(200);
  return {
    mediaId: mediaId as string,
    done: await call(cookie, "POST", `/media/${mediaId}/complete`),
  };
}

async function spaceWith(owner: { cookie: string }, ...others: { cookie: string }[]) {
  const space = (await call(owner.cookie, "POST", "/communities", { name: "Lobby" })).json();
  const invite = (await call(owner.cookie, "POST", `/communities/${space.id}/invites`, {})).json();
  for (const o of others) await call(o.cookie, "POST", `/invites/${invite.code}`);
  return { space, room: space.channels[0].id as string };
}

describe("uploads", () => {
  it("checks what arrived, reads an image's size, and serves it only to people who can see it", async () => {
    const noor = await person();
    const kenji = await person();
    const stranger = await person();
    const { mediaId, done } = await upload(noor.cookie, "image", PNG, "image/png");
    expect(done.statusCode).toBe(200);
    expect(done.json()).toMatchObject({
      status: "ready",
      width: 2,
      height: 3,
      mimeType: "image/png",
    });

    const { room } = await spaceWith(noor, kenji);
    const sent = await call(noor.cookie, "POST", `/channels/${room}/messages`, {
      content: "",
      attachmentIds: [mediaId],
    });
    expect(sent.statusCode).toBe(201);
    expect(sent.json().attachments[0]).toMatchObject({ id: mediaId, kind: "image", width: 2 });

    // In the room: Kenji may read it; a stranger may not.
    const asKenji = await call(kenji.cookie, "GET", `/media/${mediaId}/raw`);
    expect(asKenji.statusCode).toBe(302);
    const file = await t.app.inject({
      method: "GET",
      url: String(asKenji.headers.location).replace(/^\/api/, ""),
    });
    expect(file.statusCode).toBe(200);
    expect(file.rawPayload.subarray(0, 4).toString("hex")).toBe("89504e47");
    expect((await call(stranger.cookie, "GET", `/media/${mediaId}/raw`)).statusCode).toBe(404);

    // Sent once: it can't be attached again.
    const again = await call(noor.cookie, "POST", `/channels/${room}/messages`, {
      content: "",
      attachmentIds: [mediaId],
    });
    expect(again.json().error.code).toBe("UPLOAD_INVALID");
  });

  it("refuses a file that isn't what it claims, and programs", async () => {
    const noor = await person();
    const fake = await upload(
      noor.cookie,
      "image",
      Buffer.from("not really a picture at all"),
      "image/png",
    );
    expect(fake.done.statusCode).toBe(400);
    expect(fake.done.json().error.code).toBe("UPLOAD_INVALID");
    const exe = await upload(
      noor.cookie,
      "file",
      Buffer.concat([Buffer.from("MZ"), Buffer.alloc(64)]),
      "application/x-msdownload",
      { filename: "game.exe" },
    );
    expect(exe.done.json().error.message).toContain("Programs");
    const tooBig = await call(noor.cookie, "POST", "/media/uploads", {
      kind: "image",
      mimeType: "image/png",
      sizeBytes: 50 * 1024 * 1024,
    });
    expect(tooBig.statusCode).toBe(413);
  });

  it("keeps a file's name and always downloads it", async () => {
    const noor = await person();
    const { mediaId, done } = await upload(
      noor.cookie,
      "file",
      Buffer.from("plain notes\n"),
      "text/plain",
      {
        filename: "notes.txt",
      },
    );
    expect(done.json()).toMatchObject({
      filename: "notes.txt",
      mimeType: "application/octet-stream",
    });
    const link = await call(noor.cookie, "GET", `/media/${mediaId}/raw`);
    const file = await t.app.inject({
      method: "GET",
      url: String(link.headers.location).replace(/^\/api/, ""),
    });
    expect(String(file.headers["content-disposition"])).toContain('filename="notes.txt"');
  });

  it("sets a profile picture from your own image only", async () => {
    const noor = await person();
    const kenji = await person();
    const { mediaId } = await upload(noor.cookie, "image", PNG, "image/png");
    const set = await call(noor.cookie, "PATCH", "/users/@me", { avatarMediaId: mediaId });
    expect(set.json().avatarUrl).toBe(`/api/v1/media/${mediaId}/raw`);
    // Profile pictures are public.
    expect((await call(undefined, "GET", `/media/${mediaId}/raw`)).statusCode).toBe(302);
    const theirs = await call(kenji.cookie, "PATCH", "/users/@me", { avatarMediaId: mediaId });
    expect(theirs.json().error.code).toBe("UPLOAD_INVALID");
  });

  /** Lights a Space up with test Sparks from new people. */
  async function glow(spaceId: string, n: number) {
    for (let i = 0; i < n; i++) {
      const giver = await person();
      await t.deps.db.insert(schema.spaceSparks).values({
        id: t.deps.ids.next(),
        communityId: BigInt(spaceId),
        userId: BigInt(giver.id),
        source: "test",
        endsAt: new Date(Date.now() + 86_400_000),
      });
    }
  }

  it("gives a Space a banner its members (or anyone, if public) can see", async () => {
    const noor = await person();
    const kenji = await person();
    const stranger = await person();
    const { space } = await spaceWith(noor, kenji);
    const { mediaId } = await upload(noor.cookie, "image", PNG, "image/png");
    // A banner is a Glow 1 perk: without Sparks it's refused.
    const early = await call(noor.cookie, "PATCH", `/communities/${space.id}`, {
      bannerMediaId: mediaId,
    });
    expect(early.statusCode).toBe(403);
    await glow(space.id, 3);
    const set = await call(noor.cookie, "PATCH", `/communities/${space.id}`, {
      bannerMediaId: mediaId,
    });
    expect(set.json().bannerUrl).toBe(`/api/v1/media/${mediaId}/raw`);
    // Private Space: its members see it, nobody else does.
    expect((await call(kenji.cookie, "GET", `/media/${mediaId}/raw`)).statusCode).toBe(302);
    expect((await call(stranger.cookie, "GET", `/media/${mediaId}/raw`)).statusCode).toBe(404);
    // Someone else's upload can't be used.
    const other = await upload(kenji.cookie, "image", PNG, "image/png");
    const theirs = await call(noor.cookie, "PATCH", `/communities/${space.id}`, {
      bannerMediaId: other.mediaId,
    });
    expect(theirs.json().error.code).toBe("UPLOAD_INVALID");
    // A public Space's banner is for anyone.
    const pub = (
      await call(noor.cookie, "POST", "/communities", { name: "Open", visibility: "public" })
    ).json();
    const shot = await upload(noor.cookie, "image", PNG, "image/png");
    await glow(pub.id, 3);
    await call(noor.cookie, "PATCH", `/communities/${pub.id}`, { bannerMediaId: shot.mediaId });
    expect((await call(undefined, "GET", `/media/${shot.mediaId}/raw`)).statusCode).toBe(302);
    const cleared = await call(noor.cookie, "PATCH", `/communities/${pub.id}`, {
      bannerMediaId: null,
    });
    expect(cleared.json().bannerUrl).toBeNull();
  });
});

describe("places and spam checks", () => {
  it("shares a place once, as a card", async () => {
    const noor = await person();
    const { room } = await spaceWith(noor);
    const sent = await call(noor.cookie, "POST", `/channels/${room}/messages`, {
      content: "here",
      place: { name: "Joe's Pizza", address: "7 Carmine St", lat: 40.730612345, lng: -74.0021 },
    });
    expect(sent.json().place).toEqual({
      name: "Joe's Pizza",
      address: "7 Carmine St",
      lat: 40.73061,
      lng: -74.0021,
    });
  });

  it("slows down bursts and repeats, and links from brand-new accounts", async () => {
    const noor = await person();
    const { room } = await spaceWith(noor);
    const say = (content: string) =>
      call(noor.cookie, "POST", `/channels/${room}/messages`, { content });
    expect((await say("free skins at the link")).statusCode).toBe(201);
    expect((await say("free skins at the link")).statusCode).toBe(201);
    expect((await say("free skins at the link")).statusCode).toBe(201);
    const fourth = await say("free skins at the link");
    expect(fourth.json().error.code).toBe("SLOW_DOWN");

    const other = await person();
    const { room: r2 } = await spaceWith(other);
    const link = (n: number) =>
      call(other.cookie, "POST", `/channels/${r2}/messages`, {
        content: `look https://x${n}.example.com`,
      });
    for (let i = 0; i < 3; i++) expect((await link(i)).statusCode).toBe(201);
    expect((await link(9)).json().error.code).toBe("SLOW_DOWN");
  });
});

describe("push notifications", () => {
  it("tells members who aren't around, once per room, and respects mutes", async () => {
    const pusher = new NoopPusher(true);
    const deps = t.deps as { pusher: Pusher };
    const before = deps.pusher;
    deps.pusher = pusher;
    try {
      const noor = await person();
      const kenji = await person();
      const sol = await person();
      const { space, room } = await spaceWith(noor, kenji, sol);
      await call(kenji.cookie, "PUT", "/users/@me/push-tokens", { token: "k".repeat(40) });
      await call(sol.cookie, "PUT", "/users/@me/push-tokens", { token: "s".repeat(40) });
      await call(sol.cookie, "PUT", `/users/@me/mutes/community/${space.id}`, {});

      await call(noor.cookie, "POST", `/channels/${room}/messages`, { content: "ranked at 9?" });
      await t.queue.drain();
      expect(pusher.sent.map((p) => p.token)).toEqual(["k".repeat(40)]);
      expect(pusher.sent[0]).toMatchObject({
        title: "Lobby · #general",
        link: `/spaces/${space.slug}/general`,
      });
      expect(pusher.sent[0]?.body).toContain("ranked at 9?");

      await call(noor.cookie, "POST", `/channels/${room}/messages`, { content: "anyone?" });
      await t.queue.drain();
      expect(pusher.sent).toHaveLength(1);
    } finally {
      deps.pusher = before;
    }
  });
});
