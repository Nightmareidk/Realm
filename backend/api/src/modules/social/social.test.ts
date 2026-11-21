import { inArray, schema } from "@realm/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  browser,
  createTestApp,
  newAccount,
  sessionCookie,
  type TestContext,
} from "../../test/helpers";
import { SocialService } from "./service";

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
    remoteAddress: `10.50.${Math.floor(++ip / 250)}.${ip % 250}`,
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

const say = async (who: { cookie: string }, caption: string, extra: object = {}) => {
  const res = await call(who.cookie, "POST", "/posts", { kind: "text", caption, ...extra });
  expect(res.statusCode).toBe(201);
  return res.json() as { id: string; visibility: string };
};

const feed = async (who: { cookie: string }) =>
  ((await call(who.cookie, "GET", "/feed")).json().items as { caption: string }[]).map(
    (p) => p.caption,
  );

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from([0, 0, 0, 13]),
  Buffer.from("IHDR"),
  Buffer.from([0, 0, 0, 4, 0, 0, 0, 5, 8, 6, 0, 0, 0]),
  Buffer.alloc(40),
]);

async function photo(cookie: string) {
  const ticket = (
    await call(cookie, "POST", "/media/uploads", {
      kind: "image",
      mimeType: "image/png",
      sizeBytes: PNG.length,
    })
  ).json();
  await t.app.inject({
    method: "PUT",
    url: ticket.uploadUrl.replace(/^\/api/, ""),
    headers: { "content-type": "image/png" },
    payload: PNG,
  });
  await call(cookie, "POST", `/media/${ticket.mediaId}/complete`);
  return ticket.mediaId as string;
}

const MP4 = Buffer.concat([
  Buffer.from([0, 0, 0, 24]),
  Buffer.from("ftypisom"),
  Buffer.from([0, 0, 2, 0]),
  Buffer.from("isommp41"),
  Buffer.alloc(200),
]);

async function video(cookie: string) {
  const ticket = (
    await call(cookie, "POST", "/media/uploads", {
      kind: "video",
      mimeType: "video/mp4",
      sizeBytes: MP4.length,
      durationMs: 4000,
      width: 1920,
      height: 1080,
    })
  ).json();
  await t.app.inject({
    method: "PUT",
    url: ticket.uploadUrl.replace(/^\/api/, ""),
    headers: { "content-type": "video/mp4" },
    payload: MP4,
  });
  await call(cookie, "POST", `/media/${ticket.mediaId}/complete`);
  return ticket.mediaId as string;
}

describe("posts and the Home feed", () => {
  it("shows what people you follow post, and nothing from people you don't", async () => {
    const noor = await person();
    const kenji = await person();
    const stranger = await person();

    const followed = await call(noor.cookie, "PUT", `/users/${kenji.username}/follow`);
    expect(followed.json()).toEqual({ follow: "following" });
    await say(kenji, "ranked night recap");
    await say(stranger, "nobody asked");
    await say(noor, "my own post");

    expect(await feed(noor)).toEqual(["my own post", "ranked night recap"]);
    const profile = (await call(noor.cookie, "GET", `/users/${kenji.username}/profile`)).json();
    expect(profile).toMatchObject({
      follow: "following",
      isPrivate: false,
      counts: { posts: 1, followers: 1, following: 0 },
    });
  });

  it("posts photos, which only people who can see the post can open", async () => {
    const noor = await person();
    const kenji = await person();
    await call(noor.cookie, "PATCH", "/users/@me/settings", { profileVisibility: "private" });
    const mediaId = await photo(noor.cookie);
    const post = await call(noor.cookie, "POST", "/posts", {
      kind: "image",
      caption: "victory 13-9",
      mediaIds: [mediaId],
    });
    expect(post.statusCode).toBe(201);
    expect(post.json()).toMatchObject({ visibility: "followers", media: [{ id: mediaId }] });

    expect((await call(kenji.cookie, "GET", `/media/${mediaId}/raw`)).statusCode).toBe(404);
    const reused = await call(noor.cookie, "POST", "/posts", {
      kind: "image",
      mediaIds: [mediaId],
    });
    expect(reused.statusCode).toBe(400);
  });

  it("takes photos and videos mixed in one post, in the order they were picked", async () => {
    const noor = await person();
    const first = await video(noor.cookie);
    const second = await photo(noor.cookie);
    const post = await call(noor.cookie, "POST", "/posts", {
      kind: "image",
      caption: "clutch and the photo after",
      mediaIds: [first, second],
    });
    expect(post.statusCode).toBe(201);
    expect(post.json()).toMatchObject({
      kind: "image",
      media: [
        { id: first, kind: "video" },
        { id: second, kind: "image" },
      ],
    });
    // A Clip is still one video, and nothing else.
    const clip = await call(noor.cookie, "POST", "/posts", {
      kind: "clip",
      mediaIds: [await photo(noor.cookie)],
    });
    expect(clip.statusCode).toBe(400);
  });

  it("keeps Clips out of Home; they stay in Clips and on the profile", async () => {
    const noor = await person();
    const kenji = await person();
    await call(noor.cookie, "PUT", `/users/${kenji.username}/follow`);
    await say(kenji, "a post");
    const clip = await call(kenji.cookie, "POST", "/posts", {
      kind: "clip",
      caption: "a clip",
      mediaIds: [await video(kenji.cookie)],
    });
    expect(clip.statusCode).toBe(201);
    const clipId = clip.json().id as string;

    expect(await feed(noor)).toEqual(["a post"]);
    expect(await feed(kenji)).toEqual(["a post"]);
    const clips = (await call(noor.cookie, "GET", "/clips")).json().items as { id: string }[];
    expect(clips.map((c) => c.id)).toContain(clipId);
    const onProfile = (
      await call(noor.cookie, "GET", `/users/${kenji.username}/posts?kind=clip`)
    ).json().items as { id: string }[];
    expect(onProfile.map((c) => c.id)).toEqual([clipId]);

    // A repost of a Clip stays out of Home too.
    const sam = await person();
    await call(sam.cookie, "PUT", `/users/${noor.username}/follow`);
    expect((await call(noor.cookie, "PUT", `/posts/${clipId}/repost`)).statusCode).toBeLessThan(
      300,
    );
    expect(await feed(sam)).toEqual([]);
  });
});

describe("private accounts", () => {
  it("asks to follow, hides followers-only posts, and shows the ones marked public", async () => {
    const ama = await person();
    const noor = await person();
    await call(ama.cookie, "PATCH", "/users/@me/settings", { profileVisibility: "private" });
    const hidden = await say(ama, "just for followers");
    const open = await say(ama, "this one's public", { visibility: "public" });
    expect(hidden.visibility).toBe("followers");

    const asked = await call(noor.cookie, "PUT", `/users/${ama.username}/follow`);
    expect(asked.json()).toEqual({ follow: "requested" });
    let posts = (await call(noor.cookie, "GET", `/users/${ama.username}/posts`)).json().items;
    expect(posts.map((p: { id: string }) => p.id)).toEqual([open.id]);
    expect((await call(noor.cookie, "GET", `/posts/${hidden.id}`)).statusCode).toBe(404);
    const list = await call(noor.cookie, "GET", `/users/${ama.username}/followers`);
    expect(list.json().error.code).toBe("PRIVATE_ACCOUNT");

    const requests = (await call(ama.cookie, "GET", "/users/@me/follow-requests")).json();
    expect(requests.map((r: { user: { id: string } }) => r.user.id)).toEqual([noor.id]);
    expect(
      (await call(ama.cookie, "POST", `/users/@me/follow-requests/${noor.username}`)).statusCode,
    ).toBe(204);

    posts = (await call(noor.cookie, "GET", `/users/${ama.username}/posts`)).json().items;
    expect(posts).toHaveLength(2);
    expect((await feed(noor)).sort()).toEqual(["just for followers", "this one's public"]);
    const profile = (await call(noor.cookie, "GET", `/users/${ama.username}/profile`)).json();
    expect(profile).toMatchObject({ isPrivate: true, follow: "following", canSeeAll: true });
  });

  it("lets everyone in when the account turns business", async () => {
    const shop = await person();
    const fan = await person();
    await call(shop.cookie, "PATCH", "/users/@me/settings", { profileVisibility: "private" });
    await call(fan.cookie, "PUT", `/users/${shop.username}/follow`);
    const res = await call(shop.cookie, "PATCH", "/users/@me/account", {
      accountKind: "business",
      category: "Esports team",
    });
    expect(res.json()).toMatchObject({
      accountKind: "business",
      category: "Esports team",
      isPrivate: false,
      counts: { followers: 1 },
    });
  });
});

describe("likes, comments and activity", () => {
  it("counts likes once, threads replies, and tells the author", async () => {
    const noor = await person();
    const kenji = await person();
    const post = await say(noor, "who's in for friday");

    await call(kenji.cookie, "PUT", `/posts/${post.id}/like`);
    const liked = await call(kenji.cookie, "PUT", `/posts/${post.id}/like`);
    expect(liked.json()).toMatchObject({ likeCount: 1, liked: true });

    const top = (
      await call(kenji.cookie, "POST", `/posts/${post.id}/comments`, { body: "me" })
    ).json();
    const reply = await call(noor.cookie, "POST", `/posts/${post.id}/comments`, {
      body: "nice",
      parentId: top.id,
    });
    expect(reply.json()).toMatchObject({ parentId: top.id, depth: 1 });
    const thread = (await call(noor.cookie, "GET", `/posts/${post.id}/comments`)).json().items;
    expect(thread.map((c: { body: string }) => c.body)).toEqual(["me", "nice"]);

    // Comments take likes too, once per person.
    await call(noor.cookie, "PUT", `/posts/${post.id}/comments/${top.id}/like`);
    const again = await call(noor.cookie, "PUT", `/posts/${post.id}/comments/${top.id}/like`);
    expect(again.json()).toEqual({ likeCount: 1, liked: true });
    const seen = (await call(noor.cookie, "GET", `/posts/${post.id}/comments`)).json().items[0];
    expect(seen).toMatchObject({ likeCount: 1, liked: true });
    const gone = await call(noor.cookie, "DELETE", `/posts/${post.id}/comments/${top.id}/like`);
    expect(gone.json()).toEqual({ likeCount: 0, liked: false });

    const activity = (await call(noor.cookie, "GET", "/users/@me/activity")).json();
    expect(activity.unread).toBe(2);
    expect(activity.items.map((a: { type: string }) => a.type).sort()).toEqual([
      "post_comment",
      "post_like",
    ]);
    await call(noor.cookie, "POST", "/users/@me/activity/read");
    expect((await call(noor.cookie, "GET", "/users/@me/activity")).json().unread).toBe(0);

    const unliked = await call(kenji.cookie, "DELETE", `/posts/${post.id}/like`);
    expect(unliked.json()).toMatchObject({ likeCount: 0, liked: false });
  });
});

describe("search and blocks", () => {
  it("finds people by name, and a block hides them both ways", async () => {
    const zeynep = await person({ displayName: "Zeynep Arslan" });
    const noor = await person();
    await call(noor.cookie, "PUT", `/users/${zeynep.username}/follow`);
    await say(zeynep, "clutch round");

    const found = (await call(noor.cookie, "GET", "/search?q=zeynep")).json();
    expect(found.users.map((u: { id: string }) => u.id)).toContain(zeynep.id);

    await call(zeynep.cookie, "PUT", `/users/@me/blocks/${noor.id}`);
    expect(await feed(noor)).not.toContain("clutch round");
    const after = (await call(noor.cookie, "GET", "/search?q=zeynep")).json();
    expect(after.users.map((u: { id: string }) => u.id)).not.toContain(zeynep.id);
    expect((await call(noor.cookie, "PUT", `/users/${zeynep.username}/follow`)).statusCode).toBe(
      403,
    );
  });
});

/** Confirmed email and a week old: the accounts whose reports count on a profile post. */
async function establish(...who: { id: string }[]) {
  await t.deps.db
    .update(schema.users)
    .set({ emailVerifiedAt: new Date(), createdAt: new Date(Date.now() - 7 * 86400_000) })
    .where(
      inArray(
        schema.users.id,
        who.map((w) => BigInt(w.id)),
      ),
    );
}

const report = (who: { cookie: string }, targetType: string, targetId: string) =>
  call(who.cookie, "POST", "/reports", { targetType, targetId, reason: "harassment" });

describe("reports on posts and comments", () => {
  it("hides a profile post after three established reporters; brand-new ones don't count", async () => {
    const author = await person();
    const post = await say(author, "a post people report");
    const fresh = await person();
    const [one, two, three] = [await person(), await person(), await person()];
    await establish(one, two, three);

    expect((await report(author, "post", post.id)).statusCode).toBe(400);
    expect((await report(fresh, "post", post.id)).json()).toMatchObject({ hidden: false });
    expect((await report(one, "post", post.id)).json().hidden).toBe(false);
    expect((await report(two, "post", post.id)).json().hidden).toBe(false);
    const third = await report(three, "post", post.id);
    expect(third.json()).toMatchObject({ hidden: true, goesTo: "noted" });

    // Gone for everyone else; its author still sees it, marked.
    expect((await call(fresh.cookie, "GET", `/posts/${post.id}`)).statusCode).toBe(404);
    const own = await call(author.cookie, "GET", `/posts/${post.id}`);
    expect(own.json()).toMatchObject({ hidden: true });
    const grid = (await call(author.cookie, "GET", `/users/${author.username}/posts`)).json();
    expect(grid.items.map((p: { id: string }) => p.id)).toContain(post.id);
    const theirs = (await call(fresh.cookie, "GET", `/users/${author.username}/posts`)).json();
    expect(theirs.items.map((p: { id: string }) => p.id)).not.toContain(post.id);
  });

  it("hides a comment from everyone but its writer, and takes it off the count", async () => {
    const author = await person();
    const rude = await person();
    const post = await say(author, "comment on this");
    const comment = (
      await call(rude.cookie, "POST", `/posts/${post.id}/comments`, { body: "something rude" })
    ).json();
    const crowd = [author, await person(), await person()];
    await establish(...crowd);
    for (const who of crowd) await report(who, "comment", comment.id);

    const seen = (await call(author.cookie, "GET", `/posts/${post.id}/comments`)).json().items;
    expect(seen).toHaveLength(0);
    const mine = (await call(rude.cookie, "GET", `/posts/${post.id}/comments`)).json().items;
    expect(mine).toMatchObject([{ id: comment.id, hidden: true }]);
    expect((await call(author.cookie, "GET", `/posts/${post.id}`)).json().commentCount).toBe(0);
  });

  it("sends a post shared to a Space to that Space's moderators", async () => {
    const owner = await person();
    const space = (
      await call(owner.cookie, "POST", "/communities", { name: "Report Room" })
    ).json();
    const invite = (
      await call(owner.cookie, "POST", `/communities/${space.id}/invites`, {})
    ).json();
    const member = await person();
    await call(member.cookie, "POST", `/invites/${invite.code}`);
    const post = await say(member, "in the space", { spaceId: space.id });

    expect((await report(owner, "post", post.id)).json()).toMatchObject({ goesTo: "space" });
    const queue = (await call(owner.cookie, "GET", `/communities/${space.id}/reports`)).json();
    expect(queue.items).toMatchObject([
      { targetType: "post", targetId: post.id, evidence: { content: "in the space" } },
    ]);
    await call(owner.cookie, "POST", `/communities/${space.id}/reports/${post.id}`, {
      action: "remove",
    });
    expect((await call(member.cookie, "GET", `/posts/${post.id}`)).json().hidden).toBe(true);
  });
});

describe("blocks and spam", () => {
  it("ends following both ways when someone blocks", async () => {
    const a = await person();
    const b = await person();
    await call(a.cookie, "PUT", `/users/${b.username}/follow`);
    await call(b.cookie, "PUT", `/users/${a.username}/follow`);
    await call(a.cookie, "PUT", `/users/@me/blocks/${b.id}`);
    await call(a.cookie, "DELETE", `/users/@me/blocks/${b.id}`);
    const profile = (await call(a.cookie, "GET", `/users/${b.username}/profile`)).json();
    expect(profile).toMatchObject({ follow: "none", followsYou: false });
    expect(profile.counts).toMatchObject({ followers: 0, following: 0 });
  });

  it("slows down the same comment pasted again and again", async () => {
    const author = await person();
    const spammer = await person();
    const post = await say(author, "spam magnet");
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) {
      codes.push(
        (
          await call(spammer.cookie, "POST", `/posts/${post.id}/comments`, {
            body: "free skins here",
          })
        ).statusCode,
      );
    }
    expect(codes.slice(0, 3)).toEqual([201, 201, 201]);
    expect(codes[3]).toBe(429);
  });
});

describe("profiles like the big apps", () => {
  it("fills Explore with public posts from people you don't follow, never private or your own", async () => {
    const noor = await person();
    const kenji = await person();
    const quiet = await person();
    const shot = async (who: { cookie: string }) =>
      (
        await call(who.cookie, "POST", "/posts", {
          kind: "image",
          mediaIds: [await photo(who.cookie)],
        })
      ).json().id as string;
    const open = await shot(noor);
    await call(quiet.cookie, "PATCH", "/users/@me/settings", { profileVisibility: "private" });
    const hidden = await shot(quiet);
    const own = await shot(kenji);
    const ids = (await call(kenji.cookie, "GET", "/explore"))
      .json()
      .items.map((p: { id: string }) => p.id);
    expect(ids).toContain(open);
    expect(ids).not.toContain(hidden);
    expect(ids).not.toContain(own);
    // Once Kenji follows Noor, her posts are in his feed instead.
    await call(kenji.cookie, "PUT", `/users/${noor.username}/follow`);
    const after = (await call(kenji.cookie, "GET", "/explore")).json().items;
    expect(after.some((p: { id: string }) => p.id === open)).toBe(false);
    expect((await call(undefined, "GET", "/explore")).statusCode).toBe(401);
  });

  it("pins up to three posts to the top, and shows who you know that follows someone", async () => {
    const noor = await person();
    const kenji = await person();
    const ama = await person();
    const made = [];
    for (const c of ["one", "two", "three", "four", "five"]) made.push(await say(noor, c));
    const [one, two, three, four] = made as { id: string }[];
    for (const p of [one, two, three]) {
      expect((await call(noor.cookie, "PUT", `/posts/${p?.id}/pin`)).json().pinned).toBe(true);
    }
    expect((await call(noor.cookie, "PUT", `/posts/${four?.id}/pin`)).statusCode).toBe(400);
    expect((await call(kenji.cookie, "PUT", `/posts/${four?.id}/pin`)).statusCode).toBe(403);
    const page = (await call(kenji.cookie, "GET", `/users/${noor.username}/posts?limit=4`)).json();
    // Pinned first (newest pin first), then the rest newest first, and no repeats on page two.
    expect(page.items.slice(0, 3).every((p: { pinned: boolean }) => p.pinned)).toBe(true);
    const next = (
      await call(
        kenji.cookie,
        "GET",
        `/users/${noor.username}/posts?limit=4&before=${page.nextCursor}`,
      )
    ).json();
    const seen = [...page.items, ...next.items].map((p: { id: string }) => p.id);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toHaveLength(5);

    // Kenji follows Ama, Ama follows Noor: Noor's profile says "Followed by ama".
    await call(kenji.cookie, "PUT", `/users/${ama.username}/follow`);
    await call(ama.cookie, "PUT", `/users/${noor.username}/follow`);
    const profile = (await call(kenji.cookie, "GET", `/users/${noor.username}/profile`)).json();
    expect(profile.followedBy.count).toBe(1);
    expect(profile.followedBy.users[0].username).toBe(ama.username);
  });
});

describe("hashtags", () => {
  const tagPosts = async (cookie: string, tag: string) =>
    (await call(cookie, "GET", `/tags/${encodeURIComponent(tag)}/posts`)).json().items as {
      id: string;
    }[];

  it("finds public posts by their #tags, in any case and any language", async () => {
    const noor = await person();
    const kenji = await person();
    const a = await say(noor, "Sunset run #Running #sunset #日本 #run_club and #1 isn't a tag");
    const b = await say(kenji, "Morning miles #running");
    const none = await say(kenji, "no tags here, an email@address.com#frag and C#");

    const running = await tagPosts(kenji.cookie, "RUNNING");
    expect(running.map((p) => p.id)).toEqual([b.id, a.id]);
    expect((await tagPosts(kenji.cookie, "日本")).map((p) => p.id)).toEqual([a.id]);
    expect((await tagPosts(kenji.cookie, "run_club")).map((p) => p.id)).toEqual([a.id]);
    expect(await tagPosts(kenji.cookie, "frag")).toEqual([]);
    expect(none.id).toBeTruthy();
    // Not a tag at all: refused, not searched.
    expect((await call(kenji.cookie, "GET", "/tags/a%20b/posts")).statusCode).toBe(400);
    expect((await call(undefined, "GET", "/tags/running/posts")).statusCode).toBe(401);
  });

  it("follows an edited caption, and forgets a deleted post", async () => {
    const noor = await person();
    const kenji = await person();
    const post = await say(noor, "first thoughts #draft");
    expect(await tagPosts(kenji.cookie, "draft")).toHaveLength(1);
    await call(noor.cookie, "PATCH", `/posts/${post.id}`, { caption: "final words #finished" });
    expect(await tagPosts(kenji.cookie, "draft")).toEqual([]);
    expect(await tagPosts(kenji.cookie, "finished")).toHaveLength(1);
    await call(noor.cookie, "DELETE", `/posts/${post.id}`);
    expect(await tagPosts(kenji.cookie, "finished")).toEqual([]);
  });

  it("keeps private, followers-only and blocked people's posts out of a tag", async () => {
    const noor = await person();
    const kenji = await person();
    const shy = await person();
    await call(shy.cookie, "PATCH", "/users/@me/settings", { profileVisibility: "private" });
    await say(shy, "only for my people #secretclub");
    await say(noor, "for followers #secretclub", { visibility: "followers" });
    const open = await say(noor, "for everyone #secretclub");
    expect((await tagPosts(kenji.cookie, "secretclub")).map((p) => p.id)).toEqual([open.id]);
    // Blocked either way: gone from the tag for both.
    await call(noor.cookie, "PUT", `/users/@me/blocks/${kenji.id}`);
    expect(await tagPosts(kenji.cookie, "secretclub")).toEqual([]);
  });

  it("ranks trending tags by how many different people used them", async () => {
    const people = [await person(), await person(), await person()];
    const tag = `wave${Date.now()}`;
    const spam = `spam${Date.now()}`;
    for (const p of people) await say(p, `joining in #${tag}`);
    // One account posting a tag five times doesn't beat three people posting another.
    for (let i = 0; i < 5; i++) await say(people[0] as { cookie: string }, `again ${i} #${spam}`);
    const trending = (await call(people[1]?.cookie, "GET", "/tags/trending")).json().tags as {
      tag: string;
      posts: number;
    }[];
    const names = trending.map((x) => x.tag);
    expect(names).toContain(tag);
    expect(trending.find((x) => x.tag === tag)?.posts).toBe(3);
    if (names.includes(spam)) expect(names.indexOf(tag)).toBeLessThan(names.indexOf(spam));
  });
});

describe("reposts", () => {
  type Item = { id: string; caption: string; repostedBy: { id: string } | null };
  const home = async (who: { cookie: string }) =>
    (await call(who.cookie, "GET", "/feed")).json().items as Item[];

  it("shows a repost in the reposter's followers' Home, with their name on it", async () => {
    const author = await person();
    const noor = await person();
    const fan = await person();
    await call(fan.cookie, "PUT", `/users/${noor.username}/follow`);
    const post = await say(author, "worth sharing");

    // The fan doesn't follow the author, so it isn't in their Home yet.
    expect((await home(fan)).map((p) => p.id)).not.toContain(post.id);
    const done = await call(noor.cookie, "PUT", `/posts/${post.id}/repost`);
    expect(done.statusCode, done.body).toBe(200);
    expect(done.json()).toMatchObject({ repostCount: 1, reposted: true });

    const seen = (await home(fan)).find((p) => p.id === post.id);
    expect(seen?.repostedBy?.id).toBe(noor.id);
    // Reposting twice counts once, and the author is told once.
    await call(noor.cookie, "PUT", `/posts/${post.id}/repost`);
    expect((await call(author.cookie, "GET", `/posts/${post.id}`)).json().repostCount).toBe(1);
    const activity = (await call(author.cookie, "GET", "/users/@me/activity")).json().items as {
      type: string;
      actor: { id: string };
    }[];
    expect(activity.filter((a) => a.type === "post_repost")).toHaveLength(1);
    expect(activity.find((a) => a.type === "post_repost")?.actor.id).toBe(noor.id);

    // Taking it back removes it from the follower's Home.
    const undone = await call(noor.cookie, "DELETE", `/posts/${post.id}/repost`);
    expect(undone.json()).toMatchObject({ repostCount: 0, reposted: false });
    expect((await home(fan)).map((p) => p.id)).not.toContain(post.id);
  });

  it("puts a reposted post once, at its newest place, and pages without repeats", async () => {
    const author = await person();
    const noor = await person();
    const fan = await person();
    await call(fan.cookie, "PUT", `/users/${noor.username}/follow`);
    await call(fan.cookie, "PUT", `/users/${author.username}/follow`);
    const old = await say(author, "an older post");
    const mid = await say(noor, "noor's own post");
    // Reposted after Noor's own post: it now sits above it, and only once.
    await call(noor.cookie, "PUT", `/posts/${old.id}/repost`);
    const list = await home(fan);
    expect(list.map((p) => p.id)).toEqual([old.id, mid.id]);
    expect(list[0]?.repostedBy?.id).toBe(noor.id);

    // Paging by one never shows the same post twice.
    const first = (await call(fan.cookie, "GET", "/feed?limit=1")).json();
    expect(first.items.map((p: Item) => p.id)).toEqual([old.id]);
    const second = (
      await call(fan.cookie, "GET", `/feed?limit=1&before=${first.nextCursor}`)
    ).json();
    expect(second.items.map((p: Item) => p.id)).toEqual([mid.id]);
    const third = (
      await call(fan.cookie, "GET", `/feed?limit=1&before=${second.nextCursor ?? "1"}`)
    ).json();
    expect(third.items.map((p: Item) => p.id)).not.toContain(old.id);
  });

  it("only takes public posts by other people, and respects blocks", async () => {
    const author = await person();
    const noor = await person();
    const fan = await person();
    await call(fan.cookie, "PUT", `/users/${noor.username}/follow`);
    const own = await say(noor, "my own words");
    expect((await call(noor.cookie, "PUT", `/posts/${own.id}/repost`)).statusCode).toBe(400);
    await call(noor.cookie, "PUT", `/users/${author.username}/follow`);
    const quiet = await say(author, "for followers only", { visibility: "followers" });
    expect((await call(noor.cookie, "PUT", `/posts/${quiet.id}/repost`)).statusCode).toBe(400);
    expect((await call(undefined, "PUT", `/posts/${own.id}/repost`)).statusCode).toBe(401);

    // The fan blocked the author: a repost of the author's post never reaches the fan.
    const open = await say(author, "public words");
    await call(fan.cookie, "PUT", `/users/@me/blocks/${author.id}`);
    await call(noor.cookie, "PUT", `/posts/${open.id}/repost`);
    expect((await home(fan)).map((p) => p.id)).not.toContain(open.id);
    // And the author, blocked by someone, can't repost that person's posts.
    const fans = await say(fan, "the fan's post");
    expect((await call(author.cookie, "PUT", `/posts/${fans.id}/repost`)).statusCode).toBe(404);
  });
});

describe("polls", () => {
  type Poll = {
    options: { text: string; votes: number | null }[];
    total: number;
    voted: number | null;
    ended: boolean;
  };
  const poll = { options: ["Tea", "Coffee", "Water"], hours: 24 };

  it("hides the numbers until you vote, takes one vote each, and shows them after", async () => {
    const author = await person();
    const noor = await person();
    const kenji = await person();
    const post = await say(author, "What's in your cup?", { poll });

    // Someone who hasn't voted sees the choices and how many voted, not who's winning.
    const before = (await call(noor.cookie, "GET", `/posts/${post.id}`)).json().poll as Poll;
    expect(before.options.map((o) => o.text)).toEqual(poll.options);
    expect(before.options.every((o) => o.votes === null)).toBe(true);
    expect(before).toMatchObject({ total: 0, voted: null, ended: false });

    const voted = await call(noor.cookie, "PUT", `/posts/${post.id}/poll/vote`, { choice: 1 });
    expect(voted.statusCode, voted.body).toBe(200);
    expect((voted.json().poll as Poll).options.map((o) => o.votes)).toEqual([0, 1, 0]);
    expect(voted.json().poll).toMatchObject({ total: 1, voted: 1 });

    // One vote each: no second go, and no changing it.
    expect(
      (await call(noor.cookie, "PUT", `/posts/${post.id}/poll/vote`, { choice: 0 })).statusCode,
    ).toBe(400);
    await call(kenji.cookie, "PUT", `/posts/${post.id}/poll/vote`, { choice: 1 });
    // The author sees the numbers without voting; a stranger who hasn't voted still doesn't.
    const mine = (await call(author.cookie, "GET", `/posts/${post.id}`)).json().poll as Poll;
    expect(mine.options.map((o) => o.votes)).toEqual([0, 2, 0]);
    expect(mine.voted).toBeNull();
    const stranger = await person();
    const theirs = (await call(stranger.cookie, "GET", `/posts/${post.id}`)).json().poll as Poll;
    expect(theirs.total).toBe(2);
    expect(theirs.options.every((o) => o.votes === null)).toBe(true);
  });

  it("refuses bad polls and bad votes", async () => {
    const author = await person();
    const noor = await person();
    const bad = async (extra: object) =>
      (await call(author.cookie, "POST", "/posts", { kind: "text", caption: "hm", ...extra }))
        .statusCode;
    expect(await bad({ poll: { options: ["only one"] } })).toBe(400);
    expect(await bad({ poll: { options: ["a", "b", "c", "d", "e"] } })).toBe(400);
    expect(await bad({ poll: { options: ["Same", "same"] } })).toBe(400);
    expect(await bad({ poll: { options: ["a", "b"], hours: 5 } })).toBe(400);
    expect(await bad({ poll: { options: ["a", "x".repeat(41)] } })).toBe(400);

    const post = await say(author, "Pick one", { poll: { options: ["Left", "Right"] } });
    const vote = (who: { cookie: string } | null, choice: unknown) =>
      call(who?.cookie, "PUT", `/posts/${post.id}/poll/vote`, { choice });
    expect((await vote(null, 0)).statusCode).toBe(401);
    expect((await vote(noor, 2)).statusCode).toBe(400);
    expect((await vote(noor, -1)).statusCode).toBe(400);
    expect((await vote(noor, "0; drop table posts")).statusCode).toBe(400);
    // A post without a poll has nothing to vote in.
    const plain = await say(author, "no poll here");
    expect(
      (await call(noor.cookie, "PUT", `/posts/${plain.id}/poll/vote`, { choice: 0 })).statusCode,
    ).toBe(404);
    // The question people voted on can't be rewritten afterwards.
    expect(
      (
        await call(author.cookie, "PATCH", `/posts/${post.id}`, {
          caption: "Pick the other",
          visibility: "public",
          tags: [],
        })
      ).statusCode,
    ).toBe(400);
  });

  it("closes when its time is up, and then shows everyone the result", async () => {
    const author = await person();
    const noor = await person();
    const late = await person();
    const post = await say(author, "Quick one", { poll: { options: ["Yes", "No"], hours: 1 } });
    await call(noor.cookie, "PUT", `/posts/${post.id}/poll/vote`, { choice: 0 });
    await t.deps.db
      .update(schema.postPolls)
      .set({ endsAt: new Date(Date.now() - 1000) })
      .where(inArray(schema.postPolls.postId, [BigInt(post.id)]));
    expect(
      (await call(late.cookie, "PUT", `/posts/${post.id}/poll/vote`, { choice: 1 })).statusCode,
    ).toBe(400);
    const done = (await call(late.cookie, "GET", `/posts/${post.id}`)).json().poll as Poll;
    expect(done.ended).toBe(true);
    expect(done.options.map((o) => o.votes)).toEqual([1, 0]);
  });

  it("can't be voted in by someone who can't see the post", async () => {
    const author = await person();
    const outsider = await person();
    const post = await say(author, "Followers, choose", {
      visibility: "followers",
      poll: { options: ["A", "B"] },
    });
    expect(
      (await call(outsider.cookie, "PUT", `/posts/${post.id}/poll/vote`, { choice: 0 })).statusCode,
    ).toBe(404);
  });
});

describe("quote posts", () => {
  type Quoted = { id: string; post: { caption: string; author: { id: string } } | null } | null;
  const quotedOf = async (who: { cookie: string }, id: string) =>
    (await call(who.cookie, "GET", `/posts/${id}`)).json().quoted as Quoted;

  it("shows the quoted post under the new words, and tells its author", async () => {
    const author = await person();
    const noor = await person();
    const original = await say(author, "the original thought");
    const quote = await say(noor, "adding my view", { quoteOf: original.id });

    const seen = await quotedOf(author, quote.id);
    expect(seen?.id).toBe(original.id);
    expect(seen?.post).toMatchObject({ caption: "the original thought" });
    expect(seen?.post?.author.id).toBe(author.id);

    const activity = (await call(author.cookie, "GET", "/users/@me/activity")).json().items as {
      type: string;
      actor: { id: string };
      post: { id: string };
      text: string | null;
    }[];
    const told = activity.find((a) => a.type === "post_quote");
    // It opens the new post, the one with the quote in it.
    expect(told).toMatchObject({ actor: { id: noor.id }, post: { id: quote.id } });
    expect(told?.text).toBe("adding my view");
    // Quoting your own post tells nobody.
    await say(author, "more on that", { quoteOf: original.id });
    const again = (await call(author.cookie, "GET", "/users/@me/activity")).json().items as {
      type: string;
    }[];
    expect(again.filter((a) => a.type === "post_quote")).toHaveLength(1);
  });

  it("only quotes public posts the writer can see", async () => {
    const author = await person();
    const noor = await person();
    await call(noor.cookie, "PUT", `/users/${author.username}/follow`);
    const quiet = await say(author, "for followers only", { visibility: "followers" });
    const tryQuote = async (who: { cookie: string }, id: string) =>
      (
        await call(who.cookie, "POST", "/posts", {
          kind: "text",
          caption: "look at this",
          quoteOf: id,
        })
      ).statusCode;
    // A follower can see it, but quoting would show it to people who can't.
    expect(await tryQuote(noor, quiet.id)).toBe(400);
    const stranger = await person();
    expect(await tryQuote(stranger, quiet.id)).toBe(404);
    expect(await tryQuote(noor, "1")).toBe(404);
    // A quote can't also carry a poll.
    const open = await say(author, "public words");
    expect(
      (
        await call(noor.cookie, "POST", "/posts", {
          kind: "text",
          caption: "both?",
          quoteOf: open.id,
          poll: { options: ["a", "b"] },
        })
      ).statusCode,
    ).toBe(400);
  });

  it("stops showing a quoted post that was deleted, hidden away, or whose author you blocked", async () => {
    const author = await person();
    const noor = await person();
    const reader = await person();
    const one = await say(author, "soon deleted");
    const two = await say(author, "soon followers-only");
    const three = await say(author, "from someone the reader blocks");
    const q1 = await say(noor, "quote one", { quoteOf: one.id });
    const q2 = await say(noor, "quote two", { quoteOf: two.id });
    const q3 = await say(noor, "quote three", { quoteOf: three.id });

    await call(author.cookie, "DELETE", `/posts/${one.id}`);
    const hid = await call(author.cookie, "PATCH", `/posts/${two.id}`, {
      caption: "soon followers-only",
      visibility: "followers",
      tags: [],
    });
    expect(hid.statusCode, hid.body).toBe(200);
    expect(await quotedOf(reader, q1.id)).toEqual({ id: one.id, post: null });
    expect(await quotedOf(reader, q2.id)).toEqual({ id: two.id, post: null });
    // Still shown to everyone else...
    expect((await quotedOf(reader, q3.id))?.post?.caption).toBe("from someone the reader blocks");
    // ...but not to the reader once they block its author. The quote's own words stay.
    await call(reader.cookie, "PUT", `/users/@me/blocks/${author.id}`);
    expect(await quotedOf(reader, q3.id)).toEqual({ id: three.id, post: null });
    expect((await call(reader.cookie, "GET", `/posts/${q3.id}`)).json().caption).toBe(
      "quote three",
    );
  });
});

describe("time capsules", () => {
  const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
  const openNow = async (postId: string) => {
    await t.deps.db
      .update(schema.posts)
      .set({ opensAt: new Date(Date.now() - 5) })
      .where(inArray(schema.posts.id, [BigInt(postId)]));
    return new SocialService(t.deps).openCapsules();
  };

  it("keeps what's inside sealed from everyone but its author until it opens", async () => {
    const author = await person();
    const noor = await person();
    await call(noor.cookie, "PUT", `/users/${author.username}/follow`);
    const opensAt = inDays(30);
    const post = await say(author, "Dear future me, #goals @nobody", { opensAt });

    // Its author sees the words, and that it's sealed.
    const mine = (await call(author.cookie, "GET", `/posts/${post.id}`)).json();
    expect(mine.caption).toBe("Dear future me, #goals @nobody");
    expect(mine.capsule).toEqual({ opensAt, sealed: true });

    // Anyone else sees only that it exists and when it opens, here and on the profile.
    const theirs = (await call(noor.cookie, "GET", `/posts/${post.id}`)).json();
    expect(theirs.caption).toBeNull();
    expect(theirs.media).toEqual([]);
    expect(theirs.capsule).toEqual({ opensAt, sealed: true });
    const profile = (await call(noor.cookie, "GET", `/users/${author.username}/posts`)).json();
    expect(profile.items.find((p: { id: string }) => p.id === post.id)?.caption).toBeNull();

    // Not in Home, not under its #tag, until it opens.
    expect(await feed(noor)).not.toContain("Dear future me, #goals @nobody");
    const underTag = async () => {
      const res = await call(noor.cookie, "GET", "/tags/goals/posts");
      expect(res.statusCode).toBe(200);
      return (res.json().items as { id: string }[]).some((p) => p.id === post.id);
    };
    expect(await underTag()).toBe(false);

    // Nobody can like, comment on, repost or quote it yet; saving it (to be reminded) is fine.
    const act = (method: Method, url: string, payload?: unknown) =>
      call(noor.cookie, method, url, payload).then((r) => r.statusCode);
    expect(await act("PUT", `/posts/${post.id}/like`)).toBe(400);
    expect(await act("PUT", `/posts/${post.id}/repost`)).toBe(400);
    expect(await act("POST", `/posts/${post.id}/comments`, { body: "what is it?" })).toBe(400);
    expect(await act("POST", "/posts", { kind: "text", caption: "hm", quoteOf: post.id })).toBe(
      400,
    );
    expect(await act("PUT", `/posts/${post.id}/save`)).toBe(200);

    // Once it opens, its #tag finds it.
    await openNow(post.id);
    expect(await underTag()).toBe(true);
  });

  it("opens on time: arrives fresh in Home and tells its author and the people who saved it", async () => {
    const author = await person();
    const noor = await person();
    await call(noor.cookie, "PUT", `/users/${author.username}/follow`);
    const post = await say(author, "Open me later", { opensAt: inDays(1) });
    await say(author, "an ordinary post after it");
    await call(noor.cookie, "PUT", `/posts/${post.id}/save`);
    await new Promise((r) => setTimeout(r, 30));

    expect(await openNow(post.id)).toBeGreaterThanOrEqual(1);
    // Announced once only, however often the job runs.
    await new SocialService(t.deps).openCapsules();

    const opened = (await call(noor.cookie, "GET", `/posts/${post.id}`)).json();
    expect(opened.caption).toBe("Open me later");
    expect(opened.capsule.sealed).toBe(false);
    // Placed by when it opened: above the post written after it.
    const home = await feed(noor);
    expect(home.indexOf("Open me later")).toBeLessThan(home.indexOf("an ordinary post after it"));
    expect(home.filter((c) => c === "Open me later")).toHaveLength(1);

    const told = async (who: { cookie: string }) =>
      (await call(who.cookie, "GET", "/users/@me/activity"))
        .json()
        .items.filter(
          (a: { type: string; post: { id: string } | null }) =>
            a.type === "capsule_open" && a.post?.id === post.id,
        );
    expect(await told(author)).toHaveLength(1);
    expect(await told(noor)).toHaveLength(1);
    expect((await call(noor.cookie, "PUT", `/posts/${post.id}/like`)).statusCode).toBe(200);
  });

  it("refuses capsules that open too soon, too late, or can't be one", async () => {
    const author = await person();
    const bad = async (extra: object, kind = "text") =>
      (await call(author.cookie, "POST", "/posts", { kind, caption: "later", ...extra }))
        .statusCode;
    expect(await bad({ opensAt: new Date(Date.now() + 10 * 60_000).toISOString() })).toBe(400);
    expect(await bad({ opensAt: inDays(-1) })).toBe(400);
    expect(await bad({ opensAt: inDays(6 * 366) })).toBe(400);
    expect(await bad({ opensAt: "next tuesday" })).toBe(400);
    expect(await bad({ opensAt: inDays(7), poll: { options: ["a", "b"] } })).toBe(400);
    expect(await bad({ opensAt: inDays(7), tags: ["someone"] })).toBe(400);
    expect(await bad({ opensAt: inDays(7) })).toBe(201);
  });
});
