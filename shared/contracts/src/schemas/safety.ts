import { z } from "zod";
import { Snowflake } from "../ids";
import { IsoDateTime } from "./common";
import { UserSummary } from "./users";

/*
 * Safety for a solo-run platform (owner, 2026-10-04): automated limits first, then people's own
 * tools (report, block, mute), then each Space's moderators. Nothing here assumes someone at
 * Realm reads every report; only the gravest category is kept for the platform.
 */

export const ReportReason = z.enum([
  "spam",
  "harassment",
  "hate",
  "sexual_content",
  "sexual_minors",
  "violence",
  "self_harm",
  "impersonation",
  // Someone else's art, music or brand (a theme sold with characters its seller doesn't own).
  "intellectual_property",
  "other",
]);
export type ReportReason = z.infer<typeof ReportReason>;

export const CreateReportBody = z.object({
  targetType: z.enum(["message", "user", "community", "post", "comment"]),
  targetId: Snowflake,
  reason: ReportReason,
  details: z.string().trim().max(1000).optional(),
  /** Reporting a person from inside a Space sends it to that Space's moderators. */
  communityId: Snowflake.optional(),
});
export type CreateReportBody = z.infer<typeof CreateReportBody>;

/** What happened to a report straight away, so the reporter knows it did something. */
export const ReportReceipt = z
  .object({
    /** The message is now hidden for everyone until a moderator looks. */
    hidden: z.boolean(),
    /** Who'll look: the Space's moderators, or Realm (the gravest reports only). */
    /** "noted": kept on record (a DM, or a person outside any shared Space); block to stop them. */
    goesTo: z.enum(["space", "realm", "noted"]),
  })
  .meta({ id: "ReportReceipt" });
export type ReportReceipt = z.infer<typeof ReportReceipt>;

/** One reported thing in a Space's queue: all its reports folded together. Reporters stay private. */
export const ReportedItem = z
  .object({
    id: Snowflake,
    targetType: z.enum(["message", "user", "community", "post", "comment"]),
    targetId: Snowflake,
    reasons: z.array(ReportReason),
    count: z.number().int(),
    details: z.array(z.string()),
    /** The message, post or comment as it was when first reported. */
    evidence: z
      .object({
        content: z.string().nullable(),
        author: UserSummary.nullable(),
        channelId: Snowflake.nullable(),
      })
      .nullable(),
    hidden: z.boolean(),
    firstReportedAt: IsoDateTime,
  })
  .meta({ id: "ReportedItem" });
export type ReportedItem = z.infer<typeof ReportedItem>;

export const HandleReportBody = z.object({
  /** dismiss: nothing wrong (and unhide); remove: take the message, post or comment down. */
  action: z.enum(["dismiss", "remove"]),
});

export const MuteTarget = z.enum(["user", "community", "channel"]);

export const MuteBody = z.object({
  /** Until when; left out means until you unmute. */
  until: IsoDateTime.optional(),
});

export const Mute = z
  .object({
    targetType: MuteTarget,
    targetId: Snowflake,
    until: IsoDateTime.nullable(),
  })
  .meta({ id: "Mute" });
export type Mute = z.infer<typeof Mute>;

export const SafetyLists = z
  .object({
    blocked: z.array(UserSummary),
    mutes: z.array(Mute),
  })
  .meta({ id: "SafetyLists" });
export type SafetyLists = z.infer<typeof SafetyLists>;

/** Moderators' changes to a member. */
export const UpdateMemberBody = z
  .object({
    roleIds: z.array(Snowflake).max(25),
    /** Can read but not post until then; null lifts it. */
    timeoutUntil: IsoDateTime.nullable(),
    reason: z.string().trim().max(500),
  })
  .partial();
export type UpdateMemberBody = z.infer<typeof UpdateMemberBody>;

export const TIMEOUT_CHOICES_MS = [
  60_000, 300_000, 600_000, 3_600_000, 86_400_000, 604_800_000,
] as const;

export const BanBody = z.object({
  reason: z.string().trim().max(500).optional(),
  /** Also remove their recent messages from the Space. */
  deleteMessagesHours: z.literal([0, 1, 24, 168]).default(0),
});

export const Ban = z
  .object({
    user: UserSummary,
    reason: z.string().nullable(),
    createdAt: IsoDateTime,
  })
  .meta({ id: "Ban" });
export type Ban = z.infer<typeof Ban>;

export const AuditEntry = z
  .object({
    id: Snowflake,
    action: z.string(),
    actor: UserSummary,
    target: UserSummary.nullable(),
    targetType: z.string().nullable(),
    reason: z.string().nullable(),
    createdAt: IsoDateTime,
  })
  .meta({ id: "AuditEntry" });
export type AuditEntry = z.infer<typeof AuditEntry>;

export const RegisterPushToken = z.object({
  token: z.string().min(20).max(4096),
  platform: z.enum(["web", "ios", "android"]).default("web"),
});
