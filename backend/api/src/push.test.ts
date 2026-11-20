import { eq, schema } from "@realm/db";
import { fcmMessage, NoopPusher, type Pusher } from "@realm/server-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { activityText } from "./jobs";
import { revokeAllSessions } from "./lib/sessions";
import {
  browser,
  createTestApp,
  newAccount,
  sessionCookie,
  type TestContext,
} from "./test/helpers";

let t: TestContext;
const pusher = new NoopPusher(true);

beforeAll(async () => {
  t = await createTestApp();
  (t.deps as { pusher: Pusher }).pusher = pusher;
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
    remoteAddress: `10.61.${Math.floor(++ip / 250)}.${ip % 250}`,
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

describe("the Firebase message for each kind of device", () => {
  const base = {
    token: "t".repeat(40),
    title: "Noor",
    body: "hi",
    link: "/messages/1",
    tag: "room-1",
  };

  it("sends the website a data message its service worker shows", () => {
    const m = fcmMessage({ ...base, platform: "web", extra: { room: "1" } });
    expect(m).toMatchObject({
      data: { title: "Noor", body: "hi", link: "/messages/1", tag: "room-1", room: "1" },
      webpush: { headers: { Urgency: "high" } },
    });
    expect(m).not.toHaveProperty("android");
  });

  it("sends the Android app the shape its notifications library shows while closed", () => {
    const m = fcmMessage({
      ...base,
      platform: "android",
      channel: "activity",
      extra: { room: "1" },
    });
    expect(m.data).toMatchObject({
      title: "Noor",
      message: "hi",
      channelId: "activity",
      tag: "room-1",
    });
    expect(JSON.parse(m.data.body as string)).toEqual({
      link: "/messages/1",
      tag: "room-1",
      room: "1",
    });
    // Every value is a string: Firebase refuses anything else in `data`.
    for (const v of Object.values(m.data)) expect(typeof v).toBe("string");
    expect(m).toMatchObject({ android: { priority: "high", collapse_key: "room-1" } });
  });
});

describe("activity notifications", () => {
  it("words each kind plainly", () => {
    expect(activityText("post_like", {}, true, false)).toBe("liked your post.");
    expect(activityText("post_comment", { text: "nice!" }, true, false)).toBe("commented: nice!");
    expect(activityText("mention", { via: "tag" }, true, false)).toBe("tagged you in a post.");
    expect(activityText("follow", { accepted: true }, true, false)).toBe(
      "accepted your follow request.",
    );
    expect(activityText("capsule_open", {}, false, true)).toBe("Your time capsule just opened.");
    expect(activityText("post_like", {}, false, false)).toBeNull();
  });

  it("tells an away author about a like, a comment and a follow, on their phone", async () => {
    const noor = await person();
    const kenji = await person();
    const token = "a".repeat(60);
    expect(
      (await call(noor.cookie, "PUT", "/users/@me/push-tokens", { token, platform: "android" }))
        .statusCode,
    ).toBe(204);
    const post = (
      await call(noor.cookie, "POST", "/posts", { kind: "text", caption: "first" })
    ).json();
    pusher.sent.length = 0;

    await call(kenji.cookie, "PUT", `/posts/${post.id}/like`);
    await t.queue.drain();
    expect(pusher.sent).toHaveLength(1);
    expect(pusher.sent[0]).toMatchObject({
      token,
      platform: "android",
      channel: "activity",
      body: "liked your post.",
      link: `/p/${post.id}`,
      extra: { post: post.id, user: kenji.username },
    });

    // Unlike and like again within ten minutes: no second buzz.
    await call(kenji.cookie, "DELETE", `/posts/${post.id}/like`);
    await call(kenji.cookie, "PUT", `/posts/${post.id}/like`);
    await t.queue.drain();
    expect(pusher.sent).toHaveLength(1);

    await call(kenji.cookie, "POST", `/posts/${post.id}/comments`, { body: "so good" });
    await call(kenji.cookie, "PUT", `/users/${noor.username}/follow`);
    await t.queue.drain();
    expect(pusher.sent.map((p) => p.body)).toEqual([
      "liked your post.",
      "commented: so good",
      "started following you.",
    ]);
  });

  it("keeps each kind's switch, and pausing stops everything", async () => {
    const ama = await person();
    const sol = await person();
    await call(ama.cookie, "PUT", "/users/@me/push-tokens", {
      token: "b".repeat(60),
      platform: "web",
    });
    const fresh = (await call(ama.cookie, "GET", "/users/@me/notification-prefs")).json();
    expect(fresh).toEqual({
      paused: false,
      kinds: { messages: true, likes: true, comments: true, follows: true, mentions: true },
    });

    const off = await call(ama.cookie, "PUT", "/users/@me/notification-prefs", {
      kinds: { likes: false },
    });
    expect(off.json().kinds).toMatchObject({ likes: false, comments: true });
    const post = (
      await call(ama.cookie, "POST", "/posts", { kind: "text", caption: "hey" })
    ).json();
    pusher.sent.length = 0;
    await call(sol.cookie, "PUT", `/posts/${post.id}/like`);
    await call(sol.cookie, "POST", `/posts/${post.id}/comments`, { body: "yo" });
    await t.queue.drain();
    expect(pusher.sent.map((p) => p.body)).toEqual(["commented: yo"]);

    await call(ama.cookie, "PUT", "/users/@me/notification-prefs", { paused: true });
    await call(sol.cookie, "PUT", `/users/${ama.username}/follow`);
    await t.queue.drain();
    expect(pusher.sent).toHaveLength(1);
    // Pausing keeps the per-kind choices for when they come back.
    const back = (
      await call(ama.cookie, "PUT", "/users/@me/notification-prefs", { paused: false })
    ).json();
    expect(back).toMatchObject({ paused: false, kinds: { likes: false } });
  });

  it("stays quiet about people they blocked", async () => {
    const lee = await person();
    const max = await person();
    await call(lee.cookie, "PUT", "/users/@me/push-tokens", {
      token: "c".repeat(60),
      platform: "web",
    });
    const post = (await call(lee.cookie, "POST", "/posts", { kind: "text", caption: "x" })).json();
    await call(lee.cookie, "PUT", `/users/@me/blocks/${max.id}`);
    pusher.sent.length = 0;
    await call(max.cookie, "PUT", `/posts/${post.id}/like`);
    await t.queue.drain();
    expect(pusher.sent).toHaveLength(0);
  });

  it("keeps devices on 'sign out other devices', and forgets them all when signed out everywhere", async () => {
    const ivy = await person();
    await call(ivy.cookie, "PUT", "/users/@me/push-tokens", {
      token: "d".repeat(60),
      platform: "android",
    });
    const tokens = () =>
      t.deps.db
        .select()
        .from(schema.pushTokens)
        .where(eq(schema.pushTokens.userId, BigInt(ivy.id)));
    await call(ivy.cookie, "DELETE", "/sessions");
    expect(await tokens()).toHaveLength(1);
    // A password reset or a suspension signs out every session, this one included.
    await revokeAllSessions(t.deps, t.deps.db, BigInt(ivy.id));
    expect(await tokens()).toHaveLength(0);
  });
});
