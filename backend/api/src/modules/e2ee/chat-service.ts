import { createHmac, timingSafeEqual } from "node:crypto";
import {
  E2EE_LIMITS,
  type EncryptedEnvelope,
  type EncryptedGroupState,
  type EncryptedInbox,
  type EncryptedSent,
  Permission,
  type ReportReason,
} from "@realm/contracts";
import { and, asc, eq, inArray, isNotNull, isNull, schema, sql } from "@realm/db";
import { equalBytes, frankingCommitment } from "@realm/e2ee";
import { Limits } from "@realm/server-core";
import type { Deps } from "../../deps";
import { AppError, badRequest, conflict, notFound, rateLimited } from "../../lib/errors";
import type { ResolvedSession } from "../../lib/sessions";
import type { ConversationsService } from "../dms/service";
import { roomAccess } from "../spaces/access";
import type { E2eeService } from "./service";

const {
  channelRecipients,
  channels,
  devices,
  e2eeDeliveries,
  e2eeGroupDevices,
  e2eeGroups,
  e2eeMessages,
  reports,
} = schema;

const bytes = (b64: string) => new Uint8Array(Buffer.from(b64, "base64url"));
const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64url");
const INBOX_PAGE = 100;

const stale = () =>
  conflict("EPOCH_STALE", "This chat's keys changed. Catch up on new messages, then try again.");

/**
 * Encrypted chats, the server's part (docs/E2EE.md §7, §12, §17): it orders ciphertext, queues it
 * for each device, and signs the sender's franking commitment. It never has a key and never sees
 * text, who wrote a message isn't kept on its row, and rows are deleted once every device has
 * fetched them. Off unless REALM_E2EE_DMS is on (the prototype engine isn't audited yet).
 */
export class E2eeChatService {
  private readonly frankingSecret: Buffer;

  constructor(
    private readonly deps: Deps,
    private readonly e2ee: E2eeService,
    private readonly dms: ConversationsService,
  ) {
    // A key of its own, derived from the server secret, used for nothing else.
    this.frankingSecret = createHmac("sha256", deps.config.REALM_SECRET)
      .update("realm-franking-signature-v1")
      .digest();
  }

  private get db() {
    return this.deps.db;
  }

  private requireOn() {
    if (this.deps.config.REALM_E2EE_DMS !== "on") throw notFound("Encrypted chats");
  }

  private async enforce(rule: (typeof Limits)[keyof typeof Limits], key: string) {
    const r = await this.deps.limiter.hit(rule, key);
    if (!r.allowed) throw rateLimited(r.resetSeconds);
  }

  /** The chat, if it's an encrypted one this person is in. */
  private async chat(channelId: bigint, userId: bigint) {
    const ctx = await roomAccess(this.db, channelId, userId);
    if (ctx.channel.encryption !== "mls" || !ctx.recipients) throw notFound("Conversation");
    return { channel: ctx.channel, recipients: ctx.recipients, permissions: ctx.permissions };
  }

  private canSend(permissions: bigint) {
    if ((permissions & Permission.SEND_MESSAGES) === 0n) {
      throw new AppError(403, "BLOCKED", "You can't send messages in this conversation.");
    }
  }

  private async activeDevices(channelId: bigint) {
    return this.db
      .select({ deviceId: e2eeGroupDevices.deviceId, userId: e2eeGroupDevices.userId })
      .from(e2eeGroupDevices)
      .innerJoin(devices, eq(devices.id, e2eeGroupDevices.deviceId))
      .where(
        and(
          eq(e2eeGroupDevices.channelId, channelId),
          isNull(e2eeGroupDevices.removedEpoch),
          eq(devices.status, "approved"),
        ),
      );
  }

  /** The devices to deliver to, after checking the caller's device is in the group. */
  private async others(channelId: bigint, deviceId: bigint) {
    const all = await this.activeDevices(channelId);
    if (!all.some((d) => d.deviceId === deviceId)) {
      throw new AppError(403, "FORBIDDEN", "This device isn't part of this chat.");
    }
    return all.filter((d) => d.deviceId !== deviceId);
  }

  /** Tells people's live connections something is waiting. Says nothing about what. */
  private async nudge(channelId: bigint, userIds: bigint[]) {
    const data = { channelId: channelId.toString() };
    for (const id of new Set(userIds)) {
      await this.deps.bus.publish(`user:${id}`, { type: "E2EE_PENDING", data });
    }
  }

  private sign(channelId: bigint, submitterId: string, messageId: string, commitment: Uint8Array) {
    return createHmac("sha256", this.frankingSecret)
      .update(
        `REALM-FRANK-SIG-V1\nchannel:${channelId}\nsubmitter:${submitterId}\nmessage:${messageId}\n`,
      )
      .update(commitment)
      .digest();
  }

  /** Opens, or finds, the encrypted DM with someone. The same who-can-message rules as any DM. */
  async open(auth: ResolvedSession, recipientId: string): Promise<EncryptedGroupState> {
    this.requireOn();
    await this.e2ee.approvedCaller(auth);
    await this.enforce(Limits.e2eeOpen, auth.userId.toString());
    const conversation = await this.dms.open(auth.userId, { recipientIds: [recipientId] }, "mls");
    return this.state(auth, BigInt(conversation.id));
  }

  async state(auth: ResolvedSession, channelId: bigint): Promise<EncryptedGroupState> {
    this.requireOn();
    await this.chat(channelId, auth.userId);
    const [group] = await this.db
      .select({ epoch: e2eeGroups.epoch })
      .from(e2eeGroups)
      .where(eq(e2eeGroups.channelId, channelId))
      .limit(1);
    const list = group ? await this.activeDevices(channelId) : [];
    return {
      channelId: channelId.toString(),
      epoch: group?.epoch ?? null,
      devices: list.map((d) => ({ userId: d.userId.toString(), deviceId: d.deviceId.toString() })),
    };
  }

  /** The creator sets the group up: one welcome per device it added. First one in wins. */
  async init(
    auth: ResolvedSession,
    channelId: bigint,
    welcomes: { deviceId: string; welcome: string }[],
  ): Promise<void> {
    this.requireOn();
    const me = await this.e2ee.approvedCaller(auth);
    await this.enforce(Limits.e2eeCommit, me.id.toString());
    const { recipients, permissions } = await this.chat(channelId, auth.userId);
    this.canSend(permissions);

    const ids = welcomes.map((w) => BigInt(w.deviceId));
    if (new Set(ids).size !== ids.length || ids.includes(me.id)) {
      throw badRequest("BAD_REQUEST", "Each device gets one welcome, and not this device.");
    }
    const targets = await this.db
      .select({ id: devices.id, userId: devices.userId })
      .from(devices)
      .where(and(inArray(devices.id, ids), eq(devices.status, "approved")));
    if (targets.length !== ids.length || targets.some((d) => !recipients.includes(d.userId))) {
      throw badRequest("BAD_REQUEST", "A welcome is for a device that isn't in this chat.");
    }
    if (recipients.some((r) => r !== auth.userId && !targets.some((d) => d.userId === r))) {
      throw badRequest("BAD_REQUEST", "Everyone in the chat needs at least one device in it.");
    }

    await this.db.transaction(async (tx) => {
      const made = await tx
        .insert(e2eeGroups)
        .values({ channelId, epoch: 1 })
        .onConflictDoNothing()
        .returning({ channelId: e2eeGroups.channelId });
      if (made.length === 0) throw conflict("CONFLICT", "This chat is already set up.");
      await tx
        .insert(e2eeGroupDevices)
        .values([
          { channelId, deviceId: me.id, userId: auth.userId, addedEpoch: 1 },
          ...targets.map((d) => ({ channelId, deviceId: d.id, userId: d.userId, addedEpoch: 1 })),
        ]);
      for (const w of welcomes) {
        const id = this.deps.ids.next();
        await tx
          .insert(e2eeMessages)
          .values({ id, channelId, epoch: 1, kind: "welcome", ciphertext: bytes(w.welcome) });
        await tx.insert(e2eeDeliveries).values({ messageId: id, deviceId: BigInt(w.deviceId) });
      }
    });
    await this.nudge(
      channelId,
      targets.map((d) => d.userId),
    );
  }

  async send(
    auth: ResolvedSession,
    channelId: bigint,
    body: { epoch: number; ciphertext: string; frankingCommitment: string },
  ): Promise<EncryptedSent> {
    this.requireOn();
    const me = await this.e2ee.approvedCaller(auth);
    await this.enforce(Limits.e2eeSend, me.id.toString());
    const { permissions } = await this.chat(channelId, auth.userId);
    this.canSend(permissions);
    const to = await this.others(channelId, me.id);

    const id = this.deps.ids.next();
    const commitment = bytes(body.frankingCommitment);
    const signature = this.sign(channelId, auth.userId.toString(), id.toString(), commitment);
    const createdAt = new Date();
    await this.db.transaction(async (tx) => {
      // Locked so a key change can't slip in between the check and the insert.
      const [group] = await tx
        .select({ epoch: e2eeGroups.epoch })
        .from(e2eeGroups)
        .where(eq(e2eeGroups.channelId, channelId))
        .for("update");
      if (!group || group.epoch !== body.epoch) throw stale();
      await tx.insert(e2eeMessages).values({
        id,
        channelId,
        epoch: body.epoch,
        kind: "application",
        ciphertext: bytes(body.ciphertext),
        frankingCommitment: commitment,
        serverSignature: signature,
        createdAt,
      });
      if (to.length > 0) {
        await tx
          .insert(e2eeDeliveries)
          .values(to.map((d) => ({ messageId: id, deviceId: d.deviceId })));
      }
      await tx.update(channels).set({ updatedAt: createdAt }).where(eq(channels.id, channelId));
      // A conversation someone closed comes back to their list when something new is said.
      await tx
        .update(channelRecipients)
        .set({ closedAt: null })
        .where(
          and(eq(channelRecipients.channelId, channelId), isNotNull(channelRecipients.closedAt)),
        );
    });
    await this.nudge(
      channelId,
      to.map((d) => d.userId),
    );
    return {
      id: id.toString(),
      serverSignature: b64(signature),
      createdAt: createdAt.toISOString(),
    };
  }

  /** A key change. Only the first one made in an epoch is accepted; the rest catch up and retry. */
  async commit(
    auth: ResolvedSession,
    channelId: bigint,
    body: { epoch: number; commit: string },
  ): Promise<EncryptedSent> {
    this.requireOn();
    const me = await this.e2ee.approvedCaller(auth);
    await this.enforce(Limits.e2eeCommit, me.id.toString());
    await this.chat(channelId, auth.userId);
    const to = await this.others(channelId, me.id);

    const id = this.deps.ids.next();
    const createdAt = new Date();
    await this.db.transaction(async (tx) => {
      const moved = await tx
        .update(e2eeGroups)
        .set({ epoch: sql`${e2eeGroups.epoch} + 1`, updatedAt: createdAt })
        .where(and(eq(e2eeGroups.channelId, channelId), eq(e2eeGroups.epoch, body.epoch)))
        .returning({ epoch: e2eeGroups.epoch });
      if (moved.length === 0) throw stale();
      await tx.insert(e2eeMessages).values({
        id,
        channelId,
        epoch: body.epoch,
        kind: "commit",
        ciphertext: bytes(body.commit),
        createdAt,
      });
      if (to.length > 0) {
        await tx
          .insert(e2eeDeliveries)
          .values(to.map((d) => ({ messageId: id, deviceId: d.deviceId })));
      }
    });
    await this.nudge(
      channelId,
      to.map((d) => d.userId),
    );
    return { id: id.toString(), serverSignature: null, createdAt: createdAt.toISOString() };
  }

  /** What's waiting for this device, oldest first. */
  async inbox(auth: ResolvedSession): Promise<EncryptedInbox> {
    this.requireOn();
    const me = await this.e2ee.approvedCaller(auth);
    const rows = await this.db
      .select({ m: e2eeMessages })
      .from(e2eeDeliveries)
      .innerJoin(e2eeMessages, eq(e2eeMessages.id, e2eeDeliveries.messageId))
      .where(eq(e2eeDeliveries.deviceId, me.id))
      .orderBy(asc(e2eeDeliveries.messageId))
      .limit(INBOX_PAGE + 1);
    const messages: EncryptedEnvelope[] = rows.slice(0, INBOX_PAGE).map(({ m }) => ({
      id: m.id.toString(),
      channelId: m.channelId.toString(),
      kind: m.kind,
      epoch: m.epoch,
      ciphertext: b64(m.ciphertext),
      frankingCommitment: m.frankingCommitment ? b64(m.frankingCommitment) : null,
      serverSignature: m.serverSignature ? b64(m.serverSignature) : null,
      createdAt: m.createdAt.toISOString(),
    }));
    return { messages, more: rows.length > INBOX_PAGE };
  }

  /** This device has them now. Ciphertext nobody is waiting for any more is deleted. */
  async ack(auth: ResolvedSession, ids: string[]): Promise<void> {
    this.requireOn();
    const me = await this.e2ee.approvedCaller(auth);
    const list = ids.map(BigInt);
    await this.db.transaction(async (tx) => {
      const done = await tx
        .delete(e2eeDeliveries)
        .where(and(eq(e2eeDeliveries.deviceId, me.id), inArray(e2eeDeliveries.messageId, list)))
        .returning({ id: e2eeDeliveries.messageId });
      if (done.length === 0) return;
      await tx.delete(e2eeMessages).where(
        and(
          inArray(
            e2eeMessages.id,
            done.map((d) => d.id),
          ),
          sql`not exists (select 1 from e2ee_deliveries d where d.message_id = ${e2eeMessages.id})`,
        ),
      );
    });
  }

  /**
   * A proven report (§17). The reporter reveals one message and its franking key. The server's
   * own signature shows that sender submitted that commitment here, and the commitment shows it
   * was for exactly this text. Nothing else in the chat is revealed.
   */
  async report(
    auth: ResolvedSession,
    channelId: bigint,
    body: {
      messageId: string;
      senderUserId: string;
      payload: string;
      frankingKey: string;
      frankingCommitment: string;
      serverSignature: string;
      reason: ReportReason;
      details?: string;
    },
  ): Promise<void> {
    this.requireOn();
    await this.enforce(Limits.e2eeReport, auth.userId.toString());
    const { recipients } = await this.chat(channelId, auth.userId);
    const sender = BigInt(body.senderUserId);
    if (sender === auth.userId || !recipients.includes(sender)) {
      throw badRequest("BAD_REQUEST", "Report a message someone else sent in this chat.");
    }
    const commitment = bytes(body.frankingCommitment);
    const payload = bytes(body.payload);
    const expected = this.sign(channelId, body.senderUserId, body.messageId, commitment);
    const given = Buffer.from(body.serverSignature, "base64url");
    const proven =
      given.length === expected.length &&
      timingSafeEqual(given, expected) &&
      equalBytes(
        frankingCommitment(
          bytes(body.frankingKey),
          payload,
          channelId.toString(),
          body.senderUserId,
        ),
        commitment,
      );
    if (!proven) {
      throw badRequest("SIGNATURE_INVALID", "That message couldn't be proven, so it wasn't sent.");
    }
    await this.db
      .insert(reports)
      .values({
        id: this.deps.ids.next(),
        reporterId: auth.userId,
        targetType: "message",
        targetId: BigInt(body.messageId),
        communityId: null,
        reason: body.reason,
        details: body.details || null,
        evidence: {
          encrypted: true,
          verified: true,
          channelId: channelId.toString(),
          authorId: body.senderUserId,
          // The message as the reporter's device decrypted it (Realm's message JSON).
          content: Buffer.from(payload).toString("utf8").slice(0, E2EE_LIMITS.reportTextChars),
        },
      })
      .onConflictDoNothing();
  }
}
