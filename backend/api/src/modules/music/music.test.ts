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

describe("Your own music", () => {
  /** Uploads a song file the way the app does: marked as a song, so it may be long. */
  const songFile = (cookie: string, durationMs = 240_000) =>
    upload(cookie, "audio", MP3, "audio/mpeg", { durationMs, purpose: "song" });

  it("shares a whole song with a cover, once you confirm it's yours", async () => {
    const noor = await person();
    const kenji = await person();
    const file = await songFile(noor.cookie);
    const cover = await upload(noor.cookie, "image", await photo(), "image/png");

    // No confirmation, no song.
    const unsure = await call(noor.cookie, "POST", "/sounds/songs", {
      mediaId: file,
      title: "Night Drive",
    });
    expect(unsure.statusCode).toBe(400);
    const lied = await call(noor.cookie, "POST", "/sounds/songs", {
      mediaId: file,
      title: "Night Drive",
      rights: false,
    });
    expect(lied.statusCode).toBe(400);

    const made = await call(noor.cookie, "POST", "/sounds/songs", {
      mediaId: file,
      title: "Night Drive",
      artist: "Noor & The Lights",
      coverMediaId: cover,
      rights: true,
    });
    expect(made.statusCode, made.body).toBe(201);
    const song = made.json();
    expect(song).toMatchObject({
      kind: "original",
      title: "Night Drive",
      artist: "Noor & The Lights",
      durationMs: 240_000,
      creator: { id: noor.id },
    });
    expect(song.coverUrl).toContain(cover);
    expect(song.audioUrl).toContain(file);

    // Other people find it: on her page, in search, and on the music home.
    const hers = await call(kenji.cookie, "GET", `/sounds/by/${noor.username}`);
    expect(hers.json().items.map((x: { id: string }) => x.id)).toEqual([song.id]);
    const found = await call(kenji.cookie, "GET", "/sounds?q=night%20drive");
    expect(found.json().items[0]).toMatchObject({ id: song.id });
    const home = await call(kenji.cookie, "GET", "/music/home");
    expect(home.json().fresh.map((x: { id: string }) => x.id)).toContain(song.id);
    // And can play it.
    expect((await call(kenji.cookie, "GET", `/media/${file}/raw`)).statusCode).toBe(302);
  });

  it("refuses files that aren't yours, aren't audio, or are too long or too big", async () => {
    const noor = await person();
    const kenji = await person();
    const file = await songFile(noor.cookie);
    const stolen = await call(kenji.cookie, "POST", "/sounds/songs", {
      mediaId: file,
      title: "Mine now",
      rights: true,
    });
    expect(stolen.statusCode).toBe(400);
    // Someone else's picture can't be your cover, and a song can't be the cover.
    const theirPhoto = await upload(kenji.cookie, "image", await photo(), "image/png");
    for (const coverMediaId of [theirPhoto, file]) {
      const res = await call(noor.cookie, "POST", "/sounds/songs", {
        mediaId: file,
        title: "Covered",
        coverMediaId,
        rights: true,
      });
      expect(res.statusCode).toBe(400);
    }
    // A picture can't be the song.
    const picture = await upload(noor.cookie, "image", await photo(), "image/png");
    const notAudio = await call(noor.cookie, "POST", "/sounds/songs", {
      mediaId: picture,
      title: "Silent",
      rights: true,
    });
    expect(notAudio.statusCode).toBe(400);

    const base = { kind: "audio", mimeType: "audio/mpeg", purpose: "song" };
    const long = await call(noor.cookie, "POST", "/media/uploads", {
      ...base,
      sizeBytes: 1000,
      durationMs: 16 * 60 * 1000,
    });
    expect(long.statusCode).toBe(400);
    const big = await call(noor.cookie, "POST", "/media/uploads", {
      ...base,
      sizeBytes: 21 * 1024 * 1024,
    });
    expect(big.statusCode).toBe(413);
    const video = await call(noor.cookie, "POST", "/media/uploads", {
      kind: "video",
      mimeType: "video/mp4",
      purpose: "song",
      sizeBytes: 1000,
    });
    expect(video.statusCode).toBe(400);
    // Without the song purpose, audio keeps the voice-message limit.
    const voice = await call(noor.cookie, "POST", "/media/uploads", {
      kind: "audio",
      mimeType: "audio/mpeg",
      sizeBytes: 1000,
      durationMs: 6 * 60 * 1000,
    });
    expect(voice.statusCode).toBe(400);
  });

  it("lets you take your own song down, and nobody else's", async () => {
    const noor = await person();
    const kenji = await person();
    const made = await call(noor.cookie, "POST", "/sounds/songs", {
      mediaId: await songFile(noor.cookie),
      title: "Short lived",
      rights: true,
    });
    const id = made.json().id as string;
    expect((await call(kenji.cookie, "DELETE", `/sounds/${id}`)).statusCode).toBe(404);
    expect((await call(noor.cookie, "DELETE", `/sounds/${id}`)).statusCode).toBe(204);
    expect((await call(kenji.cookie, "GET", `/sounds/by/${noor.username}`)).json().items).toEqual(
      [],
    );
    const found = await call(kenji.cookie, "GET", "/sounds?q=short%20lived");
    expect(found.json().items.map((x: { id: string }) => x.id)).not.toContain(id);
    // A library track is not something a person can take down.
    const library = (await call(noor.cookie, "GET", "/sounds?q=lofi")).json().items[0];
    expect((await call(noor.cookie, "DELETE", `/sounds/${library.id}`)).statusCode).toBe(404);
  });

  it("takes a song down by itself once three different people report it", async () => {
    const noor = await person();
    const made = await call(noor.cookie, "POST", "/sounds/songs", {
      mediaId: await songFile(noor.cookie),
      title: "Borrowed Hit",
      rights: true,
    });
    const id = made.json().id as string;
    // Your own song isn't something to report.
    const own = await call(noor.cookie, "POST", `/sounds/${id}/report`, { why: "other" });
    expect(own.statusCode).toBe(400);

    const reporters = [await person(), await person(), await person()];
    for (const [i, r] of reporters.entries()) {
      const res = await call(r.cookie, "POST", `/sounds/${id}/report`, {
        why: "not_theirs",
        details: "This is a famous song.",
      });
      expect(res.statusCode).toBe(204);
      // The same person reporting again doesn't count twice.
      await call(r.cookie, "POST", `/sounds/${id}/report`, { why: "not_theirs" });
      const listed = (await call(r.cookie, "GET", `/sounds/by/${noor.username}`)).json().items;
      expect(listed.length).toBe(i < 2 ? 1 : 0);
    }
    // Gone from search too, and it can't be reported again.
    const found = await call(reporters[0]?.cookie, "GET", "/sounds?q=borrowed%20hit");
    expect(found.json().items.map((x: { id: string }) => x.id)).not.toContain(id);
    const late = await call(reporters[0]?.cookie, "POST", `/sounds/${id}/report`, { why: "other" });
    expect(late.statusCode).toBe(404);
  });

  it("hides a person's songs from someone they blocked", async () => {
    const noor = await person();
    const kenji = await person();
    await call(noor.cookie, "POST", "/sounds/songs", {
      mediaId: await songFile(noor.cookie),
      title: "Private Party",
      rights: true,
    });
    await call(noor.cookie, "PUT", `/users/@me/blocks/${kenji.id}`);
    expect((await call(kenji.cookie, "GET", `/sounds/by/${noor.username}`)).statusCode).toBe(404);
    expect((await call(kenji.cookie, "GET", "/sounds/by/nobody_here")).statusCode).toBe(404);
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

describe("who watched", () => {
  it("shows a Story's author who watched it, and nobody else", async () => {
    const noor = await person();
    const kenji = await person();
    await call(kenji.cookie, "PUT", `/users/${noor.username}/follow`);
    const pic = await upload(noor.cookie, "image", await photo(), "image/png");
    const story = (await call(noor.cookie, "POST", "/stories", { mediaId: pic })).json();
    await call(kenji.cookie, "POST", `/stories/${story.id}/view`);
    const viewers = (await call(noor.cookie, "GET", `/stories/${story.id}/viewers`)).json().items;
    expect(viewers.map((v: { user: { id: string } }) => v.user.id)).toEqual([kenji.id]);
    expect((await call(kenji.cookie, "GET", `/stories/${story.id}/viewers`)).statusCode).toBe(404);
  });
});

describe("Story highlights", () => {
  it("keeps Stories on a profile after their day, for whoever can see the profile", async () => {
    const noor = await person();
    const kenji = await person();
    const pic = await upload(noor.cookie, "image", await photo(), "image/png");
    const story = (await call(noor.cookie, "POST", "/stories", { mediaId: pic })).json();
    await t.deps.db
      .update(schema.stories)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.stories.id, BigInt(story.id)));
    expect((await call(noor.cookie, "GET", "/stories/archive")).json().items[0].id).toBe(story.id);

    const made = await call(noor.cookie, "POST", "/stories/highlights", {
      title: "Summer",
      storyIds: [story.id],
    });
    expect(made.statusCode).toBe(201);
    expect(made.json()).toMatchObject({ title: "Summer", count: 1 });
    // Someone else's Story can't go in.
    expect(
      (
        await call(kenji.cookie, "POST", "/stories/highlights", {
          title: "Not mine",
          storyIds: [story.id],
        })
      ).statusCode,
    ).toBe(400);

    const theirs = (
      await call(kenji.cookie, "GET", `/stories/highlights/of/${noor.username}`)
    ).json();
    expect(theirs.items).toHaveLength(1);
    const detail = (
      await call(kenji.cookie, "GET", `/stories/highlights/${made.json().id}`)
    ).json();
    expect(detail.stories[0].id).toBe(story.id);
    expect((await call(kenji.cookie, "GET", `/media/${pic}/raw`)).statusCode).not.toBe(404);

    // Private account: strangers see nothing.
    await call(noor.cookie, "PATCH", "/users/@me/settings", { profileVisibility: "private" });
    expect(
      (await call(kenji.cookie, "GET", `/stories/highlights/of/${noor.username}`)).json().items,
    ).toEqual([]);
    expect(
      (await call(kenji.cookie, "PATCH", `/stories/highlights/${made.json().id}`, { title: "x" }))
        .statusCode,
    ).toBe(403);
    expect(
      (await call(noor.cookie, "DELETE", `/stories/highlights/${made.json().id}`)).statusCode,
    ).toBe(204);
  });

  it("suggests people who follow you first", async () => {
    const noor = await person();
    const kenji = await person();
    await call(kenji.cookie, "PUT", `/users/${noor.username}/follow`);
    const items = (await call(noor.cookie, "GET", "/users/@me/suggestions")).json().items;
    expect(items[0]).toMatchObject({
      user: { id: kenji.id },
      reason: "Follows you",
      followsYou: true,
    });
  });
});

describe("the music library", () => {
  it("likes songs, makes playlists, keeps what you played, and hides others' private lists", async () => {
    const noor = await person();
    const kenji = await person();
    const [a, b] = (await call(noor.cookie, "GET", "/sounds?q=lofi")).json().items;
    expect((await call(noor.cookie, "PUT", `/music/liked/${a.id}`)).statusCode).toBe(204);
    expect((await call(noor.cookie, "GET", "/music/liked")).json().items[0]).toMatchObject({
      id: a.id,
      liked: true,
    });

    const list = (
      await call(noor.cookie, "POST", "/music/playlists", { name: "late night" })
    ).json();
    await call(noor.cookie, "PUT", `/music/playlists/${list.id}/items/${b.id}`);
    await call(noor.cookie, "PUT", `/music/playlists/${list.id}/items/${a.id}`);
    const detail = (await call(noor.cookie, "GET", `/music/playlists/${list.id}`)).json();
    expect(detail.items.map((i: { id: string }) => i.id)).toEqual([b.id, a.id]);
    expect(detail).toMatchObject({ count: 2, mine: true, isPublic: false });
    // Private: someone else can't see it, or change it.
    expect((await call(kenji.cookie, "GET", `/music/playlists/${list.id}`)).statusCode).toBe(404);
    expect(
      (await call(kenji.cookie, "PUT", `/music/playlists/${list.id}/items/${a.id}`)).statusCode,
    ).toBe(403);

    await call(noor.cookie, "POST", `/music/played/${b.id}`);
    const home = (await call(noor.cookie, "GET", "/music/home")).json();
    expect(home.recent[0].id).toBe(b.id);
    expect(home.liked.count).toBe(1);
    expect(home.playlists[0]).toMatchObject({ name: "late night", count: 2 });
  });
});

describe("listening together", () => {
  type Friend = { user: { id: string }; sound: { id: string }; positionMs: number };
  const friendsOf = async (who: { cookie: string }) =>
    (await call(who.cookie, "GET", "/music/friends")).json().items as Friend[];
  const befriend = async (
    a: { cookie: string; username: string },
    b: { cookie: string; username: string },
  ) => {
    await call(a.cookie, "PUT", `/users/${b.username}/follow`);
    await call(b.cookie, "PUT", `/users/${a.username}/follow`);
  };

  it("shows friends the song you're playing, and where you are in it", async () => {
    const noor = await person();
    const kenji = await person();
    const fan = await person();
    await befriend(noor, kenji);
    // The fan follows Noor, but Noor doesn't follow back: not a friend.
    await call(fan.cookie, "PUT", `/users/${noor.username}/follow`);
    const [song] = (await call(noor.cookie, "GET", "/sounds?q=lofi")).json().items;

    expect(await friendsOf(kenji)).toEqual([]);
    const said = await call(noor.cookie, "PUT", "/music/now", {
      soundId: song.id,
      positionMs: 30_000,
    });
    expect(said.statusCode, said.body).toBe(204);

    const seen = await friendsOf(kenji);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ user: { id: noor.id }, sound: { id: song.id } });
    expect(seen[0]?.positionMs).toBeGreaterThanOrEqual(30_000);
    expect(seen[0]?.positionMs).toBeLessThan(40_000);
    // Only friends: a one-way follower, a stranger and Noor herself see nothing.
    expect(await friendsOf(fan)).toEqual([]);
    expect(await friendsOf(await person())).toEqual([]);
    expect(await friendsOf(noor)).toEqual([]);

    // Pausing or stopping takes it away.
    expect((await call(noor.cookie, "DELETE", "/music/now")).statusCode).toBe(204);
    expect(await friendsOf(kenji)).toEqual([]);
  });

  it("stops when you turn sharing off, when you block someone, and near a song's end", async () => {
    const noor = await person();
    const kenji = await person();
    await befriend(noor, kenji);
    const [song] = (await call(noor.cookie, "GET", "/sounds?q=lofi")).json().items;
    const play = (positionMs = 0) =>
      call(noor.cookie, "PUT", "/music/now", { soundId: song.id, positionMs });

    await play();
    expect(await friendsOf(kenji)).toHaveLength(1);
    // Sharing off: it's forgotten at once, and playing again doesn't bring it back.
    const off = await call(noor.cookie, "PATCH", "/users/@me/settings", { shareListening: false });
    expect(off.json().shareListening).toBe(false);
    expect(await friendsOf(kenji)).toEqual([]);
    await play();
    expect(await friendsOf(kenji)).toEqual([]);

    await call(noor.cookie, "PATCH", "/users/@me/settings", { shareListening: true });
    await play();
    expect(await friendsOf(kenji)).toHaveLength(1);
    // The last second of a song isn't worth joining.
    await play(song.durationMs - 500);
    expect(await friendsOf(kenji)).toEqual([]);

    await play();
    await call(kenji.cookie, "PUT", `/users/@me/blocks/${noor.id}`);
    expect(await friendsOf(kenji)).toEqual([]);
  });

  it("refuses made-up songs, bad positions and people who aren't signed in", async () => {
    const noor = await person();
    const [song] = (await call(noor.cookie, "GET", "/sounds?q=lofi")).json().items;
    const put = (cookie: string | undefined, body: unknown) =>
      call(cookie, "PUT", "/music/now", body);
    expect((await put(undefined, { soundId: song.id, positionMs: 0 })).statusCode).toBe(401);
    expect((await put(noor.cookie, { soundId: "1", positionMs: 0 })).statusCode).toBe(404);
    expect((await put(noor.cookie, { soundId: song.id, positionMs: -5 })).statusCode).toBe(400);
    expect((await put(noor.cookie, { soundId: "x' or 1=1", positionMs: 0 })).statusCode).toBe(400);
    expect((await put(noor.cookie, { soundId: song.id })).statusCode).toBe(400);
    expect((await call(undefined, "GET", "/music/friends")).statusCode).toBe(401);
    expect((await call(undefined, "GET", "/music/recap")).statusCode).toBe(401);
  });
});

describe("your week", () => {
  it("adds up what you played and what happened on your posts, and only yours", async () => {
    const noor = await person();
    const kenji = await person();
    const [a, b] = (await call(noor.cookie, "GET", "/sounds?q=lofi")).json().items;

    const empty = (await call(noor.cookie, "GET", "/music/recap")).json();
    expect(empty).toMatchObject({ plays: 0, songs: 0, topSongs: [], topArtist: null });
    expect(empty).toMatchObject({ posts: 0, likes: 0, newFollowers: 0, topPost: null });

    for (const id of [a.id, a.id, a.id, b.id]) {
      expect((await call(noor.cookie, "POST", `/music/played/${id}`)).statusCode).toBe(204);
    }
    // A play of a song that doesn't exist counts for nothing.
    await call(noor.cookie, "POST", "/music/played/1");
    // Kenji's listening is his own.
    await call(kenji.cookie, "POST", `/music/played/${b.id}`);

    const post = (
      await call(noor.cookie, "POST", "/posts", { kind: "text", caption: "my week" })
    ).json();
    await call(noor.cookie, "PUT", `/posts/${post.id}/like`);
    await call(kenji.cookie, "PUT", `/posts/${post.id}/like`);
    await call(kenji.cookie, "PUT", `/users/${noor.username}/follow`);

    const week = (await call(noor.cookie, "GET", "/music/recap")).json();
    expect(week).toMatchObject({ plays: 4, songs: 2 });
    expect(
      week.topSongs.map((s: { sound: { id: string }; plays: number }) => [s.sound.id, s.plays]),
    ).toEqual([
      [a.id, 3],
      [b.id, 1],
    ]);
    expect(week.topArtist).toEqual({ name: a.artist, plays: 3 });
    expect(week.minutes).toBe(Math.round((3 * a.durationMs + b.durationMs) / 60_000));
    // Your own like doesn't count; Kenji's does.
    expect(week).toMatchObject({ posts: 1, likes: 1, newFollowers: 1 });
    expect(week.topPost).toMatchObject({ id: post.id, caption: "my week", likes: 1 });

    expect((await call(kenji.cookie, "GET", "/music/recap")).json()).toMatchObject({
      plays: 1,
      songs: 1,
      posts: 0,
      likes: 0,
    });
  });

  it("leaves out anything older than seven days", async () => {
    const noor = await person();
    const [a] = (await call(noor.cookie, "GET", "/sounds?q=lofi")).json().items;
    await call(noor.cookie, "POST", `/music/played/${a.id}`);
    const old = new Date(Date.now() - 9 * 86_400_000).toISOString().slice(0, 10);
    await t.deps.db
      .update(schema.soundPlayDays)
      .set({ day: old })
      .where(eq(schema.soundPlayDays.userId, BigInt(noor.id)));
    expect((await call(noor.cookie, "GET", "/music/recap")).json()).toMatchObject({
      plays: 0,
      songs: 0,
      topSongs: [],
    });
  });
});
