import {
  type CreateCommunityBody,
  type CreateRoomBody,
  DEFAULT_EVERYONE_PERMISSIONS,
  type DiscoverSpace,
  has,
  isMinor,
  Limits,
  type MemberList,
  Permission,
  type Presence,
  type SpaceDetail,
  type UpdateCommunityBody,
  type UpdateRoomBody,
  type VoiceJoin,
} from "@realm/contracts";
import { and, asc, desc, eq, gt, inArray, isNull, or, schema, sql } from "@realm/db";
import { type LiveKitSource, liveKitToken } from "@realm/server-core";
import type { Deps } from "../../deps";
import { AppError, badRequest, conflict, forbidden, notFound } from "../../lib/errors";
import { presenceVisibleIn, readPresences } from "../../lib/presence";
import {
  toChannel,
  toCommunity,
  toMember,
  toMessage,
  toRole,
  summaryColumns as userColumns,
} from "../../lib/serialize-spaces";
import {
  type CommunityRow,
  findSpace,
  loadAccess,
  memberAccess,
  overwritesFor,
  requireSpacePermission,
  roomPermissions,
  spaceRoomAccess,
} from "./access";

const {
  communities,
  communityMembers,
  roles,
  memberRoles,
  channels,
  bans,
  messages,
  users,
  userSettings,
} = schema;

/** What a Space's moderators can do out of the box (docs/research §5a "Starter roles"). */
const MOD_PERMISSIONS =
  Permission.MANAGE_MESSAGES |
  Permission.PIN_MESSAGES |
  Permission.MANAGE_POSTS |
  Permission.KICK_MEMBERS |
  Permission.TIMEOUT_MEMBERS |
  Permission.MANAGE_NICKNAMES |
  Permission.VIEW_AUDIT_LOG |
  Permission.MODERATE_REPORTS;

/** `communities.features` bit 0: dropped from Explore after enough people reported it. */
export const UNLISTED = 1n;
/** How far "nearby" reaches. */
const NEARBY_KM = 150;
/** A Space's city is kept to about a kilometre (two decimal places). */
const roundCoord = (n: number) => Math.round(n * 100) / 100;

/** "Late Night Lobby" → "late-night-lobby", padded to the minimum length. */
export function slugify(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, Limits.communitySlug.max - 5)
    .replace(/-+$/g, "");
  return base.length >= Limits.communitySlug.min ? base : `${base || "space"}-${randomSuffix()}`;
}

const randomSuffix = () => Math.random().toString(36).slice(2, 6);

export class SpacesService {
  constructor(private readonly deps: Deps) {}

  private get db() {
    return this.deps.db;
  }

  // ── Reading ────────────────────────────────────────────────────────────────

  /** A Space as `userId` (a member) sees it: only the rooms they can see. */
  async detail(community: CommunityRow, userId: bigint): Promise<SpaceDetail> {
    const access = await loadAccess(this.db, community, userId);
    if (!access.member) throw notFound("Space");
    const rows = await this.db
      .select()
      .from(channels)
      .where(and(eq(channels.communityId, community.id), isNull(channels.deletedAt)))
      .orderBy(asc(channels.position), asc(channels.id));
    const overwrites = await overwritesFor(
      this.db,
      rows.map((c) => c.id),
    );
    const visible = rows.filter((c) =>
      has(
        roomPermissions(
          access,
          userId,
          overwrites.filter((o) => o.channelId === c.id),
        ),
        Permission.VIEW_CHANNEL,
      ),
    );
    const [user] = await this.db.select(userColumns).from(users).where(eq(users.id, userId));
    if (!user) throw notFound("User");
    return {
      ...toCommunity(community),
      channels: visible.map((c) => toChannel(c, overwrites)),
      roles: access.roles.map(toRole),
      self: toMember(access.member, user, access.memberRoleIds),
    };
  }

  async detailBySlug(idOrSlug: string, userId: bigint) {
    const access = await memberAccess(this.db, idOrSlug, userId);
    return this.detail(access.community, userId);
  }

  /** Every Space you're in, in the order you joined them. */
  async listMine(userId: bigint): Promise<SpaceDetail[]> {
    const rows = await this.db
      .select({ community: communities })
      .from(communityMembers)
      .innerJoin(communities, eq(communities.id, communityMembers.communityId))
      .where(and(eq(communityMembers.userId, userId), isNull(communities.deletedAt)))
      .orderBy(asc(communityMembers.joinedAt));
    return Promise.all(rows.map((r) => this.detail(r.community, userId)));
  }

  /** People in a Space and who's around (only those who share it; teens only in small Spaces). */
  async members(idOrSlug: string, userId: bigint): Promise<MemberList> {
    const access = await memberAccess(this.db, idOrSlug, userId);
    const community = access.community;
    const rows = await this.db
      .select({
        member: communityMembers,
        user: userColumns,
        birthDate: users.birthDate,
        showPresence: userSettings.showPresence,
      })
      .from(communityMembers)
      .innerJoin(users, eq(users.id, communityMembers.userId))
      .leftJoin(userSettings, eq(userSettings.userId, communityMembers.userId))
      .where(and(eq(communityMembers.communityId, community.id), eq(users.status, "active")))
      .orderBy(asc(communityMembers.joinedAt))
      .limit(1000);
    const assigned = await this.db
      .select()
      .from(memberRoles)
      .where(eq(memberRoles.communityId, community.id));
    const ids = rows.map((r) => r.user.id.toString());
    const statuses = await readPresences(this.deps.kv, ids);
    const presences: Presence[] = [];
    for (const r of rows) {
      const id = r.user.id.toString();
      const status = statuses.get(id) ?? "offline";
      const visible = presenceVisibleIn(
        { showPresence: r.showPresence ?? true, birthDate: r.birthDate },
        community,
      );
      // You always see yourself as you are.
      if (status !== "offline" && (visible || r.user.id === userId)) {
        presences.push({ userId: id, status, activity: null });
      }
    }
    return {
      members: rows.map((r) =>
        toMember(
          r.member,
          r.user,
          assigned.filter((a) => a.userId === r.user.id).map((a) => a.roleId),
        ),
      ),
      presences,
    };
  }

  /** How many of a Space's members are around right now (as anyone may see it). */
  async hereNow(community: CommunityRow): Promise<number> {
    const rows = await this.db
      .select({
        id: communityMembers.userId,
        birthDate: users.birthDate,
        showPresence: userSettings.showPresence,
      })
      .from(communityMembers)
      .innerJoin(users, eq(users.id, communityMembers.userId))
      .leftJoin(userSettings, eq(userSettings.userId, communityMembers.userId))
      .where(eq(communityMembers.communityId, community.id))
      .limit(1000);
    const statuses = await readPresences(
      this.deps.kv,
      rows.map((r) => r.id.toString()),
    );
    return rows.filter(
      (r) =>
        statuses.get(r.id.toString()) !== "offline" &&
        presenceVisibleIn(
          { showPresence: r.showPresence ?? true, birthDate: r.birthDate },
          community,
        ),
    ).length;
  }

  /** Public Spaces for Explore. Under-18s never see Spaces marked for adults. */
  /**
   * Public Spaces for Explore. Under-18s never see Spaces marked for adults, and don't get the
   * nearby sort. Spaces enough people reported drop out of the list on their own (no one has to
   * review them first).
   */
  async discover(
    userId: bigint | null,
    q: { sort: "active" | "new" | "members" | "nearby"; limit: number; lat?: number; lng?: number },
  ): Promise<DiscoverSpace[]> {
    let minor = false;
    if (userId) {
      const [me] = await this.db
        .select({ birthDate: users.birthDate })
        .from(users)
        .where(eq(users.id, userId));
      minor = me ? isMinor(me.birthDate) : false;
    }
    const nearby = q.sort === "nearby";
    if (nearby && minor) {
      throw new AppError(
        403,
        "AGE_RESTRICTED",
        "Finding Spaces nearby is for people 18 and older.",
      );
    }
    if (nearby && (q.lat === undefined || q.lng === undefined)) {
      throw badRequest("VALIDATION_FAILED", "Nearby needs a place to measure from.");
    }
    // Great-circle distance in km from the point asked about (haversine).
    const distance = nearby
      ? sql<number>`6371 * 2 * asin(sqrt(power(sin(radians(${communities.lat} - ${q.lat}) / 2), 2) + cos(radians(${q.lat})) * cos(radians(${communities.lat})) * power(sin(radians(${communities.lng} - ${q.lng}) / 2), 2)))`
      : null;
    const rows = await this.db
      .select({ c: communities, km: distance ?? sql<null>`null` })
      .from(communities)
      .where(
        and(
          eq(communities.visibility, "public"),
          isNull(communities.deletedAt),
          sql`(${communities.features} & ${UNLISTED}) = 0`,
          minor ? eq(communities.isNsfw, false) : undefined,
          nearby ? sql`${communities.lat} is not null and ${distance} <= ${NEARBY_KM}` : undefined,
        ),
      )
      .orderBy(
        nearby && distance
          ? asc(distance)
          : q.sort === "new"
            ? desc(communities.id)
            : desc(communities.memberCount),
      )
      .limit(q.sort === "active" ? 100 : q.limit);
    const joined = new Set<bigint>();
    if (userId && rows.length) {
      const mine = await this.db
        .select({ id: communityMembers.communityId })
        .from(communityMembers)
        .where(
          and(
            eq(communityMembers.userId, userId),
            inArray(
              communityMembers.communityId,
              rows.map((r) => r.c.id),
            ),
          ),
        );
      for (const m of mine) joined.add(m.id);
    }
    const list = await Promise.all(
      rows.map(async ({ c, km }) => ({
        id: c.id.toString(),
        slug: c.slug,
        name: c.name,
        description: c.description,
        accent: c.accent,
        memberCount: c.memberCount,
        city: c.city,
        createdAt: c.createdAt.toISOString(),
        hereNow: await this.hereNow(c),
        joined: joined.has(c.id),
        distanceKm: typeof km === "number" ? Math.round(km * 10) / 10 : null,
      })),
    );
    if (q.sort === "active") {
      list.sort((a, b) => b.hereNow - a.hereNow || b.memberCount - a.memberCount);
    }
    return list.slice(0, q.limit);
  }

  // ── Creating and changing ──────────────────────────────────────────────────

  private async countMine(userId: bigint) {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(communityMembers)
      .innerJoin(communities, eq(communities.id, communityMembers.communityId))
      .where(and(eq(communityMembers.userId, userId), isNull(communities.deletedAt)));
    return row?.n ?? 0;
  }

  private async freeSlug(wanted: string): Promise<string> {
    let slug = wanted;
    for (let i = 0; i < 8; i++) {
      const [taken] = await this.db
        .select({ id: communities.id })
        .from(communities)
        .where(sql`lower(${communities.slug}) = ${slug}`)
        .limit(1);
      if (!taken) return slug;
      slug = `${wanted.slice(0, Limits.communitySlug.max - 5)}-${randomSuffix()}`;
    }
    throw conflict("CONFLICT", "Couldn't find a free link for that name. Try another name.");
  }

  /**
   * A new Space: you as its owner, the Everyone and Mods roles, and a `#general` room to start
   * in. Boards arrive with posts, so the board room isn't made yet.
   */
  async create(userId: bigint, body: CreateCommunityBody): Promise<SpaceDetail> {
    if ((await this.countMine(userId)) >= Limits.spacesPerUser) {
      throw new AppError(
        403,
        "LIMIT_REACHED",
        `You can be in up to ${Limits.spacesPerUser} Spaces. Leave one to start another.`,
      );
    }
    const slug = await this.freeSlug(body.slug ?? slugify(body.name));
    const id = this.deps.ids.next();
    const general = this.deps.ids.next();
    const community = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(communities)
        .values({
          id,
          slug,
          name: body.name,
          description: body.description || null,
          ownerId: userId,
          accent: body.accent,
          visibility: body.visibility,
          joinPolicy: body.visibility === "public" ? "open" : "invite",
          memberCount: 1,
        })
        .returning();
      if (!row) throw new Error("community insert returned nothing");
      await tx.insert(roles).values([
        // The Space's own ID is its Everyone role (contracts/permissions).
        { id, communityId: id, name: "@everyone", permissions: DEFAULT_EVERYONE_PERMISSIONS },
        {
          id: this.deps.ids.next(),
          communityId: id,
          name: "Mods",
          position: 1,
          permissions: MOD_PERMISSIONS,
          hoist: true,
          mentionable: true,
        },
      ]);
      await tx
        .insert(channels)
        .values({ id: general, type: "text", communityId: id, name: "general" });
      await tx.insert(communityMembers).values({ communityId: id, userId });
      return row;
    });
    const detail = await this.detail(community, userId);
    await this.deps.bus.publish(`user:${userId}`, { type: "COMMUNITY_CREATE", data: detail });
    return detail;
  }

  async update(idOrSlug: string, userId: bigint, body: UpdateCommunityBody) {
    const access = await memberAccess(this.db, idOrSlug, userId);
    requireSpacePermission(access, Permission.MANAGE_COMMUNITY, "change this Space");
    const c = access.community;
    if (body.visibility === "public" && c.visibility === "private") {
      // Flipping a group's history public needs notice and a review window (docs/research §5a).
      throw new AppError(
        400,
        "COMING_SOON",
        "A private Space can't be made public yet. Start a public Space instead.",
      );
    }
    if (body.joinPolicy === "request") {
      throw new AppError(400, "COMING_SOON", "Asking to join is coming soon.");
    }
    const slug =
      body.slug && body.slug !== c.slug.toLowerCase() ? await this.freeSlug(body.slug) : undefined;
    // A new icon or banner must be the changer's own finished image upload.
    for (const id of [body.iconMediaId, body.bannerMediaId]) {
      if (!id) continue;
      const [file] = await this.db
        .select({ kind: schema.media.kind, status: schema.media.status })
        .from(schema.media)
        .where(and(eq(schema.media.id, BigInt(id)), eq(schema.media.ownerId, userId)))
        .limit(1);
      if (file?.kind !== "image" || file.status !== "ready") {
        throw badRequest("UPLOAD_INVALID", "Pick a photo you've uploaded.");
      }
    }
    const picture = (id: string | null | undefined) =>
      id === undefined ? undefined : id === null ? null : BigInt(id);
    const [row] = await this.db
      .update(communities)
      .set({
        name: body.name,
        slug,
        description: body.description === undefined ? undefined : body.description || null,
        visibility: body.visibility,
        accent: body.accent,
        joinPolicy: body.visibility === "private" ? "invite" : (body.joinPolicy ?? undefined),
        isNsfw: body.isNsfw,
        rules: body.rules,
        iconMediaId: picture(body.iconMediaId),
        bannerMediaId: picture(body.bannerMediaId),
        ...(body.location === undefined
          ? {}
          : body.location === null
            ? { city: null, lat: null, lng: null }
            : {
                city: body.location.city,
                lat: roundCoord(body.location.lat),
                lng: roundCoord(body.location.lng),
              }),
      })
      .where(eq(communities.id, c.id))
      .returning();
    if (!row) throw notFound("Space");
    const space = toCommunity(row);
    await this.deps.bus.publish(`community:${row.id}`, { type: "COMMUNITY_UPDATE", data: space });
    return space;
  }

  /** Only the owner can delete a Space. It's hidden at once and kept for a while before purging. */
  async remove(idOrSlug: string, userId: bigint) {
    const access = await memberAccess(this.db, idOrSlug, userId);
    if (!access.isOwner) throw forbidden("Only the Space's owner can delete it.");
    await this.db
      .update(communities)
      .set({ deletedAt: new Date() })
      .where(eq(communities.id, access.community.id));
    await this.deps.bus.publish(`community:${access.community.id}`, {
      type: "COMMUNITY_DELETE",
      data: { id: access.community.id.toString(), unavailable: false },
    });
  }

  async leave(idOrSlug: string, userId: bigint) {
    const access = await memberAccess(this.db, idOrSlug, userId);
    if (access.isOwner) {
      throw new AppError(
        400,
        "OWNER_CANNOT_LEAVE",
        "You own this Space. Delete it, or hand it to someone else first (coming soon).",
      );
    }
    const id = access.community.id;
    await this.db.transaction(async (tx) => {
      await tx
        .delete(memberRoles)
        .where(and(eq(memberRoles.communityId, id), eq(memberRoles.userId, userId)));
      await tx
        .delete(communityMembers)
        .where(and(eq(communityMembers.communityId, id), eq(communityMembers.userId, userId)));
      await tx
        .update(communities)
        .set({ memberCount: sql`greatest(${communities.memberCount} - 1, 0)` })
        .where(eq(communities.id, id));
    });
    await this.deps.bus.publish(`user:${userId}`, {
      type: "COMMUNITY_DELETE",
      data: { id: id.toString(), unavailable: false },
    });
    await this.deps.bus.publish(`community:${id}`, {
      type: "COMMUNITY_MEMBER_REMOVE",
      data: { communityId: id.toString(), userId: userId.toString() },
    });
  }

  /**
   * Adds someone to a Space, from an invite or (public Spaces) straight from Explore. Joining twice
   * is harmless. A short "joined" line goes into the first room so the crew sees who arrived.
   */
  async join(
    community: CommunityRow,
    userId: bigint,
    claim?: (tx: Parameters<Parameters<Deps["db"]["transaction"]>[0]>[0]) => Promise<void>,
    roomId?: bigint | null,
  ): Promise<SpaceDetail> {
    const existing = await loadAccess(this.db, community, userId);
    if (existing.member) return this.detail(community, userId);

    const [ban] = await this.db
      .select({ expiresAt: bans.expiresAt })
      .from(bans)
      .where(
        and(
          eq(bans.communityId, community.id),
          eq(bans.userId, userId),
          or(isNull(bans.expiresAt), gt(bans.expiresAt, new Date())),
        ),
      )
      .limit(1);
    if (ban) throw new AppError(403, "BANNED_FROM_COMMUNITY", "You can't join this Space.");

    const [me] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!me) throw notFound("User");
    if (community.isNsfw && isMinor(me.birthDate)) {
      throw new AppError(403, "AGE_RESTRICTED", "This Space is for people 18 and older.");
    }
    if ((await this.countMine(userId)) >= Limits.spacesPerUser) {
      throw new AppError(
        403,
        "LIMIT_REACHED",
        `You can be in up to ${Limits.spacesPerUser} Spaces. Leave one to join another.`,
      );
    }

    const rooms = await this.db
      .select()
      .from(channels)
      .where(
        and(
          eq(channels.communityId, community.id),
          eq(channels.type, "text"),
          isNull(channels.deletedAt),
        ),
      )
      .orderBy(asc(channels.position), asc(channels.id));
    const room = rooms.find((r) => r.id === roomId) ?? rooms[0];
    const messageId = this.deps.ids.next();

    const joined = await this.db.transaction(async (tx) => {
      await claim?.(tx);
      const inserted = await tx
        .insert(communityMembers)
        .values({ communityId: community.id, userId })
        .onConflictDoNothing()
        .returning();
      if (inserted.length === 0) return null;
      await tx
        .update(communities)
        .set({ memberCount: sql`${communities.memberCount} + 1` })
        .where(eq(communities.id, community.id));
      if (room) {
        const [msg] = await tx
          .insert(messages)
          .values({ id: messageId, channelId: room.id, authorId: userId, type: "system_join" })
          .returning();
        await tx.update(channels).set({ lastMessageId: messageId }).where(eq(channels.id, room.id));
        return msg ?? null;
      }
      return null;
    });

    const fresh = (await findSpace(this.db, community.id.toString())) ?? community;
    const detail = await this.detail(fresh, userId);
    await this.deps.bus.publish(`user:${userId}`, { type: "COMMUNITY_CREATE", data: detail });
    await this.deps.bus.publish(`community:${community.id}`, {
      type: "COMMUNITY_MEMBER_ADD",
      data: detail.self,
    });
    if (joined) {
      await this.deps.bus.publish(`community:${community.id}`, {
        type: "MESSAGE_CREATE",
        data: toMessage(joined, me),
      });
    }
    return detail;
  }

  /** Public, open Spaces can be joined straight from Explore. */
  async joinOpen(idOrSlug: string, userId: bigint) {
    const community = await findSpace(this.db, idOrSlug);
    if (community?.visibility !== "public") throw notFound("Space");
    if (community.joinPolicy !== "open") {
      throw forbidden("This Space is invite only. Ask someone in it for an invite.");
    }
    return this.join(community, userId);
  }

  // ── Rooms ──────────────────────────────────────────────────────────────────

  private async roomNameTaken(communityId: bigint, name: string, except?: bigint) {
    const [taken] = await this.db
      .select({ id: channels.id })
      .from(channels)
      .where(
        and(
          eq(channels.communityId, communityId),
          isNull(channels.deletedAt),
          sql`lower(${channels.name}) = ${name}`,
          except ? sql`${channels.id} <> ${except}` : undefined,
        ),
      )
      .limit(1);
    return Boolean(taken);
  }

  async createRoom(idOrSlug: string, userId: bigint, body: CreateRoomBody) {
    const access = await memberAccess(this.db, idOrSlug, userId);
    requireSpacePermission(access, Permission.MANAGE_CHANNELS, "add rooms");
    if (body.type === "board") {
      throw new AppError(
        400,
        "COMING_SOON",
        "Board rooms arrive with posts. Chat and voice rooms work now.",
      );
    }
    const id = access.community.id;
    if (await this.roomNameTaken(id, body.name)) {
      throw conflict("ROOM_NAME_TAKEN", `There's already a #${body.name} here.`);
    }
    const [count] = await this.db
      .select({
        n: sql<number>`count(*)::int`,
        last: sql<number>`coalesce(max(${channels.position}), -1)::int`,
      })
      .from(channels)
      .where(and(eq(channels.communityId, id), isNull(channels.deletedAt)));
    if ((count?.n ?? 0) >= Limits.roomsPerSpace) {
      throw new AppError(
        403,
        "LIMIT_REACHED",
        `A Space can have up to ${Limits.roomsPerSpace} rooms.`,
      );
    }
    const [row] = await this.db
      .insert(channels)
      .values({
        id: this.deps.ids.next(),
        type: body.type === "voice" ? "voice" : "text",
        communityId: id,
        name: body.name,
        topic: body.topic || null,
        position: (count?.last ?? -1) + 1,
      })
      .returning();
    if (!row) throw new Error("channel insert returned nothing");
    const room = toChannel(row);
    await this.deps.bus.publish(`community:${id}`, { type: "CHANNEL_CREATE", data: room });
    return room;
  }

  async updateRoom(channelId: bigint, userId: bigint, body: UpdateRoomBody) {
    const { channel, access } = await spaceRoomAccess(this.db, channelId, userId);
    requireSpacePermission(access, Permission.MANAGE_CHANNELS, "change rooms");
    if (body.name && (await this.roomNameTaken(access.community.id, body.name, channel.id))) {
      throw conflict("ROOM_NAME_TAKEN", `There's already a #${body.name} here.`);
    }
    const [row] = await this.db
      .update(channels)
      .set({
        name: body.name,
        topic: body.topic === undefined ? undefined : body.topic || null,
      })
      .where(eq(channels.id, channel.id))
      .returning();
    if (!row) throw notFound("Room");
    const room = toChannel(row, await overwritesFor(this.db, [row.id]));
    await this.deps.bus.publish(`community:${access.community.id}`, {
      type: "CHANNEL_UPDATE",
      data: room,
    });
    return room;
  }

  async removeRoom(channelId: bigint, userId: bigint) {
    const { channel, access } = await spaceRoomAccess(this.db, channelId, userId);
    requireSpacePermission(access, Permission.MANAGE_CHANNELS, "delete rooms");
    const [count] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(channels)
      .where(
        and(
          eq(channels.communityId, access.community.id),
          eq(channels.type, "text"),
          isNull(channels.deletedAt),
        ),
      );
    if ((count?.n ?? 0) <= 1) {
      throw badRequest("BAD_REQUEST", "A Space needs at least one room to talk in.");
    }
    await this.db
      .update(channels)
      .set({ deletedAt: new Date() })
      .where(eq(channels.id, channel.id));
    await this.deps.bus.publish(`community:${access.community.id}`, {
      type: "CHANNEL_DELETE",
      data: { id: channel.id.toString(), communityId: access.community.id.toString() },
    });
  }

  // ── Voice ──────────────────────────────────────────────────────────────────

  /**
   * A pass into a voice room (LiveKit). What you may publish follows your permissions: Speak for
   * your microphone, Video for camera and screen. Under 18: voice only in Spaces over 200 people.
   */
  async voiceJoin(channelId: bigint, userId: bigint): Promise<VoiceJoin> {
    const { channel, access, permissions } = await spaceRoomAccess(this.db, channelId, userId);
    if (channel.type !== "voice") throw badRequest("BAD_REQUEST", "That isn't a voice room.");
    if (!has(permissions, Permission.CONNECT)) throw forbidden("You can't join this voice room.");
    const lk = this.deps.livekit;
    if (!lk) {
      throw new AppError(503, "SERVICE_UNAVAILABLE", "Voice isn't set up on this Realm yet.");
    }
    const [me] = await this.db
      .select({ displayName: users.displayName, birthDate: users.birthDate })
      .from(users)
      .where(eq(users.id, userId));
    if (!me) throw notFound("User");
    const canSpeak = has(permissions, Permission.SPEAK);
    const bigSpace = access.community.memberCount > Limits.teenPresenceSpaceSize;
    const canVideo = has(permissions, Permission.VIDEO) && !(isMinor(me.birthDate) && bigSpace);
    const sources: LiveKitSource[] = [
      ...(canSpeak ? (["microphone"] as const) : []),
      ...(canVideo ? (["camera", "screen_share", "screen_share_audio"] as const) : []),
    ];
    const ttl = 10 * 60;
    return {
      url: lk.url,
      token: liveKitToken(lk, {
        identity: userId.toString(),
        name: me.displayName,
        room: `realm-${channel.id}`,
        canPublish: sources.length > 0,
        sources,
        ttlSeconds: ttl,
      }),
      canSpeak,
      canVideo,
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    };
  }
}
