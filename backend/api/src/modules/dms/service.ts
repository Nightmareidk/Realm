import {
  type Conversation,
  isMinor,
  Limits,
  type MessagePreview,
  type OpenDmBody,
  type UpdateConversationBody,
} from "@realm/contracts";
import { alias, and, asc, eq, inArray, isNull, ne, schema, sql } from "@realm/db";
import type { Deps } from "../../deps";
import { AppError, badRequest, forbidden, notFound } from "../../lib/errors";
import { summaryColumns, toChannel, toUserSummary } from "../../lib/serialize-spaces";
import { followsActively } from "../social/access";
import { blockedEitherWay, roomAccess } from "../spaces/access";
import type { MessagesService } from "../spaces/messages";

const {
  channels,
  channelRecipients,
  users,
  userSettings,
  communityMembers,
  relationships,
  messages,
  messageAttachments,
  media,
  readStates,
} = schema;

type ChannelRow = typeof channels.$inferSelect;
type MessageRow = typeof messages.$inferSelect;

const PREVIEW_CHARS = 140;

/**
 * Direct messages and group chats. A DM between two people is one conversation, reused; a group
 * is any conversation with three or more people, up to 25. Who may start one follows the other
 * person's DM setting ("friends and people in my Spaces" by default), blocks always win, and
 * under-18s are only reachable by friends and people who share a Space with them.
 */
export class ConversationsService {
  constructor(
    private readonly deps: Deps,
    private readonly messages: MessagesService,
  ) {}

  private get db() {
    return this.deps.db;
  }

  /**
   * How `from` may reach `to`: straight to their inbox, as a message request (Instagram's way,
   * for people they don't know), or not at all (with why).
   */
  private async reach(
    fromId: bigint,
    fromMinor: boolean,
    toId: bigint,
  ): Promise<"inbox" | "request" | AppError> {
    if (await blockedEitherWay(this.db, fromId, toId)) {
      return new AppError(403, "BLOCKED", "You can't message this person.");
    }
    const [target] = await this.db
      .select({
        name: users.displayName,
        birthDate: users.birthDate,
        policy: userSettings.dmPolicy,
      })
      .from(users)
      .leftJoin(userSettings, eq(userSettings.userId, users.id))
      .where(eq(users.id, toId))
      .limit(1);
    if (!target) return notFound("Person");
    const [friendship] = await this.db
      .select({ t: relationships.type })
      .from(relationships)
      .where(
        and(
          eq(relationships.userId, fromId),
          eq(relationships.targetId, toId),
          eq(relationships.type, "friend"),
        ),
      )
      .limit(1);
    // Friends, the Instagram way: people who follow each other.
    const friend =
      Boolean(friendship) ||
      ((await followsActively(this.db, fromId, toId)) &&
        (await followsActively(this.db, toId, fromId)));
    const a = alias(communityMembers, "mine");
    const [shared] = await this.db
      .select({ id: a.communityId })
      .from(a)
      .innerJoin(
        communityMembers,
        and(eq(communityMembers.communityId, a.communityId), eq(communityMembers.userId, toId)),
      )
      .where(eq(a.userId, fromId))
      .limit(1);
    // Someone who follows you, a friend, or someone in your Spaces is someone you know.
    const close =
      Boolean(friend) || Boolean(shared) || (await followsActively(this.db, toId, fromId));
    const policy = target.policy ?? "friends_and_communities";
    const minor = fromMinor || isMinor(target.birthDate);
    if (policy === "nobody") {
      return new AppError(403, "DM_NOT_ALLOWED", `${target.name} isn't taking new messages.`);
    }
    if (policy === "friends") {
      return friend
        ? "inbox"
        : new AppError(
            403,
            "DM_NOT_ALLOWED",
            `${target.name} only gets messages from friends. Follow each other to message.`,
          );
    }
    if (close) return "inbox";
    // Under-18s only meet people they know: no requests to or from them.
    if (minor) {
      return new AppError(
        403,
        "DM_NOT_ALLOWED",
        `You can message ${target.name} once you follow each other.`,
      );
    }
    return policy === "everyone" ? "inbox" : "request";
  }

  private preview(
    row: MessageRow,
    file: { kind: string } | undefined,
    count: number,
  ): MessagePreview {
    return {
      id: row.id.toString(),
      authorId: row.authorId.toString(),
      type: row.type,
      content: row.deletedAt ? "" : (row.content ?? "").slice(0, PREVIEW_CHARS),
      attachments: count,
      attachmentKind:
        file && ["image", "video", "audio", "file"].includes(file.kind)
          ? (file.kind as MessagePreview["attachmentKind"])
          : null,
      place: row.embed?.type === "place",
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * Conversations for one person: the open ones (or just `only`), pinned first, then the most
   * recently active.
   */
  async list(userId: bigint, only?: bigint): Promise<Conversation[]> {
    const mine = await this.db
      .select({
        channel: channels,
        pinnedAt: channelRecipients.pinnedAt,
        requestedAt: channelRecipients.requestedAt,
      })
      .from(channelRecipients)
      .innerJoin(channels, eq(channels.id, channelRecipients.channelId))
      .where(
        and(
          eq(channelRecipients.userId, userId),
          only ? eq(channels.id, only) : isNull(channelRecipients.closedAt),
          isNull(channels.deletedAt),
        ),
      );
    if (mine.length === 0) return [];
    const ids = mine.map((m) => m.channel.id);

    const people = await this.db
      .select({
        channelId: channelRecipients.channelId,
        requestedAt: channelRecipients.requestedAt,
        user: summaryColumns,
      })
      .from(channelRecipients)
      .innerJoin(users, eq(users.id, channelRecipients.userId))
      .where(and(inArray(channelRecipients.channelId, ids), ne(channelRecipients.userId, userId)))
      .orderBy(asc(channelRecipients.joinedAt));

    const lastIds = mine.flatMap((m) => (m.channel.lastMessageId ? [m.channel.lastMessageId] : []));
    const last = lastIds.length
      ? await this.db.select().from(messages).where(inArray(messages.id, lastIds))
      : [];
    const files = lastIds.length
      ? await this.db
          .select({
            messageId: messageAttachments.messageId,
            kind: media.kind,
            position: messageAttachments.position,
          })
          .from(messageAttachments)
          .innerJoin(media, eq(media.id, messageAttachments.mediaId))
          .where(inArray(messageAttachments.messageId, lastIds))
          .orderBy(asc(messageAttachments.position))
      : [];

    // How far the others have read: only between people who both share read receipts.
    const seenRows = (await this.messages.sharesReceipts(userId))
      ? await this.db
          .select({
            channelId: readStates.channelId,
            userId: readStates.userId,
            messageId: readStates.lastReadMessageId,
          })
          .from(readStates)
          .leftJoin(userSettings, eq(userSettings.userId, readStates.userId))
          .where(
            and(
              inArray(readStates.channelId, ids),
              ne(readStates.userId, userId),
              sql`coalesce(${userSettings.showReadReceipts}, true)`,
            ),
          )
      : [];

    // How many messages from others came after where you've read to, per conversation.
    const unreadRows = await this.db
      .select({
        channelId: messages.channelId,
        n: sql<number>`least(count(*), 99)::int`,
      })
      .from(messages)
      .leftJoin(
        readStates,
        and(eq(readStates.channelId, messages.channelId), eq(readStates.userId, userId)),
      )
      .where(
        and(
          inArray(messages.channelId, ids),
          ne(messages.authorId, userId),
          isNull(messages.deletedAt),
          sql`${messages.type}::text not like 'system_%'`,
          sql`(${readStates.lastReadMessageId} is null or ${messages.id} > ${readStates.lastReadMessageId})`,
        ),
      )
      .groupBy(messages.channelId);

    const conversations = mine.map(
      ({ channel, pinnedAt, requestedAt }): Conversation & { pinnedAt: Date | null } => {
        const row = last.find((m) => m.id === channel.lastMessageId);
        const attached = row ? files.filter((f) => f.messageId === row.id) : [];
        const others = people.filter((p) => p.channelId === channel.id);
        // Someone who hasn't accepted your request doesn't show you they've read it.
        const waiting = new Set(others.filter((p) => p.requestedAt).map((p) => p.user.id));
        return {
          ...toChannel(channel),
          recipients: people
            .filter((p) => p.channelId === channel.id)
            .map((p) => toUserSummary(p.user)),
          lastMessage: row ? this.preview(row, attached[0], attached.length) : null,
          pinned: pinnedAt !== null,
          seen: seenRows.flatMap((r) =>
            r.channelId === channel.id && r.messageId && !waiting.has(r.userId)
              ? [{ userId: r.userId.toString(), messageId: r.messageId.toString() }]
              : [],
          ),
          request: requestedAt !== null,
          unread: unreadRows.find((u) => u.channelId === channel.id)?.n ?? 0,
          awaiting: channel.type === "dm" && waiting.size > 0,
          colour: (channel.colour as Conversation["colour"]) ?? null,
          pinnedAt,
        };
      },
    );
    const activity = (c: Conversation) => BigInt(c.lastMessageId ?? c.id);
    conversations.sort((a, b) => {
      if (a.pinnedAt && b.pinnedAt) return b.pinnedAt.getTime() - a.pinnedAt.getTime();
      if (a.pinnedAt || b.pinnedAt) return a.pinnedAt ? -1 : 1;
      const x = activity(a);
      const y = activity(b);
      return x === y ? 0 : x > y ? -1 : 1;
    });
    return conversations.map(({ pinnedAt: _p, ...c }) => c);
  }

  async one(channelId: bigint, userId: bigint): Promise<Conversation> {
    const [c] = await this.list(userId, channelId);
    if (!c) throw notFound("Conversation");
    return c;
  }

  /** Tell each member about a conversation, in their own view of it. */
  private async announce(
    channelId: bigint,
    userIds: readonly bigint[],
    type: "CHANNEL_CREATE" | "CHANNEL_UPDATE",
  ) {
    for (const id of userIds) {
      const [view] = await this.list(id, channelId);
      if (view) await this.deps.bus.publish(`user:${id}`, { type, data: view });
    }
  }

  private async members(channelId: bigint): Promise<bigint[]> {
    const rows = await this.db
      .select({ userId: channelRecipients.userId })
      .from(channelRecipients)
      .where(eq(channelRecipients.channelId, channelId));
    return rows.map((r) => r.userId);
  }

  private async systemMessage(
    channel: ChannelRow,
    authorId: bigint,
    type: "system_channel_rename" | "system_recipient_add" | "system_recipient_remove",
    content: string,
    mention?: bigint,
  ) {
    const id = this.deps.ids.next();
    const [row] = await this.db
      .insert(messages)
      .values({
        id,
        channelId: channel.id,
        authorId,
        type,
        content,
        mentions: mention ? [mention] : [],
      })
      .returning();
    await this.db.update(channels).set({ lastMessageId: id }).where(eq(channels.id, channel.id));
    if (!row) return;
    const [message] = await this.messages.hydrate([row]);
    if (message)
      await this.deps.bus.publish(`dm:${channel.id}`, { type: "MESSAGE_CREATE", data: message });
  }

  private async personFor(userId: bigint) {
    const [me] = await this.db
      .select({ id: users.id, name: users.displayName, birthDate: users.birthDate })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!me) throw notFound("User");
    return me;
  }

  /** Open a DM with one person (the existing one, if there is one) or start a group. */
  async open(userId: bigint, body: OpenDmBody): Promise<Conversation> {
    const others = [...new Set(body.recipientIds)].map(BigInt).filter((id) => id !== userId);
    if (others.length === 0) throw badRequest("BAD_REQUEST", "Pick someone to message.");
    if (others.length + 1 > Limits.groupDmRecipients.max) {
      throw badRequest(
        "BAD_REQUEST",
        `A group chat holds ${Limits.groupDmRecipients.max} people at most.`,
      );
    }
    const me = await this.personFor(userId);
    const minor = isMinor(me.birthDate);
    const group = others.length > 1 || Boolean(body.name);
    const requests = new Set<bigint>();
    for (const id of others) {
      const how = await this.reach(userId, minor, id);
      if (how instanceof AppError) throw how;
      if (how === "request") {
        // Group chats are for people who know each other; a stranger gets a request first.
        if (group) {
          const them = await this.personFor(id);
          throw new AppError(
            403,
            "DM_NOT_ALLOWED",
            `Message ${them.name} on their own first. They can add you to groups once they accept.`,
          );
        }
        requests.add(id);
      }
    }

    if (others.length === 1 && !body.name) {
      const target = others[0] as bigint;
      const theirs = alias(channelRecipients, "theirs");
      const [existing] = await this.db
        .select({ id: channels.id })
        .from(channelRecipients)
        .innerJoin(channels, eq(channels.id, channelRecipients.channelId))
        .innerJoin(
          theirs,
          and(eq(theirs.channelId, channelRecipients.channelId), eq(theirs.userId, target)),
        )
        .where(
          and(
            eq(channelRecipients.userId, userId),
            eq(channels.type, "dm"),
            isNull(channels.deletedAt),
          ),
        )
        .limit(1);
      if (existing) {
        await this.db
          .update(channelRecipients)
          .set({ closedAt: null })
          .where(
            and(eq(channelRecipients.channelId, existing.id), eq(channelRecipients.userId, userId)),
          );
        return this.one(existing.id, userId);
      }
    }

    const id = this.deps.ids.next();
    const everyone = [userId, ...others];
    await this.db.transaction(async (tx) => {
      await tx.insert(channels).values({
        id,
        type: group ? "group_dm" : "dm",
        ownerId: group ? userId : null,
        name: group ? (body.name ?? null) : null,
      });
      await tx.insert(channelRecipients).values(
        everyone.map((u) => ({
          channelId: id,
          userId: u,
          // The other side sees a new DM only once something is said in it.
          closedAt: group || u === userId ? null : new Date(),
          requestedAt: requests.has(u) ? new Date() : null,
        })),
      );
    });
    // Everyone's live connection follows it from the start, so the first message arrives live.
    // (The other side's list still shows a DM only once something is said in it.)
    await this.announce(id, everyone, "CHANNEL_CREATE");
    return this.one(id, userId);
  }

  /** Accept a message request: it moves to your inbox, and they can now see you've read it. */
  async accept(channelId: bigint, userId: bigint): Promise<Conversation> {
    const ctx = await roomAccess(this.db, channelId, userId);
    if (!ctx.recipients) throw notFound("Conversation");
    await this.db
      .update(channelRecipients)
      .set({ requestedAt: null, closedAt: null })
      .where(and(eq(channelRecipients.channelId, channelId), eq(channelRecipients.userId, userId)));
    await this.announce(channelId, ctx.recipients, "CHANNEL_UPDATE");
    return this.one(channelId, userId);
  }

  /** Rename a group, or pin or unpin a conversation in your own list. */
  async update(
    channelId: bigint,
    userId: bigint,
    body: UpdateConversationBody,
  ): Promise<Conversation> {
    const ctx = await roomAccess(this.db, channelId, userId);
    if (!ctx.recipients) throw notFound("Conversation");
    if (body.pinned !== undefined) {
      await this.db
        .update(channelRecipients)
        .set({ pinnedAt: body.pinned ? new Date() : null })
        .where(
          and(eq(channelRecipients.channelId, channelId), eq(channelRecipients.userId, userId)),
        );
    }
    if (body.colour !== undefined && (body.colour ?? null) !== ctx.channel.colour) {
      await this.db
        .update(channels)
        .set({ colour: body.colour ?? null })
        .where(eq(channels.id, channelId));
      await this.announce(channelId, ctx.recipients, "CHANNEL_UPDATE");
    }
    if (body.name !== undefined) {
      if (ctx.channel.type !== "group_dm")
        throw badRequest("BAD_REQUEST", "Only group chats have names.");
      if ((body.name ?? null) !== ctx.channel.name) {
        await this.db
          .update(channels)
          .set({ name: body.name ?? null })
          .where(eq(channels.id, channelId));
        await this.systemMessage(ctx.channel, userId, "system_channel_rename", body.name ?? "");
        await this.announce(channelId, ctx.recipients, "CHANNEL_UPDATE");
      }
    }
    return this.one(channelId, userId);
  }

  /** Add people to a group chat. Anyone in it can, as long as each of them may be messaged. */
  async add(channelId: bigint, userId: bigint, targets: bigint[]): Promise<Conversation> {
    const ctx = await roomAccess(this.db, channelId, userId);
    if (!ctx.recipients) throw notFound("Conversation");
    if (ctx.channel.type !== "group_dm") {
      throw badRequest("BAD_REQUEST", "Start a group chat to add more people.");
    }
    const fresh = [...new Set(targets)].filter((t) => !ctx.recipients?.includes(t));
    if (ctx.recipients.length + fresh.length > Limits.groupDmRecipients.max) {
      throw badRequest(
        "BAD_REQUEST",
        `A group chat holds ${Limits.groupDmRecipients.max} people at most.`,
      );
    }
    const me = await this.personFor(userId);
    for (const t of fresh) {
      const how = await this.reach(userId, isMinor(me.birthDate), t);
      if (how instanceof AppError) throw how;
      if (how === "request") {
        const them = await this.personFor(t);
        throw new AppError(
          403,
          "DM_NOT_ALLOWED",
          `Message ${them.name} on their own first. They can join groups once they accept.`,
        );
      }
    }
    for (const t of fresh) {
      await this.db
        .insert(channelRecipients)
        .values({ channelId, userId: t })
        .onConflictDoNothing();
      const person = await this.personFor(t);
      await this.systemMessage(ctx.channel, userId, "system_recipient_add", person.name, t);
    }
    if (fresh.length) {
      await this.announce(channelId, fresh, "CHANNEL_CREATE");
      await this.announce(channelId, ctx.recipients, "CHANNEL_UPDATE");
    }
    return this.one(channelId, userId);
  }

  /**
   * Leave a group (or, as its starter, remove someone), or close a DM: it leaves your list until
   * something new is said.
   */
  async remove(channelId: bigint, userId: bigint, targetId: bigint): Promise<void> {
    const ctx = await roomAccess(this.db, channelId, userId);
    if (!ctx.recipients) throw notFound("Conversation");
    const gone = { id: channelId.toString(), communityId: null };
    if (ctx.channel.type === "dm") {
      if (targetId !== userId) throw forbidden("You can only close a DM for yourself.");
      await this.db
        .update(channelRecipients)
        .set({ closedAt: new Date(), pinnedAt: null })
        .where(
          and(eq(channelRecipients.channelId, channelId), eq(channelRecipients.userId, userId)),
        );
      await this.deps.bus.publish(`user:${userId}`, { type: "CHANNEL_DELETE", data: gone });
      return;
    }
    if (!ctx.recipients.includes(targetId)) throw notFound("Person");
    if (targetId !== userId && ctx.channel.ownerId !== userId) {
      throw forbidden("Only the person who started the group can remove people.");
    }
    await this.db
      .delete(channelRecipients)
      .where(
        and(eq(channelRecipients.channelId, channelId), eq(channelRecipients.userId, targetId)),
      );
    await this.deps.bus.publish(`user:${targetId}`, { type: "CHANNEL_DELETE", data: gone });
    const left = ctx.recipients.filter((r) => r !== targetId);
    if (left.length === 0) {
      await this.db
        .update(channels)
        .set({ deletedAt: new Date() })
        .where(eq(channels.id, channelId));
      return;
    }
    // The group keeps a starter: whoever has been in it longest.
    if (ctx.channel.ownerId === targetId) {
      const [next] = await this.db
        .select({ userId: channelRecipients.userId })
        .from(channelRecipients)
        .where(eq(channelRecipients.channelId, channelId))
        .orderBy(asc(channelRecipients.joinedAt))
        .limit(1);
      await this.db
        .update(channels)
        .set({ ownerId: next?.userId ?? null })
        .where(eq(channels.id, channelId));
    }
    const person = await this.personFor(targetId);
    await this.systemMessage(ctx.channel, userId, "system_recipient_remove", person.name, targetId);
    await this.announce(channelId, left, "CHANNEL_UPDATE");
  }

  /** The members' IDs, for the gateway. */
  async memberIds(channelId: bigint): Promise<bigint[]> {
    return this.members(channelId);
  }
}
