import { has, Permission } from "@realm/contracts";
import { and, eq, gt, inArray, isNull, ne, or, schema } from "@realm/db";
import type { JobHandler } from "@realm/server-core";
import type { Deps } from "./deps";
import { readPresences } from "./lib/presence";
import { MESSAGE_HIDDEN } from "./lib/serialize-spaces";
import { roomAccess } from "./modules/spaces/access";

const {
  messages,
  channels,
  communities,
  communityMembers,
  users,
  pushTokens,
  mutes,
  relationships,
  notificationPrefs,
  messageAttachments,
  media,
  channelRecipients,
} = schema;

/** Spaces up to this size notify every new message; bigger ones will notify @mentions (later). */
const NOTIFY_ALL_UP_TO = 50;
/** One notification per room per person every couple of minutes; newer ones replace it. */
const PUSH_GAP_SECONDS = 120;

/**
 * Background jobs. Without Redis they run in the API right after the request; with Redis the
 * worker process (worker-main.ts) takes them.
 */
export function jobHandlers(deps: Deps): Record<string, JobHandler> {
  return {
    // A third-party scan of a public upload would run here; none is connected (lib/scanner.ts).
    "media.scan": async () => {},

    /** A new message: tell the members who aren't here, unless they've muted or blocked it. */
    "push.message": async (data) => {
      if (!deps.pusher.enabled) return;
      const id = BigInt(String(data.messageId));
      const [row] = await deps.db
        .select({ m: messages, room: channels, space: communities, author: users.displayName })
        .from(messages)
        .innerJoin(channels, eq(channels.id, messages.channelId))
        .leftJoin(communities, eq(communities.id, channels.communityId))
        .innerJoin(users, eq(users.id, messages.authorId))
        .where(and(eq(messages.id, id), isNull(messages.deletedAt)))
        .limit(1);
      if (!row || row.m.type.startsWith("system_") || (row.m.flags & MESSAGE_HIDDEN) !== 0) return;
      const conversation = row.room.type === "dm" || row.room.type === "group_dm";
      if (!conversation && (!row.space || row.space.memberCount > NOTIFY_ALL_UP_TO)) return;
      const space = row.space;

      // Who might hear: a conversation's other members, or the Space's.
      const members = conversation
        ? await deps.db
            .select({ id: channelRecipients.userId })
            .from(channelRecipients)
            .where(
              and(
                eq(channelRecipients.channelId, row.room.id),
                ne(channelRecipients.userId, row.m.authorId),
              ),
            )
        : await deps.db
            .select({ id: communityMembers.userId })
            .from(communityMembers)
            .where(
              and(
                eq(communityMembers.communityId, space?.id ?? 0n),
                ne(communityMembers.userId, row.m.authorId),
              ),
            );
      if (members.length === 0) return;
      const ids = members.map((m) => m.id);

      // Not those who are here right now: the app already shows it to them.
      const presence = await readPresences(deps.kv, ids.map(String));
      let targets = ids.filter((u) => (presence.get(u.toString()) ?? "offline") === "offline");

      // Not those who muted the author, the Space or the room, or blocked the author.
      const now = new Date();
      const muted = await deps.db
        .select({ userId: mutes.userId })
        .from(mutes)
        .where(
          and(
            inArray(mutes.userId, targets),
            or(isNull(mutes.until), gt(mutes.until, now)),
            or(
              and(eq(mutes.targetType, "user"), eq(mutes.targetId, row.m.authorId)),
              and(eq(mutes.targetType, "community"), eq(mutes.targetId, space?.id ?? 0n)),
              and(eq(mutes.targetType, "channel"), eq(mutes.targetId, row.room.id)),
            ),
          ),
        );
      const blocked = await deps.db
        .select({ userId: relationships.userId })
        .from(relationships)
        .where(
          and(
            inArray(relationships.userId, targets),
            eq(relationships.targetId, row.m.authorId),
            eq(relationships.type, "blocked"),
          ),
        );
      const off = await deps.db
        .select({ userId: notificationPrefs.userId })
        .from(notificationPrefs)
        .where(
          and(
            inArray(notificationPrefs.userId, targets),
            ne(notificationPrefs.level, "all"),
            or(
              eq(notificationPrefs.scopeType, "global"),
              and(
                eq(notificationPrefs.scopeType, "community"),
                eq(notificationPrefs.scopeId, space?.id ?? 0n),
              ),
              and(
                eq(notificationPrefs.scopeType, "channel"),
                eq(notificationPrefs.scopeId, row.room.id),
              ),
            ),
          ),
        );
      const skip = new Set([...muted, ...blocked, ...off].map((r) => r.userId.toString()));
      targets = targets.filter((u) => !skip.has(u.toString()));

      // Only people who can read that room, and not twice within a couple of minutes.
      const allowed: bigint[] = [];
      for (const u of targets) {
        try {
          const { permissions } = await roomAccess(deps.db, row.room.id, u);
          if (!has(permissions, Permission.READ_MESSAGE_HISTORY)) continue;
        } catch {
          continue;
        }
        const gap = await deps.kv.incr(`pushed:${u}:${row.room.id}`, PUSH_GAP_SECONDS);
        if (gap.count === 1) allowed.push(u);
      }
      if (allowed.length === 0) return;

      const tokens = await deps.db
        .select()
        .from(pushTokens)
        .where(inArray(pushTokens.userId, allowed));
      if (tokens.length === 0) return;

      const [file] = await deps.db
        .select({ kind: media.kind })
        .from(messageAttachments)
        .innerJoin(media, eq(media.id, messageAttachments.mediaId))
        .where(eq(messageAttachments.messageId, row.m.id))
        .limit(1);
      const what = row.m.content?.trim()
        ? row.m.content.trim()
        : row.m.embed
          ? "shared a place"
          : file?.kind === "audio"
            ? "sent a voice message"
            : file?.kind === "image"
              ? "sent a photo"
              : file?.kind === "video"
                ? "sent a video"
                : "sent a file";
      // A DM is titled by its sender; a group by its name; a room by its Space and name.
      const text = row.room.type === "dm" ? what : `${row.author}: ${what}`;
      const title =
        row.room.type === "dm"
          ? row.author
          : row.room.type === "group_dm"
            ? (row.room.name ?? "Group chat")
            : `${space?.name ?? "Realm"} · #${row.room.name ?? "room"}`;
      const link = conversation
        ? `/messages/${row.room.id}`
        : `/spaces/${space?.slug ?? ""}/${row.room.name ?? ""}`;
      for (const t of tokens) {
        const result = await deps.pusher.send({
          token: t.token,
          title,
          body: text.length > 140 ? `${text.slice(0, 139)}…` : text,
          link,
          tag: `room-${row.room.id}`,
        });
        if (result === "gone") {
          await deps.db.delete(pushTokens).where(eq(pushTokens.token, t.token));
        }
      }
    },
  };
}
