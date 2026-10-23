import { eq, schema } from "@realm/db";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  browser,
  createTestApp,
  newAccount,
  sessionCookie,
  type TestContext,
} from "../../test/helpers";

let t: TestContext;
const realFetch = globalThis.fetch;
let openverseCalls = 0;

beforeAll(async () => {
  t = await createTestApp();
  // Openverse, as it answers: two usable Jamendo tracks, one from elsewhere, one too short.
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (!url.startsWith("https://api.openverse.org/")) return realFetch(input, init);
    openverseCalls += 1;
    if (url.includes("q=slow")) {
      // A search Openverse hasn't seen before, answered late.
      await new Promise((r) => setTimeout(r, 4400));
      return new Response(
        JSON.stringify({
          results: [
            {
              id: "s1",
              title: "Slow Song",
              creator: "Late",
              url: "https://prod-1.storage.jamendo.com/?trackid=9",
              license: "cc0",
              duration: 60000,
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({
        results: [
          {
            id: "a1",
            title: "Lofi House",
            creator: "AstroShroom",
            url: "https://prod-1.storage.jamendo.com/?trackid=1",
            thumbnail: "https://api.openverse.org/v1/audio/a1/thumb/",
            license: "by-sa",
            foreign_landing_url: "https://www.jamendo.com/track/1",
            duration: 123000,
          },
          {
            id: "a2",
            title: "Pop, Soda Pop!",
            creator: "Blik",
            url: "https://prod-1.storage.jamendo.com/?trackid=2",
            thumbnail: null,
            license: "cc0",
            foreign_landing_url: "https://www.jamendo.com/track/2",
            duration: 147000,
          },
          {
            id: "a3",
            title: "Sneaky",
            creator: "Someone",
            url: "https://evil.example/track.mp3",
            license: "by",
            duration: 90000,
          },
          {
            id: "a4",
            title: "Jingle",
            creator: "Short",
            url: "https://prod-1.storage.jamendo.com/?trackid=4",
            license: "by",
            duration: 4000,
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  });
});
afterAll(async () => {
  vi.restoreAllMocks();
  await t.close();
});

let ip = 0;
async function person(overrides: Partial<Record<string, string>> = {}) {
  const res = await t.app.inject({
    method: "POST",
    url: "/v1/auth/register",
    headers: browser(),
    payload: newAccount(overrides),
    remoteAddress: `10.80.${Math.floor(++ip / 250)}.${ip % 250}`,
  });
  const cookie = sessionCookie(res);
  if (!cookie) throw new Error("no session");
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

async function upload(
  cookie: string,
  kind: "image" | "audio",
  bytes: Buffer,
  mimeType: string,
  extra = {},
) {
  const ticket = await call(cookie, "POST", "/media/uploads", {
    kind,
    mimeType,
    sizeBytes: bytes.length,
    ...extra,
  });
  const { mediaId, uploadUrl } = ticket.json();
  await t.app.inject({
    method: "PUT",
    url: uploadUrl.replace(/^\/api/, ""),
    headers: { "content-type": mimeType },
    payload: bytes,
  });
  const done = await call(cookie, "POST", `/media/${mediaId}/complete`, {});
  expect(done.statusCode, done.body).toBe(200);
  return mediaId as string;
}

const photo = () =>
  sharp({ create: { width: 20, height: 30, channels: 3, background: "#335577" } })
    .png()
    .toBuffer();
const MP3 = Buffer.concat([Buffer.from("ID3"), Buffer.alloc(200)]);

describe("the free music library", () => {
  it("finds Jamendo tracks with their licence, skips anything else, and remembers searches", async () => {
    const noor = await person();
    const res = await call(noor.cookie, "GET", "/sounds?q=lofi");
    expect(res.statusCode).toBe(200);
    const items = res.json().items as { title: string; licence: string; audioUrl: string }[];
    expect(items.map((i) => i.title)).toEqual(["Lofi House", "Pop, Soda Pop!"]);
    expect(items[0]?.licence).toBe("CC BY-SA");
    expect(items[1]?.licence).toBe("CC0");
    expect(items.every((i) => i.audioUrl.startsWith("https://prod-1.storage.jamendo.com/"))).toBe(
      true,
    );
    const before = openverseCalls;
    await call(noor.cookie, "GET", "/sounds?q=LOFI");
    expect(openverseCalls).toBe(before);
  });
});

describe("a slow library", () => {
  it("answers with what Realm has, keeps looking, and has the rest when asked again", async () => {
    const noor = await person();
    const first = (await call(noor.cookie, "GET", "/sounds?q=slow")).json();
    expect(first.searching).toBe(true);
    expect(first.items.map((i: { title: string }) => i.title)).not.toContain("Slow Song");
    await new Promise((r) => setTimeout(r, 900));
    const again = (await call(noor.cookie, "GET", "/sounds?q=slow")).json();
    expect(again.searching).toBe(false);
    expect(again.items.map((i: { title: string }) => i.title)).toEqual(["Slow Song"]);
  }, 15_000);
});

describe("music on posts and creators' own sounds", () => {
  it("puts a sound on a photo post with the part that plays, and counts the use", async () => {
    const noor = await person();
    const [lofi] = (await call(noor.cookie, "GET", "/sounds?q=lofi")).json().items;
    const pic = await upload(noor.cookie, "image", await photo(), "image/png");
    const post = await call(noor.cookie, "POST", "/posts", {
      kind: "image",
      mediaIds: [pic],
      sound: { soundId: lofi.id, startMs: 42000, durationMs: 15000 },
    });
    expect(post.statusCode, post.body).toBe(201);
    expect(post.json().sound).toMatchObject({ title: "Lofi House", startMs: 42000, playMs: 15000 });
    expect(
      (await call(noor.cookie, "GET", `/sounds/${lofi.id}`)).json().uses,
    ).toBeGreaterThanOrEqual(1);
    const text = await call(noor.cookie, "POST", "/posts", {
      kind: "text",
      caption: "hi",
      sound: { soundId: lofi.id, startMs: 0, durationMs: 15000 },
    });
    expect(text.statusCode).toBe(400);
  });

  it("makes your own sound from your recording, which others can use but not take", async () => {
    const noor = await person();
    const kenji = await person();
    const rec = await upload(noor.cookie, "audio", MP3, "audio/mpeg", { durationMs: 20000 });
    const made = await call(noor.cookie, "POST", "/sounds", { mediaId: rec, title: "my beat" });
    expect(made.statusCode, made.body).toBe(201);
    expect(made.json()).toMatchObject({
      kind: "original",
      title: "my beat",
      creator: { id: noor.id },
    });
    // Someone else's upload can't become your sound.
    const stolen = await call(kenji.cookie, "POST", "/sounds", { mediaId: rec, title: "mine now" });
    expect(stolen.statusCode).toBe(400);
    // Anyone can hear an original sound.
    expect((await call(kenji.cookie, "GET", `/media/${rec}/raw`)).statusCode).toBe(302);
    expect((await call(noor.cookie, "GET", "/sounds/mine")).json().items).toHaveLength(1);
  });
});

describe("Stories", () => {
  it("shows a Story with music to followers, marks it seen, and lets only its author delete it", async () => {
    const noor = await person();
    const kenji = await person();
    await call(kenji.cookie, "PUT", `/users/${noor.username}/follow`);
    const [lofi] = (await call(noor.cookie, "GET", "/sounds?q=lofi")).json().items;
    const pic = await upload(noor.cookie, "image", await photo(), "image/png");
    const story = await call(noor.cookie, "POST", "/stories", {
      mediaId: pic,
      caption: "sunset",
      sound: { soundId: lofi.id, startMs: 10000, durationMs: 15000 },
    });
    expect(story.statusCode, story.body).toBe(201);
    const id = story.json().id;

    const feed = (await call(kenji.cookie, "GET", "/stories/feed")).json();
    expect(feed.rings[0]).toMatchObject({ author: { id: noor.id }, unseen: true });
    expect(feed.rings[0].stories[0].sound).toMatchObject({ title: "Lofi House", startMs: 10000 });
    expect(feed.rings[0].stories[0].views).toBeNull();

    expect((await call(kenji.cookie, "POST", `/stories/${id}/view`)).statusCode).toBe(204);
    expect((await call(kenji.cookie, "GET", "/stories/feed")).json().rings[0].unseen).toBe(false);
    const mine = (await call(noor.cookie, "GET", "/stories/feed")).json();
    expect(mine.rings[0].stories[0].views).toBe(1);

    expect((await call(kenji.cookie, "DELETE", `/stories/${id}`)).statusCode).toBe(403);
    expect((await call(noor.cookie, "DELETE", `/stories/${id}`)).statusCode).toBe(204);
    expect((await call(kenji.cookie, "GET", "/stories/feed")).json().rings).toHaveLength(0);
  });

  it("keeps a private account's Stories (and their pictures) from people who don't follow it", async () => {
    const mei = await person();
    const stranger = await person();
    await call(mei.cookie, "PATCH", "/users/@me/settings", { profileVisibility: "private" });
    const pic = await upload(mei.cookie, "image", await photo(), "image/png");
    const story = await call(mei.cookie, "POST", "/stories", { mediaId: pic });
    expect(story.json()).toMatchObject({ id: expect.any(String) });
    expect(
      (await call(stranger.cookie, "GET", `/stories/of/${mei.username}`)).json().items,
    ).toEqual([]);
    expect(
      (await call(stranger.cookie, "POST", `/stories/${story.json().id}/view`)).statusCode,
    ).toBe(404);
    expect((await call(stranger.cookie, "GET", `/media/${pic}/raw`)).statusCode).toBe(404);
  });

  it("refuses Stories made of someone else's upload, and ends them after a day", async () => {
    const noor = await person();
    const kenji = await person();
    const pic = await upload(noor.cookie, "image", await photo(), "image/png");
    expect((await call(kenji.cookie, "POST", "/stories", { mediaId: pic })).statusCode).toBe(400);
    const own = await call(noor.cookie, "POST", "/stories", { mediaId: pic });
    await t.deps.db
      .update(schema.stories)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.stories.id, BigInt(own.json().id)));
    expect((await call(noor.cookie, "GET", "/stories/feed")).json().rings).toHaveLength(0);
  });
});
