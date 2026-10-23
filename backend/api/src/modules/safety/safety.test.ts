import { Permission } from "@realm/contracts";
import { decodeJwt } from "@realm/server-core";
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

async function crew(n: number, spaceBody: Record<string, unknown> = {}) {
  const owner = await person();
  const others = [];
  for (let i = 0; i < n; i++) others.push(await person());
  const space = (
    await call(owner.cookie, "POST", "/communities", { name: "Lobby", ...spaceBody })
  ).json();
  const invite = (await call(owner.cookie, "POST", `/communities/${space.id}/invites`, {})).json();
  for (const o of others) await call(o.cookie, "POST", `/invites/${invite.code}`);
  return { owner, others, space, room: space.channels[0].id as string };
}

describe("reports hide things on their own", () => {
  it("hides a message after two members report it, for the Space's mods to decide", async () => {
    const { owner, others, space, room } = await crew(4);
    const [troll, a, b, c] = others;
    if (!troll || !a || !b || !c) throw new Error("crew");
    const msg = (
      await call(troll.cookie, "POST", `/channels/${room}/messages`, { content: "rude thing" })
    ).json();

    const first = await call(a.cookie, "POST", "/reports", {
      targetType: "message",
      targetId: msg.id,
      reason: "harassment",
    });
    expect(first.statusCode).toBe(201);
    expect(first.json()).toEqual({ hidden: false, goesTo: "space" });
    const twice = await call(a.cookie, "POST", "/reports", {
      targetType: "message",
      targetId: msg.id,
      reason: "spam",
    });
    expect(twice.json().error.code).toBe("ALREADY_REPORTED");
    const second = await call(b.cookie, "POST", "/reports", {
      targetType: "message",
      targetId: msg.id,
      reason: "harassment",
      details: "again",
    });
    expect(second.json().hidden).toBe(true);

    // Everyone else sees it hidden; the owner (a moderator) still sees what it said.
    const forC = (await call(c.cookie, "GET", `/channels/${room}/messages`)).json().messages;
    expect(forC.find((m: { id: string }) => m.id === msg.id)).toMatchObject({
      hidden: true,
      content: "",
    });
    const forOwner = (await call(owner.cookie, "GET", `/channels/${room}/messages`)).json()
      .messages;
    expect(forOwner.find((m: { id: string }) => m.id === msg.id)).toMatchObject({
      hidden: true,
      content: "rude thing",
    });

    const queue = (await call(owner.cookie, "GET", `/communities/${space.id}/reports`)).json()
      .items;
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      targetId: msg.id,
      count: 2,
      hidden: true,
      details: ["again"],
    });
    expect(queue[0].evidence.content).toBe("rude thing");
    // Members can't see the queue.
    expect((await call(c.cookie, "GET", `/communities/${space.id}/reports`)).statusCode).toBe(403);

    await call(owner.cookie, "POST", `/communities/${space.id}/reports/${msg.id}`, {
      action: "remove",
    });
    expect(
      (await call(owner.cookie, "GET", `/communities/${space.id}/reports`)).json().items,
    ).toHaveLength(0);
    const log = (await call(owner.cookie, "GET", `/communities/${space.id}/audit-log`)).json()
      .entries;
    expect(log[0]).toMatchObject({ action: "message.remove" });
  });

  it("sends the gravest reports to Realm and hides at once", async () => {
    const { others, room } = await crew(2);
    const [bad, witness] = others;
    if (!bad || !witness) throw new Error("crew");
    const msg = (
      await call(bad.cookie, "POST", `/channels/${room}/messages`, { content: "x" })
    ).json();
    const r = await call(witness.cookie, "POST", "/reports", {
      targetType: "message",
      targetId: msg.id,
      reason: "sexual_minors",
    });
    expect(r.json()).toEqual({ hidden: true, goesTo: "realm" });
  });

  it("drops a public Space from Explore after enough people report it", async () => {
    const owner = await person();
    const space = (
      await call(owner.cookie, "POST", "/communities", { name: "Shady", visibility: "public" })
    ).json();
    for (let i = 0; i < 5; i++) {
      const p = await person();
      await call(p.cookie, "POST", "/reports", {
        targetType: "community",
        targetId: space.id,
        reason: "spam",
      });
    }
    const found = (
      await call(owner.cookie, "GET", "/discover/communities?sort=new&limit=50")
    ).json().spaces;
    expect(found.some((s: { id: string }) => s.id === space.id)).toBe(false);
  });
});

describe("moderators", () => {
  it("can time out, give Mods, and only act on people below them", async () => {
    const { owner, others, space, room } = await crew(2);
    const [mod, member] = others;
    if (!mod || !member) throw new Error("crew");
    const modsRole = space.roles.find((r: { name: string }) => r.name === "Mods").id;

    const promoted = await call(
      owner.cookie,
      "PATCH",
      `/communities/${space.id}/members/${mod.id}`,
      { roleIds: [modsRole] },
    );
    expect(promoted.json().roleIds).toEqual([modsRole]);

    const until = new Date(Date.now() + 3600_000).toISOString();
    const timed = await call(mod.cookie, "PATCH", `/communities/${space.id}/members/${member.id}`, {
      timeoutUntil: until,
      reason: "cool off",
    });
    expect(timed.statusCode).toBe(200);
    const blocked = await call(member.cookie, "POST", `/channels/${room}/messages`, {
      content: "hey",
    });
    expect(blocked.statusCode).toBe(403);

    // Mods can't touch the owner, can't hand out Mods (it's their own level), can't act on peers.
    expect(
      (await call(mod.cookie, "DELETE", `/communities/${space.id}/members/${owner.id}`)).statusCode,
    ).toBe(403);
    expect(
      (
        await call(mod.cookie, "PATCH", `/communities/${space.id}/members/${member.id}`, {
          roleIds: [modsRole],
        })
      ).statusCode,
    ).toBe(403);

    // Kick: they're out and told so.
    expect(
      (
        await call(
          mod.cookie,
          "DELETE",
          `/communities/${space.id}/members/${member.id}?reason=spam`,
        )
      ).statusCode,
    ).toBe(204);
    expect((await call(member.cookie, "GET", `/communities/${space.id}`)).statusCode).toBe(404);
    const actions = (await call(owner.cookie, "GET", `/communities/${space.id}/audit-log`))
      .json()
      .entries.map((e: { action: string }) => e.action);
    expect(actions).toEqual(["member.kick", "member.timeout", "member.roles"]);
  });

  it("bans keep people out, and can clear their recent messages", async () => {
    const { owner, others, space, room } = await crew(1);
    const [spammer] = others;
    if (!spammer) throw new Error("crew");
    await call(spammer.cookie, "POST", `/channels/${room}/messages`, { content: "buy now" });
    const invite = (
      await call(owner.cookie, "POST", `/communities/${space.id}/invites`, {})
    ).json();
    expect(
      (
        await call(owner.cookie, "PUT", `/communities/${space.id}/bans/${spammer.id}`, {
          reason: "spam",
          deleteMessagesHours: 24,
        })
      ).statusCode,
    ).toBe(204);
    const left = (await call(owner.cookie, "GET", `/channels/${room}/messages`)).json().messages;
    expect(left.some((m: { content: string }) => m.content === "buy now")).toBe(false);
    const back = await call(spammer.cookie, "POST", `/invites/${invite.code}`);
    expect(back.json().error.code).toBe("BANNED_FROM_COMMUNITY");
    expect(
      (await call(owner.cookie, "GET", `/communities/${space.id}/bans`)).json().bans[0].reason,
    ).toBe("spam");
    await call(owner.cookie, "DELETE", `/communities/${space.id}/bans/${spammer.id}`);
    expect((await call(spammer.cookie, "POST", `/invites/${invite.code}`)).statusCode).toBe(200);
  });

  it("make, change, order and delete roles, only below your own and within your powers", async () => {
    const { owner, others, space } = await crew(1);
    const [mod] = others;
    if (!mod) throw new Error("crew");
    const base = `/communities/${space.id}`;
    const mods = space.roles.find((r: { name: string }) => r.name === "Mods");
    const bits = (...p: bigint[]) => p.reduce((a, b) => a | b, 0n).toString();

    const helpers = await call(owner.cookie, "POST", `${base}/roles`, {
      name: "Helpers",
      color: 0x7ef2c4,
      permissions: bits(Permission.MANAGE_MESSAGES),
    });
    expect(helpers.statusCode).toBe(201);
    expect(helpers.json().position).toBe(1);

    // Mods may now manage roles, then the mod tries things.
    const modsBits = BigInt(mods.permissions) | Permission.MANAGE_ROLES;
    expect(
      (
        await call(owner.cookie, "PATCH", `${base}/roles/${mods.id}`, {
          permissions: bits(modsBits),
        })
      ).statusCode,
    ).toBe(200);
    await call(owner.cookie, "PATCH", `${base}/members/${mod.id}`, { roleIds: [mods.id] });

    const artists = await call(mod.cookie, "POST", `${base}/roles`, { name: "Artists" });
    expect(artists.statusCode).toBe(201);
    // Not a power mods have, not their own level, not a name that looks like a mention.
    expect(
      (
        await call(mod.cookie, "POST", `${base}/roles`, {
          name: "Bouncers",
          permissions: bits(Permission.BAN_MEMBERS),
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (await call(mod.cookie, "PATCH", `${base}/roles/${mods.id}`, { name: "Gods" })).statusCode,
    ).toBe(403);
    expect((await call(mod.cookie, "POST", `${base}/roles`, { name: "@here" })).statusCode).toBe(
      400,
    );

    const renamed = await call(mod.cookie, "PATCH", `${base}/roles/${helpers.json().id}`, {
      name: "Helpers ✨",
    });
    expect(renamed.json().name).toBe("Helpers ✨");

    // Artists (newest, at the bottom) goes above Helpers; Mods can't be in the list.
    const order = await call(mod.cookie, "PUT", `${base}/roles/order`, {
      roleIds: [artists.json().id, helpers.json().id],
    });
    expect(order.statusCode).toBe(200);
    const pos = (id: string) =>
      order.json().roles.find((r: { id: string }) => r.id === id).position as number;
    expect(pos(artists.json().id)).toBeGreaterThan(pos(helpers.json().id));
    expect(pos(mods.id)).toBeGreaterThan(pos(artists.json().id));
    expect(
      (
        await call(mod.cookie, "PUT", `${base}/roles/order`, {
          roleIds: [mods.id, artists.json().id, helpers.json().id],
        })
      ).statusCode,
    ).toBe(400);

    expect((await call(owner.cookie, "DELETE", `${base}/roles/${space.id}`)).statusCode).toBe(400);
    expect(
      (await call(owner.cookie, "DELETE", `${base}/roles/${helpers.json().id}`)).statusCode,
    ).toBe(204);
    const after = (await call(owner.cookie, "GET", base)).json().roles as { id: string }[];
    expect(after.some((r) => r.id === helpers.json().id)).toBe(false);

    const actions = (await call(owner.cookie, "GET", `${base}/audit-log`))
      .json()
      .entries.map((e: { action: string }) => e.action);
    expect(actions.filter((a: string) => a.startsWith("role."))).toEqual([
      "role.delete",
      "role.reorder",
      "role.update",
      "role.create",
      "role.update",
      "role.create",
    ]);
  });
});

describe("your own tools", () => {
  it("blocks and mutes, listed in one place", async () => {
    const me = await person();
    const them = await person();
    const { space } = await crew(0);
    expect((await call(me.cookie, "PUT", `/users/@me/blocks/${them.id}`)).statusCode).toBe(204);
    expect(
      (await call(me.cookie, "PUT", `/users/@me/mutes/community/${space.id}`, {})).statusCode,
    ).toBe(204);
    const lists = (await call(me.cookie, "GET", "/users/@me/safety")).json();
    expect(lists.blocked.map((u: { id: string }) => u.id)).toEqual([them.id]);
    expect(lists.mutes).toEqual([{ targetType: "community", targetId: space.id, until: null }]);
    await call(me.cookie, "DELETE", `/users/@me/blocks/${them.id}`);
    expect((await call(me.cookie, "GET", "/users/@me/safety")).json().blocked).toEqual([]);
  });
});

describe("voice rooms", () => {
  it("makes voice rooms and hands out LiveKit passes that follow permissions", async () => {
    const { owner, others, space } = await crew(1);
    const voice = (
      await call(owner.cookie, "POST", `/communities/${space.id}/channels`, {
        name: "Hangout",
        type: "voice",
      })
    ).json();
    expect(voice.type).toBe("voice");
    const pass = await call(others[0]?.cookie, "POST", `/channels/${voice.id}/voice`);
    expect(pass.statusCode).toBe(200);
    const body = pass.json();
    expect(body).toMatchObject({ url: "wss://test.livekit.cloud", canSpeak: true, canVideo: true });
    const claims = decodeJwt(body.token);
    expect(claims.sub).toBe(others[0]?.id);
    expect(claims.video).toMatchObject({ room: `realm-${voice.id}`, roomJoin: true });
    // Not a voice room, not a pass.
    expect(
      (await call(owner.cookie, "POST", `/channels/${space.channels[0].id}/voice`)).statusCode,
    ).toBe(400);
  });
});

describe("nearby", () => {
  it("finds public Spaces near a point for adults, and not for under-18s", async () => {
    const owner = await person();
    const space = (
      await call(owner.cookie, "POST", "/communities", {
        name: "Brooklyn Speedrunners",
        visibility: "public",
      })
    ).json();
    await call(owner.cookie, "PATCH", `/communities/${space.id}`, {
      location: { city: "Brooklyn", lat: 40.678178, lng: -73.944158 },
    });
    const near = (
      await call(owner.cookie, "POST", "/discover/nearby", { lat: 40.7128, lng: -74.006 })
    ).json().spaces;
    const row = near.find((s: { id: string }) => s.id === space.id);
    expect(row.city).toBe("Brooklyn");
    expect(row.distanceKm).toBeGreaterThan(3);
    expect(row.distanceKm).toBeLessThan(15);
    const far = (
      await call(owner.cookie, "POST", "/discover/nearby", { lat: 51.5, lng: -0.12 })
    ).json().spaces;
    expect(far.some((s: { id: string }) => s.id === space.id)).toBe(false);

    const year = new Date().getUTCFullYear() - 15;
    const teen = await person({ birthDate: `${year}-02-02` });
    const refused = await call(teen.cookie, "POST", "/discover/nearby", { lat: 40.7, lng: -74 });
    expect(refused.json().error.code).toBe("AGE_RESTRICTED");
  });
});
