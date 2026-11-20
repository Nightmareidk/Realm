import { has, type NotificationKind, Permission } from "@realm/contracts";
import { and, eq, gt, inArray, isNull, ne, or, schema } from "@realm/db";
import type { JobHandler, PushMessage } from "@realm/server-core";
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
  notifications,
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
                // A message request waits quietly in Requests.
                isNull(channelRecipients.requestedAt),
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
      const prefs = await deps.db
        .select({
          userId: notificationPrefs.userId,
          scopeType: notificationPrefs.scopeType,
          level: notificationPrefs.level,
          toggles: notificationPrefs.toggles,
        })
        .from(notificationPrefs)
        .where(
          and(
            inArray(notificationPrefs.userId, targets),
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
      // Off: a Space or room set quieter than "all", everything paused, or messages switched off.
      const off = prefs.filter(
        (p) => p.level !== "all" || (p.scopeType === "global" && p.toggles.messages === false),
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
      await deliver(deps, tokens, {
        title,
        body: clip(text),
        link,
        tag: `room-${row.room.id}`,
        channel: "messages",
        // The phone app opens the chat itself from these.
        extra: {
          room: row.room.id.toString(),
          kind: conversation ? row.room.type : "room",
          name: conversation ? title : `#${row.room.name ?? "room"}`,
        },
      });
    },

    /** A like, comment, follow, mention or opened capsule: tell its person if they're away. */
    "push.activity": async (data) => {
      if (!deps.pusher.enabled) return;
      const id = BigInt(String(data.notificationId));
      const [n] = await deps.db
        .select()
        .from(notifications)
        .where(eq(notifications.id, id))
        .limit(1);
      // Gone already: an unlike or unfollow took it back before the job ran.
      if (!n || n.readAt) return;
      const userId = n.userId;

      // Not while they're on Realm: the heart on Home already lit up.
      const presence = await readPresences(deps.kv, [userId.toString()]);
      if ((presence.get(userId.toString()) ?? "offline") !== "offline") return;

      // Their own switches: everything paused, or this kind turned off in Settings.
      const [pref] = await deps.db
        .select({ level: notificationPrefs.level, toggles: notificationPrefs.toggles })
        .from(notificationPrefs)
        .where(and(eq(notificationPrefs.userId, userId), eq(notificationPrefs.scopeType, "global")))
        .limit(1);
      if (pref?.level === "none") return;
      if (pref?.level === "mentions" && !DIRECT.has(n.type)) return;
      const kind = KIND_OF[n.type];
      if (kind && pref?.toggles[kind] === false) return;

      const actorId = n.actorId;
      let actor: { name: string; username: string } | null = null;
      if (actorId !== null && actorId !== userId) {
        // Never from someone they blocked or muted.
        const [blocked] = await deps.db
          .select({ id: relationships.userId })
          .from(relationships)
          .where(
            and(
              eq(relationships.userId, userId),
              eq(relationships.targetId, actorId),
              eq(relationships.type, "blocked"),
            ),
          )
          .limit(1);
        if (blocked) return;
        const [muted] = await deps.db
          .select({ id: mutes.userId })
          .from(mutes)
          .where(
            and(
              eq(mutes.userId, userId),
              eq(mutes.targetType, "user"),
              eq(mutes.targetId, actorId),
              or(isNull(mutes.until), gt(mutes.until, new Date())),
            ),
          )
          .limit(1);
        if (muted) return;
        const [a] = await deps.db
          .select({ name: users.displayName, username: users.username, deletedAt: users.deletedAt })
          .from(users)
          .where(eq(users.id, actorId))
          .limit(1);
        if (!a || a.deletedAt) return;
        actor = { name: a.name, username: a.username };
      }

      const words = activityText(n.type, n.data, actor !== null, actorId === userId);
      if (!words) return;

      // Likes and reposts on one post: one notification every 10 minutes, newest wins. The rest:
      // no more than one a minute per kind, so a burst of follows doesn't buzz ten times.
      const quiet = n.type === "post_like" || n.type === "post_repost" ? 600 : 60;
      const gapKey = `pushed:act:${userId}:${n.type}:${n.subjectType === "post" ? n.subjectId : "any"}`;
      const gap = await deps.kv.incr(gapKey, quiet);
      if (gap.count !== 1) return;

      const tokens = await deps.db.select().from(pushTokens).where(eq(pushTokens.userId, userId));
      if (tokens.length === 0) return;

      const link =
        n.subjectType === "post"
          ? `/p/${n.subjectId}`
          : n.type === "follow_request"
            ? "/activity"
            : actor
              ? `/u/${actor.username}`
              : "/activity";
      await deliver(deps, tokens, {
        title: actor?.name ?? "Realm",
        body: clip(words),
        link,
        tag: `act-${n.type}-${n.subjectId}`,
        channel: "activity",
        extra: {
          ...(n.subjectType === "post" ? { post: n.subjectId.toString() } : {}),
          ...(actor ? { user: actor.username } : {}),
          ...(n.type === "follow_request" ? { screen: "follow-requests" } : {}),
        },
      });
    },
  };
}

/** Kinds said straight to someone: kept when they chose "mentions only". */
const DIRECT = new Set(["mention", "comment_reply", "reply", "follow_request"]);

/** Which Settings switch covers each kind. Opened capsules have none: they asked to be told. */
const KIND_OF: Record<string, NotificationKind | undefined> = {
  post_like: "likes",
  post_repost: "likes",
  post_comment: "comments",
  comment_reply: "comments",
  post_quote: "comments",
  follow: "follows",
  follow_request: "follows",
  mention: "mentions",
};

/** The line under the person's name. Null for kinds that don't buzz the phone. */
export function activityText(
  type: string,
  data: Record<string, unknown>,
  hasActor: boolean,
  self: boolean,
): string | null {
  const quote = typeof data.text === "string" && data.text.trim() ? data.text.trim() : null;
  const said = (lead: string) => (quote ? `${lead}: ${quote}` : lead);
  if (type === "capsule_open") {
    return self ? "Your time capsule just opened." : "A time capsule you saved just opened.";
  }
  if (!hasActor) return null;
  switch (type) {
    case "post_like":
      return "liked your post.";
    case "post_repost":
      return "reposted your post.";
    case "post_quote":
      return said("quoted your post");
    case "post_comment":
      return said("commented");
    case "comment_reply":
      return said("replied to your comment");
    case "mention":
      return data.via === "tag" ? "tagged you in a post." : said("mentioned you");
    case "follow":
      return data.accepted === true ? "accepted your follow request." : "started following you.";
    case "follow_request":
      return "asked to follow you.";
    default:
      return null;
  }
}

function clip(text: string): string {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > 140 ? `${one.slice(0, 139)}…` : one;
}

/** Send to each of a person's devices; forget devices Firebase says are gone. */
async function deliver(
  deps: Deps,
  tokens: { token: string; platform: "web" | "ios" | "android" }[],
  message: Omit<PushMessage, "token" | "platform">,
) {
  for (const t of tokens) {
    const result = await deps.pusher.send({ ...message, token: t.token, platform: t.platform });
    if (result === "gone") {
      await deps.db.delete(pushTokens).where(eq(pushTokens.token, t.token));
    }
  }
}
