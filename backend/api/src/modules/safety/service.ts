import {
  type AuditEntry,
  type Ban,
  type CreateReportBody,
  has,
  type Member,
  Permission,
  type ReportedItem,
  type ReportReason,
  type ReportReceipt,
  type SafetyLists,
  type UpdateMemberBody,
} from "@realm/contracts";
import { and, desc, eq, gt, inArray, isNotNull, isNull, lt, or, schema, sql } from "@realm/db";
import type { Deps } from "../../deps";
import { badRequest, conflict, forbidden, notFound } from "../../lib/errors";
import {
  MESSAGE_HIDDEN,
  summaryColumns,
  toMember,
  toUserSummary,
} from "../../lib/serialize-spaces";
import { canSeePost } from "../social/access";
import {
  findSpace,
  loadAccess,
  memberAccess,
  missingPermission,
  requireSpacePermission,
  roomAccess,
  type SpaceAccess,
  topicOf,
} from "../spaces/access";
import { MessagesService } from "../spaces/messages";
import { UNLISTED } from "../spaces/service";

const {
  reports,
  messages,
  channels,
  communities,
  communityMembers,
  memberRoles,
  bans,
  auditLog,
  relationships,
  mutes,
  users,
  posts,
  comments,
  follows,
} = schema;

/** The gravest reports go to Realm itself (the law requires acting on them); all else to Spaces. */
const PLATFORM_REASONS: ReportReason[] = ["sexual_minors"];
/** Distinct reporters before a message hides itself pending a moderator. */
const hideAt = (memberCount: number) => (memberCount <= 10 ? 2 : 3);
/**
 * Outside a Space (a profile post, or a comment on one) nobody moderates, so a post hides itself
 * once this many established people (email confirmed, account at least a day old) report it.
 * Brand-new accounts don't count, so a few throwaway sign-ups can't take someone's post down.
 */
const PROFILE_HIDE_AT = 3;
const ESTABLISHED_MS = 24 * 3600 * 1000;
/** Why a post is down: hidden by reports (undone by "Nothing wrong"), or by a moderator. */
const BY_REPORTS = "reports";
const BY_MODERATOR = "moderator";
/** Distinct reporters before a public Space drops out of Explore on its own. */
const UNLIST_AT = 5;
const MAX_TIMEOUT_MS = 28 * 24 * 3600 * 1000;

/**
 * Safety built for a solo operator (owner, 2026-10-04): automation and each Space's own
 * moderators do the work; nothing assumes a person at Realm reads every report.
 */
export class SafetyService {
  private readonly messages: MessagesService;

  constructor(private readonly deps: Deps) {
    this.messages = new MessagesService(deps);
  }

  private get db() {
    return this.deps.db;
  }

  private async audit(
    communityId: bigint,
    actorId: bigint,
    action: string,
    target: { type: string; id: bigint } | null,
    reason?: string | null,
  ) {
    await this.db.insert(auditLog).values({
      id: this.deps.ids.next(),
      communityId,
      actorId,
      action,
      targetType: target?.type ?? null,
      targetId: target?.id ?? null,
      reason: reason || null,
    });
  }

  // ── Reports ────────────────────────────────────────────────────────────────

  async report(userId: bigint, body: CreateReportBody): Promise<ReportReceipt> {
    const target = BigInt(body.targetId);
    const platform = PLATFORM_REASONS.includes(body.reason);
    let communityId: bigint | null = null;
    let evidence: Record<string, unknown> = {};
    let message: typeof messages.$inferSelect | null = null;
    let access: SpaceAccess | null = null;
    let topic: string | null = null;
    /** A reported post, or the post a reported comment is on. */
    let post: typeof posts.$inferSelect | null = null;
    let comment: typeof comments.$inferSelect | null = null;

    if (body.targetType === "post" || body.targetType === "comment") {
      if (body.targetType === "comment") {
        const [row] = await this.db
          .select()
          .from(comments)
          .where(and(eq(comments.id, target), isNull(comments.deletedAt)))
          .limit(1);
        if (!row || row.removedAt) throw notFound("Comment");
        comment = row;
      }
      const postId = comment ? comment.postId : target;
      const [row] = await this.db.select().from(posts).where(eq(posts.id, postId)).limit(1);
      // You can only report what you can see.
      if (!row || !(await canSeePost(this.db, row, userId))) {
        throw notFound(comment ? "Comment" : "Post");
      }
      const authorId = comment ? comment.authorId : row.authorId;
      if (authorId === userId) {
        throw badRequest(
          "BAD_REQUEST",
          comment ? "That's your own comment." : "That's your own post.",
        );
      }
      post = row;
      // Shared to a Space: its moderators decide. On a profile, automation does.
      communityId = row.communityId;
      evidence = {
        content: comment ? comment.body : row.body,
        authorId: authorId.toString(),
        postId: row.id.toString(),
      };
    } else if (body.targetType === "message") {
      const [row] = await this.db
        .select()
        .from(messages)
        .where(and(eq(messages.id, target), isNull(messages.deletedAt)))
        .limit(1);
      if (!row) throw notFound("Message");
      const ctx = await roomAccess(this.db, row.channelId, userId); // you can only report what you can see
      if (row.authorId === userId) throw badRequest("BAD_REQUEST", "That's your own message.");
      message = row;
      access = ctx.access;
      communityId = ctx.access?.community.id ?? null;
      topic = topicOf(ctx);
      evidence = {
        content: row.content,
        authorId: row.authorId.toString(),
        channelId: row.channelId.toString(),
      };
    } else if (body.targetType === "user") {
      if (target === userId) throw badRequest("BAD_REQUEST", "You can't report yourself.");
      const [person] = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, target));
      if (!person) throw notFound("Person");
      if (body.communityId) {
        const space = await findSpace(this.db, body.communityId);
        if (space) {
          const mine = await loadAccess(this.db, space, userId);
          const theirs = await loadAccess(this.db, space, target);
          if (mine.member && theirs.member) communityId = space.id;
        }
      }
      evidence = { authorId: target.toString() };
    } else {
      const space = await findSpace(this.db, body.targetId);
      if (!space) throw notFound("Space");
      evidence = { name: space.name, slug: space.slug };
    }

    const inserted = await this.db
      .insert(reports)
      .values({
        id: this.deps.ids.next(),
        reporterId: userId,
        targetType: body.targetType,
        targetId: target,
        // Space reports and the gravest category go to Realm; the rest to the Space's moderators.
        communityId: platform || body.targetType === "community" ? null : communityId,
        reason: body.reason,
        details: body.details || null,
        evidence,
      })
      .onConflictDoNothing()
      .returning({ id: reports.id });
    if (inserted.length === 0) {
      throw conflict("ALREADY_REPORTED", "You've already reported this. Thanks for flagging it.");
    }
    if (platform) {
      const reportId = inserted[0]?.id.toString();
      this.deps.logger.warn(
        { reportId, targetType: body.targetType },
        "safety: a report needs Realm's attention",
      );
      // A person has to see these: email the operator (REALM_SAFETY_EMAIL). The content itself
      // stays in the database, never in the email.
      const to = this.deps.config.REALM_SAFETY_EMAIL;
      if (to) {
        await this.deps.mailer
          .send({
            to,
            subject: "Realm: a report needs you",
            text: `A ${body.targetType} was reported for sexual content involving a minor.\n\nReport ${reportId}. It has been hidden. Review it in the database (reports table) and report it to the authorities where the law requires.\n`,
          })
          .catch((err) => this.deps.logger.error({ err, reportId }, "safety: alert email failed"));
      }
    }

    const [{ n } = { n: 0 }] = await this.db
      .select({ n: sql<number>`count(distinct ${reports.reporterId})::int` })
      .from(reports)
      .where(
        and(
          eq(reports.targetType, body.targetType),
          eq(reports.targetId, target),
          eq(reports.status, "open"),
        ),
      );

    let hidden = false;
    if (message && topic) {
      hidden = (message.flags & MESSAGE_HIDDEN) !== 0;
      // In a DM only the gravest category hides a message: there's nobody else to decide.
      const threshold = access ? hideAt(access.community.memberCount) : Number.POSITIVE_INFINITY;
      if (!hidden && (platform || n >= threshold)) {
        await this.setHidden(message.id, true, topic);
        hidden = true;
      }
    }
    if (post) {
      hidden = comment ? comment.removedAt !== null : post.removedAt !== null;
      if (!hidden) {
        let enough = platform;
        if (!enough && communityId) {
          const space = await findSpace(this.db, communityId.toString());
          enough = n >= hideAt(space?.memberCount ?? 0);
        } else if (!enough) {
          enough =
            (await this.establishedReporters(comment ? "comment" : "post", target)) >=
            PROFILE_HIDE_AT;
        }
        if (enough) {
          await this.takeDown(comment ? "comment" : "post", target, BY_REPORTS, null);
          hidden = true;
        }
      }
    }
    if (body.targetType === "community" && n >= UNLIST_AT) {
      await this.db
        .update(communities)
        .set({ features: sql`${communities.features} | ${UNLISTED}` })
        .where(eq(communities.id, target));
    }
    return {
      hidden,
      goesTo:
        platform || body.targetType === "community" ? "realm" : communityId ? "space" : "noted",
    };
  }

  /** Open reports on a thing from people whose accounts are confirmed and at least a day old. */
  private async establishedReporters(targetType: "post" | "comment", targetId: bigint) {
    const [row] = await this.db
      .select({ n: sql<number>`count(distinct ${reports.reporterId})::int` })
      .from(reports)
      .innerJoin(users, eq(users.id, reports.reporterId))
      .where(
        and(
          eq(reports.targetType, targetType),
          eq(reports.targetId, targetId),
          eq(reports.status, "open"),
          isNotNull(users.emailVerifiedAt),
          lt(users.createdAt, new Date(Date.now() - ESTABLISHED_MS)),
        ),
      );
    return Number(row?.n ?? 0);
  }

  /**
   * Takes a post or comment down for everyone but its author; a comment stops counting on its
   * post. A second take-down (a moderator after reports) only records who did it.
   */
  private async takeDown(type: "post" | "comment", id: bigint, why: string, by: bigint | null) {
    if (type === "post") {
      await this.db
        .update(posts)
        .set({
          removedAt: sql`coalesce(${posts.removedAt}, now())`,
          removalReason: why,
          removedBy: by,
        })
        .where(eq(posts.id, id));
      return;
    }
    const [row] = await this.db
      .update(comments)
      .set({ removedAt: new Date(), removedBy: by })
      .where(and(eq(comments.id, id), isNull(comments.removedAt)))
      .returning({ postId: comments.postId });
    if (row) {
      await this.db
        .update(posts)
        .set({ commentCount: sql`greatest(${posts.commentCount} - 1, 0)` })
        .where(eq(posts.id, row.postId));
    } else if (by) {
      await this.db.update(comments).set({ removedBy: by }).where(eq(comments.id, id));
    }
  }

  /** "Nothing wrong": back up, unless a moderator took it down on purpose. */
  private async restore(type: "post" | "comment", id: bigint) {
    if (type === "post") {
      await this.db
        .update(posts)
        .set({ removedAt: null, removalReason: null, removedBy: null })
        .where(and(eq(posts.id, id), eq(posts.removalReason, BY_REPORTS)));
      return;
    }
    const [row] = await this.db
      .update(comments)
      .set({ removedAt: null })
      .where(and(eq(comments.id, id), isNotNull(comments.removedAt), isNull(comments.removedBy)))
      .returning({ postId: comments.postId });
    if (row) {
      await this.db
        .update(posts)
        .set({ commentCount: sql`${posts.commentCount} + 1` })
        .where(eq(posts.id, row.postId));
    }
  }

  private async setHidden(messageId: bigint, hide: boolean, topic: string) {
    const [row] = await this.db
      .update(messages)
      .set({
        flags: hide
          ? sql`${messages.flags} | ${MESSAGE_HIDDEN}`
          : sql`${messages.flags} & ~${MESSAGE_HIDDEN}`,
      })
      .where(eq(messages.id, messageId))
      .returning();
    if (!row) return;
    const [message] = await this.messages.hydrate([row]);
    if (message) {
      await this.deps.bus.publish(topic, { type: "MESSAGE_UPDATE", data: message });
    }
  }

  /** The Space's queue: open reports folded together per thing. Reporters stay private. */
  async queue(idOrSlug: string, userId: bigint): Promise<ReportedItem[]> {
    const access = await memberAccess(this.db, idOrSlug, userId);
    requireSpacePermission(access, Permission.MODERATE_REPORTS, "see reports");
    const rows = await this.db
      .select()
      .from(reports)
      .where(and(eq(reports.communityId, access.community.id), eq(reports.status, "open")))
      .orderBy(desc(reports.id))
      .limit(500);
    const groups = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = `${r.targetType}:${r.targetId}`;
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    const authorIds = [
      ...new Set(
        rows.flatMap((r) => {
          const id = (r.evidence as { authorId?: string }).authorId;
          return id ? [BigInt(id)] : [];
        }),
      ),
    ];
    const authors = authorIds.length
      ? await this.db.select(summaryColumns).from(users).where(inArray(users.id, authorIds))
      : [];
    const msgIds = rows.filter((r) => r.targetType === "message").map((r) => r.targetId);
    const flags = msgIds.length
      ? await this.db
          .select({ id: messages.id, flags: messages.flags })
          .from(messages)
          .where(inArray(messages.id, msgIds))
      : [];
    const idsOf = (type: string) =>
      rows.filter((r) => r.targetType === type).map((r) => r.targetId);
    const postIds = idsOf("post");
    const commentIds = idsOf("comment");
    const down = new Set(
      [
        ...(postIds.length
          ? await this.db
              .select({ id: posts.id })
              .from(posts)
              .where(and(inArray(posts.id, postIds), isNotNull(posts.removedAt)))
          : []),
        ...(commentIds.length
          ? await this.db
              .select({ id: comments.id })
              .from(comments)
              .where(and(inArray(comments.id, commentIds), isNotNull(comments.removedAt)))
          : []),
      ].map((r) => r.id.toString()),
    );
    return [...groups.values()].map((list) => {
      const first = list[list.length - 1] ?? list[0];
      if (!first) throw new Error("empty report group");
      const ev = first.evidence as { content?: string; authorId?: string; channelId?: string };
      const author = authors.find((a) => a.id.toString() === ev.authorId);
      return {
        id: first.id.toString(),
        targetType: first.targetType as ReportedItem["targetType"],
        targetId: first.targetId.toString(),
        reasons: [...new Set(list.map((r) => r.reason as ReportReason))],
        count: new Set(list.map((r) => r.reporterId.toString())).size,
        details: list.flatMap((r) => (r.details ? [r.details] : [])).slice(0, 5),
        evidence: {
          content: ev.content ?? null,
          author: author ? toUserSummary(author) : null,
          channelId: ev.channelId ?? null,
        },
        hidden:
          down.has(first.targetId.toString()) ||
          flags.some((f) => f.id === first.targetId && (f.flags & MESSAGE_HIDDEN) !== 0),
        firstReportedAt: first.createdAt.toISOString(),
      };
    });
  }

  /** A moderator's decision: nothing wrong (dismiss, and unhide), or take the message down. */
  async resolve(idOrSlug: string, userId: bigint, targetId: bigint, action: "dismiss" | "remove") {
    const access = await memberAccess(this.db, idOrSlug, userId);
    requireSpacePermission(access, Permission.MODERATE_REPORTS, "handle reports");
    const open = await this.db
      .select()
      .from(reports)
      .where(
        and(
          eq(reports.communityId, access.community.id),
          eq(reports.targetId, targetId),
          eq(reports.status, "open"),
        ),
      );
    if (open.length === 0) throw notFound("Report");
    const type = open[0]?.targetType;
    const isMessage = type === "message";
    const postLike = type === "post" || type === "comment" ? type : null;
    if (postLike && action === "remove") {
      requireSpacePermission(access, Permission.MANAGE_MESSAGES, "remove posts");
      await this.takeDown(postLike, targetId, BY_MODERATOR, userId);
    } else if (postLike) {
      await this.restore(postLike, targetId);
    } else if (isMessage && action === "remove") {
      requireSpacePermission(access, Permission.MANAGE_MESSAGES, "remove messages");
      const [row] = await this.db
        .update(messages)
        .set({ deletedAt: new Date(), content: null })
        .where(eq(messages.id, targetId))
        .returning();
      if (row) {
        await this.deps.bus.publish(`community:${access.community.id}`, {
          type: "MESSAGE_DELETE",
          data: { id: row.id.toString(), channelId: row.channelId.toString() },
        });
      }
    } else if (isMessage) {
      await this.setHidden(targetId, false, `community:${access.community.id}`);
    }
    await this.db
      .update(reports)
      .set({
        status: action === "remove" ? "actioned" : "dismissed",
        handledBy: userId,
        handledAt: new Date(),
      })
      .where(
        and(
          eq(reports.communityId, access.community.id),
          eq(reports.targetId, targetId),
          eq(reports.status, "open"),
        ),
      );
    await this.audit(
      access.community.id,
      userId,
      action === "remove" ? `${postLike ?? "message"}.remove` : "report.dismiss",
      { type: open[0]?.targetType ?? "message", id: targetId },
    );
  }

  // ── Your own tools: block and mute ───────────────────────────────────────

  async block(userId: bigint, targetId: bigint) {
    if (userId === targetId) throw badRequest("BAD_REQUEST", "You can't block yourself.");
    const [person] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, targetId));
    if (!person) throw notFound("Person");
    await this.db
      .insert(relationships)
      .values({ userId, targetId, type: "blocked" })
      .onConflictDoUpdate({
        target: [relationships.userId, relationships.targetId],
        set: { type: "blocked", createdAt: new Date() },
      });
    // A block ends following both ways, and any request waiting, like on Instagram.
    await this.db
      .delete(follows)
      .where(
        or(
          and(eq(follows.followerId, userId), eq(follows.followeeId, targetId)),
          and(eq(follows.followerId, targetId), eq(follows.followeeId, userId)),
        ),
      );
  }

  async unblock(userId: bigint, targetId: bigint) {
    await this.db
      .delete(relationships)
      .where(
        and(
          eq(relationships.userId, userId),
          eq(relationships.targetId, targetId),
          eq(relationships.type, "blocked"),
        ),
      );
  }

  async mute(
    userId: bigint,
    targetType: "user" | "community" | "channel",
    targetId: bigint,
    until: Date | null,
  ) {
    await this.db
      .insert(mutes)
      .values({ userId, targetType, targetId, until })
      .onConflictDoUpdate({
        target: [mutes.userId, mutes.targetType, mutes.targetId],
        set: { until },
      });
  }

  async unmute(userId: bigint, targetType: "user" | "community" | "channel", targetId: bigint) {
    await this.db
      .delete(mutes)
      .where(
        and(
          eq(mutes.userId, userId),
          eq(mutes.targetType, targetType),
          eq(mutes.targetId, targetId),
        ),
      );
  }

  async lists(userId: bigint): Promise<SafetyLists> {
    const blocked = await this.db
      .select(summaryColumns)
      .from(relationships)
      .innerJoin(users, eq(users.id, relationships.targetId))
      .where(and(eq(relationships.userId, userId), eq(relationships.type, "blocked")));
    const muted = await this.db
      .select()
      .from(mutes)
      .where(and(eq(mutes.userId, userId), or(isNull(mutes.until), gt(mutes.until, new Date()))));
    return {
      blocked: blocked.map(toUserSummary),
      mutes: muted.map((m) => ({
        targetType: m.targetType,
        targetId: m.targetId.toString(),
        until: m.until?.toISOString() ?? null,
      })),
    };
  }

  // ── Space moderators ───────────────────────────────────────────────────────

  /** How high someone stands in a Space: the owner above all, then their highest role. */
  private rank(access: SpaceAccess, userId: bigint, roleIds: readonly bigint[]) {
    if (access.community.ownerId === userId) return Number.POSITIVE_INFINITY;
    const positions = access.roles.filter((r) => roleIds.includes(r.id)).map((r) => r.position);
    return Math.max(0, ...positions);
  }

  /** Moderators act only on people below them, never on the owner or themselves. */
  private async target(access: SpaceAccess, actorId: bigint, targetId: bigint) {
    if (actorId === targetId) throw badRequest("BAD_REQUEST", "You can't do that to yourself.");
    if (access.community.ownerId === targetId)
      throw forbidden("Nobody can act on the Space's owner.");
    const theirs = await loadAccess(this.db, access.community, targetId);
    const actorRank = this.rank(access, actorId, access.memberRoleIds);
    const targetRank = this.rank(access, targetId, theirs.memberRoleIds);
    if (actorRank <= targetRank) {
      throw forbidden("They're at your level or above, so only someone higher can do that.");
    }
    return { theirs, actorRank };
  }

  private async memberView(spaceId: bigint, targetId: bigint): Promise<Member | null> {
    const [row] = await this.db
      .select({ member: communityMembers, user: summaryColumns })
      .from(communityMembers)
      .innerJoin(users, eq(users.id, communityMembers.userId))
      .where(and(eq(communityMembers.communityId, spaceId), eq(communityMembers.userId, targetId)))
      .limit(1);
    if (!row) return null;
    const assigned = await this.db
      .select({ roleId: memberRoles.roleId })
      .from(memberRoles)
      .where(and(eq(memberRoles.communityId, spaceId), eq(memberRoles.userId, targetId)));
    return toMember(
      row.member,
      row.user,
      assigned.map((a) => a.roleId),
    );
  }

  async updateMember(idOrSlug: string, actorId: bigint, targetId: bigint, body: UpdateMemberBody) {
    const access = await memberAccess(this.db, idOrSlug, actorId);
    const { theirs, actorRank } = await this.target(access, actorId, targetId);
    if (!theirs.member) throw notFound("Member");
    const spaceId = access.community.id;

    if (body.roleIds) {
      requireSpacePermission(access, Permission.MANAGE_ROLES, "change roles");
      const wanted = body.roleIds.map(BigInt);
      const assignable = access.roles.filter((r) => r.id !== spaceId && r.position < actorRank);
      if (wanted.some((id) => !assignable.some((r) => r.id === id))) {
        throw forbidden("You can only give roles below your own.");
      }
      // Roles at or above the actor's own stay as they are.
      const kept = theirs.memberRoleIds.filter((id) => !assignable.some((r) => r.id === id));
      await this.db.transaction(async (tx) => {
        await tx
          .delete(memberRoles)
          .where(and(eq(memberRoles.communityId, spaceId), eq(memberRoles.userId, targetId)));
        const next = [...new Set([...kept, ...wanted])];
        if (next.length) {
          await tx
            .insert(memberRoles)
            .values(next.map((roleId) => ({ communityId: spaceId, userId: targetId, roleId })));
        }
      });
      await this.audit(
        spaceId,
        actorId,
        "member.roles",
        { type: "user", id: targetId },
        body.reason,
      );
    }

    if (body.timeoutUntil !== undefined) {
      requireSpacePermission(access, Permission.TIMEOUT_MEMBERS, "time people out");
      const until = body.timeoutUntil ? new Date(body.timeoutUntil) : null;
      if (
        until &&
        (until.getTime() <= Date.now() || until.getTime() - Date.now() > MAX_TIMEOUT_MS)
      ) {
        throw badRequest("VALIDATION_FAILED", "A timeout lasts between a minute and 28 days.");
      }
      await this.db
        .update(communityMembers)
        .set({ timeoutUntil: until })
        .where(
          and(eq(communityMembers.communityId, spaceId), eq(communityMembers.userId, targetId)),
        );
      await this.audit(
        spaceId,
        actorId,
        until ? "member.timeout" : "member.timeout_lift",
        { type: "user", id: targetId },
        body.reason,
      );
    }

    const member = await this.memberView(spaceId, targetId);
    if (member) {
      await this.deps.bus.publish(`community:${spaceId}`, {
        type: "COMMUNITY_MEMBER_UPDATE",
        data: member,
      });
    }
    return member;
  }

  private async removeMember(spaceId: bigint, targetId: bigint) {
    const removed = await this.db.transaction(async (tx) => {
      await tx
        .delete(memberRoles)
        .where(and(eq(memberRoles.communityId, spaceId), eq(memberRoles.userId, targetId)));
      const gone = await tx
        .delete(communityMembers)
        .where(
          and(eq(communityMembers.communityId, spaceId), eq(communityMembers.userId, targetId)),
        )
        .returning({ id: communityMembers.userId });
      if (gone.length) {
        await tx
          .update(communities)
          .set({ memberCount: sql`greatest(${communities.memberCount} - 1, 0)` })
          .where(eq(communities.id, spaceId));
      }
      return gone.length > 0;
    });
    if (removed) {
      await this.deps.bus.publish(`user:${targetId}`, {
        type: "COMMUNITY_DELETE",
        data: { id: spaceId.toString(), unavailable: false },
      });
      await this.deps.bus.publish(`community:${spaceId}`, {
        type: "COMMUNITY_MEMBER_REMOVE",
        data: { communityId: spaceId.toString(), userId: targetId.toString() },
      });
    }
  }

  async kick(idOrSlug: string, actorId: bigint, targetId: bigint, reason?: string) {
    const access = await memberAccess(this.db, idOrSlug, actorId);
    requireSpacePermission(access, Permission.KICK_MEMBERS, "remove people");
    const { theirs } = await this.target(access, actorId, targetId);
    if (!theirs.member) throw notFound("Member");
    await this.removeMember(access.community.id, targetId);
    await this.audit(
      access.community.id,
      actorId,
      "member.kick",
      { type: "user", id: targetId },
      reason,
    );
  }

  async ban(
    idOrSlug: string,
    actorId: bigint,
    targetId: bigint,
    body: { reason?: string; deleteMessagesHours: number },
  ) {
    const access = await memberAccess(this.db, idOrSlug, actorId);
    requireSpacePermission(access, Permission.BAN_MEMBERS, "ban people");
    await this.target(access, actorId, targetId);
    const spaceId = access.community.id;
    await this.db
      .insert(bans)
      .values({
        communityId: spaceId,
        userId: targetId,
        moderatorId: actorId,
        reason: body.reason ?? null,
      })
      .onConflictDoUpdate({
        target: [bans.communityId, bans.userId],
        set: { moderatorId: actorId, reason: body.reason ?? null, createdAt: new Date() },
      });
    await this.removeMember(spaceId, targetId);
    if (body.deleteMessagesHours > 0) {
      const since = new Date(Date.now() - body.deleteMessagesHours * 3600 * 1000);
      const rooms = await this.db
        .select({ id: channels.id })
        .from(channels)
        .where(eq(channels.communityId, spaceId));
      if (rooms.length) {
        const gone = await this.db
          .update(messages)
          .set({ deletedAt: new Date(), content: null })
          .where(
            and(
              eq(messages.authorId, targetId),
              inArray(
                messages.channelId,
                rooms.map((r) => r.id),
              ),
              gt(messages.createdAt, since),
              isNull(messages.deletedAt),
            ),
          )
          .returning({ id: messages.id, channelId: messages.channelId });
        for (const m of gone.slice(0, 500)) {
          await this.deps.bus.publish(`community:${spaceId}`, {
            type: "MESSAGE_DELETE",
            data: { id: m.id.toString(), channelId: m.channelId.toString() },
          });
        }
      }
    }
    await this.audit(spaceId, actorId, "member.ban", { type: "user", id: targetId }, body.reason);
  }

  async unban(idOrSlug: string, actorId: bigint, targetId: bigint) {
    const access = await memberAccess(this.db, idOrSlug, actorId);
    requireSpacePermission(access, Permission.BAN_MEMBERS, "lift bans");
    await this.db
      .delete(bans)
      .where(and(eq(bans.communityId, access.community.id), eq(bans.userId, targetId)));
    await this.audit(access.community.id, actorId, "member.unban", { type: "user", id: targetId });
  }

  async bans(idOrSlug: string, actorId: bigint): Promise<Ban[]> {
    const access = await memberAccess(this.db, idOrSlug, actorId);
    requireSpacePermission(access, Permission.BAN_MEMBERS, "see bans");
    const rows = await this.db
      .select({ ban: bans, user: summaryColumns })
      .from(bans)
      .innerJoin(users, eq(users.id, bans.userId))
      .where(eq(bans.communityId, access.community.id))
      .orderBy(desc(bans.createdAt))
      .limit(200);
    return rows.map((r) => ({
      user: toUserSummary(r.user),
      reason: r.ban.reason,
      createdAt: r.ban.createdAt.toISOString(),
    }));
  }

  async auditLog(idOrSlug: string, actorId: bigint): Promise<AuditEntry[]> {
    const access = await memberAccess(this.db, idOrSlug, actorId);
    if (!has(access.base, Permission.VIEW_AUDIT_LOG))
      throw missingPermission("see the activity log");
    const rows = await this.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.communityId, access.community.id))
      .orderBy(desc(auditLog.id))
      .limit(100);
    const ids = [
      ...new Set(
        rows.flatMap((r) => [
          r.actorId,
          ...(r.targetType === "user" && r.targetId ? [r.targetId] : []),
        ]),
      ),
    ];
    const people = ids.length
      ? await this.db.select(summaryColumns).from(users).where(inArray(users.id, ids))
      : [];
    const find = (id: bigint | null) => people.find((p) => p.id === id);
    return rows.flatMap((r) => {
      const actor = find(r.actorId);
      if (!actor) return [];
      const target = r.targetType === "user" ? find(r.targetId) : undefined;
      return [
        {
          id: r.id.toString(),
          action: r.action,
          actor: toUserSummary(actor),
          target: target ? toUserSummary(target) : null,
          targetType: r.targetType,
          reason: r.reason,
          createdAt: r.createdAt.toISOString(),
        },
      ];
    });
  }

  /** The Space's roles that a moderator could give (for the members screen). */
  async assignableRoles(idOrSlug: string, actorId: bigint) {
    const access = await memberAccess(this.db, idOrSlug, actorId);
    if (!has(access.base, Permission.MANAGE_ROLES)) return [];
    const actorRank = this.rank(access, actorId, access.memberRoleIds);
    return access.roles
      .filter((r) => r.id !== access.community.id && r.position < actorRank)
      .map((r) => r.id.toString());
  }
}
