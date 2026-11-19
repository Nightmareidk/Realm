import { eq, schema } from "@realm/db";
import {
  type Bytes,
  deviceCertificateBytes,
  fromBase64Url,
  type KeyStore,
  TsMlsEngine,
  toBase64Url,
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
 * Encrypted DMs end to end: real clients (the ts-mls engine) talking through the real API. The
 * server in the middle only ever holds ciphertext, which these tests check directly.
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
const nextIp = () => `10.81.${Math.floor(++ip / 250)}.${ip % 250}`;
const utf8 = new TextEncoder();
const text = new TextDecoder();

/** What the server's database holds for a chat: the proof it has ciphertext and nothing else. */
const ciphertextRows = (channelId: string) =>
  t.deps.db
    .select()
    .from(schema.e2eeMessages)
    .where(eq(schema.e2eeMessages.channelId, BigInt(channelId)));

type Method = "GET" | "POST" | "PUT";
const call = (cookie: string, method: Method, url: string, payload?: unknown) =>
  t.app.inject({ method, url: `/v1${url}`, headers: browser(cookie), payload: payload as object });

class MemoryStore implements KeyStore {
  readonly data = new Map<string, Bytes>();
  async get(name: string) {
    return this.data.get(name) ?? null;
  }
  async put(name: string, value: Bytes) {
    this.data.set(name, value.slice());
  }
  async delete(name: string) {
    this.data.delete(name);
  }
}

/** A person with the app set up: account key, one approved device, KeyPackages uploaded. */
async function client() {
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
  const userId = res.json().user.id as string;

  const store = new MemoryStore();
  const engine = new TsMlsEngine({
    keyStore: store,
    // Trust on first use: the account key the server publishes for that person.
    accountKeyFor: async (id, version) => {
      const pub = await call(cookie, "GET", `/e2ee/users/${id}`);
      const key = pub.json().accountKey;
      return key && key.version === version ? fromBase64Url(key.publicKey) : null;
    },
  });
  const { signatureKey } = await engine.createDevice();
  const { publicKey } = await engine.createAccountIdentity();
  const reg = await call(cookie, "POST", "/e2ee/devices", {
    signatureKey: toBase64Url(signatureKey),
  });
  const deviceId = reg.json().id as string;
  await call(cookie, "POST", "/e2ee/account-key", { publicKey: toBase64Url(publicKey) });
  const issuedAt = Date.now();
  const signature = await engine.signWithAccountKey(
    deviceCertificateBytes({ userId, deviceId, signatureKey, issuedAt }),
  );
  const approved = await call(cookie, "POST", `/e2ee/devices/${deviceId}/approve`, {
    issuedAt,
    signature: toBase64Url(signature),
  });
  expect(approved.statusCode).toBe(204);
  await engine.setIdentity({ userId, deviceId, accountKeyVersion: 1, issuedAt, signature });
  const packages = await engine.generateKeyPackages(3);
  const up = await call(cookie, "POST", "/e2ee/key-packages", {
    keyPackages: packages.map(toBase64Url),
  });
  expect(up.statusCode).toBe(204);
  return { cookie, userId, deviceId, engine, store, account };
}
type Client = Awaited<ReturnType<typeof client>>;

/** A opens the encrypted DM with B and sets the group up. Returns the channel id. */
async function openDm(a: Client, b: Client) {
  const opened = await call(a.cookie, "POST", "/e2ee/channels", { recipientId: b.userId });
  expect(opened.statusCode).toBe(200);
  expect(opened.json().epoch).toBeNull();
  const channelId = opened.json().channelId as string;

  const claim = await call(a.cookie, "POST", "/e2ee/key-packages/claim", { userIds: [b.userId] });
  const members = (
    claim.json().packages as { userId: string; deviceId: string; keyPackage: string }[]
  ).map((p) => ({
    userId: p.userId,
    deviceId: p.deviceId,
    keyPackage: fromBase64Url(p.keyPackage),
  }));
  const change = await a.engine.createGroup(channelId, members);
  const init = await call(a.cookie, "POST", `/e2ee/channels/${channelId}/group`, {
    welcomes: change.welcomes.map((w) => ({
      deviceId: w.deviceId,
      welcome: toBase64Url(w.welcome),
    })),
  });
  expect(init.statusCode).toBe(204);
  await a.engine.commitAccepted(channelId);
  return channelId;
}

interface Got {
  id: string;
  channelId: string;
  kind: string;
  text?: string;
  senderUserId?: string;
  frankingKey?: string;
  payload?: string;
  frankingCommitment: string | null;
  serverSignature: string | null;
}

/** Fetches what's waiting for this device, processes it with the engine, and acknowledges it. */
async function sync(c: Client): Promise<Got[]> {
  const inbox = await call(c.cookie, "GET", "/e2ee/inbox");
  expect(inbox.statusCode).toBe(200);
  const out: Got[] = [];
  for (const m of inbox.json().messages) {
    const base = {
      id: m.id,
      channelId: m.channelId,
      kind: m.kind,
      frankingCommitment: m.frankingCommitment,
      serverSignature: m.serverSignature,
    };
    if (m.kind === "welcome") {
      await c.engine.joinFromWelcome(fromBase64Url(m.ciphertext));
      out.push(base);
      continue;
    }
    const incoming = await c.engine.processIncoming(m.channelId, fromBase64Url(m.ciphertext));
    if (incoming.kind === "application") {
      out.push({
        ...base,
        text: text.decode(incoming.payload),
        senderUserId: incoming.senderUserId,
        frankingKey: toBase64Url(incoming.frankingKey),
        payload: toBase64Url(incoming.payload),
      });
    } else out.push(base);
  }
  if (out.length > 0) {
    const ack = await call(c.cookie, "POST", "/e2ee/inbox/ack", { ids: out.map((g) => g.id) });
    expect(ack.statusCode).toBe(204);
  }
  return out;
}

async function say(c: Client, channelId: string, words: string) {
  const sent = await c.engine.encryptMessage(channelId, utf8.encode(words));
  return call(c.cookie, "POST", `/e2ee/channels/${channelId}/messages`, {
    epoch: Number(sent.epoch),
    ciphertext: toBase64Url(sent.ciphertext),
    frankingCommitment: toBase64Url(sent.franking.commitment),
  });
}

describe("an encrypted DM through the server", () => {
  it("two people talk; the server holds only ciphertext and deletes it once fetched", async () => {
    const noor = await client();
    const kenji = await client();
    const channelId = await openDm(noor, kenji);

    expect((await sync(kenji)).map((g) => g.kind)).toEqual(["welcome"]);
    const secret = "meet me at the usual place at nine";
    expect((await say(noor, channelId, secret)).statusCode).toBe(201);

    // What the database holds: no plaintext anywhere, and no author column to say who wrote it.
    const stored = await ciphertextRows(channelId);
    expect(stored).toHaveLength(1);
    expect(Object.keys(stored[0] as object).join(" ")).not.toMatch(/author|sender|user/i);
    expect(Buffer.from(stored[0]?.ciphertext as Uint8Array).toString("latin1")).not.toContain(
      "usual place",
    );
    const plain = await t.deps.db
      .select({ id: schema.messages.id })
      .from(schema.messages)
      .where(eq(schema.messages.channelId, BigInt(channelId)));
    expect(plain).toEqual([]);

    const got = await sync(kenji);
    expect(got).toHaveLength(1);
    expect(got[0]?.text).toBe(secret);
    expect(got[0]?.senderUserId).toBe(noor.userId);

    // Fetched and acknowledged: the ciphertext is gone from the server.
    expect(await ciphertextRows(channelId)).toEqual([]);
    expect((await sync(kenji)).length).toBe(0);

    expect((await say(kenji, channelId, "see you there")).statusCode).toBe(201);
    expect((await sync(noor))[0]?.text).toBe("see you there");

    // The live nudge says only that something is waiting.
    const nudges = t.bus.published.filter((e) => e.event.type === "E2EE_PENDING");
    expect(nudges.length).toBeGreaterThan(0);
    expect(JSON.stringify(nudges)).not.toContain("usual place");
    for (const n of nudges) expect(Object.keys(n.event.data as object)).toEqual(["channelId"]);
  });

  it("a key change moves the epoch; the loser of a race catches up and retries", async () => {
    const noor = await client();
    const kenji = await client();
    const channelId = await openDm(noor, kenji);
    await sync(kenji);

    // Both rotate keys in the same epoch. Only the first is accepted.
    const a = await noor.engine.rotateKeys(channelId);
    const b = await kenji.engine.rotateKeys(channelId);
    const first = await call(noor.cookie, "POST", `/e2ee/channels/${channelId}/commits`, {
      epoch: Number(a.fromEpoch),
      commit: toBase64Url(a.commit),
    });
    expect(first.statusCode).toBe(201);
    await noor.engine.commitAccepted(channelId);
    const second = await call(kenji.cookie, "POST", `/e2ee/channels/${channelId}/commits`, {
      epoch: Number(b.fromEpoch),
      commit: toBase64Url(b.commit),
    });
    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe("EPOCH_STALE");
    await kenji.engine.commitRejected(channelId);

    expect((await sync(kenji)).map((g) => g.kind)).toEqual(["commit"]);
    expect(await kenji.engine.epoch(channelId)).toBe(2n);
    const state = await call(kenji.cookie, "GET", `/e2ee/channels/${channelId}`);
    expect(state.json().epoch).toBe(2);
    expect(state.json().devices).toHaveLength(2);

    expect((await say(kenji, channelId, "new keys work")).statusCode).toBe(201);
    expect((await sync(noor))[0]?.text).toBe("new keys work");

    // A message encrypted before the change is refused, not delivered where it can't be read.
    const late = await call(noor.cookie, "POST", `/e2ee/channels/${channelId}/messages`, {
      epoch: 1,
      ciphertext: toBase64Url(new Uint8Array(300)),
      frankingCommitment: toBase64Url(new Uint8Array(32)),
    });
    expect(late.statusCode).toBe(409);
  });

  it("a report is proven with the franking key, and a forged one is refused", async () => {
    const noor = await client();
    const kenji = await client();
    const channelId = await openDm(noor, kenji);
    await sync(kenji);
    await say(noor, channelId, "something nasty");
    const [got] = await sync(kenji);
    if (!got?.frankingKey || !got.payload) throw new Error("no message");
    const proof = {
      messageId: got.id,
      senderUserId: noor.userId,
      payload: got.payload,
      frankingKey: got.frankingKey,
      frankingCommitment: got.frankingCommitment,
      serverSignature: got.serverSignature,
      reason: "harassment",
    };

    // Kenji can't put words in Noor's mouth, or blame a message on himself or a stranger.
    const forged = await call(kenji.cookie, "POST", `/e2ee/channels/${channelId}/reports`, {
      ...proof,
      payload: toBase64Url(utf8.encode("something much worse")),
    });
    expect(forged.statusCode).toBe(400);
    expect(forged.json().error.code).toBe("SIGNATURE_INVALID");
    const stranger = await client();
    for (const senderUserId of [kenji.userId, stranger.userId]) {
      const res = await call(kenji.cookie, "POST", `/e2ee/channels/${channelId}/reports`, {
        ...proof,
        senderUserId,
      });
      expect(res.statusCode).toBe(400);
    }
    // Someone outside the chat can't report into it at all.
    expect(
      (await call(stranger.cookie, "POST", `/e2ee/channels/${channelId}/reports`, proof))
        .statusCode,
    ).toBe(404);

    const ok = await call(kenji.cookie, "POST", `/e2ee/channels/${channelId}/reports`, proof);
    expect(ok.statusCode).toBe(204);
    const [report] = await t.deps.db
      .select({ evidence: schema.reports.evidence })
      .from(schema.reports)
      .where(eq(schema.reports.targetId, BigInt(got.id)));
    const evidence = report?.evidence;
    expect(evidence).toMatchObject({
      encrypted: true,
      verified: true,
      authorId: noor.userId,
      content: "something nasty",
    });
  });

  it("keeps outsiders, unapproved devices and readable text out", async () => {
    const noor = await client();
    const kenji = await client();
    const mallory = await client();
    const channelId = await openDm(noor, kenji);
    await sync(kenji);
    const blob = {
      epoch: 1,
      ciphertext: toBase64Url(new Uint8Array(300)),
      frankingCommitment: toBase64Url(new Uint8Array(32)),
    };

    // Not in the chat: it doesn't exist for them.
    for (const [method, url, body] of [
      ["GET", `/e2ee/channels/${channelId}`, undefined],
      ["POST", `/e2ee/channels/${channelId}/messages`, blob],
      ["POST", `/e2ee/channels/${channelId}/commits`, { epoch: 1, commit: blob.ciphertext }],
    ] as const) {
      expect((await call(mallory.cookie, method, url, body)).statusCode).toBe(404);
    }
    // Mallory's inbox never holds other people's ciphertext, and she can't acknowledge it away.
    await say(noor, channelId, "private");
    expect((await call(mallory.cookie, "GET", "/e2ee/inbox")).json().messages).toEqual([]);
    const pending = await call(kenji.cookie, "GET", "/e2ee/inbox");
    const id = pending.json().messages[0].id as string;
    await call(mallory.cookie, "POST", "/e2ee/inbox/ack", { ids: [id] });
    expect((await call(kenji.cookie, "GET", "/e2ee/inbox")).json().messages).toHaveLength(1);

    // The group can't be set up twice, or with a device that isn't in the chat.
    const again = await call(kenji.cookie, "POST", `/e2ee/channels/${channelId}/group`, {
      welcomes: [{ deviceId: noor.deviceId, welcome: blob.ciphertext }],
    });
    expect(again.statusCode).toBe(409);
    const other = await call(noor.cookie, "POST", "/e2ee/channels", {
      recipientId: mallory.userId,
    });
    const sneak = await call(
      noor.cookie,
      "POST",
      `/e2ee/channels/${other.json().channelId}/group`,
      {
        welcomes: [{ deviceId: kenji.deviceId, welcome: blob.ciphertext }],
      },
    );
    expect(sneak.statusCode).toBe(400);

    // Readable text is refused in an encrypted chat.
    const plain = await call(noor.cookie, "POST", `/channels/${channelId}/messages`, {
      content: "this must not be stored",
    });
    expect(plain.statusCode).toBe(400);
    expect(plain.json().error.code).toBe("ENCRYPTED_CHAT");

    // A second sign-in with no approved device gets nothing.
    const login = await t.app.inject({
      method: "POST",
      url: "/v1/auth/login",
      headers: browser(),
      payload: { login: noor.account.username, password: noor.account.password },
      remoteAddress: nextIp(),
    });
    const second = sessionCookie(login) as string;
    for (const [method, url, body] of [
      ["GET", "/e2ee/inbox", undefined],
      ["POST", `/e2ee/channels/${channelId}/messages`, blob],
      ["POST", "/e2ee/channels", { recipientId: kenji.userId }],
    ] as const) {
      const res = await call(second, method, url, body);
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe("DEVICE_NOT_APPROVED");
    }

    // Blocked: no new messages either way.
    await call(kenji.cookie, "PUT", `/users/@me/blocks/${noor.userId}`);
    const blocked = await say(noor, channelId, "hello?");
    expect(blocked.statusCode).toBe(403);
  });

  it("is switched off unless the server turns it on", async () => {
    const noor = await client();
    const kenji = await client();
    t.deps.config.REALM_E2EE_DMS = "off";
    try {
      const res = await call(noor.cookie, "POST", "/e2ee/channels", { recipientId: kenji.userId });
      expect(res.statusCode).toBe(404);
      expect((await call(noor.cookie, "GET", "/e2ee/inbox")).statusCode).toBe(404);
    } finally {
      t.deps.config.REALM_E2EE_DMS = "on";
    }
  });
});
