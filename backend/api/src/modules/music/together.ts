import type { ListeningFriend, WeekRecap } from "@realm/contracts";
import { and, desc, eq, gt, inArray, isNull, schema, sql } from "@realm/db";
import type { Deps } from "../../deps";
import { notFound } from "../../lib/errors";
import { mediaUrl } from "../../lib/serialize";
import { summaryColumns, toUserSummary } from "../../lib/serialize-spaces";
import type { MusicService } from "./service";

const {
  sounds,
  soundPlayDays,
  follows,
  users,
  userSettings,
  relationships,
  posts,
  postMedia,
  votes,
} = schema;

const key = (userId: bigint | string) => `listening:${userId}`;
const DAY = 86_400_000;

/** What someone is playing: which song, and when it would have started from the beginning. */
interface Now {
  soundId: string;
  startedAt: number;
}

function parse(raw: string | null): Now | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<Now>;
    return typeof v.soundId === "string" && typeof v.startedAt === "number"
      ? { soundId: v.soundId, startedAt: v.startedAt }
      : null;
  } catch {
    return null;
  }
}

/**
 * Listening together. The app says which song is playing; friends (people who follow each other)
 * can see it and tap to hear the same song from the same moment. Nothing is written to the
 * database: it lives only as long as the song does, and "Share what I'm listening to" in
 * Settings turns it off.
 */
export class ListeningNow {
  constructor(
    private readonly deps: Deps,
    private readonly music: MusicService,
  ) {}

  private get db() {
    return this.deps.db;
  }

  /** Whether this person lets friends see what they play (on unless they turned it off). */
  private async shares(userId: bigint) {
    const [row] = await this.db
      .select({ on: userSettings.shareListening })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);
    return row?.on ?? true;
  }

  async set(userId: bigint, soundId: bigint, positionMs: number): Promise<void> {
    const [song] = await this.db
      .select({ durationMs: sounds.durationMs })
      .from(sounds)
      .where(and(eq(sounds.id, soundId), isNull(sounds.hiddenAt)))
      .limit(1);
    if (!song) throw notFound("Song");
    const left = song.durationMs - positionMs;
    if (left < 1000 || !(await this.shares(userId))) {
      await this.clear(userId);
      return;
    }
    const now: Now = { soundId: soundId.toString(), startedAt: Date.now() - positionMs };
    await this.deps.kv.set(key(userId), JSON.stringify(now), Math.ceil(left / 1000) + 5);
  }

  async clear(userId: bigint): Promise<void> {
    await this.deps.kv.del(key(userId));
  }

  /**
   * Friends playing something right now, the most recently started first. Only people the
   * viewer follows who follow them back, never anyone in a block with them, and only while
   * that friend's sharing is on.
   */
  async friends(viewerId: bigint): Promise<ListeningFriend[]> {
    const rows = await this.db
      .select({ user: summaryColumns })
      .from(follows)
      .innerJoin(users, eq(users.id, follows.followeeId))
      .leftJoin(userSettings, eq(userSettings.userId, follows.followeeId))
      .where(
        and(
          eq(follows.followerId, viewerId),
          eq(follows.status, "active"),
          eq(users.status, "active"),
          sql`coalesce(${userSettings.shareListening}, true)`,
          sql`exists (select 1 from ${follows} as back where back.follower_id = ${follows.followeeId} and back.followee_id = ${viewerId} and back.status = 'active')`,
          sql`${follows.followeeId} not in (
            select ${relationships.targetId} from ${relationships}
              where ${relationships.userId} = ${viewerId} and ${relationships.type} = 'blocked'
            union
            select ${relationships.userId} from ${relationships}
              where ${relationships.targetId} = ${viewerId} and ${relationships.type} = 'blocked')`,
        ),
      )
      .orderBy(desc(follows.createdAt))
      .limit(200);
    if (!rows.length) return [];

    const playing = (
      await Promise.all(
        rows.map(async (r) => ({
          user: r.user,
          now: parse(await this.deps.kv.get(key(r.user.id))),
        })),
      )
    ).flatMap((p) => (p.now ? [{ user: p.user, now: p.now }] : []));
    if (!playing.length) return [];

    const ids = [...new Set(playing.map((p) => BigInt(p.now.soundId)))];
    const songRows = await this.db
      .select()
      .from(sounds)
      .where(and(inArray(sounds.id, ids), isNull(sounds.hiddenAt)));
    const songs = await this.music.toSounds(songRows, viewerId);
    const at = Date.now();
    return playing
      .flatMap((p) => {
        const sound = songs.find((s) => s.id === p.now.soundId);
        const positionMs = at - p.now.startedAt;
        // The song ran out (or was taken down) since they said so.
        if (!sound || positionMs < 0 || positionMs >= sound.durationMs - 1000) return [];
        return [
          {
            user: toUserSummary(p.user),
            sound,
            startedAt: new Date(p.now.startedAt).toISOString(),
            positionMs,
          },
        ];
      })
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  }
}

/**
 * "Your week": what someone played and what happened on their posts in the last seven days.
 * Only ever their own, and only read from what Realm already keeps.
 */
export class Recap {
  constructor(
    private readonly deps: Deps,
    private readonly music: MusicService,
  ) {}

  private get db() {
    return this.deps.db;
  }

  /** Count a play towards today (the day in UTC). */
  async played(userId: bigint, soundId: bigint): Promise<void> {
    await this.db
      .insert(soundPlayDays)
      .values({ userId, soundId, day: new Date().toISOString().slice(0, 10) })
      .onConflictDoUpdate({
        target: [soundPlayDays.userId, soundPlayDays.soundId, soundPlayDays.day],
        // A song on repeat all day still counts, but not without end.
        set: { plays: sql`least(${soundPlayDays.plays} + 1, 500)` },
      });
  }

  async week(userId: bigint): Promise<WeekRecap> {
    const to = new Date();
    const from = new Date(to.getTime() - 7 * DAY);
    const firstDay = new Date(to.getTime() - 6 * DAY).toISOString().slice(0, 10);
    const mine = and(eq(soundPlayDays.userId, userId), sql`${soundPlayDays.day} >= ${firstDay}`);

    const [totals] = await this.db
      .select({
        plays: sql<number>`coalesce(sum(${soundPlayDays.plays}), 0)::int`,
        songs: sql<number>`count(distinct ${soundPlayDays.soundId})::int`,
        ms: sql<number>`coalesce(sum(${soundPlayDays.plays}::bigint * ${sounds.durationMs}), 0)::float8`,
      })
      .from(soundPlayDays)
      .innerJoin(sounds, eq(sounds.id, soundPlayDays.soundId))
      .where(mine);
    const top = await this.db
      .select({
        id: soundPlayDays.soundId,
        plays: sql<number>`sum(${soundPlayDays.plays})::int`,
      })
      .from(soundPlayDays)
      .innerJoin(sounds, eq(sounds.id, soundPlayDays.soundId))
      .where(and(mine, isNull(sounds.hiddenAt)))
      .groupBy(soundPlayDays.soundId)
      .orderBy(sql`sum(${soundPlayDays.plays}) desc`, desc(soundPlayDays.soundId))
      .limit(5);
    const [artist] = await this.db
      .select({ name: sounds.artist, plays: sql<number>`sum(${soundPlayDays.plays})::int` })
      .from(soundPlayDays)
      .innerJoin(sounds, eq(sounds.id, soundPlayDays.soundId))
      .where(and(mine, isNull(sounds.hiddenAt)))
      .groupBy(sounds.artist)
      .orderBy(sql`sum(${soundPlayDays.plays}) desc`, sounds.artist)
      .limit(1);
    const topRows = top.length
      ? await this.db
          .select()
          .from(sounds)
          .where(
            inArray(
              sounds.id,
              top.map((t) => t.id),
            ),
          )
      : [];
    const topSounds = await this.music.toSounds(topRows, userId);

    const live = and(eq(posts.authorId, userId), isNull(posts.deletedAt));
    const [made] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(posts)
      // Typed comparisons: a raw `sql` template sends the Date as-is, which the real
      // Postgres driver refuses (the in-memory test database accepted it).
      .where(and(live, gt(posts.createdAt, from)));
    // Likes from other people this week, on any of your posts.
    const liked = await this.db
      .select({ postId: votes.targetId, n: sql<number>`count(*)::int` })
      .from(votes)
      .innerJoin(posts, eq(posts.id, votes.targetId))
      .where(
        and(
          live,
          eq(votes.targetType, "post"),
          sql`${votes.userId} <> ${userId}`,
          gt(votes.createdAt, from),
        ),
      )
      .groupBy(votes.targetId)
      .orderBy(sql`count(*) desc`, desc(votes.targetId))
      .limit(500);
    const [followers] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(follows)
      .where(
        and(
          eq(follows.followeeId, userId),
          eq(follows.status, "active"),
          gt(follows.createdAt, from),
        ),
      );

    const best = liked[0];
    const [bestPost] = best
      ? await this.db
          .select({ id: posts.id, caption: posts.body })
          .from(posts)
          .where(eq(posts.id, best.postId))
          .limit(1)
      : [];
    const [thumb] = bestPost
      ? await this.db
          .select({ mediaId: postMedia.mediaId })
          .from(postMedia)
          .where(and(eq(postMedia.postId, bestPost.id), eq(postMedia.position, 0)))
          .limit(1)
      : [];

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      plays: totals?.plays ?? 0,
      songs: totals?.songs ?? 0,
      minutes: Math.round((totals?.ms ?? 0) / 60_000),
      topSongs: top.flatMap((t) => {
        const sound = topSounds.find((s) => s.id === t.id.toString());
        return sound ? [{ sound, plays: t.plays }] : [];
      }),
      topArtist: artist ? { name: artist.name, plays: artist.plays } : null,
      posts: made?.n ?? 0,
      likes: liked.reduce((sum, l) => sum + l.n, 0),
      newFollowers: followers?.n ?? 0,
      topPost:
        best && bestPost
          ? {
              id: bestPost.id.toString(),
              caption: bestPost.caption,
              thumbUrl: thumb ? mediaUrl(thumb.mediaId) : null,
              likes: best.n,
            }
          : null,
    };
  }
}
