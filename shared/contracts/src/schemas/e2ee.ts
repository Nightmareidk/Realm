import { z } from "zod";
import { Snowflake } from "../ids";
import { ConfirmWithPassword } from "./account";
import { IsoDateTime } from "./common";
import { ReportReason } from "./safety";

/**
 * End-to-end encryption, the server side of it (docs/E2EE.md). Everything here is public: keys,
 * signatures and one-time bundles. Keys and signatures travel as unpadded base64url.
 */

const b64url = (chars: number, what: string) =>
  z.string().regex(new RegExp(`^[A-Za-z0-9_-]{${chars}}$`), `Invalid ${what}`);

/** An Ed25519 public key: 32 bytes. */
export const PublicKey32 = b64url(43, "key").meta({ id: "PublicKey32" });
/** An Ed25519 signature: 64 bytes. */
export const Signature64 = b64url(86, "signature").meta({ id: "Signature64" });
/** Unix milliseconds. */
const UnixMs = z.number().int().positive();

/** An MLS KeyPackage. Size-capped so nobody can park large blobs on the server. */
export const KeyPackageBlob = z
  .string()
  .regex(/^[A-Za-z0-9_-]{100,4096}$/, "Invalid key package")
  .meta({ id: "KeyPackageBlob" });

export const E2EE_LIMITS = {
  /** Devices that aren't revoked, per account. */
  devices: 20,
  /** KeyPackages per upload, and unclaimed ones a device may hold. */
  keyPackagesPerUpload: 100,
  keyPackagesHeld: 200,
  /** People per KeyPackage claim (a group chat's size today). */
  claimUsers: 25,
  /** How far a signed time may be from the server's clock. */
  clockSkewMs: 10 * 60 * 1000,
  /** How much of a reported encrypted message is kept as evidence. */
  reportTextChars: 4000,
} as const;

export const RegisterDeviceBody = z.object({ signatureKey: PublicKey32 });
export const SetAccountKeyBody = z.object({ publicKey: PublicKey32 });
export const ResetAccountKeyBody = ConfirmWithPassword.extend({ publicKey: PublicKey32 });

/** The certificate's signature. The server rebuilds the signed text from its own records. */
export const ApproveDeviceBody = z.object({ issuedAt: UnixMs, signature: Signature64 });

/** Signing in again on a device that has its key: the device's own signature proves it. */
export const ResumeDeviceBody = z.object({ at: UnixMs, signature: Signature64 });

/** From another approved device (signed), or with the password when none is left. */
export const RevokeDeviceBody = z.union([
  z.object({ revokedAt: UnixMs, signature: Signature64 }),
  ConfirmWithPassword,
]);

export const UploadKeyPackagesBody = z.object({
  keyPackages: z.array(KeyPackageBlob).min(1).max(E2EE_LIMITS.keyPackagesPerUpload),
});
export const ClaimKeyPackagesBody = z.object({
  userIds: z.array(Snowflake).min(1).max(E2EE_LIMITS.claimUsers),
});

export const DeviceStatus = z.enum(["pending", "approved", "revoked"]);

/** One of your own devices, for Settings › Devices. */
export const OwnDevice = z
  .object({
    id: Snowflake,
    status: DeviceStatus,
    platform: z.string(),
    name: z.string(),
    signatureKey: PublicKey32,
    current: z.boolean(),
    createdAt: IsoDateTime,
    approvedAt: IsoDateTime.nullable(),
    revokedAt: IsoDateTime.nullable(),
    lastSeenAt: IsoDateTime,
  })
  .meta({ id: "OwnDevice" });
export type OwnDevice = z.infer<typeof OwnDevice>;

export const OwnDevices = z.object({
  /** Your account identity key's version, or null before your first device sets it. */
  accountKeyVersion: z.number().int().nullable(),
  devices: z.array(OwnDevice),
});

/**
 * What anyone may fetch about a person before an encrypted chat: their account key and approved
 * devices, each with the certificate to check. No names or platforms (less to leak).
 */
export const PublicDevice = z
  .object({
    id: Snowflake,
    signatureKey: PublicKey32,
    accountKeyVersion: z.number().int(),
    issuedAt: UnixMs,
    signature: Signature64,
  })
  .meta({ id: "PublicDevice" });

export const PublicDevices = z
  .object({
    userId: Snowflake,
    accountKey: z.object({ version: z.number().int(), publicKey: PublicKey32 }).nullable(),
    devices: z.array(PublicDevice),
  })
  .meta({ id: "PublicDevices" });
export type PublicDevices = z.infer<typeof PublicDevices>;

export const ClaimedKeyPackages = z.object({
  packages: z.array(
    z.object({ userId: Snowflake, deviceId: Snowflake, keyPackage: KeyPackageBlob }),
  ),
  /** Approved devices with none left: they can't be added until they upload more. */
  missing: z.array(z.object({ userId: Snowflake, deviceId: Snowflake })),
});
export type ClaimedKeyPackages = z.infer<typeof ClaimedKeyPackages>;

// ---- Encrypted chats (phase 2): the server only ever carries ciphertext.

/** An MLS message, welcome or commit. Opaque to the server, and size-capped. */
export const CiphertextBlob = z
  .string()
  .regex(/^[A-Za-z0-9_-]{50,60000}$/, "Invalid ciphertext")
  .meta({ id: "CiphertextBlob" });
/** 32 bytes: a franking commitment, a franking key, or the server's signature. */
export const Bytes32 = b64url(43, "value").meta({ id: "Bytes32" });
const Epoch = z.number().int().min(0).max(2_000_000_000);

export const OpenEncryptedDmBody = z.object({ recipientId: Snowflake });

/** The creator's first step: one welcome per device they added. */
export const InitEncryptedGroupBody = z.object({
  welcomes: z
    .array(z.object({ deviceId: Snowflake, welcome: CiphertextBlob }))
    .min(1)
    .max(E2EE_LIMITS.devices * 2),
});

export const SendEncryptedBody = z.object({
  /** The epoch it was encrypted in. Refused if the chat has moved on. */
  epoch: Epoch,
  ciphertext: CiphertextBlob,
  frankingCommitment: Bytes32,
});

export const CommitEncryptedBody = z.object({ epoch: Epoch, commit: CiphertextBlob });

export const EncryptedKind = z.enum(["welcome", "commit", "application"]);

/** One thing waiting for this device. Who wrote it is inside the ciphertext, not here. */
export const EncryptedEnvelope = z
  .object({
    id: Snowflake,
    channelId: Snowflake,
    kind: EncryptedKind,
    epoch: z.number().int(),
    ciphertext: CiphertextBlob,
    frankingCommitment: Bytes32.nullable(),
    serverSignature: Bytes32.nullable(),
    createdAt: IsoDateTime,
  })
  .meta({ id: "EncryptedEnvelope" });
export type EncryptedEnvelope = z.infer<typeof EncryptedEnvelope>;

export const EncryptedInbox = z.object({
  messages: z.array(EncryptedEnvelope),
  /** More are waiting: acknowledge these, then ask again. */
  more: z.boolean(),
});
export type EncryptedInbox = z.infer<typeof EncryptedInbox>;

export const AckEncryptedBody = z.object({ ids: z.array(Snowflake).min(1).max(200) });

export const EncryptedSent = z.object({
  id: Snowflake,
  serverSignature: Bytes32.nullable(),
  createdAt: IsoDateTime,
});
export type EncryptedSent = z.infer<typeof EncryptedSent>;

/** Where an encrypted chat stands on the server: no group yet (null epoch), or its epoch. */
export const EncryptedGroupState = z
  .object({
    channelId: Snowflake,
    epoch: z.number().int().nullable(),
    devices: z.array(z.object({ userId: Snowflake, deviceId: Snowflake })),
  })
  .meta({ id: "EncryptedGroupState" });
export type EncryptedGroupState = z.infer<typeof EncryptedGroupState>;

/**
 * Reporting an encrypted message: the reporter reveals this one message and its franking key.
 * The server checks its own signature and the sender's commitment, so the report is proven
 * without Realm being able to read anything else in the chat (docs/E2EE.md §17).
 */
export const ReportEncryptedBody = z.object({
  messageId: Snowflake,
  senderUserId: Snowflake,
  /** The decrypted message, exactly as the reporter's device got it. */
  payload: z.string().regex(/^[A-Za-z0-9_-]{1,22000}$/, "Invalid message"),
  frankingKey: Bytes32,
  frankingCommitment: Bytes32,
  serverSignature: Bytes32,
  reason: ReportReason,
  details: z.string().trim().max(1000).optional(),
});
