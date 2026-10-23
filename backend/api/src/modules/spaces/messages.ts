import {
  type CreateMessageBody,
  canStillEdit,
  has,
  isMinor,
  Limits,
  MESSAGE_UNSEND_WINDOW_MS,
  type MediaRef,
  type Message,
  type MessagePage,
  type OpenedPhoto,
  Permission,
  type ReadState,
  VIEW_ONCE_SECONDS,
} from "@realm/contracts";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, ne, schema, sql } from "@realm/db";
import type { Deps } from "../../deps";
import { AppError, badRequest, forbidden, notFound } from "../../lib/errors";
import { noScanner } from "../../lib/scanner";
import {
  MESSAGE_HIDDEN,
  toMediaRef,
  toMessage,
  summaryColumns as userColumns,
} from "../../lib/serialize-spaces";
import { guardMessage } from "../../lib/spam";
import { MediaService } from "../media/service";
import { missingPermission, type RoomContext, roomAccess, topicOf } from "./access";
import { automodBlocks } from "./sparks";

const {
  messages,
  users,
  channels,
  readStates,
  messageAttachments,
  media,
  messageReactions,
  channelRecipients,
  userSettings,
  messageViews,
  messageHides,
} = schema;

/** At most this many different emoji on one message, and pinned messages in one room. */
export const MAX_REACTION_KINDS = 20;
export const MAX_PINS = 25;

const graphemes = new Intl.Segmenter("en", { granularity: "grapheme" });
/** One emoji (with its skin tone or flag parts), and nothing else. */
export function isOneEmoji(text: string): boolean {
  if (text.length === 0 || text.length > 32 || /\s/.test(text)) return false;
  if ([...graphemes.segment(text)].length !== 1) return false;
  return /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u.test(text);
}

type MessageRow = typeof messages.$inferSelect;

/**
 * Chat in Space rooms, DMs and group chats. Writes happen here and only here; the gateway just
 * carries the news. Messages are readable by Realm's servers (rooms are never end-to-end
 * encrypted; DMs aren't yet, and say so).
 */
export class MessagesService {
  private readonly media: MediaService;

  constructor(private readonly deps: Deps) {
    this.media = new MediaService(deps);
  }

  private get db() {
    return this.deps.db;
  }

  /**
   * Rows → messages, with their authors, files and the messages they reply to. `reveal` shows a
   * message hidden after reports (for the Space's moderators).
   */
  async hydrate(rows: MessageRow[], reveal = false, viewerId?: bigint): Promise<Message[]> {
    if (rows.length === 0) return [];
    const reactionRows = await this.db
      .select({
        messageId: messageReactions.messageId,
        emoji: messageReactions.emoji,
        count: sql<number>`count(*)::int`,
        me: viewerId
          ? sql<boolean>`bool_or(${messageReactions.userId} = ${viewerId})`
          : sql<boolean>`false`,
        first: sql<string>`min(${messageReactions.createdAt})`,
      })
      .from(messageReactions)
      .where(
        inArray(
          messageReactions.messageId,
          rows.map((r) => r.id),
        ),
      )
      .groupBy(messageReactions.messageId, messageReactions.emoji)
      .orderBy(sql`min(${messageReactions.createdAt})`);
    const reactionsFor = new Map<bigint, Message["reactions"]>();
    for (const r of reactionRows) {
      reactionsFor.set(r.messageId, [
        ...(reactionsFor.get(r.messageId) ?? []),
        { emoji: r.emoji, count: r.count, me: Boolean(r.me) },
      ]);
    }
    const replyIds = [...new Set(rows.flatMap((r) => (r.replyToId ? [r.replyToId] : [])))];
    const replies = replyIds.length
      ? await this.db.select().from(messages).where(inArray(messages.id, replyIds))
      : [];
    const authorIds = [...new Set([...rows, ...replies].map((r) => r.authorId))];
    const authors = await this.db
      .select(userColumns)
      .from(users)
      .where(inArray(users.id, authorIds));
    const files = await this.db
      .select({ messageId: messageAttachments.messageId, file: media })
      .from(messageAttachments)
      .innerJoin(media, eq(media.id, messageAttachments.mediaId))
      .where(
        inArray(
          messageAttachments.messageId,
          rows.map((r) => r.id),
        ),
      )
      .orderBy(asc(messageAttachments.position));
    const filesFor = new Map<bigint, MediaRef[]>();
    for (const f of files) {
      filesFor.set(f.messageId, [...(filesFor.get(f.messageId) ?? []), toMediaRef(f.file)]);
    }
    const byId = new Map(authors.map((a) => [a.id, a]));
    const replyById = new Map(replies.map((r) => [r.id, r]));
    const limited = rows.filter((r) => r.viewLimit).map((r) => r.id);
    const viewsOf = limited.length
      ? await this.db.select().from(messageViews).where(inArray(messageViews.messageId, limited))
      : [];
    return rows.flatMap((r) => {
      const author = byId.get(r.authorId);
      if (!author) return [];
      const reply = r.replyToId ? replyById.get(r.replyToId) : undefined;
      const replyAuthor = reply ? byId.get(reply.authorId) : undefined;
      const message = toMessage(
        r,
        author,
        reply && replyAuthor ? { row: reply, author: replyAuthor } : null,
        { attachments: filesFor.get(r.id) ?? [], reveal },
      );
      message.reactions = reactionsFor.get(r.id) ?? [];
      if (r.viewLimit) {
        // Its photos come without links: opening one asks for it, and uses up a view.
        message.attachments = message.attachments.map((a) => ({ ...a, url: "" }));
        const views = viewsOf.filter((v) => v.messageId === r.id);
        message.opened = views.some((v) => v.count > 0);
        if (viewerId && viewerId !== r.authorId) {
          const mine = views.find((v) => v.userId === viewerId)?.count ?? 0;
          message.viewsLeft = Math.max(0, r.viewLimit - mine);
        }
      }
      return [message];
    });
  }

  async list(
    channelId: bigint,
    userId: bigint,
    q: { before?: string; after?: string; limit: number },
  ): Promise<MessagePage> {
    const { channel, permissions } = await roomAccess(this.db, channelId, userId);
    if (!has(permissions, Permission.READ_MESSAGE_HISTORY)) {
      return { messages: [] };
    }
    const rows = await this.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.channelId, channel.id),
          isNull(messages.deletedAt),
          // Not the ones you deleted for yourself.
          sql`not exists (select 1 from ${messageHides} where ${messageHides.userId} = ${userId} and ${messageHides.messageId} = ${messages.id})`,
          q.before ? lt(messages.id, BigInt(q.before)) : undefined,
          q.after ? gt(messages.id, BigInt(q.after)) : undefined,
        ),
      )
      .orderBy(q.after ? asc(messages.id) : desc(messages.id))
      .limit(q.limit);
    if (q.after) rows.reverse();
    return {
      messages: await this.hydrate(rows, has(permissions, Permission.MANAGE_MESSAGES), userId),
    };
  }

  async create(channelId: bigint, userId: bigint, body: CreateMessageBody): Promise<Message> {
    const ctx = await roomAccess(this.db, channelId, userId);
    const { channel, access, permissions } = ctx;
    if (channel.type !== "text" && channel.type !== "dm" && channel.type !== "group_dm") {
      throw badRequest("BAD_REQUEST", "You can't chat in this room.");
    }
    if (!has(permissions, Permission.SEND_MESSAGES)) {
      if (channel.type === "dm") {
        throw new AppError(403, "BLOCKED", "You can't send messages in this conversation.");
      }
      const timedOut = access?.member?.timeoutUntil && access.member.timeoutUntil > new Date();
      if (timedOut) {
        throw new AppError(
          403,
          "MISSING_PERMISSION",
          `You're timed out here until ${access?.member?.timeoutUntil?.toISOString()}.`,
        );
      }
      throw missingPermission("send messages");
    }
    const [author] = await this.db
      .select({
        id: users.id,
        createdAt: users.createdAt,
        emailVerifiedAt: users.emailVerifiedAt,
        birthDate: users.birthDate,
      })
      .from(users)
      .where(eq(users.id, userId));
    if (!author) throw notFound("User");
    const content = body.content.trim();
    await guardMessage(this.deps, author, content);

    // A Space's AutoMod: its blocked words, links, invites and waits for new accounts and members.
    if (access && !has(permissions, Permission.MANAGE_MESSAGES)) {
      const why = automodBlocks(
        access.community.automod,
        content,
        author,
        access.member?.joinedAt ?? null,
      );
      if (why) throw new AppError(403, "AUTOMOD", why);
    }

    // Slow mode: one message per wait, except for people who look after the room.
    if (
      channel.slowmodeSeconds > 0 &&
      !has(permissions, Permission.MANAGE_MESSAGES) &&
      !has(permissions, Permission.MANAGE_CHANNELS)
    ) {
      const hit = await this.deps.kv.incr(`slow:${channel.id}:${userId}`, channel.slowmodeSeconds);
      if (hit.count > 1) {
        throw new AppError(
          429,
          "SLOWMODE",
          `Slow mode is on here. You can send again in ${Math.max(1, hit.ttlSeconds)}s.`,
          { retryAfter: Math.max(1, hit.ttlSeconds) },
          Math.max(1, hit.ttlSeconds),
        );
      }
    }

    if (body.attachmentIds.length > 0 && !has(permissions, Permission.ATTACH_FILES)) {
      throw missingPermission("send files");
    }

    // A message request: until the other person accepts, it's words only (no photos, files or
    // places nobody asked for). Replying to a request accepts it.
    let accepting = false;
    if (channel.type === "dm") {
      const waiting = await this.db
        .select({ userId: channelRecipients.userId })
        .from(channelRecipients)
        .where(
          and(
            eq(channelRecipients.channelId, channel.id),
            isNotNull(channelRecipients.requestedAt),
          ),
        );
      accepting = waiting.some((w) => w.userId === userId);
      const theyWait = waiting.some((w) => w.userId !== userId);
      if (theyWait && (body.attachmentIds.length > 0 || body.place)) {
        throw new AppError(
          403,
          "DM_REQUEST_PENDING",
          "Photos, videos, files and places can be sent once they accept your message request.",
        );
      }
    }
    const files = await this.media.attachable(userId, body.attachmentIds.map(BigInt));
    if (body.viewLimit) {
      if (!ctx.recipients) {
        throw badRequest("BAD_REQUEST", "View once is for conversations, not Space rooms.");
      }
      if (files.some((f) => f.kind !== "image")) {
        throw badRequest("BAD_REQUEST", "Only photos can be sent to view once.");
      }
    }

    // A place is shared once, by choice. Under 18: only in small Spaces and conversations
    // (their own crowd).
    if (
      body.place &&
      isMinor(author.birthDate) &&
      access &&
      access.community.memberCount > Limits.teenPresenceSpaceSize
    ) {
      throw new AppError(403, "AGE_RESTRICTED", "Places can only be shared in smaller Spaces.");
    }

    let replyToId: bigint | null = null;
    if (body.replyToId) {
      const [target] = await this.db
        .select({ id: messages.id })
        .from(messages)
        .where(and(eq(messages.id, BigInt(body.replyToId)), eq(messages.channelId, channel.id)))
        .limit(1);
      if (!target) throw notFound("Message to reply to");
      replyToId = target.id;
    }

    // A connected moderation service (none yet) checks public Spaces only; a hold hides the
    // message for the Space's own moderators to decide on.
    const scanner = this.deps.scanner ?? noScanner;
    const held =
      scanner.enabled && access?.community.visibility === "public" && content
        ? (await scanner.scanText(content)).hold
        : false;

    const id = this.deps.ids.next();
    const [row] = await this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(messages)
        .values({
          id,
          channelId: channel.id,
          authorId: userId,
          type: replyToId ? "reply" : "default",
          content,
          replyToId,
          nonce: body.nonce ?? null,
          embed: body.place
            ? {
                type: "place",
                name: body.place.name,
                address: body.place.address,
                lat: Math.round(body.place.lat * 1e5) / 1e5,
                lng: Math.round(body.place.lng * 1e5) / 1e5,
              }
            : null,
          flags: held ? MESSAGE_HIDDEN : 0,
          viewLimit: body.viewLimit ?? null,
        })
        .returning();
      if (files.length) {
        await tx
          .insert(messageAttachments)
          .values(files.map((f, position) => ({ messageId: id, position, mediaId: f.id })));
      }
      await tx.update(channels).set({ lastMessageId: id }).where(eq(channels.id, channel.id));
      // A conversation someone closed comes back to their list when something new is said.
      if (ctx.recipients) {
        await tx
          .update(channelRecipients)
          .set({ closedAt: null })
          .where(
            and(eq(channelRecipients.channelId, channel.id), isNotNull(channelRecipients.closedAt)),
          );
      }
      if (accepting) {
        await tx
          .update(channelRecipients)
          .set({ requestedAt: null })
          .where(
            and(eq(channelRecipients.channelId, channel.id), eq(channelRecipients.userId, userId)),
          );
      }
      // Sending reads everything above it.
      await tx
        .insert(readStates)
        .values({ userId, channelId: channel.id, lastReadMessageId: id })
        .onConflictDoUpdate({
          target: [readStates.userId, readStates.channelId],
          set: { lastReadMessageId: id, mentionCount: 0, updatedAt: new Date() },
        });
      return inserted;
    });
    if (!row) throw new Error("message insert returned nothing");
    const [message] = await this.hydrate([row]);
    if (!message) throw new Error("message author missing");
    await this.deps.bus.publish(topicOf(ctx), { type: "MESSAGE_CREATE", data: message });
    if (!held) await this.deps.queue.enqueue("push.message", { messageId: id.toString() });
    // The sender sees their own message in full, even when it's held.
    return held ? ((await this.hydrate([row], true))[0] ?? message) : message;
  }

  private async own(channelId: bigint, messageId: bigint, userId: bigint) {
    const ctx = await roomAccess(this.db, channelId, userId);
    const [row] = await this.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.id, messageId),
          eq(messages.channelId, ctx.channel.id),
          isNull(messages.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw notFound("Message");
    return { ...ctx, row };
  }

  async edit(channelId: bigint, messageId: bigint, userId: bigint, content: string) {
    const { row, ...ctx } = await this.own(channelId, messageId, userId);
    if (row.authorId !== userId) throw forbidden("You can only edit your own messages.");
    if (row.type !== "default" && row.type !== "reply") {
      throw badRequest("BAD_REQUEST", "That message can't be edited.");
    }
    if (!canStillEdit(row.createdAt)) {
      throw badRequest(
        "BAD_REQUEST",
        "Messages can be edited for 15 minutes after they're sent. You can still delete it.",
      );
    }
    const [updated] = await this.db
      .update(messages)
      .set({ content: content.trim(), editedAt: new Date() })
      .where(eq(messages.id, row.id))
      .returning();
    if (!updated) throw notFound("Message");
    const [message] = await this.hydrate([updated], false, userId);
    if (!message) throw notFound("Message");
    await this.deps.bus.publish(topicOf(ctx), { type: "MESSAGE_UPDATE", data: message });
    return message;
  }

  /** Your own messages, or anyone's with Manage messages. The text is cleared, not kept. */
  async remove(channelId: bigint, messageId: bigint, userId: bigint) {
    const { row, ...ctx } = await this.own(channelId, messageId, userId);
    if (row.authorId !== userId && !has(ctx.permissions, Permission.MANAGE_MESSAGES)) {
      throw missingPermission("delete other people's messages");
    }
    // In a conversation: unsend any time before it's seen, and for 2 minutes after.
    if (ctx.recipients && row.authorId === userId) {
      const late = Date.now() - row.createdAt.getTime() > MESSAGE_UNSEND_WINDOW_MS;
      if (late) {
        const [seen] = await this.db
          .select({ userId: readStates.userId })
          .from(readStates)
          .where(
            and(
              eq(readStates.channelId, row.channelId),
              ne(readStates.userId, userId),
              sql`${readStates.lastReadMessageId} >= ${row.id}`,
            ),
          )
          .limit(1);
        if (seen) {
          throw new AppError(
            403,
            "UNSEND_EXPIRED",
            "It's been seen, and it's over 2 minutes old, so it can't be unsent. You can delete it for yourself.",
          );
        }
      }
    }
    await this.db
      .update(messages)
      .set({ deletedAt: new Date(), content: null })
      .where(eq(messages.id, row.id));
    await this.deps.bus.publish(topicOf(ctx), {
      type: "MESSAGE_DELETE",
      data: { id: row.id.toString(), channelId: row.channelId.toString() },
    });
  }

  /** "Read up to here". Only ever moves forward. */
  async ack(channelId: bigint, userId: bigint, messageId: bigint): Promise<ReadState> {
    const ctx = await roomAccess(this.db, channelId, userId);
    const { channel } = ctx;
    const [row] = await this.db
      .insert(readStates)
      .values({ userId, channelId: channel.id, lastReadMessageId: messageId })
      .onConflictDoUpdate({
        target: [readStates.userId, readStates.channelId],
        set: {
          lastReadMessageId: sql`greatest(${readStates.lastReadMessageId}, ${messageId})`,
          mentionCount: 0,
          updatedAt: new Date(),
        },
      })
      .returning();
    const state: ReadState = {
      channelId: channel.id.toString(),
      lastReadMessageId: row?.lastReadMessageId?.toString() ?? messageId.toString(),
      mentionCount: 0,
    };
    await this.deps.bus.publish(`user:${userId}`, { type: "READ_STATE_UPDATE", data: state });
    // Reading a message request doesn't tell its sender.
    const [pending] = ctx.recipients
      ? await this.db
          .select({ at: channelRecipients.requestedAt })
          .from(channelRecipients)
          .where(
            and(eq(channelRecipients.channelId, channel.id), eq(channelRecipients.userId, userId)),
          )
          .limit(1)
      : [];
    if (
      ctx.recipients &&
      !pending?.at &&
      state.lastReadMessageId &&
      (await this.sharesReceipts(userId))
    ) {
      await this.deps.bus.publish(topicOf(ctx), {
        type: "MESSAGE_ACK",
        data: {
          channelId: state.channelId,
          userId: userId.toString(),
          messageId: state.lastReadMessageId,
        },
      });
    }
    return state;
  }

  /** "Delete for you": it leaves your view of the chat; everyone else still has it. */
  async hide(channelId: bigint, messageId: bigint, userId: bigint) {
    const { row } = await this.own(channelId, messageId, userId);
    await this.db
      .insert(messageHides)
      .values({ userId, messageId: row.id, channelId: row.channelId })
      .onConflictDoNothing();
  }

  /**
   * Open a view-once (or view-twice) photo: counts a view, and hands out short links to its
   * photos. Its sender can't open it again; once the views are used, it's gone for you.
   */
  async open(channelId: bigint, messageId: bigint, userId: bigint): Promise<OpenedPhoto> {
    const { row, ...ctx } = await this.own(channelId, messageId, userId);
    if (!row.viewLimit) throw badRequest("BAD_REQUEST", "That photo stays in the chat.");
    if (row.authorId === userId) {
      throw new AppError(403, "VIEW_USED", "Photos you send to view once can't be opened again.");
    }
    const counted = await this.db
      .insert(messageViews)
      .values({ messageId: row.id, userId, count: 1 })
      .onConflictDoUpdate({
        target: [messageViews.messageId, messageViews.userId],
        set: { count: sql`${messageViews.count} + 1`, lastAt: new Date() },
        setWhere: sql`${messageViews.count} < ${row.viewLimit}`,
      })
      .returning({ count: messageViews.count });
    const count = counted[0]?.count;
    if (count === undefined) {
      throw new AppError(403, "VIEW_USED", "You've already opened this photo.");
    }
    const files = await this.db
      .select({ key: media.storageKey, mimeType: media.mimeType })
      .from(messageAttachments)
      .innerJoin(media, eq(media.id, messageAttachments.mediaId))
      .where(eq(messageAttachments.messageId, row.id))
      .orderBy(asc(messageAttachments.position));
    const urls = await Promise.all(
      files.map((f) =>
        this.deps.storage.presignGet(f.key, { expiresSeconds: 60, contentType: f.mimeType }),
      ),
    );
    // Its sender sees "Opened".
    const [updated] = await this.hydrate([row]);
    if (updated)
      await this.deps.bus.publish(topicOf(ctx), { type: "MESSAGE_UPDATE", data: updated });
    return { urls, viewsLeft: Math.max(0, row.viewLimit - count), seconds: VIEW_ONCE_SECONDS };
  }

  async readStates(userId: bigint): Promise<ReadState[]> {
    const rows = await this.db.select().from(readStates).where(eq(readStates.userId, userId));
    return rows.map((r) => ({
      channelId: r.channelId.toString(),
      lastReadMessageId: r.lastReadMessageId?.toString() ?? null,
      mentionCount: r.mentionCount,
    }));
  }

  /** Read receipts are mutual: someone who hides theirs neither shows nor sees them. */
  async sharesReceipts(userId: bigint): Promise<boolean> {
    const [row] = await this.db
      .select({ on: userSettings.showReadReceipts })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);
    return row?.on ?? true;
  }

  private async target(ctx: RoomContext, messageId: bigint) {
    const [row] = await this.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.id, messageId),
          eq(messages.channelId, ctx.channel.id),
          isNull(messages.deletedAt),
        ),
      )
      .limit(1);
    const hidden = row ? (row.flags & MESSAGE_HIDDEN) !== 0 : false;
    if (!row || (hidden && !has(ctx.permissions, Permission.MANAGE_MESSAGES))) {
      throw notFound("Message");
    }
    return row;
  }

  /** Add or take back your reaction. Any single emoji; at most 20 kinds on one message. */
  async react(channelId: bigint, messageId: bigint, userId: bigint, emoji: string, on: boolean) {
    if (!isOneEmoji(emoji)) throw badRequest("VALIDATION_FAILED", "React with one emoji.");
    const ctx = await roomAccess(this.db, channelId, userId);
    if (on && !has(ctx.permissions, Permission.ADD_REACTIONS)) throw missingPermission("react");
    const row = await this.target(ctx, messageId);
    const event = {
      messageId: row.id.toString(),
      channelId: row.channelId.toString(),
      userId: userId.toString(),
      emoji,
    };
    if (on) {
      const kinds = await this.db
        .selectDistinct({ emoji: messageReactions.emoji })
        .from(messageReactions)
        .where(eq(messageReactions.messageId, row.id));
      if (kinds.length >= MAX_REACTION_KINDS && !kinds.some((k) => k.emoji === emoji)) {
        throw badRequest(
          "BAD_REQUEST",
          "That message has as many different reactions as it can hold.",
        );
      }
      const added = await this.db
        .insert(messageReactions)
        .values({ messageId: row.id, emoji, userId })
        .onConflictDoNothing()
        .returning({ emoji: messageReactions.emoji });
      if (added.length) {
        await this.deps.bus.publish(topicOf(ctx), { type: "MESSAGE_REACTION_ADD", data: event });
      }
      return;
    }
    const removed = await this.db
      .delete(messageReactions)
      .where(
        and(
          eq(messageReactions.messageId, row.id),
          eq(messageReactions.emoji, emoji),
          eq(messageReactions.userId, userId),
        ),
      )
      .returning({ emoji: messageReactions.emoji });
    if (removed.length) {
      await this.deps.bus.publish(topicOf(ctx), { type: "MESSAGE_REACTION_REMOVE", data: event });
    }
  }

  /** Pin or unpin a message for everyone here; pinning says so in the chat. */
  async pin(channelId: bigint, messageId: bigint, userId: bigint, on: boolean): Promise<Message> {
    const ctx = await roomAccess(this.db, channelId, userId);
    if (!has(ctx.permissions, Permission.PIN_MESSAGES)) throw missingPermission("pin messages");
    const row = await this.target(ctx, messageId);
    if (row.type !== "default" && row.type !== "reply") {
      throw badRequest("BAD_REQUEST", "That message can't be pinned.");
    }
    if (on && !row.pinnedAt) {
      const [{ n } = { n: 0 }] = await this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(messages)
        .where(
          and(
            eq(messages.channelId, row.channelId),
            isNotNull(messages.pinnedAt),
            isNull(messages.deletedAt),
          ),
        );
      if (n >= MAX_PINS) {
        throw badRequest("BAD_REQUEST", `A room holds ${MAX_PINS} pins at most. Unpin one first.`);
      }
    }
    const [updated] = await this.db
      .update(messages)
      .set(
        on
          ? { pinnedAt: row.pinnedAt ?? new Date(), pinnedBy: userId }
          : { pinnedAt: null, pinnedBy: null },
      )
      .where(eq(messages.id, row.id))
      .returning();
    if (!updated) throw notFound("Message");
    const [message] = await this.hydrate([updated], false, userId);
    if (!message) throw notFound("Message");
    const topic = topicOf(ctx);
    await this.deps.bus.publish(topic, { type: "MESSAGE_UPDATE", data: message });
    await this.deps.bus.publish(topic, {
      type: "CHANNEL_PINS_UPDATE",
      data: { channelId: row.channelId.toString() },
    });
    if (on && !row.pinnedAt) {
      const id = this.deps.ids.next();
      const [system] = await this.db
        .insert(messages)
        .values({
          id,
          channelId: row.channelId,
          authorId: userId,
          type: "system_pin",
          content: "",
          replyToId: row.id,
        })
        .returning();
      await this.db
        .update(channels)
        .set({ lastMessageId: id })
        .where(eq(channels.id, row.channelId));
      if (system) {
        const [note] = await this.hydrate([system]);
        if (note) await this.deps.bus.publish(topic, { type: "MESSAGE_CREATE", data: note });
      }
    }
    return message;
  }

  /** The pinned messages here, newest pin first. */
  async pins(channelId: bigint, userId: bigint): Promise<Message[]> {
    const ctx = await roomAccess(this.db, channelId, userId);
    if (!has(ctx.permissions, Permission.READ_MESSAGE_HISTORY)) return [];
    const rows = await this.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.channelId, ctx.channel.id),
          isNotNull(messages.pinnedAt),
          isNull(messages.deletedAt),
          ne(messages.type, "system_pin"),
        ),
      )
      .orderBy(desc(messages.pinnedAt))
      .limit(MAX_PINS);
    return this.hydrate(rows, has(ctx.permissions, Permission.MANAGE_MESSAGES), userId);
  }
}
