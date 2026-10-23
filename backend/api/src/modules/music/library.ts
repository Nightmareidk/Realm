import type { MusicHome, Playlist, PlaylistBody, PlaylistDetail, Sound } from "@realm/contracts";
import { and, asc, desc, eq, inArray, schema, sql } from "@realm/db";
import type { Deps } from "../../deps";
import { badRequest, forbidden, notFound } from "../../lib/errors";
import { summaryColumns, toUserSummary } from "../../lib/serialize-spaces";
import type { MusicService } from "./service";

const { sounds, soundLikes, playlists, playlistItems, soundPlays, users } = schema;

/** A playlist holds up to this many songs; someone has up to this many playlists. */
const PLAYLIST_MAX = 500;
const PLAYLISTS_MAX = 100;

/**
 * Playing songs in Realm, the way a music app does: Liked songs, playlists you make, what you
 * played lately, and the popular songs, all from the free library and creators' own sounds.
 */
export class MusicLibrary {
  constructor(
    private readonly deps: Deps,
    private readonly music: MusicService,
  ) {}

  private get db() {
    return this.deps.db;
  }

  private async songs(ids: bigint[], viewerId: bigint): Promise<Sound[]> {
    if (!ids.length) return [];
    const rows = await this.db.select().from(sounds).where(inArray(sounds.id, ids));
    const ordered = ids.flatMap((id) => rows.filter((r) => r.id === id));
    return this.music.toSounds(ordered, viewerId);
  }

  async home(userId: bigint): Promise<MusicHome> {
    const recent = await this.db
      .select({ id: soundPlays.soundId })
      .from(soundPlays)
      .where(eq(soundPlays.userId, userId))
      .orderBy(desc(soundPlays.playedAt))
      .limit(12);
    const liked = await this.likedIds(userId, 4);
    const [count] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(soundLikes)
      .where(eq(soundLikes.userId, userId));
    const likedCovers = (await this.songs(liked, userId)).flatMap((s) =>
      s.coverUrl ? [s.coverUrl] : [],
    );
    const popular = await this.music.trending();
    return {
      recent: await this.songs(
        recent.map((r) => r.id),
        userId,
      ),
      liked: { count: count?.n ?? 0, covers: likedCovers },
      playlists: await this.mine(userId),
      popular: await this.songs(
        popular.map((p) => BigInt(p.id)),
        userId,
      ),
      featured: await this.music.featured(userId),
    };
  }

  private async likedIds(userId: bigint, limit: number) {
    const rows = await this.db
      .select({ id: soundLikes.soundId })
      .from(soundLikes)
      .where(eq(soundLikes.userId, userId))
      .orderBy(desc(soundLikes.createdAt))
      .limit(limit);
    return rows.map((r) => r.id);
  }

  async liked(userId: bigint): Promise<Sound[]> {
    return this.songs(await this.likedIds(userId, 1000), userId);
  }

  async like(userId: bigint, soundId: bigint, on: boolean) {
    if (on) {
      const [song] = await this.db
        .select({ id: sounds.id })
        .from(sounds)
        .where(eq(sounds.id, soundId));
      if (!song) throw notFound("Song");
      await this.db.insert(soundLikes).values({ userId, soundId }).onConflictDoNothing();
    } else {
      await this.db
        .delete(soundLikes)
        .where(and(eq(soundLikes.userId, userId), eq(soundLikes.soundId, soundId)));
    }
  }

  /** You played it: it goes to the top of Recently played. */
  async played(userId: bigint, soundId: bigint) {
    const [song] = await this.db
      .select({ id: sounds.id })
      .from(sounds)
      .where(eq(sounds.id, soundId));
    if (!song) return;
    await this.db
      .insert(soundPlays)
      .values({ userId, soundId })
      .onConflictDoUpdate({
        target: [soundPlays.userId, soundPlays.soundId],
        set: { playedAt: new Date() },
      });
  }

  // ── Playlists ─────────────────────────────────────────────────────────────

  private async toPlaylists(rows: (typeof playlists.$inferSelect)[]): Promise<Playlist[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const counts = await this.db
      .select({ id: playlistItems.playlistId, n: sql<number>`count(*)::int` })
      .from(playlistItems)
      .where(inArray(playlistItems.playlistId, ids))
      .groupBy(playlistItems.playlistId);
    const covers = await this.db
      .select({
        id: playlistItems.playlistId,
        cover: sounds.coverUrl,
        position: playlistItems.position,
      })
      .from(playlistItems)
      .innerJoin(sounds, eq(sounds.id, playlistItems.soundId))
      .where(and(inArray(playlistItems.playlistId, ids), sql`${sounds.coverUrl} is not null`))
      .orderBy(asc(playlistItems.position));
    const owners = await this.db
      .select(summaryColumns)
      .from(users)
      .where(inArray(users.id, [...new Set(rows.map((r) => r.ownerId))]));
    return rows.flatMap((r) => {
      const owner = owners.find((o) => o.id === r.ownerId);
      if (!owner) return [];
      return [
        {
          id: r.id.toString(),
          name: r.name,
          description: r.description,
          covers: covers
            .filter((c) => c.id === r.id)
            .slice(0, 4)
            .map((c) => c.cover as string),
          count: counts.find((c) => c.id === r.id)?.n ?? 0,
          isPublic: r.isPublic === 1,
          owner: toUserSummary(owner),
          updatedAt: r.updatedAt.toISOString(),
        },
      ];
    });
  }

  async mine(userId: bigint): Promise<Playlist[]> {
    const rows = await this.db
      .select()
      .from(playlists)
      .where(eq(playlists.ownerId, userId))
      .orderBy(desc(playlists.updatedAt))
      .limit(PLAYLISTS_MAX);
    return this.toPlaylists(rows);
  }

  private async own(userId: bigint, id: bigint) {
    const [row] = await this.db.select().from(playlists).where(eq(playlists.id, id)).limit(1);
    if (!row) throw notFound("Playlist");
    if (row.ownerId !== userId) throw forbidden("That's someone else's playlist.");
    return row;
  }

  async create(userId: bigint, body: PlaylistBody): Promise<Playlist> {
    const [count] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(playlists)
      .where(eq(playlists.ownerId, userId));
    if ((count?.n ?? 0) >= PLAYLISTS_MAX) {
      throw badRequest("BAD_REQUEST", `You can have up to ${PLAYLISTS_MAX} playlists.`);
    }
    const id = this.deps.ids.next();
    await this.db.insert(playlists).values({
      id,
      ownerId: userId,
      name: body.name,
      description: body.description ?? null,
      isPublic: body.isPublic ? 1 : 0,
    });
    const [row] = await this.db.select().from(playlists).where(eq(playlists.id, id));
    return (await this.toPlaylists([row as typeof playlists.$inferSelect]))[0] as Playlist;
  }

  async detail(viewerId: bigint, id: bigint): Promise<PlaylistDetail> {
    const [row] = await this.db.select().from(playlists).where(eq(playlists.id, id)).limit(1);
    // Someone else's private playlist doesn't exist, as far as you can tell.
    if (!row || (row.ownerId !== viewerId && row.isPublic !== 1)) throw notFound("Playlist");
    const items = await this.db
      .select({ id: playlistItems.soundId })
      .from(playlistItems)
      .where(eq(playlistItems.playlistId, id))
      .orderBy(asc(playlistItems.position))
      .limit(PLAYLIST_MAX);
    const [summary] = await this.toPlaylists([row]);
    return {
      ...(summary as Playlist),
      items: await this.songs(
        items.map((i) => i.id),
        viewerId,
      ),
      mine: row.ownerId === viewerId,
    };
  }

  async update(userId: bigint, id: bigint, body: Partial<PlaylistBody>): Promise<PlaylistDetail> {
    await this.own(userId, id);
    await this.db
      .update(playlists)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.isPublic !== undefined ? { isPublic: body.isPublic ? 1 : 0 } : {}),
        updatedAt: new Date(),
      })
      .where(eq(playlists.id, id));
    return this.detail(userId, id);
  }

  async remove(userId: bigint, id: bigint) {
    await this.own(userId, id);
    await this.db.delete(playlists).where(eq(playlists.id, id));
  }

  async add(userId: bigint, id: bigint, soundId: bigint) {
    await this.own(userId, id);
    const [song] = await this.db
      .select({ id: sounds.id })
      .from(sounds)
      .where(eq(sounds.id, soundId));
    if (!song) throw notFound("Song");
    const [last] = await this.db
      .select({
        n: sql<number>`count(*)::int`,
        max: sql<number>`coalesce(max(${playlistItems.position}), 0)::int`,
      })
      .from(playlistItems)
      .where(eq(playlistItems.playlistId, id));
    if ((last?.n ?? 0) >= PLAYLIST_MAX) {
      throw badRequest("BAD_REQUEST", `A playlist holds up to ${PLAYLIST_MAX} songs.`);
    }
    await this.db
      .insert(playlistItems)
      .values({ playlistId: id, soundId, position: (last?.max ?? 0) + 1 })
      .onConflictDoNothing();
    await this.db.update(playlists).set({ updatedAt: new Date() }).where(eq(playlists.id, id));
  }

  async take(userId: bigint, id: bigint, soundId: bigint) {
    await this.own(userId, id);
    await this.db
      .delete(playlistItems)
      .where(and(eq(playlistItems.playlistId, id), eq(playlistItems.soundId, soundId)));
    await this.db.update(playlists).set({ updatedAt: new Date() }).where(eq(playlists.id, id));
  }
}
