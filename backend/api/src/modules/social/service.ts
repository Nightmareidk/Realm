import type {
  Activity,
  ActivityPage,
  Comment,
  CreateCommentBody,
  CreatePostBody,
  FollowRequest,
  FollowState,
  Post,
  PostPage,
  PostVisibility,
  Profile,
  SearchResults,
  Suggestion,
  UpdateAccountBody,
  UpdatePostBody,
  UserSummary,
} from "@realm/contracts";
import { Limits } from "@realm/contracts";
import { and, desc, eq, inArray, isNotNull, isNull, lt, or, schema, sql } from "@realm/db";
import type { Deps } from "../../deps";
import { AppError, badRequest, forbidden, notFound } from "../../lib/errors";
import { mediaUrl, toPublicUser } from "../../lib/serialize";
import { summaryColumns, toMediaRef, toUserSummary } from "../../lib/serialize-spaces";
import { guardMessage } from "../../lib/spam";
import { MusicService } from "../music/service";
import { blockedEitherWay } from "../spaces/access";
import { canSeePost, followsActively, isMember, isPrivateAccount } from "./access";

const {
  posts,
  postMedia,
  comments,
  votes,
  saves,
  follows,
  users,
  userSettings,
  communities,
  communityMembers,
  media,
  notifications,
  relationships,
  messageAttachments,
} = schema;

type PostRow = typeof posts.$inferSelect;
type Db = Deps["db"];

const ACTIVITY_TYPES = [
  "follow",
  "follow_request",
  "post_like",
  "post_comment",
  "comment_reply",
] as const;

const toDbVisibility = (v: PostVisibility) => (v === "space" ? "community" : v);
const fromDbVisibility = (v: PostRow["visibility"]): PostVisibility =>
  v === "community" ? "space" : v;

/** Zero-padded IDs, so sorting comment paths as text keeps each thread in order. */
const pad = (id: bigint) => id.toString().padStart(20, "0");

const invalid = (message: string) => badRequest("BAD_REQUEST", message);

/** Everyone in a block with this person, either way round (their posts never show). */
const blockedWith = (viewerId: bigint) => sql`(
  select ${relationships.targetId} from ${relationships}
    where ${relationships.userId} = ${viewerId} and ${relationships.type} = 'blocked'
  union
  select ${relationships.userId} from ${relationships}
    where ${relationships.targetId} = ${viewerId} and ${relationships.type} = 'blocked'
)`;

export class SocialService {
  constructor(private readonly deps: Deps) {}

  private get db(): Db {
    return this.deps.db;
  }

  /* ── Posts ─────────────────────────────────────────────────────────────── */

  async create(authorId: bigint, body: CreatePostBody): Promise<Post> {
    const ids = body.mediaIds.map((id) => BigInt(id));
    const caption = body.caption?.trim() || null;
    if (body.kind === "text" && (!caption || ids.length)) {
      throw invalid("A text post needs words, and no photos.");
    }
    if (body.kind === "image" && ids.length === 0) throw invalid("Add at least one photo.");
    if (body.kind === "clip" && ids.length !== 1) throw invalid("A Clip is one video.");

    const files = await this.postable(authorId, ids);
    const want = body.kind === "clip" ? "video" : "image";
    if (files.some((f) => f.kind !== want)) {
      throw invalid(body.kind === "clip" ? "A Clip has to be a video." : "Posts take photos.");
    }

    if (caption) await this.guard(authorId, caption);

    const spaceId = body.spaceId ? BigInt(body.spaceId) : null;
    if (spaceId && !(await isMember(this.db, authorId, spaceId))) {
      throw forbidden("Join that Space to share to it.");
    }
    if (body.visibility === "space" && !spaceId) throw invalid("Pick the Space to share it to.");
    const visibility: PostVisibility =
      body.visibility ?? ((await isPrivateAccount(this.db, authorId)) ? "followers" : "public");

    if (body.sound && body.kind === "text") throw invalid("Music goes on photos and Clips.");
    const sound = await new MusicService(this.deps).pick(body.sound);
    const id = this.deps.ids.next();
    await this.db.insert(posts).values({
      id,
      authorId,
      communityId: spaceId,
      kind: body.kind,
      body: caption,
      visibility: toDbVisibility(visibility),
      ...(sound ?? {}),
    });
    if (files.length) {
      await this.db
        .insert(postMedia)
        .values(files.map((f, position) => ({ postId: id, position, mediaId: f.id })));
    }
    const [row] = await this.db.select().from(posts).where(eq(posts.id, id));
    return (await this.hydrate([row as PostRow], authorId))[0] as Post;
  }

  /**
   * The same automated spam checks as chat (bursts, the same words again and again, links from
   * brand-new accounts), so nobody has to read posts and comments to catch spam.
   */
  private async guard(authorId: bigint, text: string) {
    const [author] = await this.db
      .select({ id: users.id, createdAt: users.createdAt, emailVerifiedAt: users.emailVerifiedAt })
      .from(users)
      .where(eq(users.id, authorId))
      .limit(1);
    if (author) await guardMessage(this.deps, author, text);
  }

  /** Uploads a post may use: the author's own, finished, and not already posted or sent. */
  private async postable(authorId: bigint, ids: bigint[]) {
    if (ids.length === 0) return [];
    if (new Set(ids.map(String)).size !== ids.length) throw invalid("A photo is in there twice.");
    const rows = await this.db
      .select()
      .from(media)
      .where(and(inArray(media.id, ids), eq(media.ownerId, authorId), eq(media.status, "ready")));
    if (rows.length !== ids.length)
      throw invalid("One of those isn't uploaded yet, or isn't yours.");
    const [inPost] = await this.db
      .select({ id: postMedia.mediaId })
      .from(postMedia)
      .where(inArray(postMedia.mediaId, ids))
      .limit(1);
    const [inMessage] = await this.db
      .select({ id: messageAttachments.mediaId })
      .from(messageAttachments)
      .where(inArray(messageAttachments.mediaId, ids))
      .limit(1);
    if (inPost || inMessage) throw invalid("That's already posted. Upload it again to reuse it.");
    return ids.map((id) => rows.find((r) => r.id === id) as (typeof rows)[number]);
  }

  async get(id: bigint, viewerId: bigint | null): Promise<Post> {
    const row = await this.visible(id, viewerId);
    return (await this.hydrate([row], viewerId))[0] as Post;
  }

  private async visible(id: bigint, viewerId: bigint | null): Promise<PostRow> {
    const [row] = await this.db.select().from(posts).where(eq(posts.id, id)).limit(1);
    if (!row || !(await canSeePost(this.db, row, viewerId))) throw notFound("Post");
    return row;
  }

  async update(id: bigint, userId: bigint, body: UpdatePostBody): Promise<Post> {
    const row = await this.visible(id, userId);
    if (row.authorId !== userId) throw forbidden("Only the person who posted it can change it.");
    if (body.visibility === "space" && !row.communityId) {
      throw invalid("It isn't shared to a Space, so it can't be Space-only.");
    }
    const captionChanged = body.caption !== undefined && (body.caption || null) !== row.body;
    await this.db
      .update(posts)
      .set({
        body: body.caption === undefined ? undefined : body.caption || null,
        visibility: body.visibility ? toDbVisibility(body.visibility) : undefined,
        editedAt: captionChanged ? new Date() : undefined,
      })
      .where(eq(posts.id, id));
    return this.get(id, userId);
  }

  async remove(id: bigint, userId: bigint): Promise<void> {
    const row = await this.visible(id, userId);
    if (row.authorId !== userId) throw forbidden("Only the person who posted it can delete it.");
    await this.db.update(posts).set({ deletedAt: new Date() }).where(eq(posts.id, id));
  }

  async like(id: bigint, userId: bigint, on: boolean): Promise<Post> {
    const row = await this.visible(id, userId);
    if (on) {
      const added = await this.db
        .insert(votes)
        .values({ userId, targetType: "post", targetId: id, value: 1 })
        .onConflictDoNothing()
        .returning({ userId: votes.userId });
      if (added.length) {
        await this.db
          .update(posts)
          .set({ score: sql`${posts.score} + 1` })
          .where(eq(posts.id, id));
        if (row.authorId !== userId) {
          await this.notify(row.authorId, "post_like", userId, "post", id, {}, `like:${id}`);
        }
      }
    } else {
      const removed = await this.db
        .delete(votes)
        .where(and(eq(votes.userId, userId), eq(votes.targetType, "post"), eq(votes.targetId, id)))
        .returning({ userId: votes.userId });
      if (removed.length) {
        await this.db
          .update(posts)
          .set({ score: sql`greatest(${posts.score} - 1, 0)` })
          .where(eq(posts.id, id));
      }
    }
    await this.postNews(id);
    return this.get(id, userId);
  }

  /** Tell everyone looking at a post its likes and comments, as they change. */
  private async postNews(id: bigint) {
    const [row] = await this.db
      .select({ likeCount: posts.score, commentCount: posts.commentCount })
      .from(posts)
      .where(eq(posts.id, id))
      .limit(1);
    if (!row) return;
    await this.deps.bus.publish(`post:${id}`, {
      type: "POST_COUNTS",
      data: { id: id.toString(), likeCount: row.likeCount, commentCount: row.commentCount },
    });
  }

  async save(id: bigint, userId: bigint, on: boolean): Promise<Post> {
    await this.visible(id, userId);
    if (on) {
      const added = await this.db
        .insert(saves)
        .values({ userId, postId: id })
        .onConflictDoNothing()
        .returning({ userId: saves.userId });
      if (added.length) {
        await this.db
          .update(posts)
          .set({ saveCount: sql`${posts.saveCount} + 1` })
          .where(eq(posts.id, id));
      }
    } else {
      const removed = await this.db
        .delete(saves)
        .where(and(eq(saves.userId, userId), eq(saves.postId, id)))
        .returning({ userId: saves.userId });
      if (removed.length) {
        await this.db
          .update(posts)
          .set({ saveCount: sql`greatest(${posts.saveCount} - 1, 0)` })
          .where(eq(posts.id, id));
      }
    }
    return this.get(id, userId);
  }

  /* ── Feeds ─────────────────────────────────────────────────────────────── */

  /** Home: your own posts, people you follow, and what's shared to your Spaces. Newest first. */
  async home(viewerId: bigint, before: bigint | null, limit: number): Promise<PostPage> {
    const rows = await this.db
      .select()
      .from(posts)
      .where(
        and(
          isNull(posts.deletedAt),
          isNull(posts.removedAt),
          before ? lt(posts.id, before) : undefined,
          sql`${posts.authorId} not in ${blockedWith(viewerId)}`,
          or(
            eq(posts.authorId, viewerId),
            and(
              sql`${posts.authorId} in (select ${follows.followeeId} from ${follows} where ${follows.followerId} = ${viewerId} and ${follows.status} = 'active')`,
              inArray(posts.visibility, ["public", "followers"]),
            ),
            sql`${posts.communityId} in (select ${communityMembers.communityId} from ${communityMembers} where ${communityMembers.userId} = ${viewerId})`,
          ),
        ),
      )
      .orderBy(desc(posts.id))
      .limit(limit + 1);
    return this.page(rows, limit, viewerId);
  }

  /** Clips: public Clips from anyone, plus those from people you follow and your Spaces. */
  async clips(viewerId: bigint | null, before: bigint | null, limit: number): Promise<PostPage> {
    const rows = await this.db
      .select()
      .from(posts)
      .where(
        and(
          eq(posts.kind, "clip"),
          isNull(posts.deletedAt),
          isNull(posts.removedAt),
          before ? lt(posts.id, before) : undefined,
          viewerId ? sql`${posts.authorId} not in ${blockedWith(viewerId)}` : undefined,
          viewerId
            ? or(
                eq(posts.visibility, "public"),
                eq(posts.authorId, viewerId),
                and(
                  eq(posts.visibility, "followers"),
                  sql`${posts.authorId} in (select ${follows.followeeId} from ${follows} where ${follows.followerId} = ${viewerId} and ${follows.status} = 'active')`,
                ),
                sql`${posts.communityId} in (select ${communityMembers.communityId} from ${communityMembers} where ${communityMembers.userId} = ${viewerId})`,
              )
            : eq(posts.visibility, "public"),
        ),
      )
      .orderBy(desc(posts.id))
      .limit(limit + 1);
    return this.page(rows, limit, viewerId);
  }

  /**
   * Explore (a grid of what's good right now): popular public posts and Clips from the last month,
   * from public adult accounts you don't already follow. Never yours, never anyone in a block with
   * you, never a teen's (their posts stay off discovery, as the big apps do).
   */
  async explore(viewerId: bigint, page: number): Promise<PostPage> {
    const size = 30;
    const rows = await this.db
      .select({ post: posts })
      .from(posts)
      .innerJoin(users, eq(users.id, posts.authorId))
      .leftJoin(userSettings, eq(userSettings.userId, posts.authorId))
      .where(
        and(
          inArray(posts.kind, ["image", "clip"]),
          eq(posts.visibility, "public"),
          isNull(posts.deletedAt),
          isNull(posts.removedAt),
          isNull(posts.communityId),
          eq(users.status, "active"),
          sql`${posts.createdAt} > now() - interval '30 days'`,
          sql`${posts.authorId} <> ${viewerId}`,
          sql`${posts.authorId} not in ${blockedWith(viewerId)}`,
          sql`${posts.authorId} not in (select ${follows.followeeId} from ${follows} where ${follows.followerId} = ${viewerId})`,
          // Public accounts (an adult with no settings saved yet is public too).
          or(
            eq(users.accountKind, "business"),
            sql`coalesce(${userSettings.profileVisibility}, 'public') = 'public'`,
          ),
          sql`(${users.birthDate} is null or ${users.birthDate} <= now() - interval '18 years')`,
        ),
      )
      // Likes and comments, cooling with age (a day-old post needs more to stay up).
      .orderBy(
        sql`(${posts.score} * 2 + ${posts.commentCount} * 3 + 1) / power(extract(epoch from now() - ${posts.createdAt}) / 3600 + 2, 1.2) desc`,
        desc(posts.id),
      )
      .limit(size + 1)
      .offset(page * size);
    const items = await this.hydrate(
      rows.slice(0, size).map((r) => r.post),
      viewerId,
    );
    return { items, nextCursor: rows.length > size && page < 9 ? String(page + 1) : null };
  }

  /** One person's posts or Clips, as much of them as this viewer may see. */
  async byAuthor(
    authorId: bigint,
    viewerId: bigint | null,
    kind: "image" | "clip" | null,
    before: bigint | null,
    limit: number,
  ): Promise<PostPage> {
    if (
      viewerId &&
      viewerId !== authorId &&
      (await blockedEitherWay(this.db, viewerId, authorId))
    ) {
      return { items: [], nextCursor: null };
    }
    const self = viewerId === authorId;
    const following =
      viewerId && !self ? await followsActively(this.db, viewerId, authorId) : false;
    const seeing = self
      ? undefined
      : or(
          eq(posts.visibility, "public"),
          following ? eq(posts.visibility, "followers") : undefined,
          viewerId
            ? sql`${posts.communityId} in (select ${communityMembers.communityId} from ${communityMembers} where ${communityMembers.userId} = ${viewerId})`
            : undefined,
        );
    const rows = await this.db
      .select()
      .from(posts)
      .where(
        and(
          eq(posts.authorId, authorId),
          isNull(posts.deletedAt),
          // You still see your own posts once taken down, marked, so you know why.
          self ? undefined : isNull(posts.removedAt),
          kind ? eq(posts.kind, kind) : inArray(posts.kind, ["image", "text"]),
          // Pinned posts lead the first page only, so they never show twice.
          before ? and(lt(posts.id, before), isNull(posts.pinnedAt)) : undefined,
          seeing,
        ),
      )
      .orderBy(sql`${posts.pinnedAt} desc nulls last`, desc(posts.id))
      .limit(limit + 1);
    return this.page(rows, limit, viewerId);
  }

  /** Pin a post to the top of your profile (up to three), or unpin it. */
  async pin(id: bigint, userId: bigint, on: boolean): Promise<Post> {
    const [row] = await this.db.select().from(posts).where(eq(posts.id, id)).limit(1);
    if (!row || row.deletedAt) throw notFound("Post");
    if (row.authorId !== userId) throw forbidden("Only its author can pin a post.");
    if (on && !row.pinnedAt) {
      const [count] = await this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(posts)
        .where(and(eq(posts.authorId, userId), isNotNull(posts.pinnedAt), isNull(posts.deletedAt)));
      if ((count?.n ?? 0) >= Limits.pinnedPosts) {
        throw badRequest(
          "LIMIT_REACHED",
          `You can pin up to ${Limits.pinnedPosts} posts. Unpin one first.`,
        );
      }
    }
    await this.db
      .update(posts)
      .set({ pinnedAt: on ? (row.pinnedAt ?? new Date()) : null })
      .where(eq(posts.id, id));
    return this.get(id, userId);
  }

  async saved(userId: bigint, before: bigint | null, limit: number): Promise<PostPage> {
    const rows = await this.db
      .select({ post: posts })
      .from(saves)
      .innerJoin(posts, eq(posts.id, saves.postId))
      .where(
        and(
          eq(saves.userId, userId),
          isNull(posts.deletedAt),
          isNull(posts.removedAt),
          before ? lt(posts.id, before) : undefined,
        ),
      )
      .orderBy(desc(posts.id))
      .limit(limit + 1);
    const visible: PostRow[] = [];
    for (const { post } of rows) if (await canSeePost(this.db, post, userId)) visible.push(post);
    return this.page(visible, limit, userId);
  }

  private async page(rows: PostRow[], limit: number, viewerId: bigint | null): Promise<PostPage> {
    const more = rows.length > limit;
    const shown = rows.slice(0, limit);
    return {
      items: await this.hydrate(shown, viewerId),
      nextCursor: more ? (shown.at(-1)?.id.toString() ?? null) : null,
    };
  }

  /** Posts with their authors, photos, Space, and whether this viewer liked or saved them. */
  async hydrate(rows: PostRow[], viewerId: bigint | null): Promise<Post[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const authorIds = [...new Set(rows.map((r) => r.authorId))];
    const spaceIds = [...new Set(rows.flatMap((r) => (r.communityId ? [r.communityId] : [])))];
    const [authors, files, spaces, liked, saved] = await Promise.all([
      this.db.select(summaryColumns).from(users).where(inArray(users.id, authorIds)),
      this.db
        .select({ postId: postMedia.postId, position: postMedia.position, file: media })
        .from(postMedia)
        .innerJoin(media, eq(media.id, postMedia.mediaId))
        .where(inArray(postMedia.postId, ids))
        .orderBy(postMedia.position),
      spaceIds.length
        ? this.db
            .select({
              id: communities.id,
              name: communities.name,
              accent: communities.accent,
              iconMediaId: communities.iconMediaId,
            })
            .from(communities)
            .where(inArray(communities.id, spaceIds))
        : Promise.resolve([]),
      viewerId
        ? this.db
            .select({ id: votes.targetId })
            .from(votes)
            .where(
              and(
                eq(votes.userId, viewerId),
                eq(votes.targetType, "post"),
                inArray(votes.targetId, ids),
              ),
            )
        : Promise.resolve([]),
      viewerId
        ? this.db
            .select({ id: saves.postId })
            .from(saves)
            .where(and(eq(saves.userId, viewerId), inArray(saves.postId, ids)))
        : Promise.resolve([]),
    ]);
    const soundList = await new MusicService(this.deps).uses(rows);
    const likedSet = new Set(liked.map((l) => l.id.toString()));
    const savedSet = new Set(saved.map((s) => s.id.toString()));
    return rows.map((r, i) => {
      const author = authors.find((a) => a.id === r.authorId);
      const space = r.communityId ? spaces.find((s) => s.id === r.communityId) : undefined;
      return {
        sound: soundList[i] ?? null,
        id: r.id.toString(),
        author: author ? toUserSummary(author) : deletedUser(r.authorId),
        kind: r.kind === "clip" ? "clip" : r.kind === "text" ? "text" : "image",
        caption: r.body,
        media: files.filter((f) => f.postId === r.id).map((f) => toMediaRef(f.file)),
        space: space
          ? {
              id: space.id.toString(),
              name: space.name,
              accent: space.accent,
              iconUrl: space.iconMediaId ? mediaUrl(space.iconMediaId) : null,
            }
          : null,
        visibility: fromDbVisibility(r.visibility),
        likeCount: r.score,
        commentCount: r.commentCount,
        liked: likedSet.has(r.id.toString()),
        saved: savedSet.has(r.id.toString()),
        createdAt: r.createdAt.toISOString(),
        editedAt: r.editedAt?.toISOString() ?? null,
        pinned: r.pinnedAt !== null,
        hidden: r.removedAt !== null,
      } satisfies Post;
    });
  }

  /* ── Comments ──────────────────────────────────────────────────────────── */

  async comments(postId: bigint, viewerId: bigint | null): Promise<Comment[]> {
    await this.visible(postId, viewerId);
    const rows = await this.db
      .select({ c: comments, author: summaryColumns })
      .from(comments)
      .innerJoin(users, eq(users.id, comments.authorId))
      .where(
        and(
          eq(comments.postId, postId),
          isNull(comments.deletedAt),
          // A comment taken down after reports still shows to the person who wrote it.
          viewerId
            ? or(isNull(comments.removedAt), eq(comments.authorId, viewerId))
            : isNull(comments.removedAt),
          viewerId ? sql`${comments.authorId} not in ${blockedWith(viewerId)}` : undefined,
        ),
      )
      .orderBy(comments.path)
      .limit(500);
    const mine =
      viewerId && rows.length
        ? await this.db
            .select({ id: votes.targetId })
            .from(votes)
            .where(
              and(
                eq(votes.userId, viewerId),
                eq(votes.targetType, "comment"),
                inArray(
                  votes.targetId,
                  rows.map((r) => r.c.id),
                ),
              ),
            )
        : [];
    const liked = new Set(mine.map((m) => m.id));
    return rows.map(({ c, author }) => toComment(c, author, liked.has(c.id)));
  }

  /** Like or unlike a comment (it counts once per person). */
  async likeComment(postId: bigint, commentId: bigint, userId: bigint, on: boolean) {
    await this.visible(postId, userId);
    const [c] = await this.db
      .select({ id: comments.id, authorId: comments.authorId })
      .from(comments)
      .where(
        and(
          eq(comments.id, commentId),
          eq(comments.postId, postId),
          isNull(comments.deletedAt),
          isNull(comments.removedAt),
        ),
      )
      .limit(1);
    if (!c) throw notFound("Comment");
    if (on) {
      const added = await this.db
        .insert(votes)
        .values({ userId, targetType: "comment", targetId: commentId, value: 1 })
        .onConflictDoNothing()
        .returning({ userId: votes.userId });
      if (added.length) {
        await this.db
          .update(comments)
          .set({ score: sql`${comments.score} + 1` })
          .where(eq(comments.id, commentId));
      }
    } else {
      const removed = await this.db
        .delete(votes)
        .where(
          and(
            eq(votes.userId, userId),
            eq(votes.targetType, "comment"),
            eq(votes.targetId, commentId),
          ),
        )
        .returning({ userId: votes.userId });
      if (removed.length) {
        await this.db
          .update(comments)
          .set({ score: sql`greatest(${comments.score} - 1, 0)` })
          .where(eq(comments.id, commentId));
      }
    }
    const [now] = await this.db
      .select({ score: comments.score })
      .from(comments)
      .where(eq(comments.id, commentId));
    return { likeCount: now?.score ?? 0, liked: on };
  }

  async comment(postId: bigint, userId: bigint, body: CreateCommentBody): Promise<Comment> {
    const post = await this.visible(postId, userId);
    if (post.lockedAt) throw forbidden("Comments are turned off on this post.");
    let parent: typeof comments.$inferSelect | undefined;
    if (body.parentId) {
      [parent] = await this.db
        .select()
        .from(comments)
        .where(and(eq(comments.id, BigInt(body.parentId)), eq(comments.postId, postId)))
        .limit(1);
      if (!parent || parent.deletedAt || parent.removedAt) throw notFound("Comment");
    }
    await this.guard(userId, body.body);
    const id = this.deps.ids.next();
    // Replies to replies stay at one level under the comment they answer, like Instagram.
    const anchor = parent && parent.depth > 0 ? parent.path.split(".")[0] : parent?.path;
    await this.db.insert(comments).values({
      id,
      postId,
      authorId: userId,
      parentId: parent?.id ?? null,
      path: anchor ? `${anchor}.${pad(id)}` : pad(id),
      depth: parent ? 1 : 0,
      body: body.body,
    });
    await this.db
      .update(posts)
      .set({ commentCount: sql`${posts.commentCount} + 1` })
      .where(eq(posts.id, postId));
    if (parent && parent.authorId !== userId) {
      await this.notify(parent.authorId, "comment_reply", userId, "post", postId, {
        text: body.body.slice(0, 120),
      });
    }
    if (post.authorId !== userId && post.authorId !== parent?.authorId) {
      await this.notify(post.authorId, "post_comment", userId, "post", postId, {
        text: body.body.slice(0, 120),
      });
    }
    const [row] = await this.db
      .select({ c: comments, author: summaryColumns })
      .from(comments)
      .innerJoin(users, eq(users.id, comments.authorId))
      .where(eq(comments.id, id));
    if (!row) throw notFound("Comment");
    const made = toComment(row.c, row.author);
    await this.deps.bus.publish(`post:${postId}`, { type: "COMMENT_CREATE", data: made });
    await this.postNews(postId);
    return made;
  }

  async deleteComment(postId: bigint, commentId: bigint, userId: bigint): Promise<void> {
    const post = await this.visible(postId, userId);
    const [row] = await this.db
      .select()
      .from(comments)
      .where(and(eq(comments.id, commentId), eq(comments.postId, postId)))
      .limit(1);
    if (!row || row.deletedAt) throw notFound("Comment");
    if (row.authorId !== userId && post.authorId !== userId) {
      throw forbidden("You can delete your own comments, and any on your posts.");
    }
    await this.db.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, commentId));
    await this.db
      .update(posts)
      .set({ commentCount: sql`greatest(${posts.commentCount} - 1, 0)` })
      .where(eq(posts.id, postId));
    await this.deps.bus.publish(`post:${postId}`, {
      type: "COMMENT_DELETE",
      data: { postId: postId.toString(), id: commentId.toString() },
    });
    await this.postNews(postId);
  }

  /* ── Follows ───────────────────────────────────────────────────────────── */

  async followState(viewerId: bigint, targetId: bigint): Promise<FollowState> {
    const [row] = await this.db
      .select({ status: follows.status })
      .from(follows)
      .where(and(eq(follows.followerId, viewerId), eq(follows.followeeId, targetId)))
      .limit(1);
    return row?.status === "active" ? "following" : row ? "requested" : "none";
  }

  async follow(viewerId: bigint, targetId: bigint): Promise<FollowState> {
    if (viewerId === targetId) throw invalid("That's you.");
    await this.activeUser(targetId);
    if (await blockedEitherWay(this.db, viewerId, targetId)) {
      throw new AppError(403, "BLOCKED", "You can't follow this account.");
    }
    const current = await this.followState(viewerId, targetId);
    if (current !== "none") return current;
    const pending = await isPrivateAccount(this.db, targetId);
    await this.db
      .insert(follows)
      .values({
        followerId: viewerId,
        followeeId: targetId,
        status: pending ? "pending" : "active",
      })
      .onConflictDoNothing();
    await this.notify(
      targetId,
      pending ? "follow_request" : "follow",
      viewerId,
      "user",
      viewerId,
      {},
    );
    if (!pending) await this.countsChanged(viewerId, targetId);
    return pending ? "requested" : "following";
  }

  async unfollow(viewerId: bigint, targetId: bigint): Promise<FollowState> {
    await this.db
      .delete(follows)
      .where(and(eq(follows.followerId, viewerId), eq(follows.followeeId, targetId)));
    await this.countsChanged(viewerId, targetId);
    return "none";
  }

  /** Tell both people's open screens their follower and following counts, live. */
  private async countsChanged(...userIds: bigint[]) {
    for (const userId of new Set(userIds)) {
      const [row] = await this.db
        .select({
          followers: sql<number>`(select count(*)::int from ${follows} where ${follows.followeeId} = ${userId} and ${follows.status} = 'active')`,
          following: sql<number>`(select count(*)::int from ${follows} where ${follows.followerId} = ${userId} and ${follows.status} = 'active')`,
        })
        .from(sql`(select 1) as one`);
      if (!row) continue;
      const data = {
        userId: userId.toString(),
        followers: row.followers,
        following: row.following,
      };
      // To the person, and to anyone looking at them who follows the change through their own.
      await this.deps.bus.publish(`user:${userId}`, { type: "PROFILE_COUNTS", data });
      for (const other of userIds) {
        if (other !== userId) {
          await this.deps.bus.publish(`user:${other}`, { type: "PROFILE_COUNTS", data });
        }
      }
    }
  }

  async requests(userId: bigint): Promise<FollowRequest[]> {
    const rows = await this.db
      .select({ user: summaryColumns, at: follows.createdAt })
      .from(follows)
      .innerJoin(users, eq(users.id, follows.followerId))
      .where(and(eq(follows.followeeId, userId), eq(follows.status, "pending")))
      .orderBy(desc(follows.createdAt))
      .limit(200);
    return rows.map((r) => ({ user: toUserSummary(r.user), createdAt: r.at.toISOString() }));
  }

  async respond(userId: bigint, requesterId: bigint, accept: boolean): Promise<void> {
    const where = and(
      eq(follows.followerId, requesterId),
      eq(follows.followeeId, userId),
      eq(follows.status, "pending"),
    );
    if (accept) {
      const done = await this.db
        .update(follows)
        .set({ status: "active" })
        .where(where)
        .returning({ id: follows.followerId });
      if (!done.length) throw notFound("Request");
      await this.notify(requesterId, "follow", userId, "user", userId, { accepted: true });
      await this.countsChanged(userId, requesterId);
    } else {
      await this.db.delete(follows).where(where);
    }
  }

  /** Going public lets everyone who asked in. */
  async acceptAllPending(userId: bigint): Promise<void> {
    await this.db
      .update(follows)
      .set({ status: "active" })
      .where(and(eq(follows.followeeId, userId), eq(follows.status, "pending")));
  }

  async removeFollower(userId: bigint, followerId: bigint): Promise<void> {
    await this.db
      .delete(follows)
      .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, userId)));
    await this.countsChanged(userId, followerId);
  }

  async people(
    targetId: bigint,
    viewerId: bigint | null,
    side: "followers" | "following",
    before: bigint | null,
  ): Promise<{ items: UserSummary[]; nextCursor: string | null }> {
    await this.mayListPeople(targetId, viewerId);
    const other = side === "followers" ? follows.followerId : follows.followeeId;
    const own = side === "followers" ? follows.followeeId : follows.followerId;
    const rows = await this.db
      .select({ user: summaryColumns })
      .from(follows)
      .innerJoin(users, eq(users.id, other))
      .where(
        and(
          eq(own, targetId),
          eq(follows.status, "active"),
          before ? lt(other, before) : undefined,
        ),
      )
      .orderBy(desc(other))
      .limit(51);
    const more = rows.length > 50;
    const shown = rows.slice(0, 50);
    return {
      items: shown.map((r) => toUserSummary(r.user)),
      nextCursor: more ? (shown.at(-1)?.user.id.toString() ?? null) : null,
    };
  }

  private async mayListPeople(targetId: bigint, viewerId: bigint | null) {
    if (viewerId === targetId) return;
    if (viewerId && (await blockedEitherWay(this.db, viewerId, targetId))) throw notFound("User");
    if (!(await isPrivateAccount(this.db, targetId))) return;
    if (viewerId && (await followsActively(this.db, viewerId, targetId))) return;
    throw new AppError(403, "PRIVATE_ACCOUNT", "This account is private.");
  }

  /* ── Profiles and accounts ─────────────────────────────────────────────── */

  async profile(username: string, viewerId: bigint | null): Promise<Profile> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(sql`lower(${users.username}) = ${username} and ${users.status} = 'active'`)
      .limit(1);
    if (!user) throw notFound("User");
    if (viewerId && viewerId !== user.id && (await blockedEitherWay(this.db, viewerId, user.id))) {
      throw notFound("User");
    }
    const isSelf = viewerId === user.id;
    const [privateAccount, follow, followsYou, counts, followedBy] = await Promise.all([
      isPrivateAccount(this.db, user.id),
      viewerId && !isSelf ? this.followState(viewerId, user.id) : Promise.resolve("none" as const),
      viewerId && !isSelf ? followsActively(this.db, user.id, viewerId) : Promise.resolve(false),
      this.counts(user.id),
      viewerId && !isSelf
        ? this.mutuals(viewerId, user.id)
        : Promise.resolve({ users: [], count: 0 }),
    ]);
    return {
      user: toPublicUser(user),
      accountKind: user.accountKind,
      category: user.category,
      websiteUrl: user.websiteUrl,
      isPrivate: privateAccount,
      isSelf,
      counts,
      follow,
      followsYou,
      followedBy,
      canSeeAll: isSelf || !privateAccount || follow === "following",
    };
  }

  /** People you follow who also follow them ("Followed by noor, kenji and 4 others"). */
  private async mutuals(viewerId: bigint, targetId: bigint) {
    const mine = sql`(select ${follows.followeeId} from ${follows} where ${follows.followerId} = ${viewerId} and ${follows.status} = 'active')`;
    const where = and(
      eq(follows.followeeId, targetId),
      eq(follows.status, "active"),
      sql`${follows.followerId} in ${mine}`,
      sql`${follows.followerId} not in ${blockedWith(viewerId)}`,
    );
    const [rows, [count]] = await Promise.all([
      this.db
        .select(summaryColumns)
        .from(follows)
        .innerJoin(users, eq(users.id, follows.followerId))
        .where(and(where, eq(users.status, "active")))
        .orderBy(desc(follows.createdAt))
        .limit(3),
      this.db.select({ n: sql<number>`count(*)::int` }).from(follows).where(where),
    ]);
    return { users: rows.map(toUserSummary), count: count?.n ?? 0 };
  }

  private async counts(userId: bigint) {
    const [row] = await this.db
      .select({
        posts: sql<number>`(select count(*)::int from ${posts} where ${posts.authorId} = ${userId} and ${posts.deletedAt} is null and ${posts.removedAt} is null)`,
        followers: sql<number>`(select count(*)::int from ${follows} where ${follows.followeeId} = ${userId} and ${follows.status} = 'active')`,
        following: sql<number>`(select count(*)::int from ${follows} where ${follows.followerId} = ${userId} and ${follows.status} = 'active')`,
      })
      .from(users)
      .where(eq(users.id, userId));
    return {
      posts: Number(row?.posts ?? 0),
      followers: Number(row?.followers ?? 0),
      following: Number(row?.following ?? 0),
    };
  }

  /** Personal or business. A business account is public, so its pending requests go through. */
  async updateAccount(userId: bigint, body: UpdateAccountBody): Promise<void> {
    await this.db
      .update(users)
      .set({
        accountKind: body.accountKind,
        category: body.category === undefined ? undefined : body.category || null,
        websiteUrl: body.websiteUrl === undefined ? undefined : body.websiteUrl || null,
      })
      .where(eq(users.id, userId));
    if (body.accountKind === "business") {
      await this.db
        .insert(userSettings)
        .values({ userId, profileVisibility: "public" })
        .onConflictDoUpdate({ target: userSettings.userId, set: { profileVisibility: "public" } });
      await this.acceptAllPending(userId);
    }
  }

  private async activeUser(id: bigint) {
    const [row] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, id), eq(users.status, "active")))
      .limit(1);
    if (!row) throw notFound("User");
  }

  /* ── Search ────────────────────────────────────────────────────────────── */

  /**
   * People you may know: who follows you and you don't follow back, people the people you follow
   * follow, and people in your Spaces. Never you, anyone you follow (or asked to), or anyone in a
   * block with you.
   */
  async suggestions(viewerId: bigint, limit = 6): Promise<Suggestion[]> {
    const mine = sql`(select ${follows.followeeId} from ${follows} where ${follows.followerId} = ${viewerId})`;
    const allowed = (col: typeof users.id | typeof follows.followeeId) =>
      and(
        sql`${col} <> ${viewerId}`,
        sql`${col} not in ${mine}`,
        sql`${col} not in ${blockedWith(viewerId)}`,
      );
    const picked = new Map<string, Suggestion>();
    const add = (u: UserSummary, reason: string, followsYou: boolean) => {
      if (!picked.has(u.id) && picked.size < limit)
        picked.set(u.id, { user: u, reason, followsYou });
    };

    const back = await this.db
      .select(summaryColumns)
      .from(follows)
      .innerJoin(users, eq(users.id, follows.followerId))
      .where(
        and(
          eq(follows.followeeId, viewerId),
          eq(follows.status, "active"),
          eq(users.status, "active"),
          allowed(users.id),
        ),
      )
      .orderBy(desc(follows.createdAt))
      .limit(limit);
    for (const u of back) add(toUserSummary(u), "Follows you", true);

    if (picked.size < limit) {
      const viaFollows = await this.db
        .select({
          id: follows.followeeId,
          n: sql<number>`count(*)::int`,
          via: sql<string>`min(${follows.followerId})::text`,
        })
        .from(follows)
        .where(
          and(
            sql`${follows.followerId} in ${mine}`,
            eq(follows.status, "active"),
            allowed(follows.followeeId),
          ),
        )
        .groupBy(follows.followeeId)
        .orderBy(desc(sql`count(*)`))
        .limit(limit);
      const ids = [...viaFollows.map((r) => r.id), ...viaFollows.map((r) => BigInt(r.via))];
      const people = ids.length
        ? await this.db
            .select(summaryColumns)
            .from(users)
            .where(and(inArray(users.id, ids), eq(users.status, "active")))
        : [];
      const byId = new Map(people.map((u) => [u.id.toString(), u]));
      for (const r of viaFollows) {
        const u = byId.get(r.id.toString());
        const via = byId.get(r.via);
        if (!u) continue;
        const name = via?.username ?? "people you follow";
        add(
          toUserSummary(u),
          r.n > 1 ? `Followed by ${name} + ${r.n - 1}` : `Followed by ${name}`,
          false,
        );
      }
    }

    if (picked.size < limit) {
      const spaceMates = await this.db
        .select({ user: summaryColumns, space: communities.name })
        .from(communityMembers)
        .innerJoin(users, eq(users.id, communityMembers.userId))
        .innerJoin(communities, eq(communities.id, communityMembers.communityId))
        .where(
          and(
            sql`${communityMembers.communityId} in (select ${communityMembers.communityId} from ${communityMembers} where ${communityMembers.userId} = ${viewerId})`,
            isNull(communities.deletedAt),
            eq(users.status, "active"),
            allowed(users.id),
          ),
        )
        .orderBy(desc(communityMembers.joinedAt))
        .limit(limit * 3);
      for (const r of spaceMates) add(toUserSummary(r.user), `In ${r.space}`, false);
    }
    return [...picked.values()];
  }

  async search(query: string, viewerId: bigint | null): Promise<SearchResults> {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    if (!q) return { users: [], spaces: [] };
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const prefix = `${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const people = await this.db
      .select(summaryColumns)
      .from(users)
      .where(
        and(
          eq(users.status, "active"),
          or(
            sql`lower(${users.username}) like ${like}`,
            sql`lower(${users.displayName}) like ${like}`,
          ),
          viewerId ? sql`${users.id} not in ${blockedWith(viewerId)}` : undefined,
        ),
      )
      .orderBy(
        sql`case when lower(${users.username}) like ${prefix} then 0 else 1 end`,
        users.username,
      )
      .limit(20);
    const spaces = await this.db
      .select({
        id: communities.id,
        name: communities.name,
        accent: communities.accent,
        iconMediaId: communities.iconMediaId,
        memberCount: communities.memberCount,
        joined: viewerId
          ? sql<boolean>`exists (select 1 from ${communityMembers} where ${communityMembers.communityId} = ${communities.id} and ${communityMembers.userId} = ${viewerId})`
          : sql<boolean>`false`,
      })
      .from(communities)
      .where(
        and(
          isNull(communities.deletedAt),
          sql`lower(${communities.name}) like ${like}`,
          viewerId
            ? or(
                eq(communities.visibility, "public"),
                sql`${communities.id} in (select ${communityMembers.communityId} from ${communityMembers} where ${communityMembers.userId} = ${viewerId})`,
              )
            : eq(communities.visibility, "public"),
        ),
      )
      .orderBy(desc(communities.memberCount))
      .limit(10);
    return {
      users: people.map(toUserSummary),
      spaces: spaces.map((s) => ({
        id: s.id.toString(),
        name: s.name,
        accent: s.accent,
        iconUrl: s.iconMediaId ? mediaUrl(s.iconMediaId) : null,
        memberCount: s.memberCount,
        joined: Boolean(s.joined),
      })),
    };
  }

  /* ── Activity (the heart on Home) ──────────────────────────────────────── */

  async activity(userId: bigint, before: bigint | null): Promise<ActivityPage> {
    const rows = await this.db
      .select({ n: notifications, actor: summaryColumns })
      .from(notifications)
      .leftJoin(users, eq(users.id, notifications.actorId))
      .where(
        and(
          eq(notifications.userId, userId),
          inArray(notifications.type, [...ACTIVITY_TYPES]),
          before ? lt(notifications.id, before) : undefined,
        ),
      )
      .orderBy(desc(notifications.id))
      .limit(51);
    const more = rows.length > 50;
    const shown = rows.slice(0, 50);
    const postIds = shown.flatMap((r) => (r.n.subjectType === "post" ? [r.n.subjectId] : []));
    const thumbs = postIds.length
      ? await this.db
          .select({ postId: postMedia.postId, mediaId: postMedia.mediaId })
          .from(postMedia)
          .where(and(inArray(postMedia.postId, postIds), eq(postMedia.position, 0)))
      : [];
    const [unread] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          inArray(notifications.type, [...ACTIVITY_TYPES]),
          isNull(notifications.readAt),
        ),
      );
    // Whether you follow each person back, for the button on their row.
    const actorIds = [...new Set(shown.flatMap((r) => (r.actor?.id ? [r.actor.id] : [])))];
    const mine = actorIds.length
      ? await this.db
          .select({ id: follows.followeeId, status: follows.status })
          .from(follows)
          .where(and(eq(follows.followerId, userId), inArray(follows.followeeId, actorIds)))
      : [];
    const standing = (id: bigint | undefined): Activity["youFollow"] => {
      const f = mine.find((m) => m.id === id);
      return f?.status === "active" ? "following" : f ? "requested" : "none";
    };
    return {
      items: shown.map(({ n, actor }) => {
        const thumb = thumbs.find((t) => t.postId === n.subjectId);
        return {
          id: n.id.toString(),
          type: n.type as Activity["type"],
          actor: actor?.id ? toUserSummary(actor) : null,
          post:
            n.subjectType === "post"
              ? { id: n.subjectId.toString(), thumbUrl: thumb ? mediaUrl(thumb.mediaId) : null }
              : null,
          text: typeof n.data.text === "string" ? n.data.text : null,
          accepted: n.data.accepted === true,
          youFollow: standing(actor?.id ?? undefined),
          read: n.readAt !== null,
          createdAt: n.createdAt.toISOString(),
        } satisfies Activity;
      }),
      nextCursor: more ? (shown.at(-1)?.n.id.toString() ?? null) : null,
      unread: Number(unread?.n ?? 0),
    };
  }

  async markActivityRead(userId: bigint): Promise<void> {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  }

  private async notify(
    userId: bigint,
    type: (typeof ACTIVITY_TYPES)[number],
    actorId: bigint,
    subjectType: string,
    subjectId: bigint,
    data: Record<string, unknown>,
    groupKey?: string,
  ) {
    // One line per person per thing: liking, unliking and liking again doesn't stack up.
    if (groupKey) {
      await this.db
        .delete(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.actorId, actorId),
            eq(notifications.groupKey, groupKey),
          ),
        );
    }
    await this.db.insert(notifications).values({
      id: this.deps.ids.next(),
      userId,
      type,
      actorId,
      subjectType,
      subjectId,
      groupKey: groupKey ?? null,
      data,
    });
    // The heart on Home lights up at once.
    const [count] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    await this.deps.bus.publish(`user:${userId}`, {
      type: "ACTIVITY_NEW",
      data: { unread: count?.n ?? 1 },
    });
  }
}

function deletedUser(id: bigint): UserSummary {
  return {
    id: id.toString(),
    username: "deleted",
    displayName: "Deleted account",
    avatarUrl: null,
    accentColor: null,
  };
}

function toComment(
  c: typeof comments.$inferSelect,
  author: Parameters<typeof toUserSummary>[0],
  liked = false,
): Comment {
  return {
    id: c.id.toString(),
    postId: c.postId.toString(),
    parentId: c.parentId?.toString() ?? null,
    author: toUserSummary(author),
    body: c.body,
    depth: c.depth,
    createdAt: c.createdAt.toISOString(),
    hidden: c.removedAt !== null,
    likeCount: Math.max(0, c.score),
    liked,
  };
}
