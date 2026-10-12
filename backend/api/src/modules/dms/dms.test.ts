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
    remoteAddress: `10.40.${Math.floor(++ip / 250)}.${ip % 250}`,
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

/** A Space with everyone in it, so they may message each other. */
async function together(owner: { cookie: string }, ...others: { cookie: string }[]) {
  const space = (await call(owner.cookie, "POST", "/communities", { name: "Crew" })).json();
  const invite = (await call(owner.cookie, "POST", `/communities/${space.id}/invites`, {})).json();
  for (const o of others) await call(o.cookie, "POST", `/invites/${invite.code}`);
  return space;
}

const inbox = async (cookie: string) =>
  (await call(cookie, "GET", "/users/@me/channels")).json().conversations as {
    id: string;
    type: string;
    name: string | null;
    recipients: { id: string }[];
    lastMessage: { content: string } | null;
    pinned: boolean;
    seen: { userId: string; messageId: string }[];
  }[];

describe("direct messages", () => {
  it("opens one DM per pair, which the other side sees once something is said", async () => {
    const noor = await person();
    const kenji = await person();
    await together(noor, kenji);

    const dm = await call(noor.cookie, "POST", "/users/@me/channels", { recipientIds: [kenji.id] });
    expect(dm.statusCode).toBe(200);
    expect(dm.json()).toMatchObject({ type: "dm", recipients: [{ id: kenji.id }] });
    const again = await call(noor.cookie, "POST", "/users/@me/channels", {
      recipientIds: [kenji.id],
    });
    expect(again.json().id).toBe(dm.json().id);
    expect(await inbox(kenji.cookie)).toHaveLength(0);

    const sent = await call(noor.cookie, "POST", `/channels/${dm.json().id}/messages`, {
      content: "ranked at 9?",
    });
    expect(sent.statusCode).toBe(201);
    const theirs = await inbox(kenji.cookie);
    expect(theirs).toHaveLength(1);
    expect(theirs[0]?.lastMessage?.content).toBe("ranked at 9?");
    const reply = await call(kenji.cookie, "POST", `/channels/${dm.json().id}/messages`, {
      content: "in",
    });
    expect(reply.statusCode).toBe(201);
  });

  it("follows the other person's DM setting, and blocks always win", async () => {
    const noor = await person();
    const stranger = await person();
    const kenji = await person();
    await together(noor, kenji);

    const cold = await call(stranger.cookie, "POST", "/users/@me/channels", {
      recipientIds: [noor.id],
    });
    expect(cold.statusCode).toBe(403);
    expect(cold.json().error.code).toBe("DM_NOT_ALLOWED");

    const dm = (
      await call(noor.cookie, "POST", "/users/@me/channels", { recipientIds: [kenji.id] })
    ).json();
    await call(kenji.cookie, "PUT", `/users/@me/blocks/${noor.id}`);
    const blocked = await call(noor.cookie, "POST", `/channels/${dm.id}/messages`, {
      content: "hello?",
    });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().error.code).toBe("BLOCKED");
    const reopen = await call(noor.cookie, "POST", "/users/@me/channels", {
      recipientIds: [kenji.id],
    });
    expect(reopen.json().error.code).toBe("BLOCKED");
  });

  it("keeps under-18s to people they know", async () => {
    const teen = await person({ birthDate: "2011-03-01" });
    const adult = await person();
    await together(adult, teen);
    // A teen's default is friends only, so an adult in the same Space can't start one.
    const toTeen = await call(adult.cookie, "POST", "/users/@me/channels", {
      recipientIds: [teen.id],
    });
    expect(toTeen.json().error.code).toBe("DM_NOT_ALLOWED");
    // The teen can start one with someone they share a Space with.
    const fromTeen = await call(teen.cookie, "POST", "/users/@me/channels", {
      recipientIds: [adult.id],
    });
    expect(fromTeen.statusCode).toBe(200);
  });

  it("runs group chats: names, adding people, leaving", async () => {
    const noor = await person();
    const kenji = await person();
    const ama = await person();
    const sol = await person();
    await together(noor, kenji, ama, sol);

    const group = (
      await call(noor.cookie, "POST", "/users/@me/channels", {
        recipientIds: [kenji.id, ama.id],
      })
    ).json();
    expect(group.type).toBe("group_dm");
    expect(await inbox(kenji.cookie)).toHaveLength(1);

    const named = await call(kenji.cookie, "PATCH", `/users/@me/channels/${group.id}`, {
      name: "Ranked night",
    });
    expect(named.json().name).toBe("Ranked night");
    const added = await call(
      ama.cookie,
      "PUT",
      `/users/@me/channels/${group.id}/recipients/${sol.id}`,
    );
    expect(added.json().recipients).toHaveLength(3);
    const history = (await call(sol.cookie, "GET", `/channels/${group.id}/messages`)).json();
    expect(history.messages.map((m: { type: string }) => m.type)).toEqual([
      "system_recipient_add",
      "system_channel_rename",
    ]);

    // Only the starter removes others; anyone can leave.
    const kick = await call(
      kenji.cookie,
      "DELETE",
      `/users/@me/channels/${group.id}/recipients/${ama.id}`,
    );
    expect(kick.statusCode).toBe(403);
    expect(
      (await call(sol.cookie, "DELETE", `/users/@me/channels/${group.id}/recipients/@me`))
        .statusCode,
    ).toBe(204);
    expect((await call(sol.cookie, "GET", `/channels/${group.id}/messages`)).statusCode).toBe(404);
  });

  it("reacts, pins and shows how far the other person has read", async () => {
    const noor = await person();
    const kenji = await person();
    await together(noor, kenji);
    const dm = (
      await call(noor.cookie, "POST", "/users/@me/channels", { recipientIds: [kenji.id] })
    ).json();
    const msg = (
      await call(noor.cookie, "POST", `/channels/${dm.id}/messages`, { content: "gg" })
    ).json();

    const fire = encodeURIComponent("🔥");
    expect(
      (
        await call(
          kenji.cookie,
          "PUT",
          `/channels/${dm.id}/messages/${msg.id}/reactions/${fire}/@me`,
        )
      ).statusCode,
    ).toBe(204);
    const bad = await call(
      kenji.cookie,
      "PUT",
      `/channels/${dm.id}/messages/${msg.id}/reactions/hi/@me`,
    );
    expect(bad.statusCode).toBe(400);
    let page = (await call(kenji.cookie, "GET", `/channels/${dm.id}/messages`)).json();
    expect(page.messages[0].reactions).toEqual([{ emoji: "🔥", count: 1, me: true }]);
    page = (await call(noor.cookie, "GET", `/channels/${dm.id}/messages`)).json();
    expect(page.messages[0].reactions).toEqual([{ emoji: "🔥", count: 1, me: false }]);
    await call(
      kenji.cookie,
      "DELETE",
      `/channels/${dm.id}/messages/${msg.id}/reactions/${fire}/@me`,
    );
    page = (await call(noor.cookie, "GET", `/channels/${dm.id}/messages`)).json();
    expect(page.messages[0].reactions).toEqual([]);

    const pinned = await call(kenji.cookie, "PUT", `/channels/${dm.id}/pins/${msg.id}`);
    expect(pinned.json().pinned).toBe(true);
    const pins = (await call(noor.cookie, "GET", `/channels/${dm.id}/pins`)).json();
    expect(pins.messages.map((m: { id: string }) => m.id)).toEqual([msg.id]);

    await call(kenji.cookie, "POST", `/channels/${dm.id}/ack`, { messageId: msg.id });
    expect((await inbox(noor.cookie))[0]?.seen).toEqual([{ userId: kenji.id, messageId: msg.id }]);
    // Mutual: once Kenji hides read receipts, Noor sees none from him.
    await call(kenji.cookie, "PATCH", "/users/@me/settings", { showReadReceipts: false });
    expect((await inbox(noor.cookie))[0]?.seen).toEqual([]);
  });

  it("keeps DM reports on record, and acts at once on the gravest", async () => {
    const noor = await person();
    const kenji = await person();
    await together(noor, kenji);
    const dm = (
      await call(noor.cookie, "POST", "/users/@me/channels", { recipientIds: [kenji.id] })
    ).json();
    const a = (
      await call(kenji.cookie, "POST", `/channels/${dm.id}/messages`, { content: "spam" })
    ).json();
    const b = (
      await call(kenji.cookie, "POST", `/channels/${dm.id}/messages`, { content: "worse" })
    ).json();
    const noted = await call(noor.cookie, "POST", "/reports", {
      targetType: "message",
      targetId: a.id,
      reason: "spam",
    });
    expect(noted.json()).toMatchObject({ goesTo: "noted", hidden: false });
    const grave = await call(noor.cookie, "POST", "/reports", {
      targetType: "message",
      targetId: b.id,
      reason: "sexual_minors",
    });
    expect(grave.json()).toMatchObject({ goesTo: "realm", hidden: true });
  });
});
