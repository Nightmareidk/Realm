import { describe, expect, it } from "vitest";
import { asciiBytes, asciiText, type Bytes, toBase64Url } from "../bytes";
import { deviceCertificateBytes } from "../certificate";
import type { KeyStore } from "../engine";
import { frankingCommitment, PADDING_BUCKET, safetyNumber } from "../franking";
import { TsMlsEngine } from "./ts-mls";

const enc = { encode: asciiBytes };
const dec = { decode: asciiText };

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

/** Account keys everyone trusts in these tests: `${userId}:${version}` -> key. */
const directory = new Map<string, Bytes>();
const trustAll = async (id: string, version: number) => directory.get(`${id}:${version}`) ?? null;
let nextDevice = 9000n;

async function person(userId: string, accountKeyFor = trustAll) {
  const store = new MemoryStore();
  const engine = new TsMlsEngine({ keyStore: store, accountKeyFor });
  const { signatureKey } = await engine.createDevice();
  const { publicKey } = await engine.createAccountIdentity();
  directory.set(`${userId}:1`, publicKey);
  const deviceId = (nextDevice++).toString();
  const issuedAt = 1_800_000_000_000;
  const signature = await engine.signWithAccountKey(
    deviceCertificateBytes({ userId, deviceId, signatureKey, issuedAt }),
  );
  await engine.setIdentity({ userId, deviceId, accountKeyVersion: 1, issuedAt, signature });
  return { engine, store, userId, deviceId, accountKey: publicKey, signatureKey };
}

async function dm(channel: string) {
  const noor = await person("101");
  const kenji = await person("202");
  const [kp] = await kenji.engine.generateKeyPackages(1);
  const change = await noor.engine.createGroup(channel, [
    { userId: kenji.userId, deviceId: kenji.deviceId, keyPackage: kp as Bytes },
  ]);
  await noor.engine.commitAccepted(channel);
  expect(await kenji.engine.joinFromWelcome(change.welcomes[0]?.welcome as Bytes)).toBe(channel);
  return { noor, kenji };
}

describe("TsMlsEngine: an encrypted DM", () => {
  it("two people talk both ways, with the sender proven", async () => {
    const { noor, kenji } = await dm("5001");
    const sent = await noor.engine.encryptMessage("5001", enc.encode("hi Kenji"));
    expect(sent.epoch).toBe(1n);
    const got = await kenji.engine.processIncoming("5001", sent.ciphertext);
    if (got.kind !== "application") throw new Error("expected a message");
    expect(dec.decode(got.payload)).toBe("hi Kenji");
    expect(got.senderUserId).toBe("101");
    expect(got.senderDeviceId).toBe(noor.deviceId);

    const reply = await kenji.engine.encryptMessage("5001", enc.encode("hi Noor"));
    const back = await noor.engine.processIncoming("5001", reply.ciphertext);
    expect(back.kind === "application" && dec.decode(back.payload)).toBe("hi Noor");
    expect(await noor.engine.members("5001")).toHaveLength(2);
  });

  it("hides the text and its length, and the franking proof checks out", async () => {
    const { noor, kenji } = await dm("5002");
    const short = await noor.engine.encryptMessage("5002", enc.encode("ok"));
    const longer = await noor.engine.encryptMessage("5002", enc.encode("x".repeat(180)));
    expect(short.ciphertext.length).toBe(longer.ciphertext.length);
    expect(short.ciphertext.length).toBeGreaterThan(PADDING_BUCKET);
    expect(toBase64Url(longer.ciphertext)).not.toContain(toBase64Url(asciiBytes("xxxxxx")));

    const got = await kenji.engine.processIncoming("5002", short.ciphertext);
    if (got.kind !== "application") throw new Error("expected a message");
    // What Kenji would reveal in a report: the text and the key. It matches what Noor committed to.
    expect(frankingCommitment(got.frankingKey, got.payload, "5002", "101")).toEqual(
      short.franking.commitment,
    );
    // A made-up text, or blaming someone else, doesn't match.
    expect(frankingCommitment(got.frankingKey, enc.encode("no"), "5002", "101")).not.toEqual(
      short.franking.commitment,
    );
    expect(frankingCommitment(got.frankingKey, got.payload, "5002", "202")).not.toEqual(
      short.franking.commitment,
    );
  });

  it("rotates keys: the call key changes and new messages flow", async () => {
    const { noor, kenji } = await dm("5003");
    const before = await noor.engine.exportSecret("5003", "realm call", new Uint8Array(), 32);
    const rotation = await kenji.engine.rotateKeys("5003");
    expect(rotation.fromEpoch).toBe(1n);
    expect(rotation.epoch).toBe(2n);
    // Until the server accepts it, Kenji is still in the old epoch.
    expect(await kenji.engine.epoch("5003")).toBe(1n);
    await kenji.engine.commitAccepted("5003");
    const seen = await noor.engine.processIncoming("5003", rotation.commit);
    expect(seen).toEqual({ kind: "commit", epoch: 2n, added: [], removed: [] });
    const after = await noor.engine.exportSecret("5003", "realm call", new Uint8Array(), 32);
    expect(after).not.toEqual(before);
    expect(after).toEqual(
      await kenji.engine.exportSecret("5003", "realm call", new Uint8Array(), 32),
    );
    const msg = await noor.engine.encryptMessage("5003", enc.encode("new keys"));
    const got = await kenji.engine.processIncoming("5003", msg.ciphertext);
    expect(got.kind === "application" && dec.decode(got.payload)).toBe("new keys");
  });

  it("a rejected change is dropped and the chat carries on", async () => {
    const { noor, kenji } = await dm("5004");
    await noor.engine.rotateKeys("5004");
    await noor.engine.commitRejected("5004");
    expect(await noor.engine.epoch("5004")).toBe(1n);
    const msg = await noor.engine.encryptMessage("5004", enc.encode("still here"));
    const got = await kenji.engine.processIncoming("5004", msg.ciphertext);
    expect(got.kind === "application" && dec.decode(got.payload)).toBe("still here");
  });

  it("refuses a changed message, a replay and a message for another chat", async () => {
    const { noor, kenji } = await dm("5005");
    const msg = await noor.engine.encryptMessage("5005", enc.encode("once"));
    const bent = msg.ciphertext.slice();
    bent[bent.length - 1] = (bent.at(-1) ?? 0) ^ 1;
    await expect(kenji.engine.processIncoming("5005", bent)).rejects.toThrow();
    await kenji.engine.processIncoming("5005", msg.ciphertext);
    await expect(kenji.engine.processIncoming("5005", msg.ciphertext)).rejects.toThrow();

    const other = await dm("5006");
    const elsewhere = await other.noor.engine.encryptMessage("5006", enc.encode("other chat"));
    await expect(kenji.engine.processIncoming("5005", elsewhere.ciphertext)).rejects.toThrow();
  });

  it("won't add a device that isn't certified for the person it claims to be", async () => {
    const noor = await person("101");
    const mallory = await person("666");
    const victim = await person("303");
    const [kp] = await mallory.engine.generateKeyPackages(1);
    // The server (or anyone) claims Mallory's key package is the victim's device.
    await expect(
      noor.engine.createGroup("5007", [
        { userId: victim.userId, deviceId: victim.deviceId, keyPackage: kp as Bytes },
      ]),
    ).rejects.toThrow("different device");

    // A device signed by a key that isn't the account's own is refused when it is set up.
    const fake = new TsMlsEngine({ keyStore: new MemoryStore(), accountKeyFor: trustAll });
    const { signatureKey } = await fake.createDevice();
    await fake.createAccountIdentity();
    const signature = await fake.signWithAccountKey(
      deviceCertificateBytes({ userId: "303", deviceId: "9999", signatureKey, issuedAt: 5 }),
    );
    await expect(
      fake.setIdentity({
        userId: "303",
        deviceId: "9999",
        accountKeyVersion: 1,
        issuedAt: 5,
        signature,
      }),
    ).rejects.toThrow();
  });

  it("won't join when it doesn't trust the other person's account key", async () => {
    const noor = await person("101");
    const loner = await person("404", async (id, v) => (id === "404" ? trustAll(id, v) : null));
    const [kp] = await loner.engine.generateKeyPackages(1);
    const change = await noor.engine.createGroup("5008", [
      { userId: "404", deviceId: loner.deviceId, keyPackage: kp as Bytes },
    ]);
    await expect(
      loner.engine.joinFromWelcome(change.welcomes[0]?.welcome as Bytes),
    ).rejects.toThrow();
  });

  it("keeps working after a restart, and a key package is used only once", async () => {
    const { noor, kenji } = await dm("5009");
    const reborn = new TsMlsEngine({ keyStore: kenji.store, accountKeyFor: trustAll });
    const msg = await noor.engine.encryptMessage("5009", enc.encode("after restart"));
    const got = await reborn.processIncoming("5009", msg.ciphertext);
    expect(got.kind === "application" && dec.decode(got.payload)).toBe("after restart");
    // No private key package is left behind once it has been used to join.
    expect([...kenji.store.data.keys()].filter((k) => k.startsWith("kp:"))).toEqual([]);
  });

  it("keeps everything in the key store, under known names", async () => {
    const { noor } = await dm("5010");
    expect([...noor.store.data.keys()].sort()).toEqual([
      "account",
      "device",
      "group:5010",
      "identity",
    ]);
    const device = JSON.parse(dec.decode(noor.store.data.get("device") as Bytes));
    expect(device.pub).toBe(toBase64Url(noor.signatureKey));
    expect(device.sign).not.toBe(device.pub);
  });
});

describe("TsMlsEngine: a race over a key change", () => {
  it("the loser drops its change and can still follow the winner's", async () => {
    const { noor, kenji } = await dm("5011");
    const winner = await noor.engine.rotateKeys("5011");
    // Kenji made a change in the same epoch, and the server refused it.
    await kenji.engine.rotateKeys("5011");
    await kenji.engine.commitRejected("5011");
    await noor.engine.commitAccepted("5011");
    const seen = await kenji.engine.processIncoming("5011", winner.commit);
    expect(seen.kind).toBe("commit");
    const msg = await noor.engine.encryptMessage("5011", enc.encode("after the race"));
    const got = await kenji.engine.processIncoming("5011", msg.ciphertext);
    expect(got.kind === "application" && dec.decode(got.payload)).toBe("after the race");
  });
});

describe("safetyNumber", () => {
  it("is the same for both people and changes with either key", () => {
    const a = { userId: "101", accountKey: new Uint8Array(32).fill(1) };
    const b = { userId: "202", accountKey: new Uint8Array(32).fill(2) };
    const n = safetyNumber(a, b);
    expect(n).toMatch(/^(\d{5} ){11}\d{5}$/);
    expect(safetyNumber(b, a)).toBe(n);
    expect(safetyNumber(a, { ...b, accountKey: new Uint8Array(32).fill(3) })).not.toBe(n);
  });
});
