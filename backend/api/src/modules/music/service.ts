import { createHash } from "node:crypto";
import type {
  CreateSoundBody,
  CreateStoryBody,
  Sound,
  SoundPick,
  SoundUse,
  Story,
  StoryFeed,
  StoryRing,
} from "@realm/contracts";
import { STORY_HOURS } from "@realm/contracts";
import { and, desc, eq, gt, ilike, inArray, isNull, schema, sql } from "@realm/db";
import type { Deps } from "../../deps";
import { AppError, forbidden, notFound } from "../../lib/errors";
import { mediaUrl } from "../../lib/serialize";
import { summaryColumns, toMediaRef, toUserSummary } from "../../lib/serialize-spaces";
import { guardMessage } from "../../lib/spam";
import { followsActively, isPrivateAccount } from "../social/access";

const { sounds, stories, storyViews, media, users, follows } = schema;
type SoundRow = typeof sounds.$inferSelect;
type StoryRow = typeof stories.$inferSelect;

const invalid = (message: string) => new AppError(400, "BAD_REQUEST", message);

/** Library tracks only ever stream from Jamendo, and covers from Openverse or Jamendo. */
const AUDIO_HOST = /^https:\/\/([a-z0-9-]+\.)*jamendo\.com\//i;
const COVER_HOST = /^https:\/\/(api\.openverse\.org|([a-z0-9-]+\.)*jamendo\.com)\//i;
const SEARCH_TTL = 24 * 3600;

interface OpenverseTrack {
  id: string;
  title?: string;
  creator?: string;
  url?: string;
  thumbnail?: string | null;
  license?: string;
  foreign_landing_url?: string;
  duration?: number | null;
}

const licenceName = (l?: string) =>
  !l ? null : l.toLowerCase() === "cc0" ? "CC0" : `CC ${l.toUpperCase()}`;

/**
 * Music: the free library (Creative Commons tracks from Jamendo, searched through Openverse and
 * kept in Realm's own list so posts can point at them), creators' own sounds, and Stories.
 */
export class MusicService {
  constructor(private readonly deps: Deps) {}

  private get db() {
    return this.deps.db;
  }

  // ── Sounds ─────────────────────────────────────────────────────────────────

  private async toSounds(rows: SoundRow[]): Promise<Sound[]> {
    const creatorIds = [...new Set(rows.flatMap((r) => (r.creatorId ? [r.creatorId] : [])))];
    const creators = creatorIds.length
      ? await this.db.select(summaryColumns).from(users).where(inArray(users.id, creatorIds))
      : [];
    return rows.map((r) => {
      const creator = creators.find((c) => c.id === r.creatorId);
      return {
        id: String(r.id),
        kind: r.kind,
        title: r.title,
        artist: r.artist,
        coverUrl: r.coverUrl,
        audioUrl: r.kind === "original" && r.mediaId ? mediaUrl(r.mediaId) : (r.audioUrl ?? ""),
        durationMs: r.durationMs,
        licence: r.licence,
        sourceUrl: r.sourceUrl,
        creator: creator ? toUserSummary(creator) : null,
        uses: r.uses,
      };
    });
  }

  /** Ask Openverse for free music (Jamendo, licences that allow reuse). Null when it can't answer. */
  private async openverse(q: string): Promise<OpenverseTrack[] | null> {
    const url = `https://api.openverse.org/v1/audio/?q=${encodeURIComponent(q)}&category=music&license=by,by-sa,cc0&source=jamendo&page_size=20`;
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "Realm (tomyrealm.com)" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { results?: OpenverseTrack[] };
      return Array.isArray(body.results) ? body.results : null;
    } catch (err) {
      this.deps.logger.warn({ err }, "openverse search failed");
      return null;
    }
  }

  /** Search the free library; results are kept for a day so Openverse isn't asked twice. */
  async search(q?: string): Promise<Sound[]> {
    const query = (q?.trim() || "pop").toLowerCase().slice(0, 60);
    const key = `music:search:${createHash("sha1").update(query).digest("base64url")}`;
    const cached = await this.deps.kv.get(key);
    let ids: bigint[] | null = cached ? (JSON.parse(cached) as string[]).map(BigInt) : null;

    if (!ids) {
      const found = await this.openverse(query);
      if (found) {
        ids = [];
        for (const t of found) {
          const audio = t.url && AUDIO_HOST.test(t.url) ? t.url : null;
          const durationMs = Math.round(Number(t.duration ?? 0));
          if (!audio || durationMs < 15_000) continue;
          const values = {
            kind: "library" as const,
            title: (t.title ?? "Untitled").trim().slice(0, 120),
            artist: (t.creator ?? "Unknown artist").trim().slice(0, 80),
            externalId: `openverse:${t.id}`,
            audioUrl: audio,
            coverUrl: t.thumbnail && COVER_HOST.test(t.thumbnail) ? t.thumbnail : null,
            durationMs,
            licence: licenceName(t.license),
            sourceUrl: t.foreign_landing_url?.startsWith("https://") ? t.foreign_landing_url : null,
          };
          const [row] = await this.db
            .insert(sounds)
            .values({ id: this.deps.ids.next(), ...values })
            .onConflictDoUpdate({ target: sounds.externalId, set: values })
            .returning({ id: sounds.id });
          if (row) ids.push(row.id);
        }
        await this.deps.kv.set(key, JSON.stringify(ids.map(String)), SEARCH_TTL);
      }
    }

    if (ids?.length) {
      const rows = await this.db.select().from(sounds).where(inArray(sounds.id, ids));
      return this.toSounds(ids.flatMap((id) => rows.filter((r) => r.id === id)));
    }
    // Openverse is away: search what Realm already knows.
    const like = `%${query.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    const rows = await this.db
      .select()
      .from(sounds)
      .where(sql`${sounds.title} ilike ${like} or ${sounds.artist} ilike ${like}`)
      .orderBy(desc(sounds.uses))
      .limit(20);
    return this.toSounds(rows);
  }

  /** The sounds people use most, topped up from the library when Realm is new. */
  async trending(): Promise<Sound[]> {
    const rows = await this.db
      .select()
      .from(sounds)
      .where(gt(sounds.uses, 0))
      .orderBy(desc(sounds.uses))
      .limit(20);
    const used = await this.toSounds(rows);
    if (used.length >= 8) return used;
    const fill = await this.search("pop");
    return [...used, ...fill.filter((s) => !used.some((u) => u.id === s.id))].slice(0, 20);
  }

  async mine(userId: bigint): Promise<Sound[]> {
    const rows = await this.db
      .select()
      .from(sounds)
      .where(eq(sounds.creatorId, userId))
      .orderBy(desc(sounds.createdAt))
      .limit(50);
    return this.toSounds(rows);
  }

  async get(id: bigint): Promise<Sound> {
    const [row] = await this.db.select().from(sounds).where(eq(sounds.id, id)).limit(1);
    if (!row) throw notFound("Sound");
    return (await this.toSounds([row]))[0] as Sound;
  }

  /** Make your own sound from a recording or upload, so you (and others) can use it. */
  async create(userId: bigint, body: CreateSoundBody): Promise<Sound> {
    const [file] = await this.db
      .select()
      .from(media)
      .where(eq(media.id, BigInt(body.mediaId)))
      .limit(1);
    if (!file || file.ownerId !== userId || file.status !== "ready") {
      throw invalid("Upload the sound first, and wait for it to finish.");
    }
    if (file.kind !== "audio" && file.kind !== "video") {
      throw invalid("A sound has to be audio (or a video, for its sound).");
    }
    const durationMs = file.durationMs ?? 0;
    if (durationMs > 0 && durationMs < 3000) throw invalid("Sounds need to be at least 3 seconds.");
    const [author] = await this.db
      .select({ id: users.id, createdAt: users.createdAt, emailVerifiedAt: users.emailVerifiedAt, name: users.displayName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!author) throw notFound("User");
    await guardMessage(this.deps, author, body.title);
    const id = this.deps.ids.next();
    await this.db.insert(sounds).values({
      id,
      kind: "original",
      title: body.title,
      artist: author.name,
      creatorId: userId,
      mediaId: file.id,
      durationMs,
    });
    return this.get(id);
  }

  /** Check a sound pick and count one more use. */
  async pick(pick: SoundPick | undefined) {
    if (!pick) return null;
    const [row] = await this.db
      .select()
      .from(sounds)
      .where(eq(sounds.id, BigInt(pick.soundId)))
      .limit(1);
    if (!row) throw invalid("That sound isn't available.");
    const startMs = row.durationMs ? Math.min(pick.startMs, Math.max(0, row.durationMs - 5000)) : 0;
    await this.db
      .update(sounds)
      .set({ uses: sql`${sounds.uses} + 1` })
      .where(eq(sounds.id, row.id));
    return { soundId: row.id, soundStartMs: startMs, soundPlayMs: pick.durationMs };
  }

  /** The sounds on posts or Stories, with the part each plays. */
  async uses(
    rows: { soundId: bigint | null; soundStartMs: number | null; soundPlayMs: number | null }[],
  ): Promise<(SoundUse | null)[]> {
    const ids = [...new Set(rows.flatMap((r) => (r.soundId ? [r.soundId] : [])))];
    const found = ids.length
      ? await this.toSounds(await this.db.select().from(sounds).where(inArray(sounds.id, ids)))
      : [];
    return rows.map((r) => {
      const s = r.soundId ? found.find((x) => x.id === String(r.soundId)) : undefined;
      return s ? { ...s, startMs: r.soundStartMs ?? 0, playMs: r.soundPlayMs ?? 15_000 } : null;
    });
  }

  // ── Stories ────────────────────────────────────────────────────────────────

  async createStory(userId: bigint, body: CreateStoryBody): Promise<Story> {
    const [file] = await this.db
      .select()
      .from(media)
      .where(eq(media.id, BigInt(body.mediaId)))
      .limit(1);
    if (!file || file.ownerId !== userId || file.status !== "ready") {
      throw invalid("Add a photo or video first, and wait for it to finish uploading.");
    }
    if (file.kind !== "image" && file.kind !== "video") throw invalid("Stories are a photo or a video.");
    if (file.kind === "video" && (file.durationMs ?? 0) > 60_000) {
      throw invalid("Story videos can be up to 60 seconds.");
    }
    const caption = body.caption?.trim() || null;
    if (caption) {
      const [author] = await this.db
        .select({ id: users.id, createdAt: users.createdAt, emailVerifiedAt: users.emailVerifiedAt })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (author) await guardMessage(this.deps, author, caption);
    }
    const sound = await this.pick(body.sound);
    const visibility =
      body.visibility ?? ((await isPrivateAccount(this.db, userId)) ? "followers" : "public");
    const id = this.deps.ids.next();
    await this.db.insert(stories).values({
      id,
      authorId: userId,
      mediaId: file.id,
      caption,
      visibility,
      expiresAt: new Date(Date.now() + STORY_HOURS * 3600 * 1000),
      ...(sound ?? {}),
    });
    const [row] = await this.db.select().from(stories).where(eq(stories.id, id));
    return (await this.toStories([row as StoryRow], userId))[0] as Story;
  }

  /** Whether someone may watch a Story: its author, everyone for public ones, followers otherwise. */
  private async canSee(row: StoryRow, viewerId: bigint | null) {
    if (row.deletedAt || row.expiresAt < new Date()) return false;
    if (viewerId === row.authorId) return true;
    if (row.visibility === "public" && !(await isPrivateAccount(this.db, row.authorId))) return true;
    return viewerId ? followsActively(this.db, viewerId, row.authorId) : false;
  }

  private async toStories(rows: StoryRow[], viewerId: bigint | null): Promise<Story[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const [authors, files, seen, counts, soundList] = await Promise.all([
      this.db
        .select(summaryColumns)
        .from(users)
        .where(inArray(users.id, [...new Set(rows.map((r) => r.authorId))])),
      this.db
        .select()
        .from(media)
        .where(inArray(media.id, rows.map((r) => r.mediaId))),
      viewerId
        ? this.db
            .select({ storyId: storyViews.storyId })
            .from(storyViews)
            .where(and(eq(storyViews.viewerId, viewerId), inArray(storyViews.storyId, ids)))
        : Promise.resolve([]),
      this.db
        .select({ storyId: storyViews.storyId, n: sql<number>`count(*)::int` })
        .from(storyViews)
        .where(inArray(storyViews.storyId, ids))
        .groupBy(storyViews.storyId),
      this.uses(rows),
    ]);
    const seenSet = new Set(seen.map((v) => String(v.storyId)));
    return rows.flatMap((r, i) => {
      const author = authors.find((a) => a.id === r.authorId);
      const file = files.find((f) => f.id === r.mediaId);
      if (!author || !file) return [];
      const mine = viewerId === r.authorId;
      return [
        {
          id: String(r.id),
          author: toUserSummary(author),
          media: toMediaRef(file),
          sound: soundList[i] ?? null,
          caption: r.caption,
          createdAt: r.createdAt.toISOString(),
          expiresAt: r.expiresAt.toISOString(),
          seen: mine || seenSet.has(String(r.id)),
          views: mine ? Number(counts.find((c) => c.storyId === r.id)?.n ?? 0) : null,
        },
      ];
    });
  }

  /** Stories from you and the people you follow, grouped by person, new ones first. */
  async feed(viewerId: bigint): Promise<StoryFeed> {
    const followed = await this.db
      .select({ id: follows.followeeId })
      .from(follows)
      .where(and(eq(follows.followerId, viewerId), eq(follows.status, "active")));
    const authorIds = [viewerId, ...followed.map((f) => f.id)];
    const rows = await this.db
      .select()
      .from(stories)
      .where(
        and(
          inArray(stories.authorId, authorIds),
          isNull(stories.deletedAt),
          gt(stories.expiresAt, new Date()),
        ),
      )
      .orderBy(stories.createdAt)
      .limit(500);
    const visible: StoryRow[] = [];
    for (const r of rows) if (await this.canSee(r, viewerId)) visible.push(r);
    const all = await this.toStories(visible, viewerId);
    const rings: StoryRing[] = [];
    for (const s of all) {
      let ring = rings.find((x) => x.author.id === s.author.id);
      if (!ring) {
        ring = { author: s.author, stories: [], unseen: false };
        rings.push(ring);
      }
      ring.stories.push(s);
      if (!s.seen) ring.unseen = true;
    }
    const me = String(viewerId);
    rings.sort((a, b) => {
      if (a.author.id === me) return -1;
      if (b.author.id === me) return 1;
      if (a.unseen !== b.unseen) return a.unseen ? -1 : 1;
      const last = (r: StoryRing) => r.stories.at(-1)?.createdAt ?? "";
      return last(b).localeCompare(last(a));
    });
    return { rings };
  }

  /** One person's current Stories, for their profile. */
  async ofUser(username: string, viewerId: bigint | null): Promise<Story[]> {
    const [u] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(ilike(users.username, username.replace(/[\\%_]/g, (m) => `\\${m}`)))
      .limit(1);
    if (!u) throw notFound("User");
    const rows = await this.db
      .select()
      .from(stories)
      .where(and(eq(stories.authorId, u.id), isNull(stories.deletedAt), gt(stories.expiresAt, new Date())))
      .orderBy(stories.createdAt)
      .limit(100);
    const visible: StoryRow[] = [];
    for (const r of rows) if (await this.canSee(r, viewerId)) visible.push(r);
    return this.toStories(visible, viewerId);
  }

  async view(viewerId: bigint, storyId: bigint) {
    const [row] = await this.db.select().from(stories).where(eq(stories.id, storyId)).limit(1);
    if (!row || !(await this.canSee(row, viewerId))) throw notFound("Story");
    if (row.authorId === viewerId) return;
    await this.db.insert(storyViews).values({ storyId, viewerId }).onConflictDoNothing();
  }

  async remove(userId: bigint, storyId: bigint) {
    const [row] = await this.db.select().from(stories).where(eq(stories.id, storyId)).limit(1);
    if (!row || row.deletedAt) throw notFound("Story");
    if (row.authorId !== userId) throw forbidden("Only its author can delete a Story.");
    await this.db.update(stories).set({ deletedAt: new Date() }).where(eq(stories.id, storyId));
  }

  /** For media access: may this person see a picture or video that's in a Story, or a sound? */
  async mediaVisible(mediaId: bigint, viewerId: bigint | null): Promise<boolean> {
    const [asSound] = await this.db
      .select({ id: sounds.id })
      .from(sounds)
      .where(eq(sounds.mediaId, mediaId))
      .limit(1);
    if (asSound) return true;
    const rows = await this.db.select().from(stories).where(eq(stories.mediaId, mediaId)).limit(5);
    for (const r of rows) if (await this.canSee(r, viewerId)) return true;
    return false;
  }
}
