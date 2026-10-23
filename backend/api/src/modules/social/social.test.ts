import { inArray, schema } from "@realm/db";
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
