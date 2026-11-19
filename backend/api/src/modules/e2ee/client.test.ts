import { eq, schema } from "@realm/db";
import {
  aes256GcmSealer,
  type BlobStore,
  type Bytes,
  deviceCertificateBytes,
  E2eeClient,
  E2eeNotice,
  E2eeRequestError,
  fromBase64Url,
  newStorageKey,
  SealedKeyStore,
  TsMlsEngine,
  toBase64Url,
  utf8Bytes,
} from "@realm/e2ee";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  browser,
  createTestApp,
  newAccount,
  sessionCookie,
  type TestContext,
} from "../../test/helpers";

/**
 * The whole client (`E2eeClient`) against the real API, the way the apps will use it: each
 * person has a device whose storage is sealed with AES-256-GCM, and the server in between
 * only relays ciphertext.
 */

let t: TestContext;
beforeAll(async () => {
  t = await createTestApp();
  t.deps.config.REALM_E2EE_DMS = "on";
});
afterAll(async () => {
  await t.close();
});

let ip = 0;
const nextIp = () => `10.82.${Math.floor(++ip / 250)}.${ip % 250}`;

class Disk implements BlobStore {
  readonly files = new Map<string, Bytes>();
  async get(name: string) {
    return this.files.get(name) ?? null;
  }
  async put(name: string, value: Bytes) {
    this.files.set(name, value.slice());
  }
  async delete(name: string) {
    this.files.delete(name);
  }
}

function transportFor(cookie: string) {
  const calls: string[] = [];
  return {
    calls,
    async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
      calls.push(`${method} ${path}`);
      const res = await t.app.inject({
        method,
        url: `/v1${path}`,
        headers: browser(cookie),
        payload: body as object,
      });
      if (res.statusCode >= 400) {
        const error = res.json().error ?? {};
        throw new E2eeRequestError(res.statusCode, error.code ?? "UNKNOWN", error.message ?? "");
      }
      return (res.body ? res.json() : undefined) as T;
    },
  };
}

async function signUp() {
  const account = newAccount();
  const res = await t.app.inject({
    method: "POST",
    url: "/v1/auth/register",
    headers: browser(),
    payload: account,
    remoteAddress: nextIp(),
  });
  const cookie = sessionCookie(res);
  if (!cookie) throw new Error("no session");
  return { cookie, userId: res.json().user.id as string, account };
}

/** A person with a set-up device. `disk` and `key` are what a phone would keep. */
async function device(who?: Awaited<ReturnType<typeof signUp>>, clock?: () => number) {
  const person = who ?? (await signUp());
  const disk = new Disk();
  const key = newStorageKey();
  const transport = transportFor(person.cookie);
  const changes: string[] = [];
  const open = () =>
    new E2eeClient({
      userId: person.userId,
      transport,
      store: new SealedKeyStore(disk, aes256GcmSealer(key)),
      ...(clock ? { now: clock } : {}),
      onChange: (c) => changes.push(c.channelId ?? `key:${c.keyChangedFor}`),
    });
  const client = open();
  expect(await client.start()).toBe("ready");
  const deviceId = (await client.engine.identity())?.deviceId as string;
  return { ...person, client, disk, key, transport, changes, reopen: open, deviceId };
}

describe("E2eeClient", () => {
  it("sets a first device up by itself, and a chat works both ways", async () => {
    const noor = await device();
    const kenji = await device();
    // Starting again changes nothing and registers nothing twice.
    expect(await noor.client.start()).toBe("ready");
    expect(noor.transport.calls.filter((c) => c === "POST /e2ee/devices")).toHaveLength(1);

    const channelId = await noor.client.openDm(kenji.userId);
    expect(await noor.client.chats()).toEqual([channelId]);
    const sent = await noor.client.sendText(channelId, "héllo Kenji 👋");
    expect(sent.status).toBeUndefined();

    await kenji.client.sync();
    expect(await kenji.client.chats()).toEqual([channelId]);
    const theirs = await kenji.client.chat(channelId);
    expect(theirs?.messages.map((m) => [m.authorId, m.text])).toEqual([
      [noor.userId, "héllo Kenji 👋"],
    ]);
    expect(kenji.changes).toContain(channelId);

    // Opening the same DM from the other side finds the same chat, already joined.
    expect(await kenji.client.openDm(noor.userId)).toBe(channelId);
    await kenji.client.sendText(channelId, "hi Noor", sent.id);
    await noor.client.sync();
    const mine = await noor.client.chat(channelId);
    expect(mine?.messages.map((m) => m.text)).toEqual(["héllo Kenji 👋", "hi Noor"]);
    expect(mine?.messages[1]?.replyTo).toBe(sent.id);

    // Both see the same 60-digit safety number.
    const number = await noor.client.safetyNumber(kenji.userId);
    expect(number).toMatch(/^(\d{5} ){11}\d{5}$/);
    expect(await kenji.client.safetyNumber(noor.userId)).toBe(number);
  });

  it("edits, deletes, reacts and marks seen, all as encrypted events", async () => {
    const noor = await device();
    const kenji = await device();
    const channelId = await noor.client.openDm(kenji.userId);
    const first = await noor.client.sendText(channelId, "frist");
    const second = await noor.client.sendText(channelId, "oops wrong chat");
    await noor.client.edit(channelId, first.id, "first");
    await noor.client.remove(channelId, second.id);
    await kenji.client.sync();
    await kenji.client.react(channelId, first.id, "🔥");
    await kenji.client.markSeen(channelId, first.id);
    // Kenji tries to edit Noor's message: his own copy ignores it, and so will Noor's.
    await kenji.client.edit(channelId, first.id, "kenji was here");
    await noor.client.sync();

    for (const who of [noor, kenji]) {
      const chat = await who.client.chat(channelId);
      expect(chat?.messages.map((m) => [m.text, m.deleted ?? false])).toEqual([
        ["first", false],
        ["", true],
      ]);
      expect(chat?.messages[0]?.reactions).toEqual({ "🔥": [kenji.userId] });
      expect(chat?.seen[kenji.userId]).toBe(first.id);
    }

    // None of it reached the server in readable form.
    const rows = await t.deps.db
      .select()
      .from(schema.e2eeMessages)
      .where(eq(schema.e2eeMessages.channelId, BigInt(channelId)));
    for (const row of rows) {
      const raw = Buffer.from(row.ciphertext).toString("latin1");
      expect(raw).not.toContain("first");
      expect(raw).not.toContain("wrong chat");
    }
  });

  it("keeps everything on the device sealed, and carries on after the app restarts", async () => {
    const noor = await device();
    const kenji = await device();
    const channelId = await noor.client.openDm(kenji.userId);
    await noor.client.sendText(channelId, "the launch code is 0000");
    await kenji.client.sync();

    // Nothing readable on either disk: not the text, not an id, not a key in the clear.
    for (const who of [noor, kenji]) {
      const everything = [...who.disk.files.values()]
        .map((b) => Buffer.from(b).toString("latin1"))
        .join("|");
      expect(everything).not.toContain("launch code");
      expect(everything).not.toContain(who.userId);
      expect(who.disk.files.size).toBeGreaterThan(4);
    }
    // The wrong storage key opens nothing.
    const thief = new SealedKeyStore(kenji.disk, aes256GcmSealer(newStorageKey()));
    await expect(thief.get(`chat:${channelId}`)).rejects.toThrow();

    // A restart: a new client object over the same disk and key.
    const again = kenji.reopen();
    expect(await again.start()).toBe("ready");
    expect((await again.chat(channelId))?.messages[0]?.text).toBe("the launch code is 0000");
    await again.sendText(channelId, "got it");
    await noor.client.sync();
    expect((await noor.client.chat(channelId))?.messages.at(-1)?.text).toBe("got it");
  });

  it("carries on with the same keys after signing out and in again on the device", async () => {
    const noor = await device();
    const kenji = await device();
    const channelId = await noor.client.openDm(kenji.userId);
    await noor.client.sendText(channelId, "before signing out");
    await kenji.client.sync();

    // Kenji signs in again: a new session, the same phone (same disk and storage key).
    const login = await t.app.inject({
      method: "POST",
      url: "/v1/auth/login",
      headers: browser(),
      payload: { login: kenji.account.username, password: kenji.account.password },
      remoteAddress: nextIp(),
    });
    const again = sessionCookie(login) as string;
    const transport = transportFor(again);
    const back = new E2eeClient({
      userId: kenji.userId,
      transport,
      store: new SealedKeyStore(kenji.disk, aes256GcmSealer(kenji.key)),
    });
    expect(await back.start()).toBe("ready");
    // No second device was made: the session took up the one this phone already is.
    expect(transport.calls).not.toContain("POST /e2ee/devices");
    const mine = await transport.request<{ devices: { current: boolean; status: string }[] }>(
      "GET",
      "/e2ee/devices",
    );
    expect(mine.devices).toHaveLength(1);
    expect(mine.devices[0]).toMatchObject({ current: true, status: "approved" });

    await noor.client.sendText(channelId, "welcome back");
    await back.sync();
    expect((await back.chat(channelId))?.messages.map((m) => m.text)).toEqual([
      "before signing out",
      "welcome back",
    ]);

    // Someone who has Kenji's password but not his phone can't claim to be that device: the
    // device's public key is known, its private key never left the phone.
    const thief = await t.app.inject({
      method: "POST",
      url: "/v1/auth/login",
      headers: browser(),
      payload: { login: kenji.account.username, password: kenji.account.password },
      remoteAddress: nextIp(),
    });
    const stolen = transportFor(sessionCookie(thief) as string);
    const claim = stolen.request("POST", `/e2ee/devices/${kenji.deviceId}/resume`, {
      at: Date.now(),
      signature: toBase64Url(new Uint8Array(64)),
    });
    await expect(claim).rejects.toMatchObject({ code: "SIGNATURE_INVALID" });
    await expect(stolen.request("GET", "/e2ee/inbox")).rejects.toMatchObject({
      code: "DEVICE_NOT_APPROVED",
    });
    // A fresh client there (no keys) is told to get approved, and nothing crashes.
    const stranger = new E2eeClient({
      userId: kenji.userId,
      transport: stolen,
      store: new SealedKeyStore(new Disk(), aes256GcmSealer(newStorageKey())),
    });
    expect(await stranger.start()).toBe("needs-approval");
  });

  it("changes keys after a week, and the other side follows without noticing", async () => {
    let time = Date.now();
    const noor = await device(undefined, () => time);
    const kenji = await device();
    const channelId = await noor.client.openDm(kenji.userId);
    await noor.client.sendText(channelId, "before");
    expect(await noor.client.engine.epoch(channelId)).toBe(1n);

    time += 8 * 24 * 60 * 60 * 1000;
    await noor.client.sendText(channelId, "a week later");
    expect(await noor.client.engine.epoch(channelId)).toBe(2n);

    await kenji.client.sync();
    expect(await kenji.client.engine.epoch(channelId)).toBe(2n);
    await kenji.client.sendText(channelId, "still reading you");
    await noor.client.sync();
    expect((await noor.client.chat(channelId))?.messages.map((m) => m.text)).toEqual([
      "before",
      "a week later",
      "still reading you",
    ]);
  });

  it("catches up and retries when the keys changed under a message being sent", async () => {
    let time = Date.now();
    const noor = await device(undefined, () => time);
    const kenji = await device();
    const channelId = await noor.client.openDm(kenji.userId);
    await noor.client.sendText(channelId, "one");
    await kenji.client.sync();
    time += 8 * 24 * 60 * 60 * 1000;
    await noor.client.sendText(channelId, "two"); // Noor rotates: the chat is now at epoch 2.

    // Kenji hasn't synced, so his device still thinks it's epoch 1.
    const sent = await kenji.client.sendText(channelId, "three");
    expect(sent.status).toBeUndefined();
    expect(await kenji.client.engine.epoch(channelId)).toBe(2n);
    await noor.client.sync();
    expect((await noor.client.chat(channelId))?.messages.map((m) => m.text)).toEqual([
      "one",
      "two",
      "three",
    ]);
    expect((await kenji.client.chat(channelId))?.messages.map((m) => m.text)).toEqual([
      "one",
      "two",
      "three",
    ]);
  });

  it("reads a message quietly first, then tells the sender once, and never twice", async () => {
    const noor = await device();
    const kenji = await device();
    const channelId = await noor.client.openDm(kenji.userId);
    const hello = await noor.client.sendText(channelId, "hello?");
    await kenji.client.sync();
    const posts = () =>
      kenji.transport.calls.filter((c) => c === `POST /e2ee/channels/${channelId}/messages`).length;

    // A message request, or read receipts off: Kenji's device remembers, Noor isn't told.
    await kenji.client.markSeen(channelId, hello.id, false);
    expect((await kenji.client.chat(channelId))?.seen[kenji.userId]).toBe(hello.id);
    expect(posts()).toBe(0);
    await noor.client.sync();
    expect((await noor.client.chat(channelId))?.seen[kenji.userId]).toBeUndefined();

    // He accepts: now she's told, exactly once however often the screen asks.
    await kenji.client.markSeen(channelId, hello.id, true);
    await kenji.client.markSeen(channelId, hello.id, true);
    expect(posts()).toBe(1);
    await noor.client.sync();
    expect((await noor.client.chat(channelId))?.seen[kenji.userId]).toBe(hello.id);
    // A message that isn't in the chat can't be marked.
    await kenji.client.markSeen(channelId, "f".repeat(32), true);
    expect(posts()).toBe(1);
  });

  it("reports a message with proof, straight from what the device saved", async () => {
    const noor = await device();
    const kenji = await device();
    const channelId = await noor.client.openDm(kenji.userId);
    const nasty = await noor.client.sendText(channelId, "something nasty");
    await kenji.client.sync();
    await kenji.client.report(channelId, nasty.id, "harassment", "second time this week");
    const [report] = await t.deps.db
      .select()
      .from(schema.reports)
      .where(eq(schema.reports.reporterId, BigInt(kenji.userId)));
    expect(report?.evidence).toMatchObject({ verified: true, authorId: noor.userId });
    expect(String(report?.evidence.content)).toContain("something nasty");
    // You can't "report" your own message, and there's no proof kept for it.
    await expect(noor.client.report(channelId, nasty.id, "spam")).rejects.toThrow("proof");
  });

  it("marks a message failed when it can't be sent, and sends it once on retry", async () => {
    const noor = await device();
    const kenji = await device();
    const channelId = await noor.client.openDm(kenji.userId);
    await kenji.client.sync();

    // Kenji blocks Noor: the server refuses her message.
    await t.app.inject({
      method: "PUT",
      url: `/v1/users/@me/blocks/${noor.userId}`,
      headers: browser(kenji.cookie),
    });
    await expect(noor.client.sendText(channelId, "are you there?")).rejects.toThrow();
    const failed = (await noor.client.chat(channelId))?.messages.at(-1);
    expect(failed).toMatchObject({ text: "are you there?", status: "failed" });

    await t.app.inject({
      method: "DELETE",
      url: `/v1/users/@me/blocks/${noor.userId}`,
      headers: browser(kenji.cookie),
    });
    const sent = await noor.client.resend(channelId, failed?.id as string);
    expect(sent.status).toBeUndefined();
    await kenji.client.sync();
    expect((await kenji.client.chat(channelId))?.messages.map((m) => m.text)).toEqual([
      "are you there?",
    ]);
  });

  it("says so plainly when the other person isn't set up, or this device isn't", async () => {
    const noor = await device();
    const newcomer = await signUp();
    await expect(noor.client.openDm(newcomer.userId)).rejects.toMatchObject({
      name: "E2eeNotice",
      reason: "they-are-not-set-up",
    });

    // A second sign-in of the same account can't confirm itself: it needs the first device.
    const login = await t.app.inject({
      method: "POST",
      url: "/v1/auth/login",
      headers: browser(),
      payload: { login: noor.account.username, password: noor.account.password },
      remoteAddress: nextIp(),
    });
    const second = new E2eeClient({
      userId: noor.userId,
      transport: transportFor(sessionCookie(login) as string),
      store: new SealedKeyStore(new Disk(), aes256GcmSealer(newStorageKey())),
    });
    expect(await second.start()).toBe("needs-approval");
    await expect(second.openDm(newcomer.userId)).rejects.toBeInstanceOf(E2eeNotice);
  });

  it("refuses a fake device when a taken-over server swaps someone's account key", async () => {
    const noor = await device();
    const kenji = await device();
    const channelId = await noor.client.openDm(kenji.userId);
    await noor.client.sendText(channelId, "hello");
    await kenji.client.sync();

    // The attacker controls the server. They make their own "account key" for Kenji, and a
    // device certified by it that claims to be Kenji's.
    const attacker = await device();
    let forgedKey: Bytes = new Uint8Array();
    const forged = new TsMlsEngine({
      keyStore: new SealedKeyStore(new Disk(), aes256GcmSealer(newStorageKey())),
      accountKeyFor: async (userId, version) => {
        if (userId === kenji.userId) return version === 2 ? forgedKey : null;
        const published = await attacker.transport.request<{
          accountKey: { version: number; publicKey: string } | null;
        }>("GET", `/e2ee/users/${userId}`);
        return published.accountKey?.version === version
          ? fromBase64Url(published.accountKey.publicKey)
          : null;
      },
    });
    const { signatureKey } = await forged.createDevice();
    forgedKey = (await forged.createAccountIdentity()).publicKey;
    const fakeDeviceId = t.deps.ids.next().toString();
    const issuedAt = Date.now();
    await forged.setIdentity({
      userId: kenji.userId,
      deviceId: fakeDeviceId,
      accountKeyVersion: 2,
      issuedAt,
      signature: await forged.signWithAccountKey(
        deviceCertificateBytes({
          userId: kenji.userId,
          deviceId: fakeDeviceId,
          signatureKey,
          issuedAt,
        }),
      ),
    });
    // They publish the forged key as Kenji's new one...
    await t.deps.db
      .update(schema.accountIdentityKeys)
      .set({ supersededAt: new Date() })
      .where(eq(schema.accountIdentityKeys.userId, BigInt(kenji.userId)));
    await t.deps.db.insert(schema.accountIdentityKeys).values({
      userId: BigInt(kenji.userId),
      version: 2,
      publicKey: Buffer.from(forgedKey),
    });
    // ...and pull Noor's device into a group with the fake "Kenji", delivering the welcome.
    const claimed = await attacker.transport.request<{
      packages: { userId: string; deviceId: string; keyPackage: string }[];
    }>("POST", "/e2ee/key-packages/claim", { userIds: [noor.userId] });
    const target = claimed.packages[0];
    if (!target) throw new Error("no key package for Noor");
    const trap = await forged.createGroup(t.deps.ids.next().toString(), [
      {
        userId: target.userId,
        deviceId: target.deviceId,
        keyPackage: fromBase64Url(target.keyPackage),
      },
    ]);
    const welcomeId = t.deps.ids.next();
    await t.deps.db.insert(schema.e2eeMessages).values({
      id: welcomeId,
      channelId: BigInt(channelId),
      epoch: 1,
      kind: "welcome",
      ciphertext: Buffer.from(trap.welcomes[0]?.welcome as Bytes),
    });
    await t.deps.db
      .insert(schema.e2eeDeliveries)
      .values({ messageId: welcomeId, deviceId: BigInt(target.deviceId) });

    await noor.client.sync();
    // Noor's device pinned Kenji's real key the first time. The new key is not trusted, the
    // fake group is not joined, and Noor is told the key changed instead.
    expect(await noor.client.chats()).toEqual([channelId]);
    expect(await noor.client.keyChanged(kenji.userId)).toBe(true);
    expect(noor.changes).toContain(`key:${kenji.userId}`);
    expect((await noor.client.chat(channelId))?.problems).toBe(1);
    // The real chat with the real Kenji is untouched.
    await kenji.client.sendText(channelId, "it's really me");
    await noor.client.sync();
    expect((await noor.client.chat(channelId))?.messages.at(-1)?.text).toBe("it's really me");
    // Only Noor herself can accept a new key, after checking it with Kenji.
    await noor.client.acceptKeyChange(kenji.userId);
    expect(await noor.client.keyChanged(kenji.userId)).toBe(false);

    // Control: the same welcome, delivered again, now works. So trust was the only thing in
    // its way, and the refusal above wasn't some other error.
    const againId = t.deps.ids.next();
    await t.deps.db.insert(schema.e2eeMessages).values({
      id: againId,
      channelId: BigInt(channelId),
      epoch: 1,
      kind: "welcome",
      ciphertext: Buffer.from(trap.welcomes[0]?.welcome as Bytes),
    });
    await t.deps.db
      .insert(schema.e2eeDeliveries)
      .values({ messageId: againId, deviceId: BigInt(target.deviceId) });
    await noor.client.sync();
    expect(await noor.client.chats()).toEqual([channelId, trap.groupId]);
  });

  it("counts junk from the server and carries on", async () => {
    const noor = await device();
    const kenji = await device();
    const channelId = await noor.client.openDm(kenji.userId);
    await noor.client.sendText(channelId, "hello");
    await kenji.client.sync();

    const junkId = t.deps.ids.next();
    await t.deps.db.insert(schema.e2eeMessages).values({
      id: junkId,
      channelId: BigInt(channelId),
      epoch: 1,
      kind: "application",
      ciphertext: Buffer.from(utf8Bytes("not an mls message at all, just noise ".repeat(3))),
    });
    const [mine] = await t.deps.db
      .select({ id: schema.devices.id })
      .from(schema.devices)
      .where(eq(schema.devices.userId, BigInt(noor.userId)));
    await t.deps.db
      .insert(schema.e2eeDeliveries)
      .values({ messageId: junkId, deviceId: mine?.id as bigint });
    await noor.client.sync();
    const chat = await noor.client.chat(channelId);
    expect(chat?.problems).toBe(1);
    expect(chat?.messages.map((m) => m.text)).toEqual(["hello"]);
    await kenji.client.sendText(channelId, "still fine");
    await noor.client.sync();
    expect((await noor.client.chat(channelId))?.messages.at(-1)?.text).toBe("still fine");
  });
});
