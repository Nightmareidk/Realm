import { bigint, index, jsonb, pgEnum, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { createdAt, id, tstz } from "./_columns";
import { communities } from "./communities";
import { users } from "./users";

export const reportTarget = pgEnum("report_target", [
  "user",
  "post",
  "comment",
  "message",
  "community",
]);

export const reportReason = pgEnum("report_reason", [
  "spam",
  "harassment",
  "hate",
  "sexual_content",
  "sexual_minors",
  "violence",
  "self_harm",
  "impersonation",
  "intellectual_property",
  "other",
]);

export const reportStatus = pgEnum("report_status", ["open", "actioned", "dismissed"]);

export const reports = pgTable(
  "reports",
  {
    id: id().primaryKey(),
    reporterId: id()
      .notNull()
      .references(() => users.id),
    targetType: reportTarget().notNull(),
    targetId: id().notNull(),
    /** Routes to that community's moderators; null = platform Trust & Safety. */
    communityId: id().references(() => communities.id),
    reason: reportReason().notNull(),
    details: text(),
    /** Snapshot of the reported content at report time. */
    evidence: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    status: reportStatus().notNull().default("open"),
    handledBy: id(),
    handledAt: tstz(),
    createdAt: createdAt(),
  },
  (t) => [
    index("reports_community_idx").on(t.communityId, t.status, t.id.desc()),
    index("reports_target_idx").on(t.targetType, t.targetId),
    // One report per person per thing: repeats can't pile up against someone.
    uniqueIndex("reports_once_key").on(t.reporterId, t.targetType, t.targetId),
  ],
);

/** Append-only community moderation log. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: id().primaryKey(),
    communityId: id()
      .notNull()
      .references(() => communities.id),
    actorId: id()
      .notNull()
      .references(() => users.id),
    /** e.g. `channel.create`, `member.ban`, `role.update`, `post.remove`. */
    action: text().notNull(),
    targetType: text(),
    targetId: bigint({ mode: "bigint" }),
    changes: jsonb().$type<Record<string, { before?: unknown; after?: unknown }>>(),
    reason: text(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_community_idx").on(t.communityId, t.id.desc())],
);

/**
 * Warnings already emailed to Realm's owner ("storage:90", "login-flood:2026-10-19T14"), so each
 * goes out once. Clearing a key lets that warning go out again (storage freed up, say).
 */
export const ownerAlerts = pgTable("owner_alerts", {
  key: text().primaryKey(),
  sentAt: createdAt(),
});
