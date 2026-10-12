import {
  computeBasePermissions,
  computeChannelPermissions,
  has,
  type MemberContext,
  Permission,
} from "@realm/contracts";
import { and, eq, inArray, isNull, or, schema, sql } from "@realm/db";
import type { Deps } from "../../deps";
import { AppError, notFound } from "../../lib/errors";

const {
  communities,
  communityMembers,
  roles,
  memberRoles,
  channels,
  channelOverwrites,
  channelRecipients,
  relationships,
} = schema;

type Db = Deps["db"];
export type CommunityRow = typeof communities.$inferSelect;
export type ChannelRow = typeof channels.$inferSelect;
export type OverwriteRow = typeof channelOverwrites.$inferSelect;
export type RoleRow = typeof roles.$inferSelect;
export type MemberRow = typeof communityMembers.$inferSelect;

/** Everything needed to answer "can this person do that here", loaded once per request. */
export interface SpaceAccess {
  community: CommunityRow;
  member: MemberRow | null;
  roles: RoleRow[];
  memberRoleIds: bigint[];
  /** Space-wide permissions before room overwrites; 0 for non-members. */
  base: bigint;
  isOwner: boolean;
}

export const missingPermission = (what: string) =>
  new AppError(403, "MISSING_PERMISSION", `You don't have permission to ${what} here.`);

function memberContext(a: SpaceAccess, userId: bigint): MemberContext {
  return {
    userId: userId.toString(),
    ownerId: a.community.ownerId.toString(),
    communityId: a.community.id.toString(),
    roles: a.roles.map((r) => ({ id: r.id.toString(), permissions: r.permissions })),
    memberRoleIds: a.memberRoleIds.map(String),
    timeoutUntil: a.member?.timeoutUntil?.getTime() ?? null,
  };
}

/** A live Space by ID or slug, or null. */
export async function findSpace(db: Db, idOrSlug: string): Promise<CommunityRow | null> {
  const where = /^\d+$/.test(idOrSlug)
    ? eq(communities.id, BigInt(idOrSlug))
    : sql`lower(${communities.slug}) = ${idOrSlug.toLowerCase()}`;
  const [row] = await db
    .select()
    .from(communities)
    .where(and(where, isNull(communities.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function loadAccess(
  db: Db,
  community: CommunityRow,
  userId: bigint,
): Promise<SpaceAccess> {
  const [[member], roleRows, assigned] = await Promise.all([
    db
      .select()
      .from(communityMembers)
      .where(
        and(eq(communityMembers.communityId, community.id), eq(communityMembers.userId, userId)),
      )
      .limit(1),
    db.select().from(roles).where(eq(roles.communityId, community.id)),
    db
      .select({ roleId: memberRoles.roleId })
      .from(memberRoles)
      .where(and(eq(memberRoles.communityId, community.id), eq(memberRoles.userId, userId))),
  ]);
  const access: SpaceAccess = {
    community,
    member: member ?? null,
    roles: roleRows,
    memberRoleIds: assigned.map((r) => r.roleId),
    base: 0n,
    isOwner: community.ownerId === userId,
  };
  if (access.member) access.base = computeBasePermissions(memberContext(access, userId));
  return access;
}

/**
 * The Space, as a member. A private Space you're not in answers "not found", so its existence
 * isn't confirmed to outsiders.
 */
export async function memberAccess(db: Db, idOrSlug: string, userId: bigint) {
  const community = await findSpace(db, idOrSlug);
  if (!community) throw notFound("Space");
  const access = await loadAccess(db, community, userId);
  if (!access.member) throw notFound("Space");
  return access;
}

export function requireSpacePermission(access: SpaceAccess, bit: bigint, what: string) {
  if (!has(access.base, bit)) throw missingPermission(what);
}

export function roomPermissions(
  access: SpaceAccess,
  userId: bigint,
  overwrites: readonly OverwriteRow[],
): bigint {
  if (!access.member) return 0n;
  return computeChannelPermissions(
    memberContext(access, userId),
    overwrites.map((o) => ({
      targetType: o.targetType,
      targetId: o.targetId.toString(),
      allow: o.allow,
      deny: o.deny,
    })),
  );
}

export async function overwritesFor(db: Db, channelIds: readonly bigint[]) {
  if (channelIds.length === 0) return [];
  return db
    .select()
    .from(channelOverwrites)
    .where(inArray(channelOverwrites.channelId, channelIds));
}

/** What everyone in a DM or group chat may do (there are no roles there). */
export const DM_PERMISSIONS =
  Permission.VIEW_CHANNEL |
  Permission.SEND_MESSAGES |
  Permission.READ_MESSAGE_HISTORY |
  Permission.ADD_REACTIONS |
  Permission.ATTACH_FILES |
  Permission.EMBED_LINKS |
  Permission.PIN_MESSAGES |
  Permission.MENTION_EVERYONE;

/** A DM or a group chat (as opposed to a Space's room). */
export const isConversation = (c: Pick<ChannelRow, "type">) =>
  c.type === "dm" || c.type === "group_dm";

/** Whether either of two people has blocked the other. */
export async function blockedEitherWay(db: Db, a: bigint, b: bigint): Promise<boolean> {
  const [row] = await db
    .select({ userId: relationships.userId })
    .from(relationships)
    .where(
      and(
        eq(relationships.type, "blocked"),
        or(
          and(eq(relationships.userId, a), eq(relationships.targetId, b)),
          and(eq(relationships.userId, b), eq(relationships.targetId, a)),
        ),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** A room (or conversation) you can see, and what you may do in it. */
export interface RoomContext {
  channel: ChannelRow;
  /** The Space, for a room; null in a DM or group chat. */
  access: SpaceAccess | null;
  overwrites: OverwriteRow[];
  permissions: bigint;
  /** Everyone in a DM or group chat (you included); null for a Space's room. */
  recipients: bigint[] | null;
}

/** A Space's room only: DMs and group chats answer "not found" here. */
export async function spaceRoomAccess(db: Db, channelId: bigint, userId: bigint) {
  const ctx = await roomAccess(db, channelId, userId);
  if (!ctx.access) throw notFound("Room");
  return ctx as RoomContext & { access: SpaceAccess };
}

/** Where a room's news goes: its Space's topic, or the conversation's own. */
export const topicOf = (ctx: Pick<RoomContext, "channel" | "access">) =>
  ctx.access ? `community:${ctx.access.community.id}` : `dm:${ctx.channel.id}`;

/**
 * A room you can see, with your permissions in it. Rooms you can't see are "not found". DMs and
 * group chats are open to their members only; in a one-to-one DM a block either way stops new
 * messages (what was said stays readable).
 */
export async function roomAccess(db: Db, channelId: bigint, userId: bigint): Promise<RoomContext> {
  const [channel] = await db
    .select()
    .from(channels)
    .where(and(eq(channels.id, channelId), isNull(channels.deletedAt)))
    .limit(1);
  if (!channel) throw notFound("Room");
  if (isConversation(channel)) {
    const rows = await db
      .select({ userId: channelRecipients.userId })
      .from(channelRecipients)
      .where(eq(channelRecipients.channelId, channel.id));
    const recipients = rows.map((r) => r.userId);
    if (!recipients.includes(userId)) throw notFound("Conversation");
    let permissions = DM_PERMISSIONS;
    if (channel.type === "dm") {
      const other = recipients.find((id) => id !== userId);
      if (other && (await blockedEitherWay(db, userId, other))) {
        permissions &= ~(
          Permission.SEND_MESSAGES |
          Permission.ADD_REACTIONS |
          Permission.ATTACH_FILES
        );
      }
    }
    return { channel, access: null, overwrites: [], permissions, recipients };
  }
  if (!channel.communityId) throw notFound("Room");
  const community = await findSpace(db, channel.communityId.toString());
  if (!community) throw notFound("Room");
  const access = await loadAccess(db, community, userId);
  const overwrites = await overwritesFor(db, [channel.id]);
  const permissions = roomPermissions(access, userId, overwrites);
  if (!has(permissions, Permission.VIEW_CHANNEL)) throw notFound("Room");
  return { channel, access, overwrites, permissions, recipients: null };
}
