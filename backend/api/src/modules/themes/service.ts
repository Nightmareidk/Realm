import {
  type ActiveTheme,
  ageInYears,
  checkTheme,
  fixTheme,
  Limits,
  type MyTheme,
  mapThemeImages,
  type ReportThemeBody,
  type ReviewThemeBody,
  resolveTheme,
  type SaveThemeBody,
  THEME_STORE,
  type ThemeCheck,
  type ThemeDetail,
  ThemeFile,
  type ThemePage,
  type ThemeReview,
  type ThemeStoreQuery,
  type ThemeSummary,
  themeImages,
  type UpdateThemeBody,
  type WallpaperLight,
} from "@realm/contracts";
import { and, desc, eq, ilike, inArray, isNotNull, lt, ne, or, schema, sql } from "@realm/db";
import sharp from "sharp";
import type { Deps } from "../../deps";
import { AppError, badRequest, conflict, forbidden, notFound } from "../../lib/errors";
import { mediaUrl } from "../../lib/serialize";
import { summaryColumns, toUserSummary } from "../../lib/serialize-spaces";
import { paletteFromPicture } from "./palette";

const {
  themes,
  themeVersions,
  themeAssets,
  themeLibrary,
  themeReviews,
  themeReports,
  media,
  users,
  userSettings,
} = schema;

type ThemeRow = typeof themes.$inferSelect;

const PAGE = 24;
/** Accounts whose reports count towards hiding a theme: email confirmed, at least a day old. */
const ESTABLISHED_MS = 24 * 3600 * 1000;
const LINK = /\bhttps?:\/\/|\bwww\.|\b[a-z0-9-]+\.(com|net|org|gg|io|xyz|ru|ly|me|app|link)\b/i;

const invalid = (message: string) => new AppError(400, "THEME_INVALID", message);
const notOwned = () =>
  new AppError(403, "THEME_NOT_OWNED", "Get this theme first. Paid themes need buying.");
const paymentsOff = () =>
  new AppError(
    503,
    "PAYMENTS_NOT_SET_UP",
    "Paid themes aren't set up on this Realm yet. Free themes work now.",
  );

const mediaRef = (ref: string) => (ref.startsWith("media:") ? BigInt(ref.slice(6)) : null);

/**
 * Themes: the store ("More themes"), your library, saving what you design, and which theme
 * you're using. The file format and its checks live in @realm/contracts (themes/), shared with
 * the studio, so the server and the editor always agree on what passes.
 */
export class ThemeService {
  constructor(private readonly deps: Deps) {}

  private get db() {
    return this.deps.db;
  }

  paymentsEnabled() {
    return Boolean(this.deps.config.STRIPE_SECRET_KEY);
  }

  // ── Checking a file ────────────────────────────────────────────────────────

  /**
   * How bright a wallpaper is at its darkest and brightest, measured from the picture itself
   * (shrunk to 24×24 first), so the readability check is about the real image.
   */
  private async wallpaperLight(mediaId: bigint): Promise<WallpaperLight | undefined> {
    const cacheKey = `theme:wallpaper:${mediaId}`;
    const cached = await this.deps.kv.get(cacheKey);
    if (cached) return JSON.parse(cached) as WallpaperLight;
    const [row] = await this.db.select().from(media).where(eq(media.id, mediaId)).limit(1);
    if (!row) return undefined;
    try {
      const bytes = await this.deps.storage.read(row.storageKey, 0, row.sizeBytes - 1);
      const { data } = await sharp(bytes, { limitInputPixels: 60_000_000, failOn: "error" })
        .resize(24, 24, { fit: "fill" })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const lin = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      const lums: number[] = [];
      for (let i = 0; i + 2 < data.length; i += 3) {
        lums.push(
          0.2126 * lin(data[i] as number) +
            0.7152 * lin(data[i + 1] as number) +
            0.0722 * lin(data[i + 2] as number),
        );
      }
      lums.sort((a, b) => a - b);
      const at = (p: number) => lums[Math.min(lums.length - 1, Math.floor(p * lums.length))] ?? 0;
      const light = { low: at(0.02), high: at(0.98) };
      await this.deps.kv.set(cacheKey, JSON.stringify(light), 30 * 24 * 3600);
      return light;
    } catch (err) {
      this.deps.logger.warn({ err, mediaId: String(mediaId) }, "wallpaper measure failed");
      // Unmeasured: assume the brightest picture, so the dimming errs on readable.
      return { low: 0, high: 1 };
    }
  }

  /**
   * Make a file safe to use: every picture must be a finished image this person may use (theirs,
   * or from a theme in their library), and anything hard to read is fixed. Returns what changed.
   */
  async check(userId: bigint, input: ThemeFile, opts: { ownPicturesOnly?: boolean } = {}) {
    const problems: string[] = [];
    const refs = themeImages(input);
    const ids = refs.map(mediaRef).filter((v): v is bigint => v !== null);
    if (refs.length > ids.length) {
      problems.push("Some pictures weren't uploaded yet, so they were left out.");
    }

    const allowed = new Set<string>();
    if (ids.length) {
      const rows = await this.db
        .select({ id: media.id, ownerId: media.ownerId, kind: media.kind, status: media.status })
        .from(media)
        .where(inArray(media.id, ids));
      const borrowed = opts.ownPicturesOnly
        ? []
        : await this.db
            .select({ mediaId: themeAssets.mediaId })
            .from(themeAssets)
            .innerJoin(themeLibrary, eq(themeLibrary.themeId, themeAssets.themeId))
            .where(and(eq(themeLibrary.userId, userId), inArray(themeAssets.mediaId, ids)));
      const fromLibrary = new Set(borrowed.map((b) => String(b.mediaId)));
      for (const r of rows) {
        if (r.kind !== "image" || r.status !== "ready") continue;
        if (r.ownerId === userId || fromLibrary.has(String(r.id))) allowed.add(`media:${r.id}`);
      }
      if (allowed.size < ids.length) {
        problems.push(
          opts.ownPicturesOnly
            ? "Themes in the store can only use pictures you uploaded yourself."
            : "A picture in this theme isn't available to you, so it was left out.",
        );
      }
    }
    const file = mapThemeImages(input, (ref) => (allowed.has(ref) ? ref : null));

    const resolved = resolveTheme(file);
    const wallpaperId = file.art?.wallpaper ? mediaRef(file.art.wallpaper.image) : null;
    const light = wallpaperId ? await this.wallpaperLight(wallpaperId) : undefined;
    const found = checkTheme(resolved, light);
    if (!found.length) return { file, problems };

    const fixed = fixTheme(resolved, light);
    if (checkTheme(fixed, light).length) {
      throw invalid("Realm couldn't make this theme readable. Try more different colours.");
    }
    problems.push(
      ...found.map((p) => p.message),
      "Realm adjusted it so everything stays readable.",
    );
    const out = ThemeFile.parse({
      ...file,
      colors: fixed.colors,
      style: { ...file.style, glow: fixed.style.glow },
      ...(file.panels || fixed.panels.opacity < 1
        ? { panels: { ...file.panels, opacity: fixed.panels.opacity } }
        : {}),
      ...(file.art ? { art: fixed.art } : {}),
    });
    return { file: out, problems };
  }

  /** Colour sets from one of your pictures (or one from a theme you have). */
  async palette(userId: bigint, mediaId: bigint) {
    const [row] = await this.db.select().from(media).where(eq(media.id, mediaId)).limit(1);
    const yours =
      row?.ownerId === userId || (row ? await this.assetVisible(row.id, userId) : false);
    if (!row || !yours || row.kind !== "image" || row.status !== "ready") throw notFound("Picture");
    try {
      const bytes = await this.deps.storage.read(row.storageKey, 0, row.sizeBytes - 1);
      return { suggestions: await paletteFromPicture(bytes) };
    } catch (err) {
      this.deps.logger.warn({ err, mediaId: String(mediaId) }, "palette failed");
      throw invalid("Realm couldn't read colours from that picture. Try another one.");
    }
  }

  async checkOnly(userId: bigint, input: ThemeFile): Promise<ThemeCheck> {
    try {
      const { file, problems } = await this.check(userId, input);
      return { ok: true, file, problems };
    } catch (err) {
      if (err instanceof AppError && err.code === "THEME_INVALID")
        return { ok: false, file: null, problems: [err.message] };
      throw err;
    }
  }

  // ── Reading ────────────────────────────────────────────────────────────────

  private async latestFile(themeId: bigint, version: number): Promise<ThemeFile> {
    const [v] = await this.db
      .select({ file: themeVersions.file })
      .from(themeVersions)
      .where(and(eq(themeVersions.themeId, themeId), eq(themeVersions.number, version)))
      .limit(1);
    if (!v) throw notFound("Theme");
    return ThemeFile.parse(v.file);
  }

  private async summaries(rows: ThemeRow[], viewerId: bigint | null): Promise<ThemeSummary[]> {
    if (!rows.length) return [];
    const creatorIds = [...new Set(rows.map((r) => r.creatorId))];
    const [creators, files, owned] = await Promise.all([
      this.db.select(summaryColumns).from(users).where(inArray(users.id, creatorIds)),
      this.db
        .select({
          themeId: themeVersions.themeId,
          number: themeVersions.number,
          file: themeVersions.file,
        })
        .from(themeVersions)
        .where(
          or(
            ...rows.map((r) =>
              and(eq(themeVersions.themeId, r.id), eq(themeVersions.number, r.version)),
            ),
          ),
        ),
      viewerId
        ? this.db
            .select({ themeId: themeLibrary.themeId })
            .from(themeLibrary)
            .where(
              and(
                eq(themeLibrary.userId, viewerId),
                inArray(
                  themeLibrary.themeId,
                  rows.map((r) => r.id),
                ),
              ),
            )
        : Promise.resolve([]),
    ]);
    const ownedSet = new Set(owned.map((o) => String(o.themeId)));
    return rows.flatMap((r) => {
      const creator = creators.find((c) => c.id === r.creatorId);
      const f = files.find((x) => x.themeId === r.id && x.number === r.version);
      if (!creator || !f) return [];
      return [
        {
          id: String(r.id),
          name: r.name,
          description: r.description,
          look: r.look,
          tags: r.tags as ThemeSummary["tags"],
          creator: toUserSummary(creator),
          priceCents: r.priceCents,
          installs: r.installs,
          rating: r.ratingCount ? Math.round((r.ratingSum / r.ratingCount) * 10) / 10 : null,
          ratingCount: r.ratingCount,
          version: r.version,
          status: r.status,
          file: ThemeFile.parse(f.file),
          updatedAt: r.updatedAt.toISOString(),
          owned: ownedSet.has(String(r.id)),
          mine: viewerId === r.creatorId,
        },
      ];
    });
  }

  /** A theme someone may look at: in the store, theirs, or in their library. */
  private async visible(themeId: bigint, viewerId: bigint | null): Promise<ThemeRow> {
    const [row] = await this.db.select().from(themes).where(eq(themes.id, themeId)).limit(1);
    if (!row) throw notFound("Theme");
    if (row.status === "published") return row;
    if (viewerId && row.creatorId === viewerId && row.status !== "removed") return row;
    if (viewerId && (await this.inLibrary(viewerId, themeId))) return row;
    throw notFound("Theme");
  }

  private async inLibrary(userId: bigint, themeId: bigint) {
    const [hit] = await this.db
      .select({ source: themeLibrary.source })
      .from(themeLibrary)
      .where(and(eq(themeLibrary.userId, userId), eq(themeLibrary.themeId, themeId)))
      .limit(1);
    return hit ?? null;
  }

  async store(viewerId: bigint | null, q: ThemeStoreQuery): Promise<ThemePage> {
    const where = [eq(themes.status, "published")];
    if (q.q) {
      const like = `%${q.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
      where.push(or(ilike(themes.name, like), ilike(themes.description, like)) as never);
    }
    if (q.tag) where.push(sql`${q.tag} = any(${themes.tags})`);
    if (q.look) where.push(eq(themes.look, q.look));
    if (q.price === "free") where.push(eq(themes.priceCents, 0));
    if (q.price === "paid") where.push(sql`${themes.priceCents} > 0`);
    const order =
      q.sort === "new"
        ? [desc(themes.publishedAt), desc(themes.id)]
        : q.sort === "top"
          ? [
              desc(
                sql`case when ${themes.ratingCount} >= 3 then ${themes.ratingSum}::float / ${themes.ratingCount} else 0 end`,
              ),
              desc(themes.installs),
            ]
          : [desc(themes.installs), desc(themes.id)];
    const rows = await this.db
      .select()
      .from(themes)
      .where(and(...where))
      .orderBy(...order)
      .limit(PAGE + 1)
      .offset(q.page * PAGE);
    return { items: await this.summaries(rows.slice(0, PAGE), viewerId), more: rows.length > PAGE };
  }

  async detail(themeId: bigint, viewerId: bigint | null): Promise<ThemeDetail> {
    const row = await this.visible(themeId, viewerId);
    const [summary] = await this.summaries([row], viewerId);
    if (!summary) throw notFound("Theme");
    const [versions, reviewRows] = await Promise.all([
      this.db
        .select()
        .from(themeVersions)
        .where(eq(themeVersions.themeId, themeId))
        .orderBy(desc(themeVersions.number))
        .limit(20),
      this.db
        .select({ review: themeReviews, author: summaryColumns })
        .from(themeReviews)
        .innerJoin(users, eq(users.id, themeReviews.userId))
        .where(eq(themeReviews.themeId, themeId))
        .orderBy(desc(themeReviews.updatedAt))
        .limit(30),
    ]);
    const reviews: ThemeReview[] = reviewRows.map((r) => ({
      author: toUserSummary(r.author),
      stars: r.review.stars,
      text: r.review.body,
      createdAt: r.review.updatedAt.toISOString(),
    }));
    const mineIdx = viewerId ? reviewRows.findIndex((r) => r.review.userId === viewerId) : -1;
    return {
      ...summary,
      versions: versions.map((v) => ({
        number: v.number,
        changelog: v.changelog,
        createdAt: v.createdAt.toISOString(),
      })),
      reviews,
      myReview: mineIdx >= 0 ? (reviews[mineIdx] ?? null) : null,
      ownArt: row.ownArt,
    };
  }

  async library(userId: bigint): Promise<ThemeSummary[]> {
    const rows = await this.db
      .select({ theme: themes })
      .from(themeLibrary)
      .innerJoin(themes, eq(themes.id, themeLibrary.themeId))
      .where(eq(themeLibrary.userId, userId))
      .orderBy(desc(themeLibrary.createdAt))
      .limit(200);
    return this.summaries(
      rows.map((r) => r.theme).filter((t) => t.status !== "removed" || t.creatorId !== userId),
      userId,
    );
  }

  async created(userId: bigint): Promise<ThemeSummary[]> {
    const rows = await this.db
      .select()
      .from(themes)
      .where(and(eq(themes.creatorId, userId), ne(themes.status, "removed")))
      .orderBy(desc(themes.updatedAt))
      .limit(200);
    return this.summaries(rows, userId);
  }

  /** The picture links a theme's file needs, for someone allowed to use it. */
  async file(themeId: bigint, viewerId: bigint) {
    const row = await this.visible(themeId, viewerId);
    const owned = await this.inLibrary(viewerId, themeId);
    const free = row.status === "published" && row.priceCents === 0;
    if (!owned && !free && row.creatorId !== viewerId) throw notOwned();
    const file = await this.latestFile(themeId, row.version);
    return {
      file,
      images: themeImages(file).map((ref) => ({ ref, url: mediaUrl(ref.slice(6)) })),
    };
  }

  // ── Making ─────────────────────────────────────────────────────────────────

  private async owned(themeId: bigint, userId: bigint): Promise<ThemeRow> {
    const [row] = await this.db.select().from(themes).where(eq(themes.id, themeId)).limit(1);
    if (!row || row.status === "removed") throw notFound("Theme");
    if (row.creatorId !== userId)
      throw forbidden("Only the person who made this theme can change it.");
    return row;
  }

  private async noteAssets(themeId: bigint, file: ThemeFile) {
    const ids = themeImages(file)
      .map(mediaRef)
      .filter((v): v is bigint => v !== null);
    if (ids.length) {
      await this.db
        .insert(themeAssets)
        .values(ids.map((mediaId) => ({ themeId, mediaId })))
        .onConflictDoNothing();
    }
  }

  async create(userId: bigint, body: SaveThemeBody) {
    const { file, problems } = await this.check(userId, body.file);
    const id = this.deps.ids.next();
    await this.db.transaction(async (tx) => {
      await tx.insert(themes).values({
        id,
        creatorId: userId,
        name: file.name,
        description: file.description ?? null,
        look: file.look,
        tags: body.tags,
        priceCents: body.priceCents,
        ownArt: body.ownArt,
      });
      await tx.insert(themeVersions).values({
        themeId: id,
        number: 1,
        file,
        changelog: body.changelog ?? null,
      });
      await tx.insert(themeLibrary).values({ userId, themeId: id, source: "own" });
    });
    await this.noteAssets(id, file);
    return { theme: await this.detail(id, userId), problems };
  }

  async addVersion(userId: bigint, themeId: bigint, body: SaveThemeBody) {
    const row = await this.owned(themeId, userId);
    const { file, problems } = await this.check(userId, body.file, {
      ownPicturesOnly: row.status === "published",
    });
    if (row.status === "published") this.guardPublicText(file);
    const number = row.version + 1;
    await this.db.transaction(async (tx) => {
      await tx.insert(themeVersions).values({
        themeId,
        number,
        file,
        changelog: body.changelog ?? null,
      });
      await tx
        .update(themes)
        .set({
          version: number,
          name: file.name,
          description: file.description ?? null,
          look: file.look,
          tags: body.tags,
          ownArt: body.ownArt,
        })
        .where(eq(themes.id, themeId));
    });
    await this.noteAssets(themeId, file);
    if (body.priceCents !== row.priceCents) {
      await this.update(userId, themeId, { priceCents: body.priceCents });
    }
    return { theme: await this.detail(themeId, userId), problems };
  }

  private async seller(userId: bigint) {
    const [u] = await this.db
      .select({ birthDate: users.birthDate, verified: users.emailVerifiedAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!u) throw notFound("User");
    if (ageInYears(u.birthDate) < Limits.adultAgeYears) {
      throw forbidden("Selling themes is for people 18 and over. You can share themes for free.");
    }
  }

  async update(userId: bigint, themeId: bigint, body: UpdateThemeBody) {
    const row = await this.owned(themeId, userId);
    const price = body.priceCents ?? row.priceCents;
    const ownArt = body.ownArt ?? row.ownArt;
    if (price > 0) {
      await this.seller(userId);
      if (!ownArt) {
        throw badRequest(
          "THEME_INVALID",
          "To sell a theme, its pictures must be yours or ones you're allowed to sell. Tick the box to say so.",
        );
      }
      if (row.status === "published" && !this.paymentsEnabled()) throw paymentsOff();
    }
    await this.db
      .update(themes)
      .set({ priceCents: price, ownArt, ...(body.tags ? { tags: body.tags } : {}) })
      .where(eq(themes.id, themeId));
    return this.detail(themeId, userId);
  }

  private guardPublicText(file: ThemeFile) {
    if (LINK.test(file.name) || LINK.test(file.description ?? "")) {
      throw invalid("Theme names and descriptions in the store can't have web links.");
    }
  }

  async publish(userId: bigint, themeId: bigint) {
    const row = await this.owned(themeId, userId);
    if (row.status === "hidden") {
      throw forbidden(
        "This theme was hidden after reports. It can't go back in the store for now.",
      );
    }
    const [u] = await this.db
      .select({ verified: users.emailVerifiedAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!u?.verified) {
      throw new AppError(403, "EMAIL_NOT_VERIFIED", "Confirm your email to share themes.");
    }
    const file = await this.latestFile(themeId, row.version);
    this.guardPublicText(file);
    // Everything in the store uses only its creator's own pictures.
    const { file: checked } = await this.check(userId, file, { ownPicturesOnly: true });
    if (themeImages(checked).length !== themeImages(file).length) {
      throw invalid("Themes in the store can only use pictures you uploaded yourself.");
    }
    if (row.priceCents > 0) {
      await this.seller(userId);
      if (!row.ownArt) throw invalid("To sell a theme, say its pictures are yours to sell.");
      if (!this.paymentsEnabled()) throw paymentsOff();
    }
    await this.db
      .update(themes)
      .set({ status: "published", publishedAt: row.publishedAt ?? new Date() })
      .where(eq(themes.id, themeId));
    return this.detail(themeId, userId);
  }

  async unpublish(userId: bigint, themeId: bigint) {
    const row = await this.owned(themeId, userId);
    if (row.status === "published") {
      await this.db.update(themes).set({ status: "draft" }).where(eq(themes.id, themeId));
    }
    return this.detail(themeId, userId);
  }

  /** Takes a theme out for good. Anyone who already has it keeps it. */
  async remove(userId: bigint, themeId: bigint) {
    await this.owned(themeId, userId);
    await this.db.update(themes).set({ status: "removed" }).where(eq(themes.id, themeId));
    await this.db
      .delete(themeLibrary)
      .where(and(eq(themeLibrary.themeId, themeId), eq(themeLibrary.userId, userId)));
    await this.db
      .update(userSettings)
      .set({ themeId: null })
      .where(and(eq(userSettings.userId, userId), eq(userSettings.themeId, themeId)));
  }

  // ── Getting ────────────────────────────────────────────────────────────────

  async get(userId: bigint, themeId: bigint) {
    const row = await this.visible(themeId, userId);
    if (await this.inLibrary(userId, themeId)) return this.detail(themeId, userId);
    if (row.status !== "published") throw notFound("Theme");
    if (row.priceCents > 0) throw notOwned();
    const added = await this.db
      .insert(themeLibrary)
      .values({ userId, themeId, source: "added" })
      .onConflictDoNothing()
      .returning({ userId: themeLibrary.userId });
    if (added.length) {
      await this.db
        .update(themes)
        .set({ installs: sql`${themes.installs} + 1` })
        .where(eq(themes.id, themeId));
    }
    return this.detail(themeId, userId);
  }

  async drop(userId: bigint, themeId: bigint) {
    const hit = await this.inLibrary(userId, themeId);
    if (!hit) return;
    if (hit.source === "own") throw forbidden("This is your theme. Delete it instead.");
    if (hit.source === "bought") {
      throw forbidden(
        "You bought this theme, so it stays in your library. Switch to another to stop using it.",
      );
    }
    await this.db
      .delete(themeLibrary)
      .where(and(eq(themeLibrary.userId, userId), eq(themeLibrary.themeId, themeId)));
    await this.db
      .update(userSettings)
      .set({ themeId: null })
      .where(and(eq(userSettings.userId, userId), eq(userSettings.themeId, themeId)));
  }

  async buy(userId: bigint, themeId: bigint): Promise<{ checkoutUrl: string }> {
    const row = await this.visible(themeId, userId);
    if (row.status !== "published" || row.priceCents === 0) throw notFound("Theme");
    if (await this.inLibrary(userId, themeId)) {
      throw conflict("CONFLICT", "You already have this theme.");
    }
    const [u] = await this.db
      .select({ birthDate: users.birthDate })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!u || ageInYears(u.birthDate) < Limits.adultAgeYears) {
      throw forbidden("Buying themes is for people 18 and over. Free themes are open to everyone.");
    }
    if (!this.paymentsEnabled()) throw paymentsOff();
    // Checkout with Stripe is switched on with the payment keys (docs/SERVICES.md).
    throw paymentsOff();
  }

  // ── Reviews and reports ────────────────────────────────────────────────────

  private async recount(themeId: bigint) {
    const [r] = await this.db
      .select({
        sum: sql<number>`coalesce(sum(${themeReviews.stars}), 0)::int`,
        n: sql<number>`count(*)::int`,
      })
      .from(themeReviews)
      .where(eq(themeReviews.themeId, themeId));
    await this.db
      .update(themes)
      .set({ ratingSum: Number(r?.sum ?? 0), ratingCount: Number(r?.n ?? 0) })
      .where(eq(themes.id, themeId));
  }

  async review(userId: bigint, themeId: bigint, body: ReviewThemeBody) {
    const row = await this.visible(themeId, userId);
    if (row.creatorId === userId) throw forbidden("You can't review your own theme.");
    if (!(await this.inLibrary(userId, themeId))) {
      throw forbidden("Add or buy the theme before reviewing it.");
    }
    if (body.text && LINK.test(body.text)) throw invalid("Reviews can't have web links.");
    await this.db
      .insert(themeReviews)
      .values({ themeId, userId, stars: body.stars, body: body.text || null })
      .onConflictDoUpdate({
        target: [themeReviews.themeId, themeReviews.userId],
        set: { stars: body.stars, body: body.text || null, updatedAt: new Date() },
      });
    await this.recount(themeId);
    return this.detail(themeId, userId);
  }

  async unreview(userId: bigint, themeId: bigint) {
    await this.db
      .delete(themeReviews)
      .where(and(eq(themeReviews.themeId, themeId), eq(themeReviews.userId, userId)));
    await this.recount(themeId);
  }

  /**
   * Report a theme. Once three established people report it, it leaves the store until it's
   * looked at; people who have it keep it (solo-moderator rule: automation does the first pass).
   */
  async report(userId: bigint, themeId: bigint, body: ReportThemeBody) {
    const row = await this.visible(themeId, userId);
    if (row.creatorId === userId) throw forbidden("You can't report your own theme.");
    const added = await this.db
      .insert(themeReports)
      .values({ themeId, reporterId: userId, reason: body.reason, notes: body.notes ?? null })
      .onConflictDoNothing()
      .returning({ themeId: themeReports.themeId });
    if (!added.length) throw conflict("ALREADY_REPORTED", "You already reported this theme.");
    const [n] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(themeReports)
      .innerJoin(users, eq(users.id, themeReports.reporterId))
      .where(
        and(
          eq(themeReports.themeId, themeId),
          isNotNull(users.emailVerifiedAt),
          lt(users.createdAt, new Date(Date.now() - ESTABLISHED_MS)),
        ),
      );
    const hidden = Number(n?.n ?? 0) >= THEME_STORE.hideAfterReports && row.status === "published";
    if (hidden) {
      await this.db.update(themes).set({ status: "hidden" }).where(eq(themes.id, themeId));
      this.deps.logger.warn({ themeId: String(themeId) }, "theme hidden after reports");
    }
    return { hidden };
  }

  // ── Using ──────────────────────────────────────────────────────────────────

  async active(userId: bigint): Promise<MyTheme> {
    const [s] = await this.db
      .select({
        look: userSettings.look,
        accent: userSettings.accent,
        themeId: userSettings.themeId,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);
    const look = {
      kind: "look" as const,
      look: s?.look ?? "now-playing",
      accent: s?.accent ?? "mint",
    };
    if (!s?.themeId || !(await this.inLibrary(userId, s.themeId)))
      return { active: look, file: null };
    const [row] = await this.db.select().from(themes).where(eq(themes.id, s.themeId)).limit(1);
    if (!row) return { active: look, file: null };
    return {
      active: { kind: "theme", themeId: String(row.id) },
      file: await this.latestFile(row.id, row.version),
    };
  }

  async setActive(userId: bigint, body: ActiveTheme): Promise<MyTheme> {
    if (body.kind === "look") {
      await this.db
        .insert(userSettings)
        .values({ userId, look: body.look, accent: body.accent, themeId: null })
        .onConflictDoUpdate({
          target: userSettings.userId,
          set: { look: body.look, accent: body.accent, themeId: null },
        });
    } else {
      const themeId = BigInt(body.themeId);
      if (!(await this.inLibrary(userId, themeId))) throw notOwned();
      await this.db
        .insert(userSettings)
        .values({ userId, themeId })
        .onConflictDoUpdate({ target: userSettings.userId, set: { themeId } });
    }
    return this.active(userId);
  }

  /** For media access: may this person see a theme's picture? */
  async assetVisible(mediaId: bigint, viewerId: bigint | null): Promise<boolean> {
    const uses = await this.db
      .select({ themeId: themes.id, status: themes.status, creatorId: themes.creatorId })
      .from(themeAssets)
      .innerJoin(themes, eq(themes.id, themeAssets.themeId))
      .where(eq(themeAssets.mediaId, mediaId))
      .limit(20);
    for (const u of uses) {
      if (u.status === "published") return true;
      if (viewerId && u.creatorId === viewerId) return true;
      if (viewerId && (await this.inLibrary(viewerId, u.themeId))) return true;
    }
    return false;
  }
}
