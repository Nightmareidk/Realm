import type {
  AdminOverview,
  AdminReport,
  AdminUser,
  AdminUserUpdate,
  MyVerification,
  ReservedHandle,
  StaffAction,
  StaffRole,
  VerificationRequest,
  VerificationRequestBody,
} from "@realm/contracts";
import { isMinor } from "@realm/contracts";
import { and, desc, eq, ilike, inArray, isNull, or, schema, sql } from "@realm/db";
import type { Deps } from "../../deps";
import { AppError, badRequest, forbidden, notFound } from "../../lib/errors";
import { summaryColumns, toUserSummary } from "../../lib/serialize-spaces";
import { revokeAllSessions } from "../../lib/sessions";
import { FAMOUS_HANDLES } from "../auth/famous";
import { handleForms } from "../auth/reserved";

const {
  users,
  posts,
  comments,
  messages,
  reports,
  follows,
  verificationRequests,
  reservedHandles,
  staffActions,
} = schema;

/** Asking again after a no: a month later. */
const RETRY_AFTER_MS = 30 * 24 * 3600 * 1000;
const MESSAGE_HIDDEN = 1;

/**
 * Realm's own staff tools, and the verification people ask for. Every change needs a reason and
 * lands in the staff record for good. Moderators handle reports and suspensions; admins also
 * verify accounts, give out kept-back names, and choose who's staff. Nobody acts on themselves.
 */
export class AdminService {
  constructor(private readonly deps: Deps) {}

  private get db() {
    return this.deps.db;
  }

  /** Who's staff, read fresh each time (never from a cached session). */
  async roleOf(userId: bigint): Promise<StaffRole | null> {
    const [row] = await this.db
      .select({ role: users.staffRole, status: users.status })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row?.status === "active" ? (row.role ?? null) : null;
  }

  private async log(
    actorId: bigint,
    action: string,
    targetType: string,
    targetId: string,
    detail: Record<string, unknown>,
    reason: string | null,
  ) {
    await this.db.insert(staffActions).values({
      id: this.deps.ids.next(),
      actorId,
      action,
      targetType,
      targetId,
      detail,
      reason,
    });
  }

  // ── Overview ──────────────────────────────────────────────────────────────

  async overview(): Promise<AdminOverview> {
    const [row] = await this.db
      .select({
        users: sql<number>`(select count(*)::int from ${users} where ${users.deletedAt} is null)`,
        newToday: sql<number>`(select count(*)::int from ${users} where ${users.createdAt} > now() - interval '1 day')`,
        posts: sql<number>`(select count(*)::int from ${posts} where ${posts.deletedAt} is null)`,
        openReports: sql<number>`(select count(*)::int from ${reports} where ${reports.status} = 'open' and ${reports.communityId} is null)`,
        pendingVerifications: sql<number>`(select count(*)::int from ${verificationRequests} where ${verificationRequests.status} = 'pending')`,
        suspended: sql<number>`(select count(*)::int from ${users} where ${users.status} = 'suspended')`,
      })
      .from(sql`(select 1) as one`);
    return (
      row ?? {
        users: 0,
        newToday: 0,
        posts: 0,
        openReports: 0,
        pendingVerifications: 0,
        suspended: 0,
      }
    );
  }

  // ── Accounts ──────────────────────────────────────────────────────────────

  async users(
    viewerRole: StaffRole,
    q: string | undefined,
    filter: "all" | "verified" | "staff" | "suspended",
  ): Promise<AdminUser[]> {
    const text = q?.trim().replace(/^@/, "");
    const like = text ? `%${text.replace(/[\\%_]/g, (m) => `\\${m}`)}%` : null;
    const rows = await this.db
      .select()
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          like
            ? or(
                ilike(users.username, like),
                ilike(users.displayName, like),
                // Admins can find someone by email; moderators can't see emails at all.
                viewerRole === "admin" ? ilike(users.email, like) : undefined,
              )
            : undefined,
          filter === "verified" ? sql`${users.verified} is not null` : undefined,
          filter === "staff" ? sql`${users.staffRole} is not null` : undefined,
          filter === "suspended" ? eq(users.status, "suspended") : undefined,
        ),
      )
      .orderBy(desc(users.id))
      .limit(50);
    return this.toAdminUsers(rows, viewerRole);
  }

  private async toAdminUsers(
    rows: (typeof users.$inferSelect)[],
    viewerRole: StaffRole,
  ): Promise<AdminUser[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const followers = await this.db
      .select({ id: follows.followeeId, n: sql<number>`count(*)::int` })
      .from(follows)
      .where(and(inArray(follows.followeeId, ids), eq(follows.status, "active")))
      .groupBy(follows.followeeId);
    const postCounts = await this.db
      .select({ id: posts.authorId, n: sql<number>`count(*)::int` })
      .from(posts)
      .where(and(inArray(posts.authorId, ids), isNull(posts.deletedAt)))
      .groupBy(posts.authorId);
    const against = await this.db
      .select({ id: reports.targetId, n: sql<number>`count(*)::int` })
      .from(reports)
      .where(and(eq(reports.targetType, "user"), inArray(reports.targetId, ids)))
      .groupBy(reports.targetId);
    const n = (list: { id: bigint; n: number }[], id: bigint) =>
      list.find((x) => x.id === id)?.n ?? 0;
    return rows.map((u) => ({
      user: toUserSummary(u),
      email: viewerRole === "admin" ? u.email : null,
      status: u.status,
      accountKind: u.accountKind,
      verified: u.verified ?? null,
      staff: u.staffRole ?? null,
      teen: isMinor(u.birthDate),
      emailVerified: u.emailVerifiedAt !== null,
      createdAt: u.createdAt.toISOString(),
      followers: n(followers, u.id),
      posts: n(postCounts, u.id),
      reportsAgainst: n(against, u.id),
    }));
  }

  async updateUser(
    actorId: bigint,
    actorRole: StaffRole,
    targetId: bigint,
    body: AdminUserUpdate,
  ): Promise<AdminUser> {
    if (targetId === actorId && (body.status !== undefined || body.staff !== undefined)) {
      throw forbidden("You can't suspend yourself or change your own staff role.");
    }
    const [target] = await this.db.select().from(users).where(eq(users.id, targetId)).limit(1);
    if (!target || target.deletedAt) throw notFound("Account");
    const adminOnly =
      body.verified !== undefined || body.staff !== undefined || body.username !== undefined;
    if (adminOnly && actorRole !== "admin") {
      throw forbidden("Only admins can verify accounts, change usernames or choose staff.");
    }
    // Moderators can't act on other staff.
    if (actorRole !== "admin" && target.staffRole) {
      throw forbidden("Only admins can act on staff accounts.");
    }

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    const set: Partial<typeof users.$inferInsert> = {};
    if (body.status !== undefined && body.status !== target.status) {
      set.status = body.status;
      changes.status = { before: target.status, after: body.status };
    }
    if (body.verified !== undefined && body.verified !== target.verified) {
      set.verified = body.verified;
      set.verifiedAt = body.verified ? new Date() : null;
      changes.verified = { before: target.verified, after: body.verified };
    }
    if (body.staff !== undefined && body.staff !== target.staffRole) {
      set.staffRole = body.staff;
      changes.staff = { before: target.staffRole, after: body.staff };
    }
    if (body.username !== undefined && body.username !== target.username) {
      // Staff can give a kept-back name, but only to a verified account (or Realm's own).
      const forms = handleForms(body.username);
      const kept = [...forms].some((f) => FAMOUS_HANDLES[f]);
      const verified = set.verified ?? target.verified;
      if (kept && !verified) {
        throw badRequest("BAD_REQUEST", "Verify the account before giving it a kept-back name.");
      }
      const [taken] = await this.db
        .select({ id: users.id })
        .from(users)
        .where(
          and(sql`lower(${users.username}) = ${body.username}`, sql`${users.id} <> ${targetId}`),
        )
        .limit(1);
      if (taken) throw new AppError(409, "USERNAME_TAKEN", "Someone already has that username.");
      set.username = body.username;
      changes.username = { before: target.username, after: body.username };
    }
    if (Object.keys(set).length === 0) {
      return (await this.toAdminUsers([target], actorRole))[0] as AdminUser;
    }

    await this.db.transaction(async (tx) => {
      await tx.update(users).set(set).where(eq(users.id, targetId));
      if (set.username) {
        await tx
          .update(reservedHandles)
          .set({ claimedBy: targetId })
          .where(inArray(reservedHandles.handle, [...handleForms(set.username)]));
      }
      // Suspended: signed out everywhere at once.
      if (set.status === "suspended") await revokeAllSessions(this.deps, tx, targetId);
    });
    await this.log(actorId, "user.update", "user", targetId.toString(), changes, body.reason);
    const [after] = await this.db.select().from(users).where(eq(users.id, targetId)).limit(1);
    return (
      await this.toAdminUsers([after as typeof users.$inferSelect], actorRole)
    )[0] as AdminUser;
  }

  async signOutEverywhere(actorId: bigint, targetId: bigint, reason: string) {
    const count = await this.db.transaction((tx) => revokeAllSessions(this.deps, tx, targetId));
    await this.log(
      actorId,
      "user.sign_out",
      "user",
      targetId.toString(),
      { sessions: count },
      reason,
    );
  }

  // ── Verification ──────────────────────────────────────────────────────────

  private async toRequests(
    rows: (typeof verificationRequests.$inferSelect)[],
  ): Promise<VerificationRequest[]> {
    if (rows.length === 0) return [];
    const people = await this.db
      .select(summaryColumns)
      .from(users)
      .where(inArray(users.id, [...new Set(rows.map((r) => r.userId))]));
    return rows.flatMap((r) => {
      const who = people.find((p) => p.id === r.userId);
      if (!who) return [];
      return [
        {
          id: r.id.toString(),
          user: toUserSummary(who),
          kind: r.kind === "business" ? "business" : "notable",
          realName: r.realName,
          category: r.category,
          links: r.links,
          note: r.note,
          status: r.status,
          reason: r.reason,
          createdAt: r.createdAt.toISOString(),
          decidedAt: r.decidedAt?.toISOString() ?? null,
        } satisfies VerificationRequest,
      ];
    });
  }

  async myVerification(userId: bigint): Promise<MyVerification> {
    const [me] = await this.db
      .select({ verified: users.verified })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const [latest] = await this.db
      .select()
      .from(verificationRequests)
      .where(eq(verificationRequests.userId, userId))
      .orderBy(desc(verificationRequests.id))
      .limit(1);
    const request = latest ? ((await this.toRequests([latest]))[0] ?? null) : null;
    const canApply =
      !me?.verified &&
      (!latest ||
        (latest.status === "rejected" &&
          Date.now() - (latest.decidedAt?.getTime() ?? 0) > RETRY_AFTER_MS));
    return { verified: me?.verified ?? null, request, canApply };
  }

  async requestVerification(
    userId: bigint,
    body: VerificationRequestBody,
  ): Promise<MyVerification> {
    const now = await this.myVerification(userId);
    if (!now.canApply) {
      throw badRequest(
        "BAD_REQUEST",
        now.verified
          ? "You're already verified."
          : now.request?.status === "pending"
            ? "Your request is being looked at."
            : "You can ask again a month after the last answer.",
      );
    }
    await this.db.insert(verificationRequests).values({
      id: this.deps.ids.next(),
      userId,
      kind: body.kind,
      realName: body.realName,
      category: body.category,
      links: body.links,
      note: body.note ?? null,
    });
    return this.myVerification(userId);
  }

  async verificationQueue(
    status: "pending" | "approved" | "rejected",
  ): Promise<VerificationRequest[]> {
    const rows = await this.db
      .select()
      .from(verificationRequests)
      .where(eq(verificationRequests.status, status))
      .orderBy(status === "pending" ? verificationRequests.id : desc(verificationRequests.id))
      .limit(100);
    return this.toRequests(rows);
  }

  async decideVerification(actorId: bigint, requestId: bigint, approve: boolean, reason?: string) {
    const [req] = await this.db
      .select()
      .from(verificationRequests)
      .where(eq(verificationRequests.id, requestId))
      .limit(1);
    if (!req) throw notFound("Request");
    if (req.status !== "pending")
      throw badRequest("BAD_REQUEST", "That request was already answered.");
    await this.db.transaction(async (tx) => {
      await tx
        .update(verificationRequests)
        .set({
          status: approve ? "approved" : "rejected",
          decidedBy: actorId,
          decidedAt: new Date(),
          reason: approve ? null : (reason ?? "We couldn't confirm it's you from the links given."),
        })
        .where(eq(verificationRequests.id, requestId));
      if (approve) {
        await tx
          .update(users)
          .set({ verified: req.kind, verifiedAt: new Date() })
          .where(eq(users.id, req.userId));
      }
    });
    await this.log(
      actorId,
      approve ? "verification.approve" : "verification.reject",
      "user",
      req.userId.toString(),
      { request: requestId.toString(), kind: req.kind },
      reason ?? null,
    );
  }

  // ── Kept-back names ───────────────────────────────────────────────────────

  async reserved(q?: string): Promise<{ items: ReservedHandle[]; builtInCount: number }> {
    const text = q?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
    const rows = await this.db
      .select()
      .from(reservedHandles)
      .orderBy(desc(reservedHandles.createdAt))
      .limit(200);
    const claimers = rows.flatMap((r) => (r.claimedBy ? [r.claimedBy] : []));
    const people = claimers.length
      ? await this.db.select(summaryColumns).from(users).where(inArray(users.id, claimers))
      : [];
    const added: ReservedHandle[] = rows
      .filter((r) => !text || r.handle.includes(text) || r.label.toLowerCase().includes(text))
      .map((r) => {
        const who = people.find((p) => p.id === r.claimedBy);
        return {
          handle: r.handle,
          label: r.label,
          builtIn: false,
          claimedBy: who ? toUserSummary(who) : null,
        };
      });
    const builtIn: ReservedHandle[] = text
      ? Object.entries(FAMOUS_HANDLES)
          .filter(([h, label]) => h.includes(text) || label.toLowerCase().includes(text))
          .slice(0, 50)
          .map(([handle, label]) => ({ handle, label, builtIn: true, claimedBy: null }))
      : [];
    return { items: [...added, ...builtIn], builtInCount: Object.keys(FAMOUS_HANDLES).length };
  }

  async reserve(actorId: bigint, handle: string, label: string) {
    const core = handle.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (core.length < 2) throw badRequest("BAD_REQUEST", "That name is too short.");
    await this.db
      .insert(reservedHandles)
      .values({ handle: core, label, addedBy: actorId })
      .onConflictDoUpdate({ target: reservedHandles.handle, set: { label } });
    await this.log(actorId, "reserved.add", "handle", core, { label }, null);
  }

  async unreserve(actorId: bigint, handle: string) {
    const core = handle.toLowerCase().replace(/[^a-z0-9]/g, "");
    await this.db.delete(reservedHandles).where(eq(reservedHandles.handle, core));
    await this.log(actorId, "reserved.remove", "handle", core, {}, null);
  }

  // ── Reports (Realm-wide, not a Space's own) ───────────────────────────────

  async reports(status: "open" | "actioned" | "dismissed"): Promise<AdminReport[]> {
    const rows = await this.db
      .select({ r: reports, reporter: summaryColumns })
      .from(reports)
      .innerJoin(users, eq(users.id, reports.reporterId))
      .where(and(eq(reports.status, status), isNull(reports.communityId)))
      .orderBy(status === "open" ? reports.id : desc(reports.id))
      .limit(100);
    const owners = new Map<string, bigint>();
    for (const { r } of rows) {
      const owner = await this.ownerOf(r.targetType, r.targetId);
      if (owner) owners.set(r.id.toString(), owner);
    }
    const people = owners.size
      ? await this.db
          .select(summaryColumns)
          .from(users)
          .where(inArray(users.id, [...owners.values()]))
      : [];
    return rows.map(({ r, reporter }) => {
      const owner = people.find((p) => p.id === owners.get(r.id.toString()));
      return {
        id: r.id.toString(),
        targetType: r.targetType,
        targetId: r.targetId.toString(),
        reason: r.reason,
        details: r.details,
        reporter: toUserSummary(reporter),
        owner: owner ? toUserSummary(owner) : null,
        evidence: r.evidence,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      };
    });
  }

  private async ownerOf(type: string, id: bigint): Promise<bigint | null> {
    if (type === "user") return id;
    const table =
      type === "post"
        ? posts
        : type === "comment"
          ? comments
          : type === "message"
            ? messages
            : null;
    if (!table) return null;
    const [row] = await this.db
      .select({ authorId: table.authorId })
      .from(table)
      .where(eq(table.id, id))
      .limit(1);
    return row?.authorId ?? null;
  }

  async decideReport(
    actorId: bigint,
    reportId: bigint,
    action: "dismiss" | "remove" | "remove_and_suspend",
    reason: string,
  ) {
    const [report] = await this.db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
    if (!report || report.communityId) throw notFound("Report");
    const owner = await this.ownerOf(report.targetType, report.targetId);
    if (action !== "dismiss") {
      const now = new Date();
      if (report.targetType === "post") {
        await this.db.update(posts).set({ removedAt: now }).where(eq(posts.id, report.targetId));
      } else if (report.targetType === "comment") {
        await this.db
          .update(comments)
          .set({ removedAt: now })
          .where(eq(comments.id, report.targetId));
      } else if (report.targetType === "message") {
        await this.db
          .update(messages)
          .set({ flags: sql`${messages.flags} | ${MESSAGE_HIDDEN}` })
          .where(eq(messages.id, report.targetId));
      }
      if ((action === "remove_and_suspend" || report.targetType === "user") && owner) {
        const role = await this.roleOf(owner);
        if (role) throw forbidden("Staff accounts can't be suspended from a report.");
        await this.db.transaction(async (tx) => {
          await tx.update(users).set({ status: "suspended" }).where(eq(users.id, owner));
          await revokeAllSessions(this.deps, tx, owner);
        });
      }
    }
    // Every open report on the same thing is settled together.
    await this.db
      .update(reports)
      .set({
        status: action === "dismiss" ? "dismissed" : "actioned",
        handledBy: actorId,
        handledAt: new Date(),
      })
      .where(
        and(
          eq(reports.targetType, report.targetType),
          eq(reports.targetId, report.targetId),
          eq(reports.status, "open"),
          isNull(reports.communityId),
        ),
      );
    await this.log(
      actorId,
      `report.${action}`,
      report.targetType,
      report.targetId.toString(),
      { report: reportId.toString(), owner: owner?.toString() ?? null },
      reason,
    );
  }

  // ── The record ────────────────────────────────────────────────────────────

  async staffLog(): Promise<StaffAction[]> {
    const rows = await this.db
      .select({ a: staffActions, actor: summaryColumns })
      .from(staffActions)
      .innerJoin(users, eq(users.id, staffActions.actorId))
      .orderBy(desc(staffActions.id))
      .limit(200);
    return rows.map(({ a, actor }) => ({
      id: a.id.toString(),
      actor: toUserSummary(actor),
      action: a.action,
      targetType: a.targetType,
      targetId: a.targetId,
      detail: a.detail,
      reason: a.reason,
      createdAt: a.createdAt.toISOString(),
    }));
  }
}
