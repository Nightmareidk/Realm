import { z } from "zod";
import { Snowflake } from "../ids";
import { IsoDateTime, MediaRef } from "./common";
import { UserSummary } from "./users";

/**
 * Music on posts, Stories and Clips. A sound is either a track from the free library (Creative
 * Commons music from Jamendo, found through Openverse, with its credit) or a creator's own sound
 * (something they recorded or uploaded), which anyone can then use.
 */

export const SoundKind = z.enum(["library", "original"]);
export type SoundKind = z.infer<typeof SoundKind>;

export const Sound = z
  .object({
    id: Snowflake,
    kind: SoundKind,
    title: z.string(),
    artist: z.string(),
    coverUrl: z.string().nullable(),
    audioUrl: z.string(),
    durationMs: z.number().int(),
    /** The licence a library track is shared under ("CC BY-SA"); null for creators' own sounds. */
    licence: z.string().nullable(),
    /** Where the track lives (its page on Jamendo), for the credit. */
    sourceUrl: z.string().nullable(),
    /** Whoever made an original sound. */
    creator: UserSummary.nullable(),
    uses: z.number().int(),
  })
  .meta({ id: "Sound" });
export type Sound = z.infer<typeof Sound>;

export const SoundList = z
  .object({
    items: z.array(Sound),
    /** The library is still looking (a new search can take it a few seconds): ask again shortly. */
    searching: z.boolean().optional(),
  })
  .meta({ id: "SoundList" });
export type SoundList = z.infer<typeof SoundList>;

export const SoundSearchQuery = z.object({ q: z.string().trim().max(60).optional() });

export const CreateSoundBody = z
  .object({
    /** Your recording or upload (audio, finished uploading). */
    mediaId: Snowflake,
    title: z.string().trim().min(1, "Give your sound a name").max(60),
  })
  .meta({ id: "CreateSoundBody" });
export type CreateSoundBody = z.infer<typeof CreateSoundBody>;

/** The part of a sound something uses: from where, and for how long (5 to 60 seconds). */
export const SoundPick = z
  .object({
    soundId: Snowflake,
    startMs: z.number().int().min(0).max(30 * 60 * 1000),
    durationMs: z.number().int().min(5000).max(60_000),
  })
  .meta({ id: "SoundPick" });
export type SoundPick = z.infer<typeof SoundPick>;

/** A sound as it's attached to a post, Story or Clip: the sound and the part that plays. */
export const SoundUse = Sound.extend({ startMs: z.number().int(), playMs: z.number().int() }).meta({
  id: "SoundUse",
});
export type SoundUse = z.infer<typeof SoundUse>;

// ── Stories ──────────────────────────────────────────────────────────────────────

/** Stories last a day. */
export const STORY_HOURS = 24;

export const Story = z
  .object({
    id: Snowflake,
    author: UserSummary,
    media: MediaRef,
    sound: SoundUse.nullable(),
    caption: z.string().nullable(),
    createdAt: IsoDateTime,
    expiresAt: IsoDateTime,
    /** You've watched it. */
    seen: z.boolean(),
    /** How many people watched it (only its author sees this). */
    views: z.number().int().nullable(),
  })
  .meta({ id: "Story" });
export type Story = z.infer<typeof Story>;

/** One person's Stories, oldest first, and whether any are new to you. */
export const StoryRing = z
  .object({ author: UserSummary, stories: z.array(Story), unseen: z.boolean() })
  .meta({ id: "StoryRing" });
export type StoryRing = z.infer<typeof StoryRing>;

export const StoryFeed = z
  .object({
    /** Your own Stories first (if you have any), then people you follow with new ones first. */
    rings: z.array(StoryRing),
  })
  .meta({ id: "StoryFeed" });
export type StoryFeed = z.infer<typeof StoryFeed>;

export const CreateStoryBody = z
  .object({
    /** One photo or one short video, yours and finished uploading. */
    mediaId: Snowflake,
    caption: z.string().trim().max(200).optional(),
    sound: SoundPick.optional(),
    /** Left out: your followers if your account is private, else everyone. */
    visibility: z.enum(["public", "followers"]).optional(),
  })
  .meta({ id: "CreateStoryBody" });
export type CreateStoryBody = z.infer<typeof CreateStoryBody>;
