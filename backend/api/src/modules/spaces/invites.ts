import { randomInt } from "node:crypto";
import { type CreateInviteBody, type Invite, Permission } from "@realm/contracts";
import { and, asc, desc, eq, isNull, or, schema, sql } from "@realm/db";
import type { Deps } from "../../deps";
import { AppError, forbidden, notFound } from "../../lib/errors";
import {
  toCommunity,
  toUserSummary,
  summaryColumns as userColumns,
} from "../../lib/serialize-spaces";
import {
  type CommunityRow,
  findSpace,
  loadAccess,
  memberAccess,
  requireSpacePermission,
} from "./access";
import type { SpacesService } from "./service";

const { invites, users, channels } = schema;

type InviteRow = typeof invites.$inferSelect;

// No look-alike characters (0/O, 1/l/I), so a code read aloud or retyped still works.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 10;

export function newInviteCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

/** Why an invite no longer works, in plain words that say who to ask. */
function deadInvite(row: InviteRow, inviter: string | null): AppError | null {
  const ask = inviter ? `Ask ${inviter} for a new one.` : "Ask for a new one.";
  const details = { inviter };
  if (row.revokedAt) {
    return new AppError(410, "INVITE_REVOKED", `This invite was turned off. ${ask}`, details);
  }
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
    return new AppError(410, "INVITE_EXPIRED", `This invite has expired. ${ask}`, details);
  }
  if (row.maxUses !== null && row.uses >= row.maxUses) {
    return new AppError(410, "INVITE_USED_UP", `This invite has been used up. ${ask}`, details);
  }
  return null;
}

export class InvitesService {
  constructor(
    private readonly deps: Deps,
    private readonly spaces: SpacesService,
  ) {}

  private get db() {
    return this.deps.db;
  }

  private async toInvite(row: InviteRow, community: CommunityRow): Promise<Invite> {
    const [inviter] = row.inviterId
      ? await this.db.select(userColumns).from(users).where(eq(users.id, row.inviterId))
      : [];
    const rooms =
      community.visibility === "public"
        ? (
            await this.db
              .select({ name: channels.name })
              .from(channels)
              .where(and(eq(channels.communityId, community.id), isNull(channels.deletedAt)))
              .orderBy(asc(channels.position), asc(channels.id))
              .limit(8)
          ).map((r) => r.name ?? "")
        : [];
    const space = toCommunity(community);
    return {
      code: row.code,
      community: {
        id: space.id,
        slug: space.slug,
        name: space.name,
        iconUrl: space.iconUrl,
        memberCount: space.memberCount,
        description: space.description,
        accent: space.accent,
        visibility: space.visibility,
      },
      rooms,
      hereNow: await this.spaces.hereNow(community),
      channelId: row.channelId?.toString() ?? null,
      inviter: inviter ? toUserSummary(inviter) : null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      maxUses: row.maxUses,
      uses: row.uses,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async create(idOrSlug: string, userId: bigint, body: CreateInviteBody): Promise<Invite> {
    const access = await memberAccess(this.db, idOrSlug, userId);
    requireSpacePermission(access, Permission.CREATE_INVITES, "invite people");
    const [general] = await this.db
      .select({ id: channels.id })
      .from(channels)
      .where(
        and(
          eq(channels.communityId, access.community.id),
          eq(channels.type, "text"),
          isNull(channels.deletedAt),
        ),
      )
      .orderBy(asc(channels.position), asc(channels.id))
      .limit(1);
    let row: InviteRow | undefined;
    for (let attempt = 0; attempt < 4 && !row; attempt++) {
      [row] = await this.db
        .insert(invites)
        .values({
          code: newInviteCode(),
          communityId: access.community.id,
          channelId: general?.id ?? null,
          inviterId: userId,
          maxUses: body.maxUses === 0 ? null : body.maxUses,
          expiresAt:
            body.maxAgeSeconds === 0 ? null : new Date(Date.now() + body.maxAgeSeconds * 1000),
        })
        .onConflictDoNothing()
        .returning();
    }
    if (!row) throw new Error("couldn't find a free invite code");
    return this.toInvite(row, access.community);
  }

  /** Live invites: everyone's if you manage the Space, otherwise your own. */
  async list(idOrSlug: string, userId: bigint): Promise<Invite[]> {
    const access = await memberAccess(this.db, idOrSlug, userId);
    const manage = (access.base & Permission.MANAGE_COMMUNITY) !== 0n || access.isOwner;
    const rows = await this.db
      .select()
      .from(invites)
      .where(
        and(
          eq(invites.communityId, access.community.id),
          isNull(invites.revokedAt),
          or(isNull(invites.expiresAt), sql`${invites.expiresAt} > now()`),
          manage ? undefined : eq(invites.inviterId, userId),
        ),
      )
      .orderBy(desc(invites.createdAt))
      .limit(100);
    return Promise.all(rows.map((r) => this.toInvite(r, access.community)));
  }

  private async live(code: string) {
    const [row] = await this.db.select().from(invites).where(eq(invites.code, code)).limit(1);
    if (!row) throw notFound("Invite");
    const community = await findSpace(this.db, row.communityId.toString());
    if (!community) throw notFound("Invite");
    const [inviter] = row.inviterId
      ? await this.db
          .select({ displayName: users.displayName })
          .from(users)
          .where(eq(users.id, row.inviterId))
      : [];
    const dead = deadInvite(row, inviter?.displayName ?? null);
    if (dead) throw dead;
    return { row, community };
  }

  /** What anyone holding the link sees, signed in or not. */
  async preview(code: string): Promise<Invite> {
    const { row, community } = await this.live(code);
    return this.toInvite(row, community);
  }

  async accept(code: string, userId: bigint) {
    const { row, community } = await this.live(code);
    return this.spaces.join(
      community,
      userId,
      async (tx) => {
        // Counted inside the join, so the last use can't be claimed twice.
        const claimed = await tx
          .update(invites)
          .set({ uses: sql`${invites.uses} + 1` })
          .where(
            and(
              eq(invites.code, row.code),
              isNull(invites.revokedAt),
              or(isNull(invites.maxUses), sql`${invites.uses} < ${invites.maxUses}`),
            ),
          )
          .returning({ code: invites.code });
        if (claimed.length === 0) {
          throw new AppError(410, "INVITE_USED_UP", "This invite has just been used up.");
        }
      },
      row.channelId,
    );
  }

  async revoke(code: string, userId: bigint) {
    const [row] = await this.db.select().from(invites).where(eq(invites.code, code)).limit(1);
    if (!row) throw notFound("Invite");
    const community = await findSpace(this.db, row.communityId.toString());
    if (!community) throw notFound("Invite");
    const access = await loadAccess(this.db, community, userId);
    if (!access.member) throw notFound("Invite");
    const manage = (access.base & Permission.MANAGE_COMMUNITY) !== 0n || access.isOwner;
    if (row.inviterId !== userId && !manage)
      throw forbidden("Only its maker or a manager can turn it off.");
    await this.db.update(invites).set({ revokedAt: new Date() }).where(eq(invites.code, code));
  }
}
