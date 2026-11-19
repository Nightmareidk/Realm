import type { Bytes } from "./bytes";

/**
 * The one door to end-to-end encryption (docs/E2EE.md §20). Chat screens, uploads and the API
 * client use only these interfaces, never an MLS library directly, so the engine can change from
 * the TypeScript prototype (ts-mls) to OpenMLS without rewriting the messaging code. Every engine
 * must pass the same conformance tests before it is used.
 *
 * Realm writes no cryptography here: engines wrap reviewed libraries (MLS, RFC 9420), and these
 * types only describe what goes in and out.
 */

export type DeviceId = string;
export type GroupId = string;

/** RFC 9420 ciphersuite 0x0001: X25519, AES-128-GCM, SHA-256, Ed25519. Realm's launch suite. */
export const LAUNCH_CIPHERSUITE = 0x0001;

/**
 * Secret storage on this device only: the OS keystore, or a non-extractable WebCrypto key in the
 * browser (§10). Nothing put here is ever sent to Realm's server.
 */
export interface KeyStore {
  get(name: string): Promise<Bytes | null>;
  put(name: string, value: Bytes): Promise<void>;
  delete(name: string): Promise<void>;
}

/** Another device's public bundle, fetched from the server and checked before use. */
export interface DeviceKeyPackage {
  userId: string;
  deviceId: DeviceId;
  keyPackage: Bytes;
}

/**
 * What a change to a group produces, for the caller to send through the server. The change is
 * PENDING on this device until the server accepts it: then call `commitAccepted`, or
 * `commitRejected` if someone else's change got there first (an epoch race, §8).
 */
export interface GroupChange {
  groupId: GroupId;
  /** The epoch this change was made in. The server refuses it if the group has moved on. */
  fromEpoch: bigint;
  /** The epoch the group is in once the change is accepted. */
  epoch: bigint;
  /** The MLS commit every current member must process. */
  commit: Bytes;
  /** One per added device, each readable only by that device. */
  welcomes: { deviceId: DeviceId; welcome: Bytes }[];
}

/** Proof that lets a reported message be checked without the server reading anything else (§17). */
export interface Franking {
  commitment: Bytes;
}

/** This device's signed place in its owner's account (§6.1), set once the device is approved. */
export interface DeviceIdentity {
  userId: string;
  deviceId: DeviceId;
  accountKeyVersion: number;
  /** When the certificate was signed, in Unix milliseconds. */
  issuedAt: number;
  /** The account identity key's signature over `deviceCertificateBytes`. */
  signature: Bytes;
}

export type Incoming =
  | {
      kind: "application";
      senderUserId: string;
      senderDeviceId: DeviceId;
      payload: Bytes;
      frankingKey: Bytes;
    }
  | { kind: "commit"; epoch: bigint; added: DeviceId[]; removed: DeviceId[] }
  | { kind: "proposal" };

export interface CryptoEngine {
  readonly engine: "ts-mls" | "openmls" | "test-only";
  readonly version: string;
  readonly ciphersuite: number;

  // Devices and identity (§6)
  /** Makes this device's signature key (once). Returns only its public half. */
  createDevice(): Promise<{ signatureKey: Bytes }>;
  /** First device only: makes the account identity key. Returns only its public half. */
  createAccountIdentity(): Promise<{ publicKey: Bytes }>;
  /** Signs bytes from `deviceCertificateBytes` or `deviceRevocationBytes` with the account key. */
  signWithAccountKey(message: Bytes): Promise<Bytes>;
  /** Signs bytes from `deviceResumeBytes` with this device's own key. */
  signWithDeviceKey(message: Bytes): Promise<Bytes>;
  /** Checks an account-key signature from someone else's certificate or revocation. */
  verifyAccountSignature(accountKey: Bytes, message: Bytes, signature: Bytes): Promise<boolean>;
  /** Stores this device's certificate once it is approved. Needed before any KeyPackage or group. */
  setIdentity(identity: DeviceIdentity): Promise<void>;
  identity(): Promise<DeviceIdentity | null>;
  generateKeyPackages(count: number): Promise<Bytes[]>;

  // Groups (a DM is a group of two people, §7, §8)
  /** `groupId` is the chat's channel id. Every member's certificate is checked first. */
  createGroup(groupId: GroupId, members: DeviceKeyPackage[]): Promise<GroupChange>;
  addMembers(group: GroupId, members: DeviceKeyPackage[]): Promise<GroupChange>;
  removeMembers(group: GroupId, devices: DeviceId[]): Promise<GroupChange>;
  /** A self-update commit: fresh keys for this device (forward secrecy, post-compromise security). */
  rotateKeys(group: GroupId): Promise<GroupChange>;
  /** The server took this device's pending change: it becomes the group's state. */
  commitAccepted(group: GroupId): Promise<void>;
  /** The server refused it: drop it. Process what's waiting, then try again. */
  commitRejected(group: GroupId): Promise<void>;
  joinFromWelcome(welcome: Bytes): Promise<GroupId>;
  /** Commits, proposals and messages arrive on one ordered stream per group. */
  processIncoming(group: GroupId, message: Bytes): Promise<Incoming>;
  /** The group's current epoch on this device, or null if it isn't in the group. */
  epoch(group: GroupId): Promise<bigint | null>;
  /** The devices in the group as this device sees it. */
  members(group: GroupId): Promise<{ userId: string; deviceId: DeviceId }[]>;

  // Messages
  encryptMessage(
    group: GroupId,
    payload: Bytes,
  ): Promise<{ ciphertext: Bytes; franking: Franking; epoch: bigint }>;
  /** MLS exporter secret, for call keys (§15). */
  exportSecret(group: GroupId, label: string, context: Bytes, length: number): Promise<Bytes>;
}

/** Files are not MLS: chunked AES-256-GCM from a reviewed library, padded before upload (§13). */
export interface AttachmentCipher {
  encrypt(plain: Bytes): Promise<{ blob: Bytes; key: Bytes; sha256: Bytes }>;
  decrypt(blob: Bytes, key: Bytes, sha256: Bytes): Promise<Bytes>;
}

/** The recovery key and Secure Backup (§11): Argon2id and AES-GCM from reviewed libraries. */
export interface RecoveryVault {
  createRecoveryKey(): Promise<{ words: string[]; wrappedBackupKey: Bytes }>;
  unwrapBackupKey(recovery: string[] | string, wrappedBackupKey: Bytes): Promise<Bytes>;
}
