import { z } from "zod";
import { Snowflake } from "../ids";
import { IsoDateTime, MediaRef } from "./common";

export const MediaKind = z.enum(["image", "video", "audio", "file"]);
export type MediaKind = z.infer<typeof MediaKind>;

/**
 * What each kind may be. The server checks the real type from the file's first bytes, never
 * trusting the name or the browser's word. Sizes keep a free storage tier usable.
 */
export const MEDIA_RULES = {
  image: {
    maxBytes: 10 * 1024 * 1024,
    types: ["image/png", "image/jpeg", "image/gif", "image/webp"],
  },
  video: { maxBytes: 100 * 1024 * 1024, types: ["video/mp4", "video/webm", "video/quicktime"] },
  audio: {
    maxBytes: 15 * 1024 * 1024,
    types: ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-m4a"],
  },
  file: { maxBytes: 25 * 1024 * 1024, types: [] as string[] },
} as const;

/** Voice messages: up to five minutes. */
export const VOICE_MESSAGE_MAX_MS = 5 * 60 * 1000;

export const CreateUploadBody = z.object({
  kind: MediaKind,
  mimeType: z.string().trim().toLowerCase().min(3).max(100),
  sizeBytes: z.number().int().min(1),
  /** Files only: the name to show and to download as. */
  filename: z.string().trim().min(1).max(200).optional(),
  /** Voice messages and videos: how long it is (the player shows it before loading). */
  durationMs: z
    .number()
    .int()
    .min(0)
    .max(4 * 60 * 60 * 1000)
    .optional(),
});
export type CreateUploadBody = z.infer<typeof CreateUploadBody>;

export const UploadTicket = z
  .object({
    mediaId: Snowflake,
    /** Where to PUT the file: storage directly (R2) or, in development, the API. */
    uploadUrl: z.string(),
    headers: z.record(z.string(), z.string()),
    expiresAt: IsoDateTime,
  })
  .meta({ id: "UploadTicket" });
export type UploadTicket = z.infer<typeof UploadTicket>;

export const MediaStatus = z.enum(["pending", "processing", "ready", "failed", "blocked"]);

/** An upload as its owner sees it: the attachment shape plus how processing went. */
export const MediaInfo = MediaRef.extend({ status: MediaStatus }).meta({ id: "MediaInfo" });
export type MediaInfo = z.infer<typeof MediaInfo>;

/** A place someone chose to share once. Never a live location. */
export const Place = z
  .object({
    name: z.string().trim().min(1).max(120),
    address: z.string().trim().max(240).nullable(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .meta({ id: "Place" });
export type Place = z.infer<typeof Place>;

/** A Space's city, for "nearby" in Explore. Stored rounded to about a kilometre. */
export const SpaceLocation = z.object({
  city: z.string().trim().min(1).max(120),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type SpaceLocation = z.infer<typeof SpaceLocation>;
