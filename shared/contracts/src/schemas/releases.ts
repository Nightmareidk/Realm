import { z } from "zod";
import { IsoDateTime } from "./common";

/** Where Realm can be installed. `web` is never listed here — it's always available. */
export const ReleasePlatform = z.enum(["windows", "macos", "linux", "android", "ios"]);
export type ReleasePlatform = z.infer<typeof ReleasePlatform>;

export const Release = z
  .object({
    platform: ReleasePlatform,
    status: z.enum(["coming_soon", "available"]),
    channel: z.enum(["stable", "beta"]),
    version: z.string().nullable(),
    /** Direct installer URL (desktop) or store listing (mobile). Null while coming soon. */
    url: z.url().nullable(),
    sha256: z.string().nullable(),
    sizeBytes: z.number().int().nullable(),
    minOs: z.string().nullable(),
    publishedAt: IsoDateTime.nullable(),
  })
  .meta({ id: "Release" });
export type Release = z.infer<typeof Release>;

export const ReleasesResponse = z.object({ releases: z.array(Release) });
