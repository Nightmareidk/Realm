import { randomBytes } from "@noble/ciphers/utils.js";
import {
  ChatEvent,
  type ClaimedKeyPackages,
  type EncryptedEnvelope,
  type EncryptedGroupState,
  type EncryptedInbox,
  type EncryptedSent,
  type OwnDevice,
  type PublicDevices,
  type ReportReason,
} from "@realm/contracts";
import { type Bytes, fromBase64Url, toBase64Url } from "../bytes";
import { deviceCertificateBytes, deviceResumeBytes } from "../certificate";
import type { CryptoEngine, KeyStore } from "../engine";
import { TsMlsEngine, type TsMlsEngineOptions } from "../engines/ts-mls";
import { safetyNumber } from "../franking";
import { utf8Bytes, utf8Text } from "../utf8";
import {
  applyEvent,
  type ChatMessage,
  type ChatState,
  emptyChat,
  type MessageProof,
  settle,
} from "./chat-state";

/**
 * The client side of encrypted chats (docs/E2EE.md §6, §7): everything a chat screen needs, with
 * no screen in it. It sets this device up, decides which account keys to trust, sends and
 * receives through Realm's API, and keeps the decrypted messages in the device's sealed store.
 * The server is treated as untrusted throughout: it carries ciphertext and public keys, and
 * every key and certificate it hands over is checked here before use.
 */

/** How this client reaches Realm's API. Must throw `E2eeRequestError` for a refused request. */
export interface E2eeTransport {
  request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T>;
}

export class E2eeRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "E2eeRequestError";
  }
}

/** Something the person using the app should be told, in words the screens can show. */
export class E2eeNotice extends Error {
  constructor(
    readonly reason: "not-ready" | "they-are-not-set-up" | "key-changed" | "not-in-chat",
    message: string,
  ) {
    super(message);
    this.name = "E2eeNotice";
  }
}

export type DeviceState =
  /** Set up and able to chat. */
  | "ready"
  /** Another of this person's devices has to confirm this one first (phase 3). */
  | "needs-approval"
  /** This sign-in can't be used for encrypted chats (revoked, or its keys are gone). */
  | "unavailable"
  /** The server isn't offering encrypted chats. Nothing is set up and no keys are made. */
  | "off";

export interface E2eeClientOptions {
  userId: string;
  transport: E2eeTransport;
  /** The device's sealed store (AES-256-GCM at rest). Nothing here is ever sent to the server. */
  store: KeyStore;
  now?: () => number;
  /** Called when a chat's saved messages changed, or a person's key did. */
  onChange?: (what: { channelId?: string; keyChangedFor?: string }) => void;
  /** For swapping the engine later (OpenMLS). Defaults to the ts-mls prototype. */
  engine?: (options: TsMlsEngineOptions) => CryptoEngine;
}

interface PinnedKey {
  version: number;
  key: string;
}

const KEY_PACKAGES_LOW = 10;
const KEY_PACKAGES_BATCH = 20;
/** §7.5: fresh keys after this many messages sent, or this long, whichever comes first. */
const ROTATE_AFTER_MESSAGES = 500;
const ROTATE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const SNOWFLAKE = /^[1-9]\d{0,19}$/;

const b64 = toBase64Url;

/** A new id for a message this device is about to send: 128 random bits, as hex. */
export function newMessageId(): string {
  return [...randomBytes(16)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const isCode = (err: unknown, code: string) => err instanceof E2eeRequestError && err.code === code;

export class E2eeClient {
  readonly engine: CryptoEngine;
  private readonly userId: string;
  private readonly api: E2eeTransport;
  private readonly store: KeyStore;
  private readonly now: () => number;
  private readonly onChange: NonNullable<E2eeClientOptions["onChange"]>;
  private state: DeviceState | null = null;
  /** One operation at a time: saved chats are read, changed and written back. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(options: E2eeClientOptions) {
    if (!SNOWFLAKE.test(options.userId)) throw new Error("invalid user id");
    this.userId = options.userId;
    this.api = options.transport;
    this.store = options.store;
    this.now = options.now ?? Date.now;
    this.onChange = options.onChange ?? (() => undefined);
    const make = options.engine ?? ((o) => new TsMlsEngine(o));
    this.engine = make({
      keyStore: options.store,
      accountKeyFor: (userId, version) => this.trustedKey(userId, version),
    });
  }

  private serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work);
    this.queue = next.catch(() => undefined);
    return next;
  }

  // ---- small storage helpers

  private async readJson<T>(name: string): Promise<T | null> {
    const raw = await this.store.get(name);
    return raw ? (JSON.parse(utf8Text(raw)) as T) : null;
  }

  private writeJson(name: string, value: unknown) {
    return this.store.put(name, utf8Bytes(JSON.stringify(value)));
  }

  private async loadChat(channelId: string): Promise<ChatState> {
    return (
      (await this.readJson<ChatState>(`chat:${channelId}`)) ?? emptyChat(channelId, this.now())
    );
  }

  private async saveChat(chat: ChatState) {
    await this.writeJson(`chat:${chat.channelId}`, chat);
    const index = (await this.readJson<string[]>("chats")) ?? [];
    if (!index.includes(chat.channelId)) await this.writeJson("chats", [...index, chat.channelId]);
    this.onChange({ channelId: chat.channelId });
  }

  private async change(channelId: string, update: (chat: ChatState) => ChatState) {
    const before = await this.loadChat(channelId);
    const after = update(before);
    if (after !== before) await this.saveChat(after);
    return after;
  }

  // ---- whose keys this device trusts (§6.4)

  /**
   * The account key this device trusts for a person. The first key seen for someone is pinned
   * (trust on first use). If the server later shows a different one, it is NOT trusted until the
   * person using the app accepts the change, so a swapped key can't slip in silently.
   */
  private async trustedKey(userId: string, version: number): Promise<Bytes | null> {
    const pinned = await this.readJson<PinnedKey>(`trust:${userId}`);
    if (pinned?.version === version) return fromBase64Url(pinned.key);
    if (pinned && version < pinned.version) return null;
    let published: PublicDevices["accountKey"];
    try {
      published = (await this.api.request<PublicDevices>("GET", `/e2ee/users/${userId}`))
        .accountKey;
    } catch {
      return null;
    }
    if (!published || published.version !== version) return null;
    const key = fromBase64Url(published.publicKey);
    if (!pinned) {
      await this.writeJson(`trust:${userId}`, { version, key: b64(key) } satisfies PinnedKey);
      return key;
    }
    await this.writeJson(`trust-changed:${userId}`, { version, key: b64(key) } satisfies PinnedKey);
    this.onChange({ keyChangedFor: userId });
    return null;
  }

  /** True when this person's account key changed and the change hasn't been accepted yet. */
  async keyChanged(userId: string): Promise<boolean> {
    return (await this.store.get(`trust-changed:${userId}`)) !== null;
  }

  /** The person using the app accepts someone's new key (after checking the safety number). */
  acceptKeyChange(userId: string): Promise<void> {
    return this.serial(async () => {
      const next = await this.readJson<PinnedKey>(`trust-changed:${userId}`);
      if (!next) return;
      await this.writeJson(`trust:${userId}`, next);
      await this.store.delete(`trust-changed:${userId}`);
    });
  }

  /** The 60 digits two people compare. Null until both account keys are known here. */
  async safetyNumber(otherUserId: string): Promise<string | null> {
    const mine = await this.readJson<PinnedKey>(`trust:${this.userId}`);
    const theirs = await this.readJson<PinnedKey>(`trust:${otherUserId}`);
    if (!mine || !theirs) return null;
    return safetyNumber(
      { userId: this.userId, accountKey: fromBase64Url(mine.key) },
      { userId: otherUserId, accountKey: fromBase64Url(theirs.key) },
    );
  }

  // ---- this device (§6.2)

  /** Sets this device up for encrypted chats, or says why it can't be yet. Safe to call again. */
  start(): Promise<DeviceState> {
    return this.serial(async () => {
      const first = this.state === null;
      try {
        await this.api.request("GET", "/e2ee/inbox");
      } catch (err) {
        // Not offered by this server: stop before making or registering any key.
        if (err instanceof E2eeRequestError && err.status === 404) {
          this.state = "off";
          return this.state;
        }
      }
      this.state = await this.setUp();
      if (this.state === "ready") {
        await this.topUpKeyPackages();
        if (first) await this.failInterruptedSends();
      }
      return this.state;
    });
  }

  /** Where this device stands, once `start` has run. */
  get deviceState(): DeviceState | null {
    return this.state;
  }

  /** A message still "sending" when the app last closed never finished: offer it for retry. */
  private async failInterruptedSends() {
    for (const channelId of await this.chats()) {
      await this.change(channelId, (chat) =>
        chat.messages
          .filter((m) => m.status === "sending")
          .reduce((c, m) => settle(c, m.id, "failed"), chat),
      );
    }
  }

  private async setUp(): Promise<DeviceState> {
    const { signatureKey } = await this.engine.createDevice();
    const own = await this.api.request<{ accountKeyVersion: number | null; devices: OwnDevice[] }>(
      "GET",
      "/e2ee/devices",
    );
    let device = own.devices.find((d) => d.current);
    if (!device) {
      const known = own.devices.find((d) => d.signatureKey === b64(signatureKey));
      if (known?.status === "revoked") return "unavailable";
      if (known) {
        // Signed in again on this device: it proves it's the same one, and carries on.
        const at = this.now();
        const proof = await this.engine.signWithDeviceKey(
          deviceResumeBytes({ userId: this.userId, deviceId: known.id, at }),
        );
        device = await this.api.request<OwnDevice>("POST", `/e2ee/devices/${known.id}/resume`, {
          at,
          signature: b64(proof),
        });
      } else {
        device = await this.api.request<OwnDevice>("POST", "/e2ee/devices", {
          signatureKey: b64(signatureKey),
        });
      }
    } else if (device.signatureKey !== b64(signatureKey)) {
      // The server knows this sign-in under a key this device no longer has.
      return "unavailable";
    }
    if (device.status === "revoked") return "unavailable";
    if (device.status === "approved") {
      return (await this.engine.identity()) ? "ready" : "unavailable";
    }

    // Waiting to be confirmed. The first device of an account makes the account key and
    // confirms itself; any later device needs one that already holds that key.
    let version = own.accountKeyVersion;
    if (version === null) {
      const { publicKey } = await this.engine.createAccountIdentity();
      try {
        await this.api.request("POST", "/e2ee/account-key", { publicKey: b64(publicKey) });
      } catch (err) {
        // Already set: by an earlier try on this device, or by another device (checked below,
        // where a key that isn't this device's own fails to sign anything the server accepts).
        if (!isCode(err, "CONFLICT")) throw err;
      }
      const after = await this.api.request<{ accountKeyVersion: number | null }>(
        "GET",
        "/e2ee/devices",
      );
      version = after.accountKeyVersion ?? 1;
      await this.writeJson(`trust:${this.userId}`, {
        version,
        key: b64(publicKey),
      } satisfies PinnedKey);
    }
    const issuedAt = this.now();
    let signature: Bytes;
    try {
      signature = await this.engine.signWithAccountKey(
        deviceCertificateBytes({
          userId: this.userId,
          deviceId: device.id,
          signatureKey,
          issuedAt,
        }),
      );
    } catch {
      return "needs-approval";
    }
    try {
      await this.api.request("POST", `/e2ee/devices/${device.id}/approve`, {
        issuedAt,
        signature: b64(signature),
      });
    } catch (err) {
      // The account key on the server isn't the one this device holds.
      if (isCode(err, "SIGNATURE_INVALID") || isCode(err, "DEVICE_NOT_APPROVED")) {
        return "needs-approval";
      }
      throw err;
    }
    await this.engine.setIdentity({
      userId: this.userId,
      deviceId: device.id,
      accountKeyVersion: version,
      issuedAt,
      signature,
    });
    return "ready";
  }

  private requireReady() {
    if (this.state !== "ready") {
      throw new E2eeNotice("not-ready", "Set this device up for encrypted chats first.");
    }
  }

  /** Keeps enough one-time KeyPackages on the server for people to start chats while offline. */
  private async topUpKeyPackages() {
    const { unclaimed } = await this.api.request<{ unclaimed: number }>(
      "GET",
      "/e2ee/key-packages/count",
    );
    if (unclaimed >= KEY_PACKAGES_LOW) return;
    const fresh = await this.engine.generateKeyPackages(KEY_PACKAGES_BATCH);
    await this.api.request("POST", "/e2ee/key-packages", { keyPackages: fresh.map(b64) });
  }

  // ---- chats (§7)

  /** Opens the encrypted DM with someone, creating its group if nobody has yet. */
  openDm(recipientId: string): Promise<string> {
    return this.serial(async () => {
      this.requireReady();
      const state = await this.api.request<EncryptedGroupState>("POST", "/e2ee/channels", {
        recipientId,
      });
      const channelId = state.channelId;
      if ((await this.engine.epoch(channelId)) !== null) return channelId;
      if (state.epoch !== null) {
        // The other side made the group: this device's welcome is waiting.
        await this.pull();
      } else {
        await this.createGroup(channelId, recipientId);
      }
      if ((await this.engine.epoch(channelId)) === null) {
        throw new E2eeNotice("not-in-chat", "This chat isn't ready on this device yet.");
      }
      // Makes sure the chat is in this device's list, even before anything is said in it.
      await this.saveChat(await this.loadChat(channelId));
      return channelId;
    });
  }

  private async createGroup(channelId: string, recipientId: string) {
    const claimed = await this.api.request<ClaimedKeyPackages>("POST", "/e2ee/key-packages/claim", {
      userIds: [recipientId],
    });
    if (!claimed.packages.some((p) => p.userId === recipientId)) {
      throw new E2eeNotice(
        "they-are-not-set-up",
        "They haven't set up encrypted chats yet. You can message them once they open Realm.",
      );
    }
    if (await this.keyChanged(recipientId)) {
      throw new E2eeNotice("key-changed", "Their security code changed. Check it with them first.");
    }
    // Every KeyPackage's certificate is checked by the engine before the device is added.
    const change = await this.engine.createGroup(
      channelId,
      claimed.packages.map((p) => ({
        userId: p.userId,
        deviceId: p.deviceId,
        keyPackage: fromBase64Url(p.keyPackage),
      })),
    );
    try {
      await this.api.request("POST", `/e2ee/channels/${channelId}/group`, {
        welcomes: change.welcomes.map((w) => ({ deviceId: w.deviceId, welcome: b64(w.welcome) })),
      });
      await this.engine.commitAccepted(channelId);
    } catch (err) {
      await this.engine.commitRejected(channelId);
      if (!isCode(err, "CONFLICT")) throw err;
      // They created it at the same moment and won: join theirs.
      await this.pull();
    }
  }

  /** Encrypts and posts one event. If the chat's keys moved on, catches up and tries again. */
  private async post(channelId: string, event: ChatEvent): Promise<EncryptedSent> {
    const payload = utf8Bytes(JSON.stringify(event));
    for (let attempt = 0; ; attempt++) {
      const sealed = await this.engine.encryptMessage(channelId, payload);
      try {
        return await this.api.request<EncryptedSent>(
          "POST",
          `/e2ee/channels/${channelId}/messages`,
          {
            epoch: Number(sealed.epoch),
            ciphertext: b64(sealed.ciphertext),
            frankingCommitment: b64(sealed.franking.commitment),
          },
        );
      } catch (err) {
        if (!isCode(err, "EPOCH_STALE") || attempt >= 2) throw err;
        await this.pull();
      }
    }
  }

  /** Sends an event and applies it to this device's copy of the chat. */
  private send(channelId: string, event: ChatEvent): Promise<ChatState> {
    return this.serial(async () => {
      this.requireReady();
      if ((await this.engine.epoch(channelId)) === null) {
        throw new E2eeNotice("not-in-chat", "This device isn't part of that chat.");
      }
      const sent = await this.post(channelId, event);
      const chat = await this.change(channelId, (c) => {
        const next = applyEvent(c, event, { userId: this.userId, at: sent.createdAt });
        return { ...next, sentSinceRotation: next.sentSinceRotation + 1 };
      });
      await this.rotateIfDue(chat);
      return chat;
    });
  }

  /**
   * Sends a message. It shows up at once as "sending", then settles as sent or failed. Sending
   * again with the same `id` retries a failed message, and the other side never shows it twice.
   */
  sendText(
    channelId: string,
    text: string,
    replyTo?: string,
    id: string = newMessageId(),
  ): Promise<ChatMessage> {
    return this.serial(async () => {
      this.requireReady();
      if ((await this.engine.epoch(channelId)) === null) {
        throw new E2eeNotice("not-in-chat", "This device isn't part of that chat.");
      }
      const before = (await this.loadChat(channelId)).messages.find((m) => m.id === id);
      // Already delivered (or the id belongs to someone else's message): nothing to send.
      if (before && (!before.status || before.authorId !== this.userId)) return before;
      const event = ChatEvent.parse({
        type: "text",
        id,
        text: before?.text ?? text,
        ...((before?.replyTo ?? replyTo) ? { replyTo: before?.replyTo ?? replyTo } : {}),
      });
      const at = new Date(this.now()).toISOString();
      await this.change(channelId, (c) =>
        before
          ? settle(c, id, "sending")
          : applyEvent(c, event, { userId: this.userId, at, status: "sending" }),
      );
      let chat: ChatState;
      try {
        const sent = await this.post(channelId, event);
        chat = await this.change(channelId, (c) => ({
          ...settle(c, id, { sentAt: sent.createdAt }),
          sentSinceRotation: c.sentSinceRotation + 1,
        }));
      } catch (err) {
        await this.change(channelId, (c) => settle(c, id, "failed"));
        throw err;
      }
      await this.rotateIfDue(chat);
      return chat.messages.find((m) => m.id === id) as ChatMessage;
    });
  }

  /** Tries a failed message again. */
  resend(channelId: string, messageId: string): Promise<ChatMessage> {
    return this.sendText(channelId, "", undefined, messageId);
  }

  edit(channelId: string, target: string, text: string) {
    return this.send(channelId, ChatEvent.parse({ type: "edit", target, text }));
  }

  remove(channelId: string, target: string) {
    return this.send(channelId, ChatEvent.parse({ type: "delete", target }));
  }

  react(channelId: string, target: string, emoji: string, remove = false) {
    return this.send(
      channelId,
      ChatEvent.parse({ type: "reaction", target, emoji, ...(remove ? { remove } : {}) }),
    );
  }

  /**
   * This person has read up to a message. With `share`, the others are told ("Seen"), once.
   * Without it (a message request not accepted yet, or read receipts switched off) only this
   * device remembers, and a later call with `share` still tells them.
   */
  markSeen(channelId: string, upTo: string, share = true): Promise<ChatState> {
    const event = ChatEvent.parse({ type: "seen", upTo });
    return this.serial(async () => {
      const from = { userId: this.userId, at: new Date(this.now()).toISOString() };
      const chat = await this.loadChat(channelId);
      const at = (id: string | undefined) => chat.messages.findIndex((m) => m.id === id);
      if (at(upTo) < 0) return chat;
      if (!share) return this.change(channelId, (c) => applyEvent(c, event, from));
      // They already know about this message, or a later one.
      if (at(chat.sharedSeen) >= at(upTo)) return chat;
      this.requireReady();
      const sent = await this.post(channelId, event);
      return this.change(channelId, (c) => ({
        ...applyEvent(c, event, { userId: this.userId, at: sent.createdAt }),
        sharedSeen: upTo,
      }));
    });
  }

  /** Fresh keys for this device in a chat, when it has sent a lot or it has been a while. */
  private async rotateIfDue(chat: ChatState) {
    const due =
      chat.sentSinceRotation >= ROTATE_AFTER_MESSAGES ||
      this.now() - chat.rotatedAt >= ROTATE_AFTER_MS;
    if (!due) return;
    const channelId = chat.channelId;
    try {
      const change = await this.engine.rotateKeys(channelId);
      try {
        await this.api.request("POST", `/e2ee/channels/${channelId}/commits`, {
          epoch: Number(change.fromEpoch),
          commit: b64(change.commit),
        });
        await this.engine.commitAccepted(channelId);
      } catch (err) {
        await this.engine.commitRejected(channelId);
        if (isCode(err, "EPOCH_STALE")) await this.pull();
      }
      // Either way the chat has fresh keys now (ours, or the other side's that beat ours).
      await this.change(channelId, (c) => ({ ...c, sentSinceRotation: 0, rotatedAt: this.now() }));
    } catch {
      // Rotation is upkeep: a failure here must never fail the message that triggered it.
    }
  }

  // ---- receiving

  /** Fetches and decrypts everything waiting for this device. */
  sync(): Promise<void> {
    return this.serial(async () => {
      this.requireReady();
      await this.pull();
    });
  }

  private async pull() {
    let joined = false;
    for (;;) {
      const inbox = await this.api.request<EncryptedInbox>("GET", "/e2ee/inbox");
      if (inbox.messages.length === 0) break;
      const done = BigInt((await this.readJson<string>("synced")) ?? "0");
      for (const envelope of inbox.messages) {
        // Already handled before a crash or a lost acknowledgement: don't process it twice.
        if (BigInt(envelope.id) > done) {
          if (await this.take(envelope)) joined = true;
          await this.writeJson("synced", envelope.id);
        }
      }
      await this.api.request("POST", "/e2ee/inbox/ack", {
        ids: inbox.messages.map((m) => m.id),
      });
      if (!inbox.more) break;
    }
    if (joined) await this.topUpKeyPackages();
  }

  /** Handles one envelope. Returns true if it was a welcome that this device joined from. */
  private async take(envelope: EncryptedEnvelope): Promise<boolean> {
    const channelId = envelope.channelId;
    // Counted against the chat when this device knows it; the server's label alone can't
    // make a chat appear here.
    const problem = async () => {
      if (await this.store.get(`chat:${channelId}`)) {
        await this.change(channelId, (c) => ({ ...c, problems: c.problems + 1 }));
      } else {
        await this.writeJson("problems", ((await this.readJson<number>("problems")) ?? 0) + 1);
      }
    };
    try {
      const bytes = fromBase64Url(envelope.ciphertext);
      if (envelope.kind === "welcome") {
        // The chat it belongs to is what the welcome itself says, not the server's label.
        const joined = await this.engine.joinFromWelcome(bytes);
        await this.saveChat(await this.loadChat(joined));
        return true;
      }
      const incoming = await this.engine.processIncoming(channelId, bytes);
      if (incoming.kind !== "application") return false;
      const parsed = ChatEvent.safeParse(JSON.parse(utf8Text(incoming.payload)));
      if (!parsed.success) {
        await problem();
        return false;
      }
      const proof: MessageProof | undefined =
        parsed.data.type === "text" && envelope.frankingCommitment && envelope.serverSignature
          ? {
              serverId: envelope.id,
              payload: b64(incoming.payload),
              frankingKey: b64(incoming.frankingKey),
              commitment: envelope.frankingCommitment,
              serverSignature: envelope.serverSignature,
            }
          : undefined;
      await this.change(channelId, (c) =>
        applyEvent(c, parsed.data, {
          userId: incoming.senderUserId,
          at: envelope.createdAt,
          ...(proof ? { proof } : {}),
        }),
      );
    } catch {
      await problem();
    }
    return false;
  }

  // ---- reading what's saved

  async chat(channelId: string): Promise<ChatState | null> {
    return this.readJson<ChatState>(`chat:${channelId}`);
  }

  async chats(): Promise<string[]> {
    return (await this.readJson<string[]>("chats")) ?? [];
  }

  /** Reports a message someone sent, with the proof that they really sent it (§17). */
  report(channelId: string, messageId: string, reason: ReportReason, details?: string) {
    return this.serial(async () => {
      const message = (await this.loadChat(channelId)).messages.find((m) => m.id === messageId);
      if (!message?.proof) throw new Error("that message can't be reported with proof");
      await this.api.request("POST", `/e2ee/channels/${channelId}/reports`, {
        messageId: message.proof.serverId,
        senderUserId: message.authorId,
        payload: message.proof.payload,
        frankingKey: message.proof.frankingKey,
        frankingCommitment: message.proof.commitment,
        serverSignature: message.proof.serverSignature,
        reason,
        ...(details ? { details } : {}),
      });
    });
  }
}
