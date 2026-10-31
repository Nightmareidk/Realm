import {
  type Collection,
  Limits,
  type MuteAccountBody,
  type Note,
  type NoteBody,
  type NoteList,
  type PostPage,
  type UserSummary,
} from "@realm/contracts";
import { and, desc, eq, gt, inArray, isNull, lt, or, schema, sql } from "@realm/db";
import type { Deps } from "../../deps";
import { AppError, badRequest, notFound } from "../../lib/errors";
import { mediaUrl } from "../../lib/serialize";
import { summaryColumns, toUserSummary } from "../../lib/serialize-spaces";
import { guardMessage } from "../../lib/spam";
import { blockedEitherWay } from "../spaces/access";
import { canSeePost } from "./access";
import type { SocialService } from "./service";

const {
  users,
  follows,
  closeFriends,
  accountMutes,
  notes,
  sounds,
  collections,
  collectionItems,
  posts,
  postMedia,
} = schema;

const NOTE_HOURS = 24;

/**
 * The people around you, Instagram's way and a little better: Close Friends (for Stories and
 * Notes), muting someone's posts or Stories without them knowing, Notes with a song, and saved
 * posts sorted into folders.
 */
export class CircleService {
  constructor(
    private readonly deps: Deps,
    private readonly social: SocialService,
  ) {}

  private get db() {
    return this.deps.db;
  }

  /** An active account by username, not in a block with you. */
  async person(viewerId: bigint, username: string) {
    const [u] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(
        sql`lower(${users.username}) = ${username.toLowerCase()} and ${users.status} = 'active'`,
      )
      .limit(1);
    if (!u || (await blockedEitherWay(this.db, viewerId, u.id))) throw notFound("User");
    if (u.id === viewerId) throw badRequest("BAD_REQUEST", "That's you.");
    return u.id;
  }

  /* ── Close Friends ─────────────────────────────────────────────────────── */

  async closeFriends(userId: bigint): Promise<UserSummary[]> {
    const rows = await this.db
      .select(summaryColumns)
      .from(closeFriends)
      .innerJoin(users, eq(users.id, closeFriends.friendId))
      .where(and(eq(closeFriends.userId, userId), eq(users.status, "active")))
      .orderBy(users.username);
    return rows.map(toUserSummary);
  }

  async setCloseFriend(userId: bigint, username: string, on: boolean) {
    const friendId = await this.person(userId, username);
    if (!on) {
      await this.db
        .delete(closeFriends)
        .where(and(eq(closeFriends.userId, userId), eq(closeFriends.friendId, friendId)));
      return;
    }
    const [count] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(closeFriends)
      .where(eq(closeFriends.userId, userId));
    if ((count?.n ?? 0) >= Limits.closeFriends) {
      throw new AppError(
        403,
        "LIMIT_REACHED",
        `Close Friends can have up to ${Limits.closeFriends} people.`,
      );
    }
    await this.db.insert(closeFriends).values({ userId, friendId }).onConflictDoNothing();
  }

  /* ── Mute ──────────────────────────────────────────────────────────────── */

  async mute(userId: bigint, username: string, body: MuteAccountBody) {
    const targetId = await this.person(userId, username);
    if (!body.posts && !body.stories) {
      await this.db
        .delete(accountMutes)
        .where(and(eq(accountMutes.userId, userId), eq(accountMutes.targetId, targetId)));
    } else {
      await this.db
        .insert(accountMutes)
        .values({ userId, targetId, posts: body.posts, stories: body.stories })
        .onConflictDoUpdate({
          target: [accountMutes.userId, accountMutes.targetId],
          set: { posts: body.posts, stories: body.stories },
        });
    }
    return { posts: body.posts, stories: body.stories };
  }

  async muted(userId: bigint) {
    const rows = await this.db
      .select({ user: summaryColumns, posts: accountMutes.posts, stories: accountMutes.stories })
      .from(accountMutes)
      .innerJoin(users, eq(users.id, accountMutes.targetId))
      .where(and(eq(accountMutes.userId, userId), eq(users.status, "active")))
      .orderBy(desc(accountMutes.createdAt));
    return {
      items: rows.map((r) => ({ user: toUserSummary(r.user), posts: r.posts, stories: r.stories })),
    };
  }

  /* ── Notes ─────────────────────────────────────────────────────────────── */

  async setNote(userId: bigint, body: NoteBody): Promise<Note> {
    const text = body.text.trim();
    if (text) {
      const [me] = await this.db
        .select({
          id: users.id,
          createdAt: users.createdAt,
          emailVerifiedAt: users.emailVerifiedAt,
        })
        .from(users)
        .where(eq(users.id, userId));
      if (me) await guardMessage(this.deps, me, text);
    }
    let soundId: bigint | null = null;
    if (body.soundId) {
      const [s] = await this.db
        .select({ id: sounds.id, hidden: sounds.hiddenAt })
        .from(sounds)
        .where(eq(sounds.id, BigInt(body.soundId)))
        .limit(1);
      if (!s || s.hidden) throw notFound("Song");
      soundId = s.id;
    }
    const row = {
      userId,
      text,
      soundId,
      soundStartMs: soundId ? (body.soundStartMs ?? 0) : null,
      audience: body.audience,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + NOTE_HOURS * 3600 * 1000),
    };
    await this.db.insert(notes).values(row).onConflictDoUpdate({ target: notes.userId, set: row });
    const [made] = await this.toNotes([row]);
    if (!made) throw notFound("Note");
    return made;
  }

  async clearNote(userId: bigint) {
    await this.db.delete(notes).where(eq(notes.userId, userId));
  }

  /**
   * Your note, and the notes you may see: from people you follow who follow you back, or from
   * people who put you on their Close Friends (for a Close Friends note). Newest first.
   */
  async notes(viewerId: bigint): Promise<NoteList> {
    const now = new Date();
    const iFollow = sql`(select ${follows.followeeId} from ${follows} where ${follows.followerId} = ${viewerId} and ${follows.status} = 'active')`;
    const followMe = sql`(select ${follows.followerId} from ${follows} where ${follows.followeeId} = ${viewerId} and ${follows.status} = 'active')`;
    const closeToThem = sql`(select ${closeFriends.userId} from ${closeFriends} where ${closeFriends.friendId} = ${viewerId})`;
    const rows = await this.db
      .select({ n: notes })
      .from(notes)
      .innerJoin(users, eq(users.id, notes.userId))
      .where(
        and(
          gt(notes.expiresAt, now),
          eq(users.status, "active"),
          or(
            eq(notes.userId, viewerId),
            and(
              eq(notes.audience, "followers"),
              sql`${notes.userId} in ${iFollow}`,
              sql`${notes.userId} in ${followMe}`,
            ),
            and(eq(notes.audience, "close_friends"), sql`${notes.userId} in ${closeToThem}`),
          ),
          sql`${notes.userId} not in (
            select ${schema.relationships.targetId} from ${schema.relationships}
              where ${schema.relationships.userId} = ${viewerId} and ${schema.relationships.type} = 'blocked'
            union
            select ${schema.relationships.userId} from ${schema.relationships}
              where ${schema.relationships.targetId} = ${viewerId} and ${schema.relationships.type} = 'blocked'
          )`,
        ),
      )
      .orderBy(desc(notes.createdAt))
      .limit(100);
    const all = await this.toNotes(rows.map((r) => r.n));
    const me = String(viewerId);
    return {
      mine: all.find((n) => n.author.id === me) ?? null,
      items: all.filter((n) => n.author.id !== me),
    };
  }

  private async toNotes(rows: (typeof notes.$inferSelect)[]): Promise<Note[]> {
    if (!rows.length) return [];
    const [authors, songs] = await Promise.all([
      this.db
        .select(summaryColumns)
        .from(users)
        .where(
          inArray(
            users.id,
            rows.map((r) => r.userId),
          ),
        ),
      (() => {
        const ids = rows.flatMap((r) => (r.soundId ? [r.soundId] : []));
        return ids.length
          ? this.db.select().from(sounds).where(inArray(sounds.id, ids))
          : Promise.resolve([]);
      })(),
    ]);
    return rows.flatMap((r) => {
      const author = authors.find((a) => a.id === r.userId);
      if (!author) return [];
      const s = songs.find((x) => x.id === r.soundId);
      return [
        {
          author: toUserSummary(author),
          text: r.text,
          sound: s
            ? {
                id: String(s.id),
                title: s.title,
                artist: s.artist,
                coverUrl: s.coverUrl,
                audioUrl: s.mediaId ? mediaUrl(s.mediaId) : s.audioUrl,
                startMs: r.soundStartMs ?? 0,
              }
            : null,
          audience: r.audience,
          createdAt: r.createdAt.toISOString(),
          expiresAt: r.expiresAt.toISOString(),
        },
      ];
    });
  }

  /* ── Collections ───────────────────────────────────────────────────────── */

  private async own(userId: bigint, id: bigint) {
    const [c] = await this.db
      .select()
      .from(collections)
      .where(and(eq(collections.id, id), eq(collections.userId, userId)))
      .limit(1);
    if (!c) throw notFound("Collection");
    return c;
  }

  async collections(userId: bigint): Promise<Collection[]> {
    const rows = await this.db
      .select()
      .from(collections)
      .where(eq(collections.userId, userId))
      .orderBy(desc(collections.createdAt));
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const counts = await this.db
      .select({ id: collectionItems.collectionId, n: sql<number>`count(*)::int` })
      .from(collectionItems)
      .innerJoin(posts, eq(posts.id, collectionItems.postId))
      .where(and(inArray(collectionItems.collectionId, ids), isNull(posts.deletedAt)))
      .groupBy(collectionItems.collectionId);
    // The newest four first photos in each, for the cover.
    const covers = await this.db
      .select({ id: collectionItems.collectionId, mediaId: postMedia.mediaId })
      .from(collectionItems)
      .innerJoin(posts, eq(posts.id, collectionItems.postId))
      .innerJoin(
        postMedia,
        and(eq(postMedia.postId, collectionItems.postId), eq(postMedia.position, 0)),
      )
      .where(
        and(
          inArray(collectionItems.collectionId, ids),
          isNull(posts.deletedAt),
          isNull(posts.removedAt),
        ),
      )
      .orderBy(desc(collectionItems.createdAt))
      .limit(ids.length * 12);
    return rows.map((r) => ({
      id: String(r.id),
      name: r.name,
      count: Number(counts.find((c) => c.id === r.id)?.n ?? 0),
      covers: covers
        .filter((c) => c.id === r.id)
        .slice(0, 4)
        .map((c) => mediaUrl(c.mediaId)),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async createCollection(userId: bigint, name: string): Promise<Collection> {
    const [count] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(collections)
      .where(eq(collections.userId, userId));
    if ((count?.n ?? 0) >= Limits.collections) {
      throw new AppError(
        403,
        "LIMIT_REACHED",
        `You can have up to ${Limits.collections} collections.`,
      );
    }
    const id = this.deps.ids.next();
    await this.db.insert(collections).values({ id, userId, name: name.trim() });
    const made = (await this.collections(userId)).find((c) => c.id === String(id));
    if (!made) throw notFound("Collection");
    return made;
  }

  async renameCollection(userId: bigint, id: bigint, name: string): Promise<Collection> {
    await this.own(userId, id);
    await this.db.update(collections).set({ name: name.trim() }).where(eq(collections.id, id));
    const made = (await this.collections(userId)).find((c) => c.id === String(id));
    if (!made) throw notFound("Collection");
    return made;
  }

  /** The folder goes; the posts stay saved. */
  async deleteCollection(userId: bigint, id: bigint) {
    await this.own(userId, id);
    await this.db.delete(collectionItems).where(eq(collectionItems.collectionId, id));
    await this.db.delete(collections).where(eq(collections.id, id));
  }

  /** Putting a post in a collection saves it too (as on Instagram). */
  async setInCollection(userId: bigint, id: bigint, postId: bigint, on: boolean) {
    await this.own(userId, id);
    if (on) {
      await this.social.save(postId, userId, true);
      await this.db
        .insert(collectionItems)
        .values({ collectionId: id, postId })
        .onConflictDoNothing();
    } else {
      await this.db
        .delete(collectionItems)
        .where(and(eq(collectionItems.collectionId, id), eq(collectionItems.postId, postId)));
    }
  }

  async collectionPosts(
    userId: bigint,
    id: bigint,
    before: bigint | null,
    limit: number,
  ): Promise<PostPage> {
    await this.own(userId, id);
    const rows = await this.db
      .select({ post: posts })
      .from(collectionItems)
      .innerJoin(posts, eq(posts.id, collectionItems.postId))
      .where(
        and(
          eq(collectionItems.collectionId, id),
          isNull(posts.deletedAt),
          before ? lt(posts.id, before) : undefined,
        ),
      )
      .orderBy(desc(posts.id))
      .limit(limit + 1);
    const more = rows.length > limit;
    const visible = [];
    for (const { post } of rows.slice(0, limit)) {
      if (await canSeePost(this.db, post, userId)) visible.push(post);
    }
    return {
      items: await this.social.hydrate(visible, userId),
      nextCursor: more ? (rows[limit - 1]?.post.id.toString() ?? null) : null,
    };
  }
}
