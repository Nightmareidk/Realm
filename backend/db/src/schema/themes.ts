import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createdAt, id, tstz, updatedAt } from "./_columns";
import { media } from "./media";
import { users } from "./users";

/**
 * Themes (docs/THEMING.md §4.6): a theme and its versions (each version's file never changes once
 * saved), the pictures it uses, who has it, reviews, reports, and purchases.
 */

export const themeLook = pgEnum("theme_look", ["now-playing", "wristband", "plain"]);
export const themeStatus = pgEnum("theme_status", ["draft", "published", "hidden", "removed"]);
export const themeSource = pgEnum("theme_source", ["added", "bought", "own"]);
export const themePurchaseStatus = pgEnum("theme_purchase_status", [
  "pending",
  "paid",
  "refunded",
  "failed",
]);

export const themes = pgTable(
  "themes",
  {
    id: id().primaryKey(),
    creatorId: id()
      .notNull()
      .references(() => users.id),
    /** Copied from the newest version's file, for searching and listing. */
    name: text().notNull(),
    description: text(),
    look: themeLook().notNull(),
    tags: text().array().notNull().default(sql`'{}'::text[]`),
    priceCents: integer().notNull().default(0),
    /** The creator said the pictures are theirs or they may use them. Needed to sell. */
    ownArt: boolean().notNull().default(false),
    status: themeStatus().notNull().default("draft"),
    version: integer().notNull().default(1),
    installs: integer().notNull().default(0),
    ratingSum: integer().notNull().default(0),
    ratingCount: integer().notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    publishedAt: tstz(),
  },
  (t) => [
    index("themes_creator_idx").on(t.creatorId, t.id.desc()),
    index("themes_store_idx").on(t.status, t.installs.desc()),
  ],
);

export const themeVersions = pgTable(
  "theme_versions",
  {
    themeId: id()
      .notNull()
      .references(() => themes.id),
    number: integer().notNull(),
    /** The checked theme file, pictures as `media:<id>`. */
    file: jsonb().notNull(),
    changelog: text(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.themeId, t.number] })],
);

/** Pictures a theme uses: anyone may see them once it's in the store. */
export const themeAssets = pgTable(
  "theme_assets",
  {
    themeId: id()
      .notNull()
      .references(() => themes.id),
    mediaId: id()
      .notNull()
      .references(() => media.id),
  },
  (t) => [
    primaryKey({ columns: [t.themeId, t.mediaId] }),
    index("theme_assets_media_idx").on(t.mediaId),
  ],
);

/** Themes someone has: added (free), bought, or made. */
export const themeLibrary = pgTable(
  "theme_library",
  {
    userId: id()
      .notNull()
      .references(() => users.id),
    themeId: id()
      .notNull()
      .references(() => themes.id),
    source: themeSource().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.themeId] }),
    index("theme_library_theme_idx").on(t.themeId),
  ],
);

export const themeReviews = pgTable(
  "theme_reviews",
  {
    themeId: id()
      .notNull()
      .references(() => themes.id),
    userId: id()
      .notNull()
      .references(() => users.id),
    stars: smallint().notNull(),
    body: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.themeId, t.userId] }),
    index("theme_reviews_theme_idx").on(t.themeId, t.updatedAt.desc()),
  ],
);

export const themeReports = pgTable(
  "theme_reports",
  {
    themeId: id()
      .notNull()
      .references(() => themes.id),
    reporterId: id()
      .notNull()
      .references(() => users.id),
    reason: text().notNull(),
    notes: text(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.themeId, t.reporterId] })],
);

/** Paid themes: what was paid, the payment company's fee, Realm's share and the creator's. */
export const themePurchases = pgTable(
  "theme_purchases",
  {
    id: id().primaryKey(),
    themeId: id()
      .notNull()
      .references(() => themes.id),
    buyerId: id()
      .notNull()
      .references(() => users.id),
    amountCents: integer().notNull(),
    feeCents: integer().notNull().default(0),
    realmCents: integer().notNull().default(0),
    creatorCents: integer().notNull().default(0),
    provider: text().notNull(),
    providerRef: text().notNull(),
    status: themePurchaseStatus().notNull().default("pending"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("theme_purchases_provider_key").on(t.provider, t.providerRef),
    index("theme_purchases_buyer_idx").on(t.buyerId, t.themeId),
  ],
);
