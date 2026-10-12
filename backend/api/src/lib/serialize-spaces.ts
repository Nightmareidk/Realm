import type {
  Channel,
  Community,
  MediaInfo,
  MediaRef,
  Member,
  Message,
  Role,
  UserSummary,
} from "@realm/contracts";
import { serializePermissions } from "@realm/contracts";
import { schema } from "@realm/db";
import { mediaUrl } from "./serialize";

type CommunityRow = typeof schema.communities.$inferSelect;
type ChannelRow = typeof schema.channels.$inferSelect;
type OverwriteRow = typeof schema.channelOverwrites.$inferSelect;
type RoleRow = typeof schema.roles.$inferSelect;
type MemberRow = typeof schema.communityMembers.$inferSelect;
type MessageRow = typeof schema.messages.$inferSelect;
type MediaRow = typeof schema.media.$inferSelect;
export type SummaryRow = Pick<
  typeof schema.users.$inferSelect,
  "id" | "username" | "displayName" | "accentColor" | "avatarMediaId"
>;

/** The columns a person's summary needs, for `select(summaryColumns)`. */
export const summaryColumns = {
  id: schema.users.id,
  username: schema.users.username,
  displayName: schema.users.displayName,
  accentColor: schema.users.accentColor,
  avatarMediaId: schema.users.avatarMediaId,
};

/** Message flag bit 0: hidden after reports, until a moderator decides. */
export const MESSAGE_HIDDEN = 1;

/** Just enough of a person to show their name and picture. */
export function toUserSummary(u: SummaryRow): UserSummary {
  return {
    id: u.id.toString(),
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarMediaId ? mediaUrl(u.avatarMediaId) : null,
    accentColor: u.accentColor,
  };
}

export function toCommunity(c: CommunityRow): Community {
  return {
    id: c.id.toString(),
    slug: c.slug,
    name: c.name,
    description: c.description,
    iconUrl: c.iconMediaId ? mediaUrl(c.iconMediaId) : null,
    bannerUrl: c.bannerMediaId ? mediaUrl(c.bannerMediaId) : null,
    ownerId: c.ownerId.toString(),
    accent: c.accent,
    visibility: c.visibility,
    joinPolicy: c.joinPolicy,
    isNsfw: c.isNsfw,
    memberCount: c.memberCount,
    rules: c.rules,
    city: c.city,
    createdAt: c.createdAt.toISOString(),
  };
}

export function toRole(r: RoleRow): Role {
  return {
    id: r.id.toString(),
    communityId: r.communityId.toString(),
    name: r.name,
    color: r.color,
    position: r.position,
    permissions: serializePermissions(r.permissions),
    hoist: r.hoist,
    mentionable: r.mentionable,
  };
}

export function toChannel(c: ChannelRow, overwrites: readonly OverwriteRow[] = []): Channel {
  return {
    id: c.id.toString(),
    type: c.type,
    communityId: c.communityId?.toString() ?? null,
    parentId: c.parentId?.toString() ?? null,
    name: c.name,
    topic: c.topic,
    position: c.position,
    isNsfw: c.isNsfw,
    slowmodeSeconds: c.slowmodeSeconds,
    lastMessageId: c.lastMessageId?.toString() ?? null,
    overwrites: overwrites
      .filter((o) => o.channelId === c.id)
      .map((o) => ({
        targetType: o.targetType,
        targetId: o.targetId.toString(),
        allow: serializePermissions(o.allow),
        deny: serializePermissions(o.deny),
      })),
    ownerId: c.ownerId?.toString() ?? null,
    iconUrl: null,
    encryption: c.encryption,
    createdAt: c.createdAt.toISOString(),
  };
}

export function toMember(m: MemberRow, user: SummaryRow, roleIds: readonly bigint[]): Member {
  return {
    user: toUserSummary(user),
    communityId: m.communityId.toString(),
    nickname: m.nickname,
    roleIds: roleIds.map(String),
    joinedAt: m.joinedAt.toISOString(),
    timeoutUntil: m.timeoutUntil?.toISOString() ?? null,
  };
}

export function toMediaRef(m: MediaRow): MediaRef {
  return {
    id: m.id.toString(),
    kind: m.kind,
    url: mediaUrl(m.id),
    width: m.width,
    height: m.height,
    blurhash: m.blurhash,
    mimeType: m.mimeType,
    sizeBytes: m.sizeBytes,
    durationMs: m.durationMs,
    filename: m.filename,
  };
}

export function toMediaInfo(m: MediaRow): MediaInfo {
  return { ...toMediaRef(m), status: m.status };
}

/**
 * A message for one viewer. A message hidden after reports keeps its shape, but its words,
 * files and place are left out unless the viewer moderates the Space (`reveal`).
 */
export function toMessage(
  m: MessageRow,
  author: SummaryRow,
  replyTo: { row: MessageRow; author: SummaryRow } | null = null,
  opts: { attachments?: MediaRef[]; reveal?: boolean } = {},
): Message {
  const hidden = (m.flags & MESSAGE_HIDDEN) !== 0;
  const show = !hidden || opts.reveal === true;
  const replyHidden = replyTo ? (replyTo.row.flags & MESSAGE_HIDDEN) !== 0 : false;
  return {
    id: m.id.toString(),
    channelId: m.channelId.toString(),
    author: toUserSummary(author),
    type: m.type,
    content: m.deletedAt || !show ? "" : (m.content ?? ""),
    attachments: show ? (opts.attachments ?? []) : [],
    reactions: [],
    replyTo: replyTo
      ? {
          id: replyTo.row.id.toString(),
          author: toUserSummary(replyTo.author),
          content:
            replyTo.row.deletedAt || replyHidden
              ? null
              : (replyTo.row.content?.slice(0, 200) ?? null),
        }
      : null,
    mentions: m.mentions.map(String),
    mentionEveryone: m.mentionEveryone,
    pinned: m.pinnedAt !== null,
    place:
      show && m.embed?.type === "place"
        ? {
            name: m.embed.name,
            address: m.embed.address,
            lat: m.embed.lat,
            lng: m.embed.lng,
          }
        : null,
    hidden,
    editedAt: m.editedAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
    nonce: m.nonce,
  };
}
