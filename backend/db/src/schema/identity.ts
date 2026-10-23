import { index, jsonb, pgEnum, pgTable, text } from "drizzle-orm/pg-core";
import { createdAt, id, tstz } from "./_columns";
import { users, verifiedKind } from "./users";

/**
 * Who someone is, checked: the requests people send to be verified, the famous names nobody can
 * take without it, and the record of everything staff do.
 */

export const verificationStatus = pgEnum("verification_status", [
  "pending",
  "approved",
  "rejected",
]);

/** "Verify me": a notable person or a business, with links that show it's really them. */
export const verificationRequests = pgTable(
  "verification_requests",
  {
    id: id().primaryKey(),
    userId: id()
      .notNull()
      .references(() => users.id),
    kind: verifiedKind().notNull(),
    /** Their real or business name, as the public knows it. */
    realName: text().notNull(),
    category: text().notNull(),
    /** Official site, other verified accounts, news coverage: up to five https links. */
    links: jsonb().$type<string[]>().notNull().default([]),
    note: text(),
    status: verificationStatus().notNull().default("pending"),
    decidedBy: id(),
    decidedAt: tstz(),
    /** Why, when it's turned down (shown to them). */
    reason: text(),
    createdAt: createdAt(),
  },
  (t) => [
    index("verification_requests_status_idx").on(t.status, t.id.desc()),
    index("verification_requests_user_idx").on(t.userId),
  ],
);

/**
 * Names staff have set aside (beyond the built-in list of famous people and brands): only a
 * verified account can be given one, by staff.
 */
export const reservedHandles = pgTable("reserved_handles", {
  /** The name with its separators and decorations taken off ("sabrinacarpenter"). */
  handle: text().primaryKey(),
  /** Who it's kept for ("Sabrina Carpenter"). */
  label: text().notNull(),
  addedBy: id(),
  /** The verified account it was given to, if any. */
  claimedBy: id(),
  createdAt: createdAt(),
});

/** Every staff action, kept for good: who did what to whom, and why. */
export const staffActions = pgTable(
  "staff_actions",
  {
    id: id().primaryKey(),
    actorId: id()
      .notNull()
      .references(() => users.id),
    action: text().notNull(),
    targetType: text().notNull(),
    targetId: text().notNull(),
    detail: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    reason: text(),
    createdAt: createdAt(),
  },
  (t) => [index("staff_actions_target_idx").on(t.targetType, t.targetId)],
);
