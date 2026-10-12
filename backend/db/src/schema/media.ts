import { bigint, boolean, index, integer, jsonb, pgEnum, pgTable, text } from "drizzle-orm/pg-core";
import { createdAt, id } from "./_columns";
import { users } from "./users";

export const mediaKind = pgEnum("media_kind", ["image", "video", "audio", "file"]);
export const mediaStatus = pgEnum("media_status", [
  "pending",
  "processing",
  "ready",
  "failed",
  "blocked",
]);

export type MediaVariants = Record<
  string,
  { key: string; width: number; height: number; mimeType: string; sizeBytes: number }
>;

export const media = pgTable(
  "media",
  {
    id: id().primaryKey(),
    ownerId: id()
      .notNull()
      .references(() => users.id),
    kind: mediaKind().notNull(),
    status: mediaStatus().notNull().default("pending"),
    storageKey: text().notNull(),
    /** Verified from magic bytes during processing, not trusted from the client. */
    mimeType: text().notNull(),
    sizeBytes: bigint({ mode: "number" }).notNull(),
    width: integer(),
    height: integer(),
    durationMs: integer(),
    blurhash: text(),
    variants: jsonb().$type<MediaVariants>().notNull().default({}),
    sha256: text(),
    /** The name the file had on the uploader's device (files only; shown on its card). */
    filename: text(),
    /** Phase 2: E2EE ciphertext the server cannot process. */
    isEncrypted: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("media_owner_idx").on(t.ownerId, t.id.desc())],
);
