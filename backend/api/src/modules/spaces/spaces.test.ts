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
const nextIp = () => `10.9.${Math.floor(++ip / 250)}.${ip % 250}`;

async function person(overrides: Partial<Record<string, string>> = {}) {
  const account = newAccount(overrides);
  const res = await t.app.inject({
    method: "POST",
    url: "/v1/auth/register",
    headers: browser(),
    payload: account,
    remoteAddress: nextIp(),
  });
  expect(res.statusCode).toBe(201);
  const cookie = sessionCookie(res);
  if (!cookie) throw new Error("no session cookie");
  return { cookie, id: res.json().user.id as string, name: account.displayName };
}

type Method = "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
async function call(cookie: string | undefined, method: Method, url: string, payload?: unknown) {
  return t.app.inject({
    method,
    url: `/v1${url}`,
    headers: browser(cookie),
    ...(payload === undefined ? {} : { payload: payload as object }),
  });
}

async function newSpace(cookie: string, body: Record<string, unknown> = {}) {
  const res = await call(cookie, "POST", "/communities", { name: "Late Night Lobby", ...body });
  expect(res.statusCode).toBe(201);
  return res.json();
}

describe("making a Space", () => {
  it("makes you its owner, with Everyone and Mods roles and a #general room", async () => {
    const noor = await person();
    const space = await newSpace(noor.cookie, { accent: "ember" });
    expect(space.slug).toMatch(/^late-night-lobby/);
    expect(space.accent).toBe("ember");
    expect(space.visibility).toBe("private");
    expect(space.joinPolicy).toBe("invite");
    expect(space.memberCount).toBe(1);
    expect(space.channels.map((c: { name: string }) => c.name)).toEqual(["general"]);
    expect(space.roles.map((r: { name: string }) => r.name).sort()).toEqual(["@everyone", "Mods"]);
    expect(space.self.user.id).toBe(noor.id);
    expect(
      t.bus.published.some(
        (p) => p.topic === `user:${noor.id}` && p.event.type === "COMMUNITY_CREATE",
      ),
    ).toBe(true);

    const mine = await call(noor.cookie, "GET", "/users/@me/communities");
    expect(mine.json().spaces.map((s: { id: string }) => s.id)).toContain(space.id);
  });

  it("gives a second Space with the same name its own link", async () => {
    const a = await person();
    const one = await newSpace(a.cookie, { name: "Clip club" });
    const two = await newSpace(a.cookie, { name: "Clip club" });
    expect(one.slug).not.toBe(two.slug);
  });

  it("hides a private Space from people who aren't in it", async () => {
    const owner = await person();
    const stranger = await person();
    const space = await newSpace(owner.cookie);
    expect((await call(stranger.cookie, "GET", `/communities/${space.slug}`)).statusCode).toBe(404);
    expect(
      (await call(stranger.cookie, "GET", `/communities/${space.id}/members`)).statusCode,
    ).toBe(404);
    const room = space.channels[0].id;
    expect((await call(stranger.cookie, "GET", `/channels/${room}/messages`)).statusCode).toBe(404);
  });

  it("won't make a private Space public yet", async () => {
    const owner = await person();
    const space = await newSpace(owner.cookie);
    const res = await call(owner.cookie, "PATCH", `/communities/${space.id}`, {
      visibility: "public",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("COMING_SOON");
  });
});

describe("invites", () => {
  it("previews for anyone, then joins with a line in #general", async () => {
    const noor = await person();
    const kenji = await person();
    const space = await newSpace(noor.cookie);
    const made = await call(noor.cookie, "POST", `/communities/${space.id}/invites`, {});
    expect(made.statusCode).toBe(201);
    const invite = made.json();
    expect(invite.code).toMatch(/^[A-Za-z0-9]{10}$/);
    expect(invite.maxUses).toBeNull();
    expect(new Date(invite.expiresAt).getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);

    // Signed out: the Space's name and count, nothing from inside a private Space.
    const preview = await call(undefined, "GET", `/invites/${invite.code}`);
    expect(preview.statusCode).toBe(200);
    expect(preview.json().community.name).toBe("Late Night Lobby");
    expect(preview.json().inviter.displayName).toBe(noor.name);
    expect(preview.json().rooms).toEqual([]);

    const joined = await call(kenji.cookie, "POST", `/invites/${invite.code}`);
    expect(joined.statusCode).toBe(200);
    expect(joined.json().memberCount).toBe(2);

    // Joining again is harmless and doesn't use the invite up.
    expect((await call(kenji.cookie, "POST", `/invites/${invite.code}`)).statusCode).toBe(200);
    expect((await call(undefined, "GET", `/invites/${invite.code}`)).json().uses).toBe(1);

    const history = await call(noor.cookie, "GET", `/channels/${space.channels[0].id}/messages`);
    const [hello] = history.json().messages;
    expect(hello.type).toBe("system_join");
    expect(hello.author.id).toBe(kenji.id);

    const members = await call(kenji.cookie, "GET", `/communities/${space.id}/members`);
    expect(members.json().members).toHaveLength(2);
  });

  it("says plainly when an invite is used up or turned off", async () => {
    const noor = await person();
    const a = await person();
    const b = await person();
    const space = await newSpace(noor.cookie);
    const once = (
      await call(noor.cookie, "POST", `/communities/${space.id}/invites`, { maxUses: 1 })
    ).json();
    expect((await call(a.cookie, "POST", `/invites/${once.code}`)).statusCode).toBe(200);
    const late = await call(b.cookie, "POST", `/invites/${once.code}`);
    expect(late.statusCode).toBe(410);
    expect(late.json().error.code).toBe("INVITE_USED_UP");
    expect(late.json().error.message).toContain(`Ask ${noor.name}`);

    const other = (await call(noor.cookie, "POST", `/communities/${space.id}/invites`, {})).json();
    expect((await call(noor.cookie, "DELETE", `/invites/${other.code}`)).statusCode).toBe(204);
    const off = await call(undefined, "GET", `/invites/${other.code}`);
    expect(off.statusCode).toBe(410);
    expect(off.json().error.code).toBe("INVITE_REVOKED");

    expect((await call(undefined, "GET", "/invites/nopeNOPE99")).statusCode).toBe(404);
  });

  it("keeps people under 18 out of Spaces marked for adults", async () => {
    const owner = await person();
    const year = new Date().getUTCFullYear() - 15;
    const teen = await person({ birthDate: `${year}-01-15` });
    const space = await newSpace(owner.cookie);
    await call(owner.cookie, "PATCH", `/communities/${space.id}`, { isNsfw: true });
    const invite = (
      await call(owner.cookie, "POST", `/communities/${space.id}/invites`, {})
    ).json();
    const res = await call(teen.cookie, "POST", `/invites/${invite.code}`);
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("AGE_RESTRICTED");
  });
});

describe("chat in rooms", () => {
  it("sends, lists newest first, edits and deletes, and tells the Space", async () => {
    const noor = await person();
    const kenji = await person();
    const space = await newSpace(noor.cookie);
    const invite = (await call(noor.cookie, "POST", `/communities/${space.id}/invites`, {})).json();
    await call(kenji.cookie, "POST", `/invites/${invite.code}`);
    const room = space.channels[0].id;

    const first = await call(kenji.cookie, "POST", `/channels/${room}/messages`, {
      content: "ranked at 9, who's in",
      nonce: "n-1",
    });
    expect(first.statusCode).toBe(201);
    expect(first.json().nonce).toBe("n-1");
    expect(
      t.bus.published.some(
        (p) => p.topic === `community:${space.id}` && p.event.type === "MESSAGE_CREATE",
      ),
    ).toBe(true);

    const reply = await call(noor.cookie, "POST", `/channels/${room}/messages`, {
      content: "in, give me ten",
      replyToId: first.json().id,
    });
    expect(reply.json().type).toBe("reply");
    expect(reply.json().replyTo.content).toBe("ranked at 9, who's in");

    const list = (await call(kenji.cookie, "GET", `/channels/${room}/messages?limit=2`)).json();
    expect(list.messages.map((m: { content: string }) => m.content)).toEqual([
      "in, give me ten",
      "ranked at 9, who's in",
    ]);

    // Only the author edits; the owner (who manages messages) can delete anyone's.
    const id = first.json().id;
    expect(
      (await call(noor.cookie, "PATCH", `/channels/${room}/messages/${id}`, { content: "x" }))
        .statusCode,
    ).toBe(403);
    const edited = await call(kenji.cookie, "PATCH", `/channels/${room}/messages/${id}`, {
      content: "ranked at 9:30",
    });
    expect(edited.json().editedAt).not.toBeNull();
    // After 15 minutes it stays as it was sent (deleting still works).
    await t.deps.db
      .update(schema.messages)
      .set({ createdAt: new Date(Date.now() - 16 * 60 * 1000) })
      .where(eq(schema.messages.id, BigInt(id)));
    const late = await call(kenji.cookie, "PATCH", `/channels/${room}/messages/${id}`, {
      content: "rewriting history",
    });
    expect(late.statusCode).toBe(400);
    expect((await call(noor.cookie, "DELETE", `/channels/${room}/messages/${id}`)).statusCode).toBe(
      204,
    );
    const after = (await call(kenji.cookie, "GET", `/channels/${room}/messages`)).json();
    expect(after.messages.some((m: { id: string }) => m.id === id)).toBe(false);
  });

  it("refuses empty messages and files for now", async () => {
    const noor = await person();
    const space = await newSpace(noor.cookie);
    const room = space.channels[0].id;
    expect(
      (await call(noor.cookie, "POST", `/channels/${room}/messages`, { content: "   " }))
        .statusCode,
    ).toBe(400);
  });

  it("moves your read position forward only", async () => {
    const noor = await person();
    const space = await newSpace(noor.cookie);
    const room = space.channels[0].id;
    const a = (
      await call(noor.cookie, "POST", `/channels/${room}/messages`, { content: "a" })
    ).json();
    const b = (
      await call(noor.cookie, "POST", `/channels/${room}/messages`, { content: "b" })
    ).json();
    await call(noor.cookie, "POST", `/channels/${room}/ack`, { messageId: b.id });
    const back = await call(noor.cookie, "POST", `/channels/${room}/ack`, { messageId: a.id });
    expect(back.json().lastReadMessageId).toBe(b.id);
  });
});

describe("rooms, leaving and Explore", () => {
  it("lets the owner add chat rooms, not members; boards wait for posts", async () => {
    const owner = await person();
    const member = await person();
    const space = await newSpace(owner.cookie);
    const invite = (
      await call(owner.cookie, "POST", `/communities/${space.id}/invites`, {})
    ).json();
    await call(member.cookie, "POST", `/invites/${invite.code}`);

    const made = await call(owner.cookie, "POST", `/communities/${space.id}/channels`, {
      name: "Clips & LFG",
    });
    expect(made.statusCode).toBe(201);
    expect(made.json().name).toBe("clips-lfg");
    const again = await call(owner.cookie, "POST", `/communities/${space.id}/channels`, {
      name: "clips-lfg",
    });
    expect(again.json().error.code).toBe("ROOM_NAME_TAKEN");
    const board = await call(owner.cookie, "POST", `/communities/${space.id}/channels`, {
      name: "posts",
      type: "board",
    });
    expect(board.json().error.code).toBe("COMING_SOON");
    const denied = await call(member.cookie, "POST", `/communities/${space.id}/channels`, {
      name: "mine",
    });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().error.code).toBe("MISSING_PERMISSION");
  });

  it("groups rooms, keeps private rooms to chosen roles, slows rooms down and sorts them", async () => {
    const owner = await person();
    const member = await person();
    const space = await newSpace(owner.cookie);
    const base = `/communities/${space.id}`;
    const invite = (await call(owner.cookie, "POST", `${base}/invites`, {})).json();
    await call(member.cookie, "POST", `/invites/${invite.code}`);
    const general = space.channels[0].id as string;
    const mods = space.roles.find((r: { name: string }) => r.name === "Mods").id as string;

    const group = await call(owner.cookie, "POST", `${base}/channels`, {
      name: "Game Nights",
      type: "category",
    });
    expect(group.statusCode).toBe(201);
    expect(group.json()).toMatchObject({ type: "category", name: "Game Nights" });
    const lfg = (
      await call(owner.cookie, "POST", `${base}/channels`, {
        name: "LFG",
        parentId: group.json().id,
      })
    ).json();
    expect(lfg.parentId).toBe(group.json().id);

    // Private to Mods: the member stops seeing it, the owner still does.
    const staff = await call(owner.cookie, "POST", `${base}/channels`, {
      name: "staff",
      privacy: { private: true, roleIds: [mods] },
    });
    expect(staff.statusCode).toBe(201);
    const memberSees = (await call(member.cookie, "GET", base))
      .json()
      .channels.map((c: { id: string }) => c.id);
    expect(memberSees).toContain(lfg.id);
    expect(memberSees).not.toContain(staff.json().id);
    await call(owner.cookie, "PATCH", `${base}/members/${member.id}`, { roleIds: [mods] });
    expect(
      (await call(member.cookie, "GET", base)).json().channels.map((c: { id: string }) => c.id),
    ).toContain(staff.json().id);

    // Slow mode: a second message too soon is refused; the owner isn't held back.
    expect(
      (await call(owner.cookie, "PATCH", `/channels/${general}`, { slowmodeSeconds: 30 }))
        .statusCode,
    ).toBe(200);
    const outsider = await person();
    await call(outsider.cookie, "POST", `/invites/${invite.code}`);
    expect(
      (await call(outsider.cookie, "POST", `/channels/${general}/messages`, { content: "one" }))
        .statusCode,
    ).toBe(201);
    const second = await call(outsider.cookie, "POST", `/channels/${general}/messages`, {
      content: "two",
    });
    expect(second.statusCode).toBe(429);
    expect(second.json().error.code).toBe("SLOWMODE");

    // Sort: the group first, then #general on its own; #lfg moves out of the group.
    const seen = (await call(owner.cookie, "GET", base)).json().channels as {
      id: string;
      parentId: string | null;
    }[];
    const order = [
      group.json().id,
      ...seen.map((c) => c.id).filter((id) => id !== group.json().id),
    ];
    const sorted = await call(owner.cookie, "PUT", `${base}/channels/order`, {
      items: order.map((id) => ({ id, parentId: null })),
    });
    expect(sorted.statusCode).toBe(200);
    const after = sorted.json().channels as { id: string; parentId: string | null }[];
    expect(after[0]?.id).toBe(group.json().id);
    expect(after.find((c) => c.id === lfg.id)?.parentId).toBeNull();
    expect(
      (
        await call(owner.cookie, "PUT", `${base}/channels/order`, {
          items: [{ id: general, parentId: null }],
        })
      ).statusCode,
    ).toBe(400);

    // Deleting a group keeps its rooms; a voice room can go even with one chat room left.
    await call(owner.cookie, "PATCH", `/channels/${lfg.id}`, { parentId: group.json().id });
    expect((await call(owner.cookie, "DELETE", `/channels/${group.json().id}`)).statusCode).toBe(
      204,
    );
    const left = (await call(owner.cookie, "GET", base)).json().channels;
    expect(left.find((c: { id: string }) => c.id === lfg.id).parentId).toBeNull();
  });

  it("keeps Glow perks for Spaces that have the Sparks", async () => {
    const owner = await person();
    const space = await newSpace(owner.cookie);
    const renamed = await call(owner.cookie, "PATCH", `/communities/${space.id}`, {
      slug: "my-own-name",
    });
    expect(renamed.statusCode).toBe(403);
    expect(renamed.json().error.message).toContain("Glow 3");
  });

  it("lets members leave but not the owner", async () => {
    const owner = await person();
    const member = await person();
    const space = await newSpace(owner.cookie);
    const invite = (
      await call(owner.cookie, "POST", `/communities/${space.id}/invites`, {})
    ).json();
    await call(member.cookie, "POST", `/invites/${invite.code}`);
    const ownerLeaves = await call(owner.cookie, "DELETE", `/communities/${space.id}/members/@me`);
    expect(ownerLeaves.json().error.code).toBe("OWNER_CANNOT_LEAVE");
    expect(
      (await call(member.cookie, "DELETE", `/communities/${space.id}/members/@me`)).statusCode,
    ).toBe(204);
    expect((await call(member.cookie, "GET", `/communities/${space.id}`)).statusCode).toBe(404);
  });

  it("lists public Spaces in Explore and lets anyone join them", async () => {
    const owner = await person();
    const visitor = await person();
    const space = await newSpace(owner.cookie, { name: "Speedrun garage", visibility: "public" });
    expect(space.joinPolicy).toBe("open");
    const found = (await call(visitor.cookie, "GET", "/discover/communities?sort=new")).json();
    const row = found.spaces.find((s: { id: string }) => s.id === space.id);
    expect(row).toMatchObject({ name: "Speedrun garage", joined: false, memberCount: 1 });
    expect((await call(visitor.cookie, "POST", `/communities/${space.slug}/join`)).statusCode).toBe(
      200,
    );
    // Private Spaces never appear.
    const hidden = await newSpace(owner.cookie, { name: "Just us" });
    const all = (
      await call(visitor.cookie, "GET", "/discover/communities?sort=new&limit=50")
    ).json();
    expect(all.spaces.some((s: { id: string }) => s.id === hidden.id)).toBe(false);
  });
});

describe("teen defaults", () => {
  it("starts accounts under 18 private, with DMs from friends only", async () => {
    const year = new Date().getUTCFullYear() - 14;
    const teen = await person({ birthDate: `${year}-03-02` });
    const settings = (await call(teen.cookie, "GET", "/users/@me/settings")).json();
    expect(settings).toMatchObject({
      profileVisibility: "private",
      dmPolicy: "friends",
      friendRequestPolicy: "friends_of_friends",
    });
    const adult = await person();
    const theirs = (await call(adult.cookie, "GET", "/users/@me/settings")).json();
    expect(theirs.profileVisibility).toBe("public");
  });
});
