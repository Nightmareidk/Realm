import { z } from "zod";
import { Snowflake } from "../ids";
import { IsoDateTime } from "./common";
import { Sound } from "./music";
import { ReportReason } from "./safety";
import { StaffRole, Username, UserSummary, VerifiedKind } from "./users";

/**
 * Verification (the badge) and Realm's admin pages: the people who ask to be verified, the
 * famous names kept for their owners, reports to act on, and a record of every staff action.
 */

// ── Asking to be verified ─────────────────────────────────────────────────────────

export const VerificationStatus = z.enum(["pending", "approved", "rejected"]);
export type VerificationStatus = z.infer<typeof VerificationStatus>;

const HttpsLink = z.url({ protocol: /^https$/, message: "Use full https:// links" }).max(300);

export const VerificationRequestBody = z
  .object({
    /** A notable person (an artist, creator, athlete, public figure) or a business or brand. */
    kind: z.enum(["notable", "business"]),
    realName: z.string().trim().min(2).max(80),
    category: z.string().trim().min(2).max(40),
    /** Where the public already knows them: official site, other verified accounts, news. */
    links: z.array(HttpsLink).min(1, "Add at least one link").max(5),
    note: z.string().trim().max(500).optional(),
  })
  .meta({ id: "VerificationRequestBody" });
export type VerificationRequestBody = z.infer<typeof VerificationRequestBody>;

export const VerificationRequest = z
  .object({
    id: Snowflake,
    user: UserSummary,
    kind: z.enum(["notable", "business"]),
    realName: z.string(),
    category: z.string(),
    links: z.array(z.string()),
    note: z.string().nullable(),
    status: VerificationStatus,
    reason: z.string().nullable(),
    createdAt: IsoDateTime,
    decidedAt: IsoDateTime.nullable(),
  })
  .meta({ id: "VerificationRequest" });
export type VerificationRequest = z.infer<typeof VerificationRequest>;

/** Your own verification: whether you have the badge, and your latest request. */
export const MyVerification = z
  .object({
    verified: VerifiedKind.nullable(),
    request: VerificationRequest.nullable(),
    /** You can ask (again) now: not while one is waiting, and 30 days after a no. */
    canApply: z.boolean(),
  })
  .meta({ id: "MyVerification" });
export type MyVerification = z.infer<typeof MyVerification>;

// ── Admin ─────────────────────────────────────────────────────────────────────────

export const AdminOverview = z
  .object({
    users: z.number().int(),
    newToday: z.number().int(),
    posts: z.number().int(),
    openReports: z.number().int(),
    pendingVerifications: z.number().int(),
    suspended: z.number().int(),
  })
  .meta({ id: "AdminOverview" });
export type AdminOverview = z.infer<typeof AdminOverview>;

export const AdminUser = z
  .object({
    user: UserSummary,
    /** Admins only; moderators see null. */
    email: z.string().nullable(),
    status: z.enum(["active", "suspended", "deactivated", "deleted"]),
    accountKind: z.enum(["personal", "business"]),
    verified: VerifiedKind.nullable(),
    staff: StaffRole.nullable(),
    teen: z.boolean(),
    emailVerified: z.boolean(),
    createdAt: IsoDateTime,
    followers: z.number().int(),
    posts: z.number().int(),
    reportsAgainst: z.number().int(),
  })
  .meta({ id: "AdminUser" });
export type AdminUser = z.infer<typeof AdminUser>;

export const AdminUserList = z.object({ items: z.array(AdminUser) }).meta({ id: "AdminUserList" });

export const AdminUserQuery = z.object({
  q: z.string().trim().max(80).optional(),
  filter: z.enum(["all", "verified", "staff", "suspended"]).default("all"),
});

/** What staff can change on an account. Every change needs a reason, kept in the record. */
export const AdminUserUpdate = z
  .object({
    status: z.enum(["active", "suspended"]).optional(),
    verified: VerifiedKind.nullable().optional(),
    /** Admins only. */
    staff: StaffRole.nullable().optional(),
    /** Admins only: may give a reserved name to a verified account. */
    username: Username.optional(),
    reason: z.string().trim().min(3, "Say why, for the record").max(300),
  })
  .meta({ id: "AdminUserUpdate" });
export type AdminUserUpdate = z.infer<typeof AdminUserUpdate>;

export const VerificationDecision = z
  .object({
    approve: z.boolean(),
    /** Shown to them when it's a no. */
    reason: z.string().trim().max(300).optional(),
  })
  .meta({ id: "VerificationDecision" });

export const VerificationList = z
  .object({ items: z.array(VerificationRequest) })
  .meta({ id: "VerificationList" });

export const ReservedHandle = z
  .object({
    handle: z.string(),
    label: z.string(),
    /** Built into Realm (famous people, brands, Realm's own names), or added by staff. */
    builtIn: z.boolean(),
    claimedBy: UserSummary.nullable(),
  })
  .meta({ id: "ReservedHandle" });
export type ReservedHandle = z.infer<typeof ReservedHandle>;

export const ReservedList = z
  .object({ items: z.array(ReservedHandle), builtInCount: z.number().int() })
  .meta({ id: "ReservedList" });

export const ReserveBody = z
  .object({
    handle: z.string().trim().min(2).max(40),
    label: z.string().trim().min(2).max(80),
  })
  .meta({ id: "ReserveBody" });

export const AdminReport = z
  .object({
    id: Snowflake,
    targetType: z.enum(["user", "post", "comment", "message", "community"]),
    targetId: Snowflake,
    reason: ReportReason,
    details: z.string().nullable(),
    reporter: UserSummary,
    /** Whose content it is, when known. */
    owner: UserSummary.nullable(),
    /** What it said or showed when reported. */
    evidence: z.record(z.string(), z.unknown()),
    status: z.enum(["open", "actioned", "dismissed"]),
    createdAt: IsoDateTime,
  })
  .meta({ id: "AdminReport" });
export type AdminReport = z.infer<typeof AdminReport>;

export const AdminReportList = z
  .object({ items: z.array(AdminReport) })
  .meta({ id: "AdminReportList" });

export const ReportDecision = z
  .object({
    /** Dismiss it, take the content down, or take it down and suspend whoever posted it. */
    action: z.enum(["dismiss", "remove", "remove_and_suspend"]),
    reason: z.string().trim().min(3, "Say why, for the record").max(300),
  })
  .meta({ id: "ReportDecision" });

export const StaffAction = z
  .object({
    id: Snowflake,
    actor: UserSummary,
    action: z.string(),
    targetType: z.string(),
    targetId: z.string(),
    detail: z.record(z.string(), z.unknown()),
    reason: z.string().nullable(),
    createdAt: IsoDateTime,
  })
  .meta({ id: "StaffAction" });
export type StaffAction = z.infer<typeof StaffAction>;

export const StaffLog = z.object({ items: z.array(StaffAction) }).meta({ id: "StaffLog" });

// ── Realm's own music library ─────────────────────────────────────────────────────

/** Under what terms Realm may play a track admins add (shown as its credit). */
export const TrackLicence = z.enum(["own", "licensed", "cc0", "cc-by", "cc-by-sa"]);
export type TrackLicence = z.infer<typeof TrackLicence>;
export const TRACK_LICENCE_LABEL: Record<TrackLicence, string> = {
  own: "Realm's own",
  licensed: "Licensed to Realm",
  cc0: "CC0",
  "cc-by": "CC BY",
  "cc-by-sa": "CC BY-SA",
};

/**
 * A track an admin adds for everyone: an uploaded MP3 or M4A (or an MP4, whose sound plays),
 * with a cover picture, and the right to use it.
 */
export const AdminTrackBody = z.object({
  mediaId: Snowflake,
  coverMediaId: Snowflake.optional(),
  title: z.string().trim().min(1).max(120),
  artist: z.string().trim().min(1).max(120),
  licence: TrackLicence,
  /** Where the credit points (the artist's page), if anywhere. */
  creditUrl: z
    .url({ protocol: /^https$/ })
    .max(300)
    .optional(),
});
export type AdminTrackBody = z.infer<typeof AdminTrackBody>;

export const AdminTrack = z
  .object({
    sound: Sound,
    hidden: z.boolean(),
    addedBy: z.string().nullable(),
    createdAt: IsoDateTime,
  })
  .meta({ id: "AdminTrack" });
export type AdminTrack = z.infer<typeof AdminTrack>;
