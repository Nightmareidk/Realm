import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createdAt, id, tstz } from "./_columns";
import { channels } from "./communities";
import { bytea } from "./messages";
import { platform, users } from "./users";

/**
 * End-to-end encryption, the server's side (docs/E2EE.md §18). Only PUBLIC keys, signatures and
 * one-time public bundles live here. Private keys, group secrets and message text never do.
 */

/** The key that signs a person's devices. A new version only when they lose every device. */
export const accountIdentityKeys = pgTable(
  "account_identity_keys",
  {
    userId: id()
      .notNull()
      .references(() => users.id),
    version: integer().notNull(),
    publicKey: bytea().notNull(),
    createdAt: createdAt(),
    /** Set when a newer version replaced it: contacts are told the security code changed. */
    supersededAt: tstz(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.version] })],
);

export const deviceStatus = pgEnum("device_status", ["pending", "approved", "revoked"]);

/** One per app install or browser: each is its own member of every encrypted chat. */
export const devices = pgTable(
  "devices",
  {
    id: id().primaryKey(),
    userId: id()
      .notNull()
      .references(() => users.id),
    status: deviceStatus().notNull().default("pending"),
    platform: platform().notNull(),
    name: text().notNull(),
    /** The device's Ed25519 public key (its MLS credential key). */
    signatureKey: bytea().notNull(),
    /** The certificate: the account key (this version) signed this device at this time. */
    accountKeyVersion: integer(),
    certIssuedAt: tstz(),
    certSignature: bytea(),
    createdAt: createdAt(),
    approvedAt: tstz(),
    revokedAt: tstz(),
    lastSeenAt: tstz().notNull().defaultNow(),
  },
  (t) => [
    index("devices_user_idx").on(t.userId, t.status),
    uniqueIndex("devices_signature_key_key").on(t.signatureKey),
  ],
);

export const revocationReason = pgEnum("revocation_reason", ["device", "password", "key_reset"]);

/** Why and how a device stopped being trusted. Signed when another device of theirs did it. */
export const deviceRevocations = pgTable("device_revocations", {
  deviceId: id()
    .primaryKey()
    .references(() => devices.id),
  userId: id()
    .notNull()
    .references(() => users.id),
  reason: revocationReason().notNull(),
  revokedAt: tstz().notNull(),
  /** The account key's signature over the revocation, when an approved device sent it. */
  signature: bytea(),
  createdAt: createdAt(),
});

/** MLS KeyPackages: public, single-use bundles that let others add a device while it's offline. */
export const keyPackages = pgTable(
  "key_packages",
  {
    id: id().primaryKey(),
    deviceId: id()
      .notNull()
      .references(() => devices.id),
    keyPackage: bytea().notNull(),
    createdAt: createdAt(),
    claimedAt: tstz(),
    claimedBy: id(),
  },
  (t) => [index("key_packages_device_idx").on(t.deviceId, t.claimedAt, t.id)],
);

/** One per encrypted chat (a channel with encryption = 'mls'). No keys: only where the group is. */
export const e2eeGroups = pgTable("e2ee_groups", {
  channelId: id()
    .primaryKey()
    .references(() => channels.id),
  /** The MLS epoch the server has accepted. A change made in an older epoch is refused. */
  epoch: integer().notNull(),
  createdAt: createdAt(),
  updatedAt: tstz().notNull().defaultNow(),
});

/** Which devices are in an encrypted chat: who gets its ciphertext. */
export const e2eeGroupDevices = pgTable(
  "e2ee_group_devices",
  {
    channelId: id()
      .notNull()
      .references(() => channels.id),
    deviceId: id()
      .notNull()
      .references(() => devices.id),
    userId: id()
      .notNull()
      .references(() => users.id),
    addedEpoch: integer().notNull(),
    removedEpoch: integer(),
  },
  (t) => [
    primaryKey({ columns: [t.channelId, t.deviceId] }),
    index("e2ee_group_devices_device_idx").on(t.deviceId),
  ],
);

export const e2eeMessageKind = pgEnum("e2ee_message_kind", ["welcome", "commit", "application"]);

/**
 * Ciphertext waiting to be fetched. The id is the server's order. There is NO author and NO
 * plaintext: the sender is inside the ciphertext (§12.1). Rows go once every device has fetched.
 */
export const e2eeMessages = pgTable(
  "e2ee_messages",
  {
    id: id().primaryKey(),
    channelId: id()
      .notNull()
      .references(() => channels.id),
    epoch: integer().notNull(),
    kind: e2eeMessageKind().notNull(),
    ciphertext: bytea().notNull(),
    /** Franking (§17): the sender's commitment and the server's signature over it. */
    frankingCommitment: bytea(),
    serverSignature: bytea(),
    createdAt: createdAt(),
  },
  (t) => [index("e2ee_messages_channel_idx").on(t.channelId, t.id)],
);

/** The delivery queue: one row per device still to fetch a message. Deleted when it has. */
export const e2eeDeliveries = pgTable(
  "e2ee_deliveries",
  {
    messageId: id()
      .notNull()
      .references(() => e2eeMessages.id, { onDelete: "cascade" }),
    deviceId: id()
      .notNull()
      .references(() => devices.id),
  },
  (t) => [primaryKey({ columns: [t.deviceId, t.messageId] })],
);
