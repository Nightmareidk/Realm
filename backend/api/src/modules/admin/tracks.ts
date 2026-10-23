import { type AdminTrack, type AdminTrackBody, TRACK_LICENCE_LABEL } from "@realm/contracts";
import { and, desc, eq, isNotNull, schema } from "@realm/db";
import type { Deps } from "../../deps";
import { badRequest, notFound } from "../../lib/errors";
import { mediaUrl } from "../../lib/serialize";
import { MusicService } from "../music/service";

const { sounds, media, staffActions } = schema;

/** What an admin may upload as a track: audio, or a video whose sound plays. */
const PLAYABLE = new Set(["audio", "video"]);

/**
 * Realm's own music library: tracks admins add for everyone (Realm's own, licensed, or Creative
 * Commons), searchable and usable on posts, Stories and Clips like any library song. Taking one
 * out hides it from search and lists; posts already using it keep playing it.
 */
export class TracksService {
  private readonly music: MusicService;

  constructor(private readonly deps: Deps) {
    this.music = new MusicService(deps);
  }

  private get db() {
    return this.deps.db;
  }

  private async log(
    actorId: bigint,
    action: string,
    soundId: bigint,
    detail: Record<string, unknown>,
  ) {
    await this.db.insert(staffActions).values({
      id: this.deps.ids.next(),
      actorId,
      action,
      targetType: "sound",
      targetId: soundId.toString(),
      detail,
      reason: null,
    });
  }

  async list(): Promise<AdminTrack[]> {
    const rows = await this.db
      .select()
      .from(sounds)
      .where(isNotNull(sounds.addedBy))
      .orderBy(desc(sounds.createdAt))
      .limit(500);
    const played = await this.music.toSounds(rows);
    return rows.flatMap((r) => {
      const sound = played.find((s) => s.id === r.id.toString());
      return sound
        ? [
            {
              sound,
              hidden: r.hiddenAt !== null,
              addedBy: r.addedBy?.toString() ?? null,
              createdAt: r.createdAt.toISOString(),
            },
          ]
        : [];
    });
  }

  async add(actorId: bigint, body: AdminTrackBody): Promise<AdminTrack> {
    const [file] = await this.db
      .select()
      .from(media)
      .where(and(eq(media.id, BigInt(body.mediaId)), eq(media.ownerId, actorId)))
      .limit(1);
    if (file?.status !== "ready" || !PLAYABLE.has(file.kind)) {
      throw badRequest("UPLOAD_INVALID", "Upload the song first (an MP3, M4A, or MP4).");
    }
    if (!file.durationMs || file.durationMs < 1000) {
      throw badRequest("UPLOAD_INVALID", "Realm couldn't tell how long that song is. Try again.");
    }
    let coverUrl: string | null = null;
    if (body.coverMediaId) {
      const [cover] = await this.db
        .select()
        .from(media)
        .where(and(eq(media.id, BigInt(body.coverMediaId)), eq(media.ownerId, actorId)))
        .limit(1);
      if (cover?.status !== "ready" || cover.kind !== "image") {
        throw badRequest("UPLOAD_INVALID", "The cover has to be a picture you uploaded.");
      }
      coverUrl = mediaUrl(cover.id);
    }
    const id = this.deps.ids.next();
    await this.db.insert(sounds).values({
      id,
      kind: "library",
      title: body.title,
      artist: body.artist,
      mediaId: file.id,
      externalId: `realm:${id}`,
      coverUrl,
      durationMs: file.durationMs,
      licence: TRACK_LICENCE_LABEL[body.licence],
      sourceUrl: body.creditUrl ?? null,
      addedBy: actorId,
    });
    await this.log(actorId, "track.add", id, { title: body.title, artist: body.artist });
    const added = (await this.list()).find((t) => t.sound.id === id.toString());
    if (!added) throw notFound("Track");
    return added;
  }

  /** Take a track out of the library (or put it back). */
  async setHidden(actorId: bigint, soundId: bigint, hidden: boolean) {
    const [row] = await this.db
      .update(sounds)
      .set({ hiddenAt: hidden ? new Date() : null })
      .where(and(eq(sounds.id, soundId), isNotNull(sounds.addedBy)))
      .returning({ id: sounds.id });
    if (!row) throw notFound("Track");
    await this.log(actorId, hidden ? "track.hide" : "track.show", soundId, {});
  }
}
