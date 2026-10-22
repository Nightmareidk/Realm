import { z } from "zod";
import { Snowflake } from "../ids";
import { ThemeFile, ThemeLook } from "../themes/file";
import { IsoDateTime } from "./common";
import { ThemeAccent, UserSummary } from "./users";

/**
 * The theme store ("More themes"), your theme library, and which theme you're using. A theme is a
 * file (themes/file.ts); the store keeps every version of it, who made it, its price and reviews.
 */

export const THEME_STORE = {
  /**
   * Realm's share of a sale, after the payment company's fee. The creator keeps the rest (88%):
   * a little above Discord's 10% for server subscriptions, well below app stores' 15–30%.
   */
  cutPercent: 12,
  /** Prices in US cents. Free, then fixed steps, so store and phone prices line up. */
  priceTiersCents: [0, 199, 299, 499, 799, 999, 1499, 1999],
  currency: "usd",
  /** Creators are paid monthly once they've earned at least this, to keep payout fees small. */
  payoutMinimumCents: 1000,
  /** Reports from this many established accounts hide a theme until it's looked at. */
  hideAfterReports: 3,
} as const;

export const ThemeTag = z.enum([
  "dark",
  "light",
  "colourful",
  "calm",
  "bold",
  "cute",
  "gaming",
  "minimal",
  "retro",
  "nature",
  "seasonal",
  "anime",
  "music",
  "high-contrast",
]);
export type ThemeTag = z.infer<typeof ThemeTag>;

export const ThemeStatus = z.enum(["draft", "published", "hidden", "removed"]);
export type ThemeStatus = z.infer<typeof ThemeStatus>;

export const ThemePrice = z
  .number()
  .int()
  .refine((v) => (THEME_STORE.priceTiersCents as readonly number[]).includes(v), {
    message: "Pick one of the price steps",
  });

/** A theme as the store and your library list it. Its file is small, so previews draw from it. */
export const ThemeSummary = z
  .object({
    id: Snowflake,
    name: z.string(),
    description: z.string().nullable(),
    look: ThemeLook,
    tags: z.array(ThemeTag),
    creator: UserSummary,
    priceCents: z.number().int(),
    installs: z.number().int(),
    /** Average stars (1–5), or null before the first review. */
    rating: z.number().nullable(),
    ratingCount: z.number().int(),
    version: z.number().int(),
    status: ThemeStatus,
    file: ThemeFile,
    updatedAt: IsoDateTime,
    /** In your library (added, bought, or yours). */
    owned: z.boolean(),
    mine: z.boolean(),
  })
  .meta({ id: "ThemeSummary" });
export type ThemeSummary = z.infer<typeof ThemeSummary>;

export const ThemeVersionInfo = z
  .object({ number: z.number().int(), changelog: z.string().nullable(), createdAt: IsoDateTime })
  .meta({ id: "ThemeVersionInfo" });

export const ThemeReview = z
  .object({
    author: UserSummary,
    stars: z.number().int().min(1).max(5),
    text: z.string().nullable(),
    createdAt: IsoDateTime,
  })
  .meta({ id: "ThemeReview" });
export type ThemeReview = z.infer<typeof ThemeReview>;

export const ThemeDetail = ThemeSummary.extend({
  versions: z.array(ThemeVersionInfo),
  reviews: z.array(ThemeReview),
  myReview: ThemeReview.nullable(),
  /** The creator said the pictures are theirs or they may use them. */
  ownArt: z.boolean(),
}).meta({ id: "ThemeDetail" });
export type ThemeDetail = z.infer<typeof ThemeDetail>;

export const ThemeSort = z.enum(["popular", "new", "top"]);
export const ThemePriceFilter = z.enum(["all", "free", "paid"]);

export const ThemeStoreQuery = z.object({
  q: z.string().trim().max(60).optional(),
  tag: ThemeTag.optional(),
  look: ThemeLook.optional(),
  price: ThemePriceFilter.default("all"),
  sort: ThemeSort.default("popular"),
  /** Page number, from 0. */
  page: z.coerce.number().int().min(0).max(50).default(0),
});
export type ThemeStoreQuery = z.infer<typeof ThemeStoreQuery>;

export const ThemePage = z
  .object({ items: z.array(ThemeSummary), more: z.boolean() })
  .meta({ id: "ThemePage" });
export type ThemePage = z.infer<typeof ThemePage>;

/** Saving a theme you made (as a draft, or straight to the store). */
export const SaveThemeBody = z
  .object({
    file: ThemeFile,
    tags: z.array(ThemeTag).max(5).default([]),
    priceCents: ThemePrice.default(0),
    /** You made the pictures, or you have the right to use them. Needed to sell. */
    ownArt: z.boolean().default(false),
    changelog: z.string().trim().max(300).optional(),
  })
  .meta({ id: "SaveThemeBody" });
export type SaveThemeBody = z.infer<typeof SaveThemeBody>;

export const UpdateThemeBody = z
  .object({
    tags: z.array(ThemeTag).max(5).optional(),
    priceCents: ThemePrice.optional(),
    ownArt: z.boolean().optional(),
  })
  .meta({ id: "UpdateThemeBody" });
export type UpdateThemeBody = z.infer<typeof UpdateThemeBody>;

export const ReviewThemeBody = z
  .object({
    stars: z.number().int().min(1).max(5),
    text: z.string().trim().max(500).optional(),
  })
  .meta({ id: "ReviewThemeBody" });
export type ReviewThemeBody = z.infer<typeof ReviewThemeBody>;

export const ThemeReportReason = z.enum([
  "not-their-art",
  "offensive",
  "sexual",
  "broken",
  "spam",
  "scam",
  "other",
]);
export const ReportThemeBody = z
  .object({ reason: ThemeReportReason, notes: z.string().trim().max(500).optional() })
  .meta({ id: "ReportThemeBody" });
export type ReportThemeBody = z.infer<typeof ReportThemeBody>;

/** Which theme you're using: one of Realm's looks (with your colour), or a theme from your library. */
export const ActiveTheme = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("look"), look: ThemeLook, accent: ThemeAccent }),
    z.object({ kind: z.literal("theme"), themeId: Snowflake }),
  ])
  .meta({ id: "ActiveTheme" });
export type ActiveTheme = z.infer<typeof ActiveTheme>;

export const MyTheme = z
  .object({
    active: ActiveTheme,
    /** The file to draw when a library theme is on; null for Realm's own looks. */
    file: ThemeFile.nullable(),
  })
  .meta({ id: "MyTheme" });
export type MyTheme = z.infer<typeof MyTheme>;

/** The result of checking a theme file or package without saving it. */
export const ThemeCheck = z
  .object({
    ok: z.boolean(),
    /** The file as Realm will use it: pictures stored, numbers tidied. */
    file: ThemeFile.nullable(),
    problems: z.array(z.string()),
  })
  .meta({ id: "ThemeCheck" });
export type ThemeCheck = z.infer<typeof ThemeCheck>;

export const ThemePayments = z
  .object({
    /** Paid themes need the payment company connected; until then only free themes exist. */
    enabled: z.boolean(),
    cutPercent: z.number(),
    priceTiersCents: z.array(z.number().int()),
  })
  .meta({ id: "ThemePayments" });
