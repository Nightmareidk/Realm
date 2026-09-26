import { z } from "zod";
import { Snowflake } from "../ids";
import { Limits } from "../limits";

export const IsoDateTime = z.iso.datetime({ offset: true }).meta({ id: "IsoDateTime" });

export const Platform = z
  .enum(["web", "ios", "android", "windows", "macos", "linux"])
  .meta({ id: "Platform" });
export type Platform = z.infer<typeof Platform>;

/** Cursor pagination query shared by list endpoints. */
export const PageQuery = z.object({
  before: Snowflake.optional(),
  after: Snowflake.optional(),
  limit: z.coerce.number().int().min(1).max(Limits.pageSize.max).default(Limits.pageSize.default),
});
export type PageQuery = z.infer<typeof PageQuery>;

export const Page = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: Snowflake.nullable(),
  });

/** Media reference as returned to clients (URLs are resolved server-side). */
export const MediaRef = z
  .object({
    id: Snowflake,
    url: z.url(),
    width: z.number().int().nullable(),
    height: z.number().int().nullable(),
    blurhash: z.string().nullable(),
    mimeType: z.string(),
  })
  .meta({ id: "MediaRef" });
export type MediaRef = z.infer<typeof MediaRef>;
