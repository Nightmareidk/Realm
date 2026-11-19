import { ed25519 } from "@noble/curves/ed25519.js";
import {
  type CiphersuiteImpl,
  type ClientConfig,
  type ClientState,
  type Credential,
  createApplicationMessage,
  createCommit,
  createGroup,
  decodeGroupState,
  decodeMlsMessage,
  defaultCapabilities,
  defaultLifetime,
  emptyPskIndex,
  encodeGroupState,
  encodeMlsMessage,
  generateKeyPackageWithKey,
  getCiphersuiteFromName,
  getCiphersuiteImpl,
  joinGroup,
  type KeyPackage,
  mlsExporter,
  type PrivateKeyPackage,
  type Proposal,
  processPrivateMessage,
  zeroOutUint8Array,
} from "ts-mls";
import { defaultClientConfig } from "ts-mls/clientConfig.js";
import { makeKeyPackageRef } from "ts-mls/keyPackage.js";
import { decryptSenderData } from "ts-mls/privateMessage.js";
import { asciiBytes, asciiText, type Bytes, fromBase64Url, toBase64Url } from "../bytes";
import {
  deviceCertificateBytes,
  ED25519_PUBLIC_KEY_BYTES,
  ED25519_SIGNATURE_BYTES,
} from "../certificate";
import {
  type CryptoEngine,
  type DeviceId,
  type DeviceIdentity,
  type DeviceKeyPackage,
  type GroupChange,
  type GroupId,
  type Incoming,
  type KeyStore,
  LAUNCH_CIPHERSUITE,
} from "../engine";
import { FRANKING_KEY_BYTES, frankingCommitment, packFrame, unpackFrame } from "../franking";
import { realmCryptoProvider } from "../provider";

/**
 * The prototype engine: ts-mls (RFC 9420) behind Realm's CryptoEngine interface (docs/E2EE.md
 * §5, §20). It keeps every secret in the KeyStore it is given and nowhere else. Realm's own code
 * here only moves bytes between the library, the store and the caller, and checks certificates.
 */

const CIPHERSUITE_NAME = "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519";
const SNOWFLAKE = /^[1-9]\d{0,19}$/;
const IDENTITY_PREFIX = "realm1";
/** KeyPackages kept on the device waiting to be used. Older ones are dropped past this. */
const MAX_STORED_KEY_PACKAGES = 300;

export interface TsMlsEngineOptions {
  keyStore: KeyStore;
  /**
   * The account identity key this device trusts for a person, at that version, or null if it
   * trusts none. The app pins keys here (first use, or a verified safety number, §6.4).
   */
  accountKeyFor(userId: string, version: number): Promise<Bytes | null>;
}

interface StoredKeyPackage {
  publicPackage: string;
  init: string;
  hpke: string;
}

const ascii = asciiText;

function json(value: unknown): Bytes {
  return asciiBytes(JSON.stringify(value));
}

function hex(bytes: Bytes): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The MLS credential: who this leaf is and the certificate that proves it. Printable ASCII. */
export function encodeIdentity(id: DeviceIdentity): Bytes {
  return asciiBytes(
    [
      IDENTITY_PREFIX,
      id.userId,
      id.deviceId,
      id.accountKeyVersion,
      id.issuedAt,
      toBase64Url(id.signature),
    ].join(":"),
  );
}

export function decodeIdentity(bytes: Bytes): DeviceIdentity {
  if (bytes.length > 300) throw new Error("identity too long");
  const parts = ascii(bytes).split(":");
  const [prefix, userId, deviceId, version, issued, sig] = parts;
  if (parts.length !== 6 || prefix !== IDENTITY_PREFIX) throw new Error("unknown identity format");
  if (!userId || !deviceId || !SNOWFLAKE.test(userId) || !SNOWFLAKE.test(deviceId)) {
    throw new Error("invalid identity ids");
  }
  if (!version || !issued || !/^\d{1,9}$/.test(version) || !/^\d{1,16}$/.test(issued)) {
    throw new Error("invalid identity numbers");
  }
  const signature = fromBase64Url(sig ?? "");
  if (signature.length !== ED25519_SIGNATURE_BYTES) throw new Error("invalid identity signature");
  return {
    userId,
    deviceId,
    accountKeyVersion: Number(version),
    issuedAt: Number(issued),
    signature,
  };
}

export class TsMlsEngine implements CryptoEngine {
  readonly engine = "ts-mls" as const;
  readonly version = "1.6.4";
  readonly ciphersuite = LAUNCH_CIPHERSUITE;

  private readonly store: KeyStore;
  private readonly accountKeyFor: TsMlsEngineOptions["accountKeyFor"];
  private impl: CiphersuiteImpl | null = null;
  /** One operation at a time: group state must never be read while another call is changing it. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(options: TsMlsEngineOptions) {
    this.store = options.keyStore;
    this.accountKeyFor = options.accountKeyFor;
  }

  private run<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async cs(): Promise<CiphersuiteImpl> {
    this.impl ??= await getCiphersuiteImpl(
      getCiphersuiteFromName(CIPHERSUITE_NAME),
      realmCryptoProvider,
    );
    return this.impl;
  }

  /** ts-mls calls this for every leaf it meets: the certificate must chain to a trusted key. */
  private readonly config: ClientConfig = {
    ...defaultClientConfig,
    authService: {
      validateCredential: async (credential, signaturePublicKey) => {
        try {
          await this.checkCredential(credential, signaturePublicKey);
          return true;
        } catch {
          return false;
        }
      },
    },
  };

  private async checkCredential(credential: Credential, signatureKey: Bytes) {
    if (credential.credentialType !== "basic") throw new Error("unsupported credential");
    const id = decodeIdentity(credential.identity);
    const accountKey = await this.accountKeyFor(id.userId, id.accountKeyVersion);
    if (!accountKey) throw new Error("no trusted account key");
    const signed = deviceCertificateBytes({
      userId: id.userId,
      deviceId: id.deviceId,
      signatureKey,
      issuedAt: id.issuedAt,
    });
    if (!(await this.verifyAccountSignature(accountKey, signed, id.signature))) {
      throw new Error("certificate not signed by the account key");
    }
    return id;
  }

  // ---- storage helpers

  private async readJson<T>(name: string): Promise<T | null> {
    const raw = await this.store.get(name);
    return raw ? (JSON.parse(ascii(raw)) as T) : null;
  }

  private async deviceKeys(): Promise<{ signKey: Bytes; publicKey: Bytes }> {
    const d = await this.readJson<{ sign: string; pub: string }>("device");
    if (!d) throw new Error("this device has no key yet");
    return { signKey: fromBase64Url(d.sign), publicKey: fromBase64Url(d.pub) };
  }

  private async requireIdentity(): Promise<DeviceIdentity> {
    const id = await this.identity();
    if (!id) throw new Error("this device isn't approved yet");
    return id;
  }

  private async loadGroup(group: GroupId, pending = false): Promise<ClientState | null> {
    const raw = await this.store.get(`${pending ? "pending" : "group"}:${group}`);
    if (!raw) return null;
    // A private copy: used-up secrets get wiped in place, and that must never reach the store's
    // own bytes (a change that is later rejected would otherwise damage the saved group).
    const decoded = decodeGroupState(raw.slice(), 0);
    if (!decoded) throw new Error("stored group state is damaged");
    return { ...decoded[0], clientConfig: this.config };
  }

  private async requireGroup(group: GroupId): Promise<ClientState> {
    if (!SNOWFLAKE.test(group)) throw new Error("invalid group id");
    const state = await this.loadGroup(group);
    if (!state) throw new Error("not in this group");
    return state;
  }

  private async saveGroup(group: GroupId, state: ClientState, pending = false) {
    await this.store.put(`${pending ? "pending" : "group"}:${group}`, encodeGroupState(state));
  }

  private memberList(state: ClientState): (DeviceIdentity & { leaf: number })[] {
    const out: (DeviceIdentity & { leaf: number })[] = [];
    state.ratchetTree.forEach((node, i) => {
      if (i % 2 !== 0 || node?.nodeType !== "leaf") return;
      const credential = node.leaf.credential;
      if (credential.credentialType !== "basic") return;
      out.push({ ...decodeIdentity(credential.identity), leaf: i / 2 });
    });
    return out;
  }

  // ---- devices and identity

  createDevice(): Promise<{ signatureKey: Bytes }> {
    return this.run(async () => {
      const existing = await this.readJson<{ pub: string }>("device");
      if (existing) return { signatureKey: fromBase64Url(existing.pub) };
      const { signature } = await this.cs();
      const { signKey, publicKey } = await signature.keygen();
      await this.store.put(
        "device",
        json({ sign: toBase64Url(signKey), pub: toBase64Url(publicKey) }),
      );
      return { signatureKey: publicKey };
    });
  }

  createAccountIdentity(): Promise<{ publicKey: Bytes }> {
    return this.run(async () => {
      const existing = await this.readJson<{ pub: string }>("account");
      if (existing) return { publicKey: fromBase64Url(existing.pub) };
      const { signature } = await this.cs();
      const { signKey, publicKey } = await signature.keygen();
      await this.store.put(
        "account",
        json({ sign: toBase64Url(signKey), pub: toBase64Url(publicKey) }),
      );
      return { publicKey };
    });
  }

  signWithAccountKey(message: Bytes): Promise<Bytes> {
    return this.run(async () => {
      const account = await this.readJson<{ sign: string }>("account");
      if (!account) throw new Error("this device doesn't hold the account key");
      return ed25519.sign(message, fromBase64Url(account.sign));
    });
  }

  signWithDeviceKey(message: Bytes): Promise<Bytes> {
    return this.run(async () => ed25519.sign(message, (await this.deviceKeys()).signKey));
  }

  async verifyAccountSignature(accountKey: Bytes, message: Bytes, signature: Bytes) {
    if (accountKey.length !== ED25519_PUBLIC_KEY_BYTES) return false;
    if (signature.length !== ED25519_SIGNATURE_BYTES) return false;
    try {
      return ed25519.verify(signature, message, accountKey);
    } catch {
      return false;
    }
  }

  setIdentity(identity: DeviceIdentity): Promise<void> {
    return this.run(async () => {
      const { publicKey } = await this.deviceKeys();
      // Refuse a certificate that isn't really for this device's key.
      await this.checkCredential(
        { credentialType: "basic", identity: encodeIdentity(identity) },
        publicKey,
      );
      await this.store.put("identity", encodeIdentity(identity));
    });
  }

  async identity(): Promise<DeviceIdentity | null> {
    const raw = await this.store.get("identity");
    return raw ? decodeIdentity(raw) : null;
  }

  private async newKeyPackage(): Promise<{
    publicPackage: KeyPackage;
    privatePackage: PrivateKeyPackage;
  }> {
    const cs = await this.cs();
    const identity = await this.requireIdentity();
    return generateKeyPackageWithKey(
      { credentialType: "basic", identity: encodeIdentity(identity) },
      defaultCapabilities(),
      defaultLifetime,
      [],
      await this.deviceKeys(),
      cs,
    );
  }

  generateKeyPackages(count: number): Promise<Bytes[]> {
    return this.run(async () => {
      if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error("invalid count");
      const cs = await this.cs();
      const index = (await this.readJson<string[]>("kp-index")) ?? [];
      const out: Bytes[] = [];
      for (let i = 0; i < count; i++) {
        const kp = await this.newKeyPackage();
        const encoded = encodeMlsMessage({
          keyPackage: kp.publicPackage,
          wireformat: "mls_key_package",
          version: "mls10",
        });
        const ref = hex(await makeKeyPackageRef(kp.publicPackage, cs.hash));
        const stored: StoredKeyPackage = {
          publicPackage: toBase64Url(encoded),
          init: toBase64Url(kp.privatePackage.initPrivateKey),
          hpke: toBase64Url(kp.privatePackage.hpkePrivateKey),
        };
        await this.store.put(`kp:${ref}`, json(stored));
        index.push(ref);
        out.push(encoded);
      }
      while (index.length > MAX_STORED_KEY_PACKAGES) {
        const old = index.shift();
        if (old) await this.store.delete(`kp:${old}`);
      }
      await this.store.put("kp-index", json(index));
      return out;
    });
  }

  // ---- groups

  /** Decodes other devices' KeyPackages and checks each is certified for who the server said. */
  private async addProposals(members: DeviceKeyPackage[]): Promise<Proposal[]> {
    const proposals: Proposal[] = [];
    for (const m of members) {
      const decoded = decodeMlsMessage(m.keyPackage, 0)?.[0];
      if (decoded?.wireformat !== "mls_key_package") throw new Error("not a key package");
      const leaf = decoded.keyPackage.leafNode;
      const id = await this.checkCredential(leaf.credential, leaf.signaturePublicKey);
      if (id.userId !== m.userId || id.deviceId !== m.deviceId) {
        throw new Error("key package belongs to a different device");
      }
      proposals.push({ proposalType: "add", add: { keyPackage: decoded.keyPackage } });
    }
    return proposals;
  }

  private async change(
    group: GroupId,
    state: ClientState,
    proposals: Proposal[],
    added: DeviceKeyPackage[],
  ): Promise<GroupChange> {
    const cs = await this.cs();
    const fromEpoch = state.groupContext.epoch;
    const result = await createCommit(
      { state, cipherSuite: cs },
      { extraProposals: proposals, ratchetTreeExtension: true },
    );
    result.consumed.forEach(zeroOutUint8Array);
    await this.saveGroup(group, result.newState, true);
    const welcome = result.welcome
      ? encodeMlsMessage({ welcome: result.welcome, wireformat: "mls_welcome", version: "mls10" })
      : null;
    if (added.length > 0 && !welcome) throw new Error("no welcome was made");
    return {
      groupId: group,
      fromEpoch,
      epoch: result.newState.groupContext.epoch,
      commit: encodeMlsMessage(result.commit),
      welcomes: welcome ? added.map((m) => ({ deviceId: m.deviceId, welcome })) : [],
    };
  }

  createGroup(groupId: GroupId, members: DeviceKeyPackage[]): Promise<GroupChange> {
    return this.run(async () => {
      if (!SNOWFLAKE.test(groupId)) throw new Error("invalid group id");
      if (members.length === 0) throw new Error("a chat needs someone else in it");
      if (await this.loadGroup(groupId)) throw new Error("already in this group");
      const cs = await this.cs();
      const proposals = await this.addProposals(members);
      const mine = await this.newKeyPackage();
      const state = await createGroup(
        asciiBytes(groupId),
        mine.publicPackage,
        mine.privatePackage,
        [],
        cs,
        this.config,
      );
      return this.change(groupId, state, proposals, members);
    });
  }

  addMembers(group: GroupId, members: DeviceKeyPackage[]): Promise<GroupChange> {
    return this.run(async () => {
      const state = await this.requireGroup(group);
      return this.change(group, state, await this.addProposals(members), members);
    });
  }

  removeMembers(group: GroupId, devices: DeviceId[]): Promise<GroupChange> {
    return this.run(async () => {
      const state = await this.requireGroup(group);
      const current = this.memberList(state);
      const proposals: Proposal[] = devices.map((deviceId) => {
        const found = current.find((m) => m.deviceId === deviceId);
        if (!found) throw new Error("that device isn't in the group");
        return { proposalType: "remove", remove: { removed: found.leaf } };
      });
      return this.change(group, state, proposals, []);
    });
  }

  rotateKeys(group: GroupId): Promise<GroupChange> {
    return this.run(async () => this.change(group, await this.requireGroup(group), [], []));
  }

  commitAccepted(group: GroupId): Promise<void> {
    return this.run(async () => {
      const pending = await this.store.get(`pending:${group}`);
      if (!pending) throw new Error("no change is waiting");
      await this.store.put(`group:${group}`, pending);
      await this.store.delete(`pending:${group}`);
    });
  }

  commitRejected(group: GroupId): Promise<void> {
    return this.run(() => this.store.delete(`pending:${group}`));
  }

  joinFromWelcome(welcomeBytes: Bytes): Promise<GroupId> {
    return this.run(async () => {
      const cs = await this.cs();
      const decoded = decodeMlsMessage(welcomeBytes, 0)?.[0];
      if (decoded?.wireformat !== "mls_welcome") throw new Error("not a welcome");
      const { signKey } = await this.deviceKeys();
      const index = (await this.readJson<string[]>("kp-index")) ?? [];
      for (const secret of decoded.welcome.secrets) {
        const ref = hex(secret.newMember);
        const stored = await this.readJson<StoredKeyPackage>(`kp:${ref}`);
        if (!stored) continue;
        const kp = decodeMlsMessage(fromBase64Url(stored.publicPackage), 0)?.[0];
        if (kp?.wireformat !== "mls_key_package") throw new Error("stored key package is damaged");
        // joinGroup checks every member's certificate through `this.config`.
        const state = await joinGroup(
          decoded.welcome,
          kp.keyPackage,
          {
            initPrivateKey: fromBase64Url(stored.init),
            hpkePrivateKey: fromBase64Url(stored.hpke),
            signaturePrivateKey: signKey,
          },
          emptyPskIndex,
          cs,
          undefined,
          undefined,
          this.config,
        );
        const groupId = ascii(state.groupContext.groupId);
        if (!SNOWFLAKE.test(groupId)) throw new Error("invalid group id");
        await this.saveGroup(groupId, state);
        // A KeyPackage is single-use: its private half is deleted once it has been used.
        await this.store.delete(`kp:${ref}`);
        await this.store.put("kp-index", json(index.filter((r) => r !== ref)));
        return groupId;
      }
      throw new Error("this welcome isn't for this device");
    });
  }

  processIncoming(group: GroupId, message: Bytes): Promise<Incoming> {
    return this.run(async () => {
      const cs = await this.cs();
      const state = await this.requireGroup(group);
      const decoded = decodeMlsMessage(message, 0)?.[0];
      if (decoded?.wireformat !== "mls_private_message") throw new Error("not a group message");
      const pm = decoded.privateMessage;
      if (ascii(pm.groupId) !== group) throw new Error("message is for another group");
      if (pm.epoch !== state.groupContext.epoch) throw new Error("message is from another epoch");

      // Who sent it. MLS then checks the message really is signed by that member's device key.
      const senderData = await decryptSenderData(pm, state.keySchedule.senderDataSecret, cs);
      const before = this.memberList(state);
      const sender = before.find((m) => m.leaf === senderData?.leafIndex);
      if (!sender) throw new Error("unknown sender");

      const result = await processPrivateMessage(state, pm, emptyPskIndex, cs);
      result.consumed.forEach(zeroOutUint8Array);
      await this.saveGroup(group, result.newState);

      if (result.kind === "applicationMessage") {
        const frame = unpackFrame(result.message);
        return {
          kind: "application",
          senderUserId: sender.userId,
          senderDeviceId: sender.deviceId,
          payload: frame.payload,
          frankingKey: frame.frankingKey,
        };
      }
      if (pm.contentType !== "commit") return { kind: "proposal" };
      const after = this.memberList(result.newState);
      const was = new Set(before.map((m) => m.deviceId));
      const now = new Set(after.map((m) => m.deviceId));
      return {
        kind: "commit",
        epoch: result.newState.groupContext.epoch,
        added: [...now].filter((d) => !was.has(d)),
        removed: [...was].filter((d) => !now.has(d)),
      };
    });
  }

  async epoch(group: GroupId): Promise<bigint | null> {
    return this.run(async () => (await this.loadGroup(group))?.groupContext.epoch ?? null);
  }

  members(group: GroupId): Promise<{ userId: string; deviceId: DeviceId }[]> {
    return this.run(async () =>
      this.memberList(await this.requireGroup(group)).map((m) => ({
        userId: m.userId,
        deviceId: m.deviceId,
      })),
    );
  }

  // ---- messages

  encryptMessage(group: GroupId, payload: Bytes) {
    return this.run(async () => {
      const cs = await this.cs();
      const state = await this.requireGroup(group);
      const me = await this.requireIdentity();
      const frankingKey = cs.rng.randomBytes(FRANKING_KEY_BYTES);
      const commitment = frankingCommitment(frankingKey, payload, group, me.userId);
      const sent = await createApplicationMessage(state, packFrame(frankingKey, payload), cs);
      sent.consumed.forEach(zeroOutUint8Array);
      await this.saveGroup(group, sent.newState);
      return {
        ciphertext: encodeMlsMessage({
          privateMessage: sent.privateMessage,
          wireformat: "mls_private_message",
          version: "mls10",
        }),
        franking: { commitment },
        epoch: state.groupContext.epoch,
      };
    });
  }

  exportSecret(group: GroupId, label: string, context: Bytes, length: number): Promise<Bytes> {
    return this.run(async () => {
      const state = await this.requireGroup(group);
      return mlsExporter(state.keySchedule.exporterSecret, label, context, length, await this.cs());
    });
  }
}
