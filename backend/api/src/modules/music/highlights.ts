import {
  HIGHLIGHT_LIMIT,
  type Highlight,
  type HighlightBody,
  type HighlightDetail,
  type Story,
  type UpdateHighlightBody,
} from "@realm/contracts";
import { and, asc, desc, eq, ilike, inArray, isNull, schema, sql } from "@realm/db";
import type { Deps } from "../../deps";
import { badRequest, forbidden, notFound } from "../../lib/errors";
import { toMediaRef } from "../../lib/serialize-spaces";
import { followsActively, isPrivateAccount } from "../social/access";
import { blockedEitherWay } from "../spaces/access";
import type { MusicService } from "./service";

const { stories, storyHighlights, storyHighlightItems, media, users } = schema;

/**
 * Story highlights: your Stories kept on your profile after their day is up, in named circles.
 * Anyone who can see your profile's posts can watch them (everyone, or followers for a private
 * account); nobody in a block with you can.
 */
export class HighlightsService {
  constructor(
    private readonly deps: Deps,
    private readonly music: MusicService,
  ) {}

  private get db() {
    return this.deps.db;
  }

  /** Whether someone may watch this person's highlights. */
  async canWatch(ownerId: bigint, viewerId: bigint | null) {
    if (viewerId === ownerId) return true;
    if (viewerId && (await blockedEitherWay(this.db, viewerId, ownerId))) return false;
    if (!(await isPrivateAccount(this.db, ownerId))) return true;
    return viewerId ? followsActively(this.db, viewerId, ownerId) : false;
  }

  private async ownerOf(username: string) {
    const [u] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          ilike(
            users.username,
            username.replace(/[\\%_]/g, (m) => `\\${m}`),
          ),
          eq(users.status, "active"),
        ),
      )
      .limit(1);
    if (!u) throw notFound("User");
    return u.id;
  }

  /** The Stories in some highlights that still exist, in order. */
  private async items(ids: bigint[]) {
    if (!ids.length) return [];
    return this.db
      .select({ highlightId: storyHighlightItems.highlightId, story: stories })
      .from(storyHighlightItems)
      .innerJoin(stories, eq(stories.id, storyHighlightItems.storyId))
      .where(and(inArray(storyHighlightItems.highlightId, ids), isNull(stories.deletedAt)))
      .orderBy(asc(storyHighlightItems.position));
  }

  private async summaries(rows: (typeof storyHighlights.$inferSelect)[]): Promise<Highlight[]> {
    const items = await this.items(rows.map((r) => r.id));
    const coverIds = rows.flatMap((r) => {
      const mine = items.filter((i) => i.highlightId === r.id);
      const cover = mine.find((i) => i.story.id === r.coverStoryId) ?? mine[0];
      return cover ? [cover.story.mediaId] : [];
    });
    const files = coverIds.length
      ? await this.db.select().from(media).where(inArray(media.id, coverIds))
      : [];
    return rows.map((r) => {
      const mine = items.filter((i) => i.highlightId === r.id);
      const cover = mine.find((i) => i.story.id === r.coverStoryId) ?? mine[0];
      const file = cover ? files.find((f) => f.id === cover.story.mediaId) : undefined;
      return {
        id: r.id.toString(),
        title: r.title,
        cover: file ? toMediaRef(file) : null,
        count: mine.length,
        createdAt: r.createdAt.toISOString(),
      };
    });
  }

  async ofUser(username: string, viewerId: bigint | null): Promise<Highlight[]> {
    const ownerId = await this.ownerOf(username);
    if (!(await this.canWatch(ownerId, viewerId))) return [];
    const rows = await this.db
      .select()
      .from(storyHighlights)
      .where(eq(storyHighlights.ownerId, ownerId))
      .orderBy(asc(storyHighlights.position), desc(storyHighlights.createdAt))
      .limit(HIGHLIGHT_LIMIT);
    // An emptied highlight (every Story in it deleted) shows only to its owner.
    const list = await this.summaries(rows);
    return viewerId === ownerId ? list : list.filter((h) => h.count > 0);
  }

  async get(id: bigint, viewerId: bigint | null): Promise<HighlightDetail> {
    const [row] = await this.db
      .select()
      .from(storyHighlights)
      .where(eq(storyHighlights.id, id))
      .limit(1);
    if (!row || !(await this.canWatch(row.ownerId, viewerId))) throw notFound("Highlight");
    const [summary] = await this.summaries([row]);
    const items = await this.items([row.id]);
    const played = await this.music.toStories(
      items.map((i) => i.story),
      viewerId,
    );
    return { ...(summary as Highlight), stories: played };
  }

  /** Your Stories from every day (not deleted), newest first: what you pick highlights from. */
  async archive(userId: bigint): Promise<Story[]> {
    const rows = await this.db
      .select()
      .from(stories)
      .where(and(eq(stories.authorId, userId), isNull(stories.deletedAt)))
      .orderBy(desc(stories.createdAt))
      .limit(300);
    return this.music.toStories(rows, userId);
  }

  /** The Stories must be the person's own and still there. */
  private async ownStories(userId: bigint, ids: string[]) {
    const wanted = [...new Set(ids)].map(BigInt);
    const rows = await this.db
      .select({ id: stories.id })
      .from(stories)
      .where(
        and(inArray(stories.id, wanted), eq(stories.authorId, userId), isNull(stories.deletedAt)),
      );
    if (rows.length !== wanted.length) {
      throw badRequest("VALIDATION_FAILED", "Pick from your own Stories.");
    }
    return wanted;
  }

  async create(userId: bigint, body: HighlightBody): Promise<Highlight> {
    const [count] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(storyHighlights)
      .where(eq(storyHighlights.ownerId, userId));
    if ((count?.n ?? 0) >= HIGHLIGHT_LIMIT) {
      throw badRequest("LIMIT_REACHED", `A profile can have up to ${HIGHLIGHT_LIMIT} highlights.`);
    }
    const ids = await this.ownStories(userId, body.storyIds);
    const cover = body.coverStoryId ? BigInt(body.coverStoryId) : null;
    if (cover && !ids.includes(cover)) {
      throw badRequest("VALIDATION_FAILED", "The cover has to be one of its Stories.");
    }
    const id = this.deps.ids.next();
    await this.db.transaction(async (tx) => {
      await tx.insert(storyHighlights).values({
        id,
        ownerId: userId,
        title: body.title,
        coverStoryId: cover,
        position: count?.n ?? 0,
      });
      await tx
        .insert(storyHighlightItems)
        .values(ids.map((storyId, position) => ({ highlightId: id, storyId, position })));
    });
    const [row] = await this.db.select().from(storyHighlights).where(eq(storyHighlights.id, id));
    return (await this.summaries(row ? [row] : []))[0] as Highlight;
  }

  private async mine(userId: bigint, id: bigint) {
    const [row] = await this.db
      .select()
      .from(storyHighlights)
      .where(eq(storyHighlights.id, id))
      .limit(1);
    if (!row) throw notFound("Highlight");
    if (row.ownerId !== userId) throw forbidden("Only its owner can change a highlight.");
    return row;
  }

  async update(userId: bigint, id: bigint, body: UpdateHighlightBody): Promise<Highlight> {
    const row = await this.mine(userId, id);
    const ids = body.storyIds ? await this.ownStories(userId, body.storyIds) : null;
    const kept = ids ?? (await this.items([row.id])).map((i) => i.story.id);
    const cover = body.coverStoryId === undefined ? row.coverStoryId : BigInt(body.coverStoryId);
    if (body.coverStoryId && cover && !kept.includes(cover)) {
      throw badRequest("VALIDATION_FAILED", "The cover has to be one of its Stories.");
    }
    await this.db.transaction(async (tx) => {
      await tx
        .update(storyHighlights)
        .set({
          title: body.title,
          coverStoryId: cover && kept.includes(cover) ? cover : null,
        })
        .where(eq(storyHighlights.id, row.id));
      if (ids) {
        await tx.delete(storyHighlightItems).where(eq(storyHighlightItems.highlightId, row.id));
        await tx
          .insert(storyHighlightItems)
          .values(ids.map((storyId, position) => ({ highlightId: row.id, storyId, position })));
      }
    });
    const [fresh] = await this.db
      .select()
      .from(storyHighlights)
      .where(eq(storyHighlights.id, row.id));
    return (await this.summaries(fresh ? [fresh] : []))[0] as Highlight;
  }

  async remove(userId: bigint, id: bigint) {
    const row = await this.mine(userId, id);
    await this.db.delete(storyHighlights).where(eq(storyHighlights.id, row.id));
  }

  /** For media access: is this picture in a Story the viewer can watch as a highlight? */
  async mediaVisible(mediaId: bigint, viewerId: bigint | null) {
    const rows = await this.db
      .select({ ownerId: storyHighlights.ownerId })
      .from(storyHighlightItems)
      .innerJoin(stories, eq(stories.id, storyHighlightItems.storyId))
      .innerJoin(storyHighlights, eq(storyHighlights.id, storyHighlightItems.highlightId))
      .where(and(eq(stories.mediaId, mediaId), isNull(stories.deletedAt)))
      .limit(5);
    for (const r of rows) if (await this.canWatch(r.ownerId, viewerId)) return true;
    return false;
  }
}
