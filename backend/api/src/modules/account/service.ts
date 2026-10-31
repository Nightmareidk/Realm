import { randomBytes } from "node:crypto";
import {
  type BackupCodes,
  type ConfirmWithPassword,
  DELETION_GRACE_DAYS,
  type DeletionScheduled,
  type TwoStepSetup,
  type TwoStepStatus,
} from "@realm/contracts";
import { and, eq, inArray, isNull, lt, or, schema, sql } from "@realm/db";
import {
  hashPassword,
  hmacHex,
  Limits,
  newTotpSecret,
  randomToken,
  seal,
  totpUri,
  unseal,
  verifyPassword,
  verifyTotp,
} from "@realm/server-core";
import type { Deps } from "../../deps";
import { AppError, badRequest, rateLimited } from "../../lib/errors";
import { type ClientContext, revokeAllSessions } from "../../lib/sessions";
import { deletionScheduledEmail, twoStepChangedEmail } from "../auth/emails";

const {
  users,
  userSettings,
  securityEvents,
  mfaBackupCodes,
  posts,
  comments,
  stories,
  notes,
  follows,
  relationships,
  closeFriends,
  accountMutes,
  saves,
  collections,
  collectionItems,
  postTags,
  communities,
  communityMembers,
  memberRoles,
  pushTokens,
  sessions,
  soundLikes,
  playlists,
  playlistItems,
  messages,
} = schema;

type UserRow = typeof users.$inferSelect;
const BACKUP_CODE_COUNT = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

/** xxxx-xxxx from an alphabet without look-alikes (no 0/o, 1/l/i). */
function backupCode(): string {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(8);
  const chars = [...bytes].map((b) => abc[b % abc.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/**
 * Your account: two-step sign-in, taking a break, deleting it (30 days to change your mind, as
 * Instagram does), and a copy of everything Realm keeps about you.
 */
export class AccountService {
  constructor(private readonly deps: Deps) {}

  private get db() {
    return this.deps.db;
  }

  private hashBackup(code: string) {
    return hmacHex(this.deps.config.REALM_SECRET, `backup:${code.toLowerCase()}`);
  }

  private async log(
    userId: bigint,
    type: (typeof securityEvents.$inferInsert)["type"],
    ip: string,
  ) {
    await this.db.insert(securityEvents).values({ id: this.deps.ids.next(), userId, type, ip });
  }

  private mail(m: Parameters<Deps["mailer"]["send"]>[0]) {
    this.deps.mailer.send(m).catch((err) => this.deps.logger.error({ err }, "mail send failed"));
  }

  async user(userId: bigint): Promise<UserRow> {
    const [u] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!u) throw new AppError(401, "UNAUTHORIZED", "Sign in to continue");
    return u;
  }

  /**
   * The second step: a code from the app (each one works once), or a backup code (used up).
   * Returns false for a wrong code; never says which kind was wrong.
   */
  async checkSecondStep(user: UserRow, code: string, ip: string): Promise<boolean> {
    if (!user.mfaSecret) return true;
    const clean = code.replace(/\s+/g, "").toLowerCase();
    if (/^\d{6}$/.test(clean)) {
      const step = verifyTotp(unseal(this.deps.config.REALM_SECRET, user.mfaSecret), clean);
      if (step === null || (user.mfaLastStep !== null && step <= user.mfaLastStep)) return false;
      // Only one request can claim this step: the update is the lock.
      const claimed = await this.db
        .update(users)
        .set({ mfaLastStep: step })
        .where(
          and(eq(users.id, user.id), or(isNull(users.mfaLastStep), lt(users.mfaLastStep, step))),
        )
        .returning({ id: users.id });
      return claimed.length === 1;
    }
    const used = await this.db
      .update(mfaBackupCodes)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(mfaBackupCodes.userId, user.id),
          eq(mfaBackupCodes.codeHash, this.hashBackup(clean)),
          isNull(mfaBackupCodes.usedAt),
        ),
      )
      .returning({ userId: mfaBackupCodes.userId });
    if (used.length === 0) return false;
    await this.log(user.id, "mfa_backup_used", ip);
    return true;
  }

  /** Password, then the code if two-step is on. Limited, so it can't be used to guess either. */
  async confirm(user: UserRow, body: ConfirmWithPassword, client: ClientContext) {
    const r = await this.deps.limiter.hit(Limits.accountConfirm, user.id.toString());
    if (!r.allowed) throw rateLimited(r.resetSeconds);
    if (!(await verifyPassword(user.passwordHash, body.password))) {
      throw new AppError(401, "INVALID_CREDENTIALS", "That password isn't right.");
    }
    if (!user.mfaSecret) return;
    if (!body.code) {
      throw new AppError(401, "MFA_REQUIRED", "Enter the code from your authenticator app.");
    }
    if (!(await this.checkSecondStep(user, body.code, client.ip))) {
      throw new AppError(401, "INVALID_CODE", "That code isn't right. Try the newest one.");
    }
  }

  async twoStepStatus(userId: bigint): Promise<TwoStepStatus> {
    const u = await this.user(userId);
    const [left] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(mfaBackupCodes)
      .where(and(eq(mfaBackupCodes.userId, userId), isNull(mfaBackupCodes.usedAt)));
    return { enabled: u.mfaSecret !== null, backupCodesLeft: u.mfaSecret ? (left?.n ?? 0) : 0 };
  }

  /** A new secret to show as a QR code. Nothing is saved until a code from it is confirmed. */
  async setupTwoStep(userId: bigint): Promise<TwoStepSetup> {
    const u = await this.user(userId);
    if (u.mfaSecret) throw badRequest("BAD_REQUEST", "Two-step sign-in is already on.");
    const secret = newTotpSecret();
    return { secret, uri: totpUri(secret, `@${u.username}`) };
  }

  async enableTwoStep(
    userId: bigint,
    secret: string,
    code: string,
    client: ClientContext,
  ): Promise<BackupCodes> {
    const r = await this.deps.limiter.hit(Limits.accountConfirm, userId.toString());
    if (!r.allowed) throw rateLimited(r.resetSeconds);
    const u = await this.user(userId);
    if (u.mfaSecret) throw badRequest("BAD_REQUEST", "Two-step sign-in is already on.");
    const step = verifyTotp(secret, code);
    if (step === null) {
      throw new AppError(
        401,
        "INVALID_CODE",
        "That code didn't match. Check the phone's time is set automatically, then try the newest code.",
      );
    }
    const codes = await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          mfaSecret: seal(this.deps.config.REALM_SECRET, secret),
          mfaEnabledAt: new Date(),
          mfaLastStep: step,
        })
        .where(and(eq(users.id, userId), isNull(users.mfaSecret)));
      return this.replaceBackupCodes(tx, userId);
    });
    await this.log(userId, "mfa_enabled", client.ip);
    this.mail(twoStepChangedEmail({ to: u.email, on: true }));
    return { codes };
  }

  private async replaceBackupCodes(tx: Pick<Deps["db"], "delete" | "insert">, userId: bigint) {
    const codes = Array.from({ length: BACKUP_CODE_COUNT }, backupCode);
    await tx.delete(mfaBackupCodes).where(eq(mfaBackupCodes.userId, userId));
    await tx
      .insert(mfaBackupCodes)
      .values(codes.map((c) => ({ userId, codeHash: this.hashBackup(c) })));
    return codes;
  }

  async newBackupCodes(userId: bigint, body: ConfirmWithPassword, client: ClientContext) {
    const u = await this.user(userId);
    if (!u.mfaSecret) throw badRequest("BAD_REQUEST", "Turn on two-step sign-in first.");
    await this.confirm(u, body, client);
    return { codes: await this.db.transaction((tx) => this.replaceBackupCodes(tx, userId)) };
  }

  async disableTwoStep(userId: bigint, body: ConfirmWithPassword, client: ClientContext) {
    const u = await this.user(userId);
    if (!u.mfaSecret) return;
    await this.confirm(u, body, client);
    await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ mfaSecret: null, mfaEnabledAt: null, mfaLastStep: null })
        .where(eq(users.id, userId));
      await tx.delete(mfaBackupCodes).where(eq(mfaBackupCodes.userId, userId));
    });
    await this.log(userId, "mfa_disabled", client.ip);
    this.mail(twoStepChangedEmail({ to: u.email, on: false }));
  }

  /** Spaces you own need a new owner first, or they'd be left with nobody in charge. */
  private async refuseIfOwner(userId: bigint) {
    const owned = await this.db
      .select({ name: communities.name })
      .from(communities)
      .where(and(eq(communities.ownerId, userId), isNull(communities.deletedAt)))
      .limit(3);
    if (owned.length > 0) {
      throw new AppError(
        409,
        "OWNER_CANNOT_LEAVE",
        `You own ${owned.map((s) => s.name).join(", ")}. Give each Space to someone else, or delete it, first.`,
      );
    }
  }

  /** Taking a break: hidden from everyone until you sign in again. Nothing is deleted. */
  async deactivate(userId: bigint, body: ConfirmWithPassword, client: ClientContext) {
    const u = await this.user(userId);
    await this.confirm(u, body, client);
    await this.db
      .update(users)
      .set({ status: "deactivated", deletionScheduledAt: null })
      .where(and(eq(users.id, userId), eq(users.status, "active")));
    await revokeAllSessions(this.deps, this.db, userId);
    await this.log(userId, "deactivated", client.ip);
  }

  /** Hidden now; deleted for good after 30 days unless they sign in first. */
  async requestDeletion(
    userId: bigint,
    body: ConfirmWithPassword,
    client: ClientContext,
  ): Promise<DeletionScheduled> {
    const u = await this.user(userId);
    await this.confirm(u, body, client);
    await this.refuseIfOwner(userId);
    const when = new Date(Date.now() + DELETION_GRACE_DAYS * DAY_MS);
    await this.db
      .update(users)
      .set({ status: "deactivated", deletionScheduledAt: when })
      .where(eq(users.id, userId));
    await revokeAllSessions(this.deps, this.db, userId);
    await this.log(userId, "deletion_requested", client.ip);
    this.mail(deletionScheduledEmail({ to: u.email, when }));
    return { deletesAt: when.toISOString() };
  }

  /**
   * Signing in during a break or the 30 days brings everything back. Returns what was undone.
   */
  async welcomeBack(user: UserRow, ip: string): Promise<"deactivated" | "deletion_cancelled"> {
    const kind = user.deletionScheduledAt ? "deletion_cancelled" : "deactivated";
    await this.db
      .update(users)
      .set({ status: "active", deletionScheduledAt: null })
      .where(and(eq(users.id, user.id), eq(users.status, "deactivated")));
    await this.log(user.id, "reactivated", ip);
    return kind;
  }

  /**
   * Accounts whose 30 days are up: everything they made goes, and the account becomes an empty
   * "Deleted account" (messages they sent in group chats stay, under that name, as on Discord).
   * Safe to run on several servers at once: each account is claimed by one update.
   */
  async sweepDeletions(now = new Date()) {
    const due = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.status, "deactivated"), lt(users.deletionScheduledAt, now)))
      .limit(50);
    for (const { id } of due) {
      try {
        await this.erase(id);
      } catch (err) {
        this.deps.logger.error({ err, userId: id.toString() }, "account deletion failed");
      }
    }
    return due.length;
  }

  private async erase(userId: bigint) {
    const placeholder = await hashPassword(randomToken());
    await this.db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(users)
        .set({
          status: "deleted",
          deletedAt: new Date(),
          deletionScheduledAt: null,
          username: `deleted_${userId}`,
          displayName: "Deleted account",
          email: `deleted+${userId}@deleted.invalid`,
          emailVerifiedAt: null,
          passwordHash: placeholder,
          bio: null,
          pronouns: null,
          websiteUrl: null,
          category: null,
          avatarMediaId: null,
          bannerMediaId: null,
          accentColor: null,
          verified: null,
          verifiedAt: null,
          staffRole: null,
          mfaSecret: null,
          mfaEnabledAt: null,
          mfaLastStep: null,
        })
        .where(and(eq(users.id, userId), eq(users.status, "deactivated")))
        .returning({ id: users.id });
      if (!claimed) return;
      const now = new Date();
      await tx
        .update(posts)
        .set({ deletedAt: now })
        .where(and(eq(posts.authorId, userId), isNull(posts.deletedAt)));
      await tx
        .update(comments)
        .set({ deletedAt: now, body: "" })
        .where(eq(comments.authorId, userId));
      await tx
        .update(stories)
        .set({ deletedAt: now })
        .where(and(eq(stories.authorId, userId), isNull(stories.deletedAt)));
      await tx.delete(notes).where(eq(notes.userId, userId));
      await tx
        .delete(follows)
        .where(or(eq(follows.followerId, userId), eq(follows.followeeId, userId)));
      await tx
        .delete(relationships)
        .where(or(eq(relationships.userId, userId), eq(relationships.targetId, userId)));
      await tx
        .delete(closeFriends)
        .where(or(eq(closeFriends.userId, userId), eq(closeFriends.friendId, userId)));
      await tx
        .delete(accountMutes)
        .where(or(eq(accountMutes.userId, userId), eq(accountMutes.targetId, userId)));
      await tx.delete(postTags).where(eq(postTags.userId, userId));
      await tx.delete(saves).where(eq(saves.userId, userId));
      const mine = tx
        .select({ id: collections.id })
        .from(collections)
        .where(eq(collections.userId, userId));
      await tx.delete(collectionItems).where(inArray(collectionItems.collectionId, mine));
      await tx.delete(collections).where(eq(collections.userId, userId));
      await tx.delete(soundLikes).where(eq(soundLikes.userId, userId));
      const lists = tx
        .select({ id: playlists.id })
        .from(playlists)
        .where(eq(playlists.ownerId, userId));
      await tx.delete(playlistItems).where(inArray(playlistItems.playlistId, lists));
      await tx.delete(playlists).where(eq(playlists.ownerId, userId));
      await tx.delete(memberRoles).where(eq(memberRoles.userId, userId));
      await tx.delete(communityMembers).where(eq(communityMembers.userId, userId));
      await tx.delete(pushTokens).where(eq(pushTokens.userId, userId));
      await tx.delete(mfaBackupCodes).where(eq(mfaBackupCodes.userId, userId));
      await tx.delete(userSettings).where(eq(userSettings.userId, userId));
      await tx.update(sessions).set({ revokedAt: now }).where(eq(sessions.userId, userId));
    });
  }

  /**
   * A copy of everything Realm keeps about you, as one JSON file: profile, settings, posts,
   * comments, Stories, who you follow and who follows you, saves, collections, your messages.
   */
  async exportData(userId: bigint) {
    const r = await this.deps.limiter.hit(Limits.dataExport, userId.toString());
    if (!r.allowed) throw rateLimited(r.resetSeconds);
    const u = await this.user(userId);
    const [settings] = await this.db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId));
    const name = (rows: { id: bigint; username: string }[]) => rows.map((x) => `@${x.username}`);
    const following = await this.db
      .select({ id: users.id, username: users.username })
      .from(follows)
      .innerJoin(users, eq(users.id, follows.followeeId))
      .where(eq(follows.followerId, userId));
    const followers = await this.db
      .select({ id: users.id, username: users.username })
      .from(follows)
      .innerJoin(users, eq(users.id, follows.followerId))
      .where(eq(follows.followeeId, userId));
    const myPosts = await this.db
      .select({
        id: posts.id,
        kind: posts.kind,
        caption: posts.body,
        createdAt: posts.createdAt,
        archived: posts.archivedAt,
      })
      .from(posts)
      .where(and(eq(posts.authorId, userId), isNull(posts.deletedAt)));
    const myComments = await this.db
      .select({ postId: comments.postId, text: comments.body, createdAt: comments.createdAt })
      .from(comments)
      .where(and(eq(comments.authorId, userId), isNull(comments.deletedAt)));
    const myStories = await this.db
      .select({ id: stories.id, caption: stories.caption, createdAt: stories.createdAt })
      .from(stories)
      .where(and(eq(stories.authorId, userId), isNull(stories.deletedAt)));
    const mySaves = await this.db
      .select({ postId: saves.postId, savedAt: saves.createdAt })
      .from(saves)
      .where(eq(saves.userId, userId));
    const myCollections = await this.db
      .select({ id: collections.id, name: collections.name })
      .from(collections)
      .where(eq(collections.userId, userId));
    const myMessages = await this.db
      .select({
        roomId: messages.channelId,
        text: messages.content,
        sentAt: messages.createdAt,
      })
      .from(messages)
      .where(and(eq(messages.authorId, userId), isNull(messages.deletedAt)))
      .limit(50_000);
    const str = (v: unknown): unknown =>
      typeof v === "bigint"
        ? v.toString()
        : v instanceof Date
          ? v.toISOString()
          : Array.isArray(v)
            ? v.map(str)
            : v && typeof v === "object"
              ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, str(x)]))
              : v;
    return str({
      exportedAt: new Date(),
      account: {
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        email: u.email,
        birthDate: u.birthDate,
        bio: u.bio,
        pronouns: u.pronouns,
        website: u.websiteUrl,
        accountKind: u.accountKind,
        createdAt: u.createdAt,
        twoStepOn: u.mfaSecret !== null,
      },
      settings: settings ? { ...settings, userId: undefined } : null,
      following: name(following),
      followers: name(followers),
      posts: myPosts,
      comments: myComments,
      stories: myStories,
      saved: mySaves,
      collections: myCollections,
      messages: myMessages,
    }) as Record<string, unknown>;
  }
}
