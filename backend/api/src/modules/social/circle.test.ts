import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { browser, createTestApp, newAccount, sessionCookie, type TestContext } from "../../test/helpers";
import { mentionsIn } from "./service";

let t: TestContext;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t.close();
});

let ip = 0;
async function person() {
  const account = newAccount();
  const res = await t.app.inject({
    method: "POST",
    url: "/v1/auth/register",
    headers: browser(),
    payload: account,
    remoteAddress: `10.70.${Math.floor(++ip / 250)}.${ip % 250}`,
  });
  const cookie = sessionCookie(res);
  if (!cookie) throw new Error("no session");
  return { cookie, id: res.json().user.id as string, username: account.username as string };
}

type Method = "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
const call = (cookie: string | undefined, method: Method, url: string, payload?: unknown) =>
  t.app.inject({
    method,
    url: `/v1${url}`,
    headers: browser(cookie),
    ...(payload === undefined ? {} : { payload: payload as object }),
  });

async function photo(cookie: string) {
  const bytes = await sharp({
    create: { width: 20, height: 30, channels: 3, background: "#335577" },
  })
    .png()
    .toBuffer();
  const ticket = (
    await call(cookie, "POST", "/media/uploads", {
      kind: "image",
      mimeType: "image/png",
      sizeBytes: bytes.length,
    })
  ).json();
  await t.app.inject({
    method: "PUT",
    url: ticket.uploadUrl.replace(/^\/api/, ""),
    headers: { "content-type": "image/png" },
    payload: bytes,
  });
  await call(cookie, "POST", `/media/${ticket.mediaId}/complete`, {});
  return ticket.mediaId as string;
}

const follow = (a: { cookie: string }, b: { username: string }) =>
  call(a.cookie, "PUT", `/users/${b.username}/follow`);
const activity = async (who: { cookie: string }) =>
  (await call(who.cookie, "GET", "/users/@me/activity")).json().items as {
    type: string;
    via: string | null;
  }[];

describe("mentions", () => {
  it("finds @names, not e-mail addresses, and stops at a trailing dot", () => {
    expect(mentionsIn("hi @Noor and @kenji. mail me at a@b.com @noor")).toEqual(["noor", "kenji"]);
  });
});

describe("tags, mentions, hidden likes and comments off", () => {
  it("tags people, tells them, lists the post on their Tagged tab, and lets them untag", async () => {
    const noor = await person();
    const kenji = await person();
    const post = await call(noor.cookie, "POST", "/posts", {
      kind: "image",
      mediaIds: [await photo(noor.cookie)],
      caption: `with @${kenji.username}`,
      tags: [kenji.username],
    });
    expect(post.statusCode).toBe(201);
    expect(post.json().tags.map((u: { username: string }) => u.username)).toEqual([
      kenji.username,
    ]);
    const kinds = (await activity(kenji)).map((a) => `${a.type}:${a.via}`);
    expect(kinds).toContain("mention:tag");
    expect(kinds).toContain("mention:caption");
    const tagged = (await call(kenji.cookie, "GET", `/users/${kenji.username}/tagged`)).json();
    expect(tagged.items[0].id).toBe(post.json().id);

    expect(
      (await call(kenji.cookie, "DELETE", `/posts/${post.json().id}/tags/@me`)).statusCode,
    ).toBe(204);
    expect(
      (await call(kenji.cookie, "GET", `/users/${kenji.username}/tagged`)).json().items,
    ).toEqual([]);
    // Tagging someone who doesn't exist is refused.
    const ghost = await call(noor.cookie, "POST", "/posts", {
      kind: "text",
      caption: "hi",
      tags: ["nobody_at_all_here"],
    });
    expect(ghost.statusCode).toBe(400);
  });

  it("never tags or notifies across a block", async () => {
    const noor = await person();
    const blocker = await person();
    await call(blocker.cookie, "PUT", `/users/@me/blocks/${noor.id}`);
    const tag = await call(noor.cookie, "POST", "/posts", {
      kind: "text",
      caption: "hey",
      tags: [blocker.username],
    });
    expect(tag.statusCode).toBe(400);
    await call(noor.cookie, "POST", "/posts", { kind: "text", caption: `@${blocker.username}` });
    expect((await activity(blocker)).some((a) => a.type === "mention")).toBe(false);
  });

  it("hides the like count from everyone but the author, and turns comments off", async () => {
    const noor = await person();
    const kenji = await person();
    const post = (
      await call(noor.cookie, "POST", "/posts", {
        kind: "text",
        caption: "quiet one",
        hideLikes: true,
        commentsOff: true,
      })
    ).json();
    const liked = await call(kenji.cookie, "PUT", `/posts/${post.id}/like`);
    expect(liked.json()).toMatchObject({ likeCount: 0, liked: true, hideLikes: true });
    expect((await call(noor.cookie, "GET", `/posts/${post.id}`)).json().likeCount).toBe(1);
    const comment = await call(kenji.cookie, "POST", `/posts/${post.id}/comments`, {
      body: "nice",
    });
    expect(comment.json().error.code).toBe("COMMENTS_OFF");
    // Only the author can change it.
    expect(
      (await call(kenji.cookie, "PATCH", `/posts/${post.id}`, { commentsOff: false })).statusCode,
    ).toBe(403);
    await call(noor.cookie, "PATCH", `/posts/${post.id}`, { commentsOff: false });
    expect(
      (await call(kenji.cookie, "POST", `/posts/${post.id}/comments`, { body: `hi @${noor.username}` }))
        .statusCode,
    ).toBe(201);
  });

  it("archives a post out of sight, and brings it back", async () => {
    const noor = await person();
    const kenji = await person();
    await follow(kenji, noor);
    const post = (await call(noor.cookie, "POST", "/posts", { kind: "text", caption: "old" })).json();
    await call(noor.cookie, "PATCH", `/posts/${post.id}`, { archived: true });
    expect((await call(kenji.cookie, "GET", `/posts/${post.id}`)).statusCode).toBe(404);
    const feed = (await call(kenji.cookie, "GET", "/feed")).json().items as { id: string }[];
    expect(feed.some((p) => p.id === post.id)).toBe(false);
    const archive = (await call(noor.cookie, "GET", "/users/@me/archive")).json();
    expect(archive.items[0]).toMatchObject({ id: post.id, archived: true });
    await call(noor.cookie, "PATCH", `/posts/${post.id}`, { archived: false });
    expect((await call(kenji.cookie, "GET", `/posts/${post.id}`)).statusCode).toBe(200);
  });
});

describe("Close Friends, mute and Notes", () => {
  it("shows a Close Friends Story only to people on the list, with a green ring", async () => {
    const noor = await person();
    const close = await person();
    const other = await person();
    await follow(close, noor);
    await follow(other, noor);
    await call(noor.cookie, "PUT", `/users/@me/close-friends/${close.username}`);
    const list = (await call(noor.cookie, "GET", "/users/@me/close-friends")).json().items;
    expect(list.map((u: { username: string }) => u.username)).toEqual([close.username]);

    const story = await call(noor.cookie, "POST", "/stories", {
      mediaId: await photo(noor.cookie),
      visibility: "close_friends",
    });
    expect(story.json().closeFriends).toBe(true);
    const ring = (await call(close.cookie, "GET", "/stories/feed")).json().rings.find(
      (r: { author: { id: string } }) => r.author.id === noor.id,
    );
    expect(ring?.closeFriends).toBe(true);
    const theirs = (await call(other.cookie, "GET", "/stories/feed")).json().rings;
    expect(theirs.some((r: { author: { id: string } }) => r.author.id === noor.id)).toBe(false);
    expect((await call(other.cookie, "GET", `/stories/${story.json().id}`)).statusCode).toBe(404);
    // And it can't be slipped into a Highlight everyone sees.
    const highlight = await call(noor.cookie, "POST", "/stories/highlights", {
      title: "Close",
      storyIds: [story.json().id],
    });
    expect(highlight.statusCode).toBe(400);
    expect(highlight.json().error.message).toMatch(/Close Friends/);
  });

  it("mutes someone's posts and Stories without unfollowing, and unmutes", async () => {
    const noor = await person();
    const kenji = await person();
    await follow(kenji, noor);
    await call(noor.cookie, "POST", "/posts", { kind: "text", caption: "loud" });
    await call(noor.cookie, "POST", "/stories", { mediaId: await photo(noor.cookie) });
    const muted = await call(kenji.cookie, "PUT", `/users/${noor.username}/mute`, {
      posts: true,
      stories: true,
    });
    expect(muted.statusCode).toBe(200);
    const feed = (await call(kenji.cookie, "GET", "/feed")).json().items as { caption: string }[];
    expect(feed.some((p) => p.caption === "loud")).toBe(false);
    const rings = (await call(kenji.cookie, "GET", "/stories/feed")).json().rings;
    expect(rings.some((r: { author: { id: string } }) => r.author.id === noor.id)).toBe(false);
    const profile = (await call(kenji.cookie, "GET", `/users/${noor.username}/profile`)).json();
    expect(profile).toMatchObject({ follow: "following", muted: { posts: true, stories: true } });

    await call(kenji.cookie, "PUT", `/users/${noor.username}/mute`, { posts: false, stories: false });
    const again = (await call(kenji.cookie, "GET", "/feed")).json().items as { caption: string }[];
    expect(again.some((p) => p.caption === "loud")).toBe(true);
    expect((await call(kenji.cookie, "GET", "/users/@me/muted")).json().items).toEqual([]);
  });

  it("shares Notes with people who follow each other, or only Close Friends", async () => {
    const noor = await person();
    const mutual = await person();
    const fan = await person();
    await follow(noor, mutual);
    await follow(mutual, noor);
    await follow(fan, noor);

    const note = await call(noor.cookie, "PUT", "/notes/@me", { text: "studying all night" });
    expect(note.statusCode).toBe(200);
    expect((await call(noor.cookie, "GET", "/notes")).json().mine.text).toBe("studying all night");
    const seen = (await call(mutual.cookie, "GET", "/notes")).json().items;
    expect(seen.map((n: { text: string }) => n.text)).toEqual(["studying all night"]);
    // Following one way isn't enough.
    expect((await call(fan.cookie, "GET", "/notes")).json().items).toEqual([]);

    await call(noor.cookie, "PUT", "/notes/@me", { text: "close only", audience: "close_friends" });
    expect((await call(mutual.cookie, "GET", "/notes")).json().items).toEqual([]);
    await call(noor.cookie, "PUT", `/users/@me/close-friends/${fan.username}`);
    expect((await call(fan.cookie, "GET", "/notes")).json().items[0].text).toBe("close only");

    // Too long, empty, and signed-out are refused.
    expect(
      (await call(noor.cookie, "PUT", "/notes/@me", { text: "x".repeat(61) })).statusCode,
    ).toBe(400);
    expect((await call(noor.cookie, "PUT", "/notes/@me", { text: "" })).statusCode).toBe(400);
    expect((await call(undefined, "GET", "/notes")).statusCode).toBe(401);
    expect((await call(noor.cookie, "DELETE", "/notes/@me")).statusCode).toBe(204);
    expect((await call(noor.cookie, "GET", "/notes")).json().mine).toBeNull();
  });
});

describe("collections", () => {
  it("sorts saved posts into folders that only you can see", async () => {
    const noor = await person();
    const kenji = await person();
    const post = (
      await call(kenji.cookie, "POST", "/posts", {
        kind: "image",
        mediaIds: [await photo(kenji.cookie)],
      })
    ).json();
    const made = await call(noor.cookie, "POST", "/users/@me/collections", { name: "Recipes" });
    expect(made.statusCode).toBe(201);
    const id = made.json().id;
    await call(noor.cookie, "PUT", `/users/@me/collections/${id}/posts/${post.id}`);
    const list = (await call(noor.cookie, "GET", "/users/@me/collections")).json().items;
    expect(list[0]).toMatchObject({ name: "Recipes", count: 1 });
    expect(list[0].covers).toHaveLength(1);
    // Putting it in a folder saves it too.
    expect((await call(noor.cookie, "GET", `/posts/${post.id}`)).json().saved).toBe(true);
    const inside = (await call(noor.cookie, "GET", `/users/@me/collections/${id}/posts`)).json();
    expect(inside.items[0].id).toBe(post.id);

    // Someone else's folder doesn't exist for you.
    expect(
      (await call(kenji.cookie, "GET", `/users/@me/collections/${id}/posts`)).statusCode,
    ).toBe(404);
    expect(
      (await call(kenji.cookie, "DELETE", `/users/@me/collections/${id}`)).statusCode,
    ).toBe(404);

    await call(noor.cookie, "PATCH", `/users/@me/collections/${id}`, { name: "Food" });
    await call(noor.cookie, "DELETE", `/users/@me/collections/${id}`);
    expect((await call(noor.cookie, "GET", "/users/@me/collections")).json().items).toEqual([]);
    expect((await call(noor.cookie, "GET", `/posts/${post.id}`)).json().saved).toBe(true);
  });
});
