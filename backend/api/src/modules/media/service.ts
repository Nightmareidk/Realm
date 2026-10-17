import {
  type CreateUploadBody,
  has,
  MEDIA_RULES,
  type MediaInfo,
  Permission,
  type UploadTicket,
  VOICE_MESSAGE_MAX_MS,
} from "@realm/contracts";
import { and, eq, inArray, isNull, or, schema } from "@realm/db";
import type { Deps } from "../../deps";
import { AppError, notFound } from "../../lib/errors";
import { MESSAGE_HIDDEN, toMediaInfo } from "../../lib/serialize-spaces";
import { acceptAs, imageSize, sniff } from "../../lib/sniff";
import { seenThroughPost } from "../social/access";
import { roomAccess } from "../spaces/access";

const { media, messageAttachments, messages, users } = schema;

type MediaRow = typeof media.$inferSelect;

const UPLOAD_TTL_SECONDS = 15 * 60;
const READ_TTL_SECONDS = 10 * 60;
/** How much one person may upload in a day, so a free storage tier can't be filled by one account. */
export const DAILY_UPLOAD_BYTES = 500 * 1024 * 1024;

const invalid = (message: string) => new AppError(400, "UPLOAD_INVALID", message);

/**
 * Uploads: the browser asks for a ticket, sends the file straight to storage, then says it's
 * done; Realm checks what actually arrived before anyone else can see it.
 */
export class MediaService {
  constructor(private readonly deps: Deps) {}

  private get db() {
    return this.deps.db;
  }

  async createUpload(userId: bigint, body: CreateUploadBody): Promise<UploadTicket> {
    const rule = MEDIA_RULES[body.kind];
    if (body.sizeBytes > rule.maxBytes) {
      throw new AppError(
        413,
        "PAYLOAD_TOO_LARGE",
        `That's too big. ${body.kind === "file" ? "Files" : `${body.kind[0]?.toUpperCase()}${body.kind.slice(1)}s`} can be up to ${Math.round(rule.maxBytes / 1024 / 1024)} MB.`,
      );
    }
    const declared = body.mimeType.split(";")[0]?.trim() ?? "";
    if (rule.types.length > 0 && !(rule.types as readonly string[]).includes(declared)) {
      throw invalid("Realm can't take that kind of file here.");
    }
    if (body.kind === "audio" && (body.durationMs ?? 0) > VOICE_MESSAGE_MAX_MS) {
      throw invalid("Voice messages can be up to five minutes.");
    }

    // A day's allowance per person (best effort; the per-file limit is the hard one).
    const day = new Date().toISOString().slice(0, 10);
    const quotaKey = `upload-bytes:${userId}:${day}`;
    const used = Number((await this.deps.kv.get(quotaKey)) ?? 0);
    if (used + body.sizeBytes > DAILY_UPLOAD_BYTES) {
      throw new AppError(429, "RATE_LIMITED", "You've uploaded a lot today. Try again tomorrow.");
    }
    await this.deps.kv.set(quotaKey, String(used + body.sizeBytes), 26 * 3600);

    const id = this.deps.ids.next();
    const key = `u/${userId}/${id}`;
    await this.db.insert(media).values({
      id,
      ownerId: userId,
      kind: body.kind,
      status: "pending",
      storageKey: key,
      mimeType: declared,
      sizeBytes: body.sizeBytes,
      durationMs: body.durationMs ?? null,
      filename: body.kind === "file" ? (body.filename ?? "file") : null,
    });
    const put = await this.deps.storage.presignPut(key, {
      contentType: declared,
      sizeBytes: body.sizeBytes,
      expiresSeconds: UPLOAD_TTL_SECONDS,
    });
    return {
      mediaId: id.toString(),
      uploadUrl: put.url,
      headers: put.headers,
      expiresAt: new Date(Date.now() + UPLOAD_TTL_SECONDS * 1000).toISOString(),
    };
  }

  private async own(userId: bigint, id: bigint) {
    const [row] = await this.db
      .select()
      .from(media)
      .where(and(eq(media.id, id), eq(media.ownerId, userId)))
      .limit(1);
    if (!row) throw notFound("Upload");
    return row;
  }

  /** The upload arrived: check its size and real type, then make it usable. */
  async complete(userId: bigint, id: bigint): Promise<MediaInfo> {
    const row = await this.own(userId, id);
    if (row.status === "ready") return toMediaInfo(row);
    if (row.status !== "pending") throw invalid("That upload can't be used.");

    const fail = async (message: string): Promise<never> => {
      await this.deps.storage.delete(row.storageKey).catch(() => {});
      await this.db.update(media).set({ status: "failed" }).where(eq(media.id, row.id));
      throw invalid(message);
    };

    const stored = await this.deps.storage.head(row.storageKey);
    if (!stored) throw invalid("The file hasn't finished uploading.");
    if (stored.sizeBytes !== row.sizeBytes)
      await fail("The file that arrived isn't the one that was announced.");

    const head = await this.deps.storage.read(row.storageKey, 0, 64 * 1024 - 1);
    const found = sniff(head);
    const type = acceptAs(row.kind, found, row.mimeType);
    if (!type) {
      await fail(
        found === "executable"
          ? "Programs can't be shared on Realm."
          : `That doesn't look like ${row.kind === "image" ? "an image" : row.kind === "audio" ? "audio" : `a ${row.kind}`} Realm can show.`,
      );
    }
    const size = row.kind === "image" ? imageSize(type ?? "", head) : null;
    if (row.kind === "image" && size && (size.width > 16_384 || size.height > 16_384)) {
      await fail("That image is too large to show.");
    }

    const [ready] = await this.db
      .update(media)
      .set({
        status: "ready",
        mimeType: type ?? row.mimeType,
        width: size?.width ?? null,
        height: size?.height ?? null,
      })
      .where(eq(media.id, row.id))
      .returning();
    if (!ready) throw notFound("Upload");
    await this.deps.queue.enqueue("media.scan", { mediaId: ready.id.toString() });
    return toMediaInfo(ready);
  }

  /**
   * Who may open a file: its owner; anyone for profile pictures; a Space's icon and banner for
   * whoever can see the Space; and for a file in a message,
   * people who can read that room (moderators only, while the message is hidden after reports).
   */
  async canSee(row: MediaRow, viewerId: bigint | null): Promise<boolean> {
    if (row.status !== "ready") return viewerId === row.ownerId;
    if (viewerId === row.ownerId) return true;
    const [avatar] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(or(eq(users.avatarMediaId, row.id), eq(users.bannerMediaId, row.id)))
      .limit(1);
    if (avatar) return true;
    // A Space's icon or banner: anyone for a public Space, its members for a private one.
    const [space] = await this.db
      .select({ id: schema.communities.id, visibility: schema.communities.visibility })
      .from(schema.communities)
      .where(
        and(
          or(
            eq(schema.communities.iconMediaId, row.id),
            eq(schema.communities.bannerMediaId, row.id),
          ),
          isNull(schema.communities.deletedAt),
        ),
      )
      .limit(1);
    if (space?.visibility === "public") return true;
    if (space && viewerId) {
      const [member] = await this.db
        .select({ userId: schema.communityMembers.userId })
        .from(schema.communityMembers)
        .where(
          and(
            eq(schema.communityMembers.communityId, space.id),
            eq(schema.communityMembers.userId, viewerId),
          ),
        )
        .limit(1);
      if (member) return true;
    }
    if (await seenThroughPost(this.db, row.id, viewerId)) return true;
    if (!viewerId) return false;
    const uses = await this.db
      .select({ channelId: messages.channelId, flags: messages.flags })
      .from(messageAttachments)
      .innerJoin(messages, eq(messages.id, messageAttachments.messageId))
      .where(and(eq(messageAttachments.mediaId, row.id), isNull(messages.deletedAt)))
      .limit(5);
    for (const use of uses) {
      try {
        const { permissions } = await roomAccess(this.db, use.channelId, viewerId);
        if (!has(permissions, Permission.READ_MESSAGE_HISTORY)) continue;
        if ((use.flags & MESSAGE_HIDDEN) !== 0 && !has(permissions, Permission.MANAGE_MESSAGES))
          continue;
        return true;
      } catch {
        // A room they can't see.
      }
    }
    return false;
  }

  /** A short-lived link to the file itself, for someone allowed to see it. */
  async readUrl(id: bigint, viewerId: bigint | null): Promise<string> {
    const [row] = await this.db.select().from(media).where(eq(media.id, id)).limit(1);
    if (!row || !(await this.canSee(row, viewerId))) throw notFound("File");
    return this.deps.storage.presignGet(row.storageKey, {
      expiresSeconds: READ_TTL_SECONDS,
      contentType: row.kind === "file" ? "application/octet-stream" : row.mimeType,
      ...(row.kind === "file" ? { downloadAs: row.filename ?? "file" } : {}),
    });
  }

  async info(id: bigint, viewerId: bigint): Promise<MediaInfo> {
    const [row] = await this.db.select().from(media).where(eq(media.id, id)).limit(1);
    if (!row || !(await this.canSee(row, viewerId))) throw notFound("File");
    return toMediaInfo(row);
  }

  /** Uploads someone may attach: theirs, finished, and not already in another message. */
  async attachable(userId: bigint, ids: bigint[]): Promise<MediaRow[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(media)
      .where(and(inArray(media.id, ids), eq(media.ownerId, userId), eq(media.status, "ready")));
    if (rows.length !== new Set(ids.map(String)).size) {
      throw invalid("One of those files isn't ready, or isn't yours to send.");
    }
    const used = await this.db
      .select({ id: messageAttachments.mediaId })
      .from(messageAttachments)
      .where(inArray(messageAttachments.mediaId, ids))
      .limit(1);
    if (used.length) throw invalid("That file was already sent. Upload it again to send it twice.");
    return ids.map((id) => rows.find((r) => r.id === id) as MediaRow);
  }
}
