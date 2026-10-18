import { isMinor, TEEN_USER_SETTINGS } from "@realm/contracts";
import { and, eq, isNull, schema } from "@realm/db";
import type { Deps } from "../../deps";
import { blockedEitherWay } from "../spaces/access";

type Db = Deps["db"];
type PostRow = typeof schema.posts.$inferSelect;

const { users, userSettings, follows, communityMembers } = schema;

/**
 * Whether an account is private: its setting, or the teen default when it has none yet. A
 * business account is always public.
 */
export async function isPrivateAccount(db: Db, userId: bigint): Promise<boolean> {
  const [row] = await db
    .select({
      kind: users.accountKind,
      birthDate: users.birthDate,
      visibility: userSettings.profileVisibility,
    })
    .from(users)
    .leftJoin(userSettings, eq(userSettings.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return false;
  if (row.kind === "business") return false;
  if (row.visibility) return row.visibility === "private";
  return isMinor(row.birthDate) && TEEN_USER_SETTINGS.profileVisibility === "private";
}

export async function followsActively(db: Db, followerId: bigint, followeeId: bigint) {
  const [row] = await db
    .select({ status: follows.status })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)))
    .limit(1);
  return row?.status === "active";
}

export async function isMember(db: Db, userId: bigint, communityId: bigint) {
  const [row] = await db
    .select({ userId: communityMembers.userId })
    .from(communityMembers)
    .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)))
    .limit(1);
  return Boolean(row);
}

/**
 * Who may see a post: its author (even once it's taken down, so they know); members of the Space
 * it was shared to; everyone for a public post (even from a private account: that's the author's
 * choice per post); the author's followers for a followers post. Never across a block, and never
 * once deleted.
 */
export async function canSeePost(db: Db, post: PostRow, viewerId: bigint | null) {
  if (post.deletedAt) return false;
  if (viewerId === post.authorId) return true;
  if (post.removedAt) return false;
  if (viewerId && (await blockedEitherWay(db, viewerId, post.authorId))) return false;
  if (post.communityId && viewerId && (await isMember(db, viewerId, post.communityId))) {
    return true;
  }
  if (post.visibility === "public") return true;
  if (post.visibility === "followers" && viewerId) {
    return followsActively(db, viewerId, post.authorId);
  }
  return false;
}

/** Whether an upload belongs to a post this person can see (for reading the file itself). */
export async function seenThroughPost(db: Db, mediaId: bigint, viewerId: bigint | null) {
  const rows = await db
    .select({ post: schema.posts })
    .from(schema.postMedia)
    .innerJoin(schema.posts, eq(schema.posts.id, schema.postMedia.postId))
    .where(and(eq(schema.postMedia.mediaId, mediaId), isNull(schema.posts.deletedAt)))
    .limit(3);
  for (const { post } of rows) if (await canSeePost(db, post, viewerId)) return true;
  return false;
}
