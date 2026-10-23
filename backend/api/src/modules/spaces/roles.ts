import {
  ALL_PERMISSIONS,
  type CreateRoleBody,
  Permission,
  parsePermissions,
  type Role,
  SPACE_ROLE_LIMIT,
  type UpdateRoleBody,
} from "@realm/contracts";
import { and, eq, gt, gte, schema, sql } from "@realm/db";
import type { Deps } from "../../deps";
import { badRequest, forbidden, notFound } from "../../lib/errors";
import { toRole } from "../../lib/serialize-spaces";
import { memberAccess, rankOf, requireSpacePermission, type SpaceAccess } from "./access";

const { roles, memberRoles, channelOverwrites, auditLog } = schema;

/**
 * A Space's roles. The rules are the usual ones for chat servers: you need Manage roles, you only
 * touch roles below your own highest one, and you can't hand out (or take away) a permission you
 * don't have yourself. The owner stands above everything. Everyone (the Space's own ID) is the base
 * every member gets: its permissions can change, its name can't, and it can't be deleted.
 */
export class RolesService {
  constructor(private readonly deps: Deps) {}

  private get db() {
    return this.deps.db;
  }

  private async manager(space: string, actorId: bigint) {
    const access = await memberAccess(this.db, space, actorId);
    requireSpacePermission(access, Permission.MANAGE_ROLES, "manage roles");
    return { access, rank: rankOf(access, actorId, access.memberRoleIds) };
  }

  /** Only permissions the actor holds may change hands (owners and admins hold them all). */
  private checkGrant(access: SpaceAccess, changed: bigint) {
    if ((changed & ~access.base) !== 0n) {
      throw forbidden("You can only give or take away permissions you have yourself.");
    }
  }

  private find(access: SpaceAccess, roleId: bigint, rank: number) {
    const role = access.roles.find((r) => r.id === roleId);
    if (!role) throw notFound("Role");
    if (role.position >= rank) {
      throw forbidden("That role is at your level or above, so only someone higher can change it.");
    }
    return role;
  }

  private async log(spaceId: bigint, actorId: bigint, action: string, roleId: bigint | null) {
    await this.db.insert(auditLog).values({
      id: this.deps.ids.next(),
      communityId: spaceId,
      actorId,
      action,
      targetType: roleId === null ? "community" : "role",
      targetId: roleId ?? spaceId,
    });
  }

  private async announce(spaceId: bigint, type: "COMMUNITY_ROLE_UPDATE", list: Role[]) {
    for (const role of list) {
      await this.deps.bus.publish(`community:${spaceId}`, { type, data: role });
    }
  }

  async create(space: string, actorId: bigint, body: CreateRoleBody): Promise<Role> {
    const { access, rank } = await this.manager(space, actorId);
    const spaceId = access.community.id;
    if (rank < 1) throw forbidden("You need a role of your own before you can make new ones.");
    if (access.roles.length >= SPACE_ROLE_LIMIT) {
      throw badRequest("LIMIT_REACHED", `A Space can have up to ${SPACE_ROLE_LIMIT} roles.`);
    }
    const name = body.name.trim();
    if (name.startsWith("@"))
      throw badRequest("VALIDATION_FAILED", "Role names can't start with @.");
    const permissions = parsePermissions(body.permissions ?? "0") & ALL_PERMISSIONS;
    this.checkGrant(access, permissions);

    // New roles start at the bottom, just above Everyone; the rest move up one.
    const id = this.deps.ids.next();
    const row = await this.db.transaction(async (tx) => {
      await tx
        .update(roles)
        .set({ position: sql`${roles.position} + 1` })
        .where(and(eq(roles.communityId, spaceId), gte(roles.position, 1)));
      const [created] = await tx
        .insert(roles)
        .values({
          id,
          communityId: spaceId,
          name,
          color: body.color ?? null,
          position: 1,
          permissions,
          hoist: body.hoist ?? false,
          mentionable: body.mentionable ?? false,
        })
        .returning();
      return created;
    });
    if (!row) throw new Error("role insert returned nothing");
    await this.log(spaceId, actorId, "role.create", id);
    const role = toRole(row);
    await this.deps.bus.publish(`community:${spaceId}`, {
      type: "COMMUNITY_ROLE_CREATE",
      data: role,
    });
    return role;
  }

  async update(
    space: string,
    actorId: bigint,
    roleId: bigint,
    body: UpdateRoleBody,
  ): Promise<Role> {
    const { access, rank } = await this.manager(space, actorId);
    const spaceId = access.community.id;
    const role = this.find(access, roleId, rank);
    const everyone = role.id === spaceId;
    if (everyone && (body.name !== undefined || body.color !== undefined)) {
      throw badRequest("VALIDATION_FAILED", "Everyone's name and colour stay as they are.");
    }
    const name = body.name?.trim();
    if (name?.startsWith("@"))
      throw badRequest("VALIDATION_FAILED", "Role names can't start with @.");

    const set: Partial<typeof roles.$inferInsert> = {};
    if (name !== undefined) set.name = name;
    if (body.color !== undefined) set.color = body.color;
    if (body.hoist !== undefined && !everyone) set.hoist = body.hoist;
    if (body.mentionable !== undefined && !everyone) set.mentionable = body.mentionable;
    if (body.permissions !== undefined) {
      const next = parsePermissions(body.permissions) & ALL_PERMISSIONS;
      this.checkGrant(access, next ^ role.permissions);
      set.permissions = next;
    }
    if (Object.keys(set).length === 0) return toRole(role);

    const [row] = await this.db.update(roles).set(set).where(eq(roles.id, role.id)).returning();
    if (!row) throw notFound("Role");
    await this.log(spaceId, actorId, "role.update", role.id);
    const updated = toRole(row);
    await this.announce(spaceId, "COMMUNITY_ROLE_UPDATE", [updated]);
    return updated;
  }

  async remove(space: string, actorId: bigint, roleId: bigint) {
    const { access, rank } = await this.manager(space, actorId);
    const spaceId = access.community.id;
    const role = this.find(access, roleId, rank);
    if (role.id === spaceId) throw badRequest("BAD_REQUEST", "Everyone can't be deleted.");

    await this.db.transaction(async (tx) => {
      await tx.delete(memberRoles).where(eq(memberRoles.roleId, role.id));
      await tx
        .delete(channelOverwrites)
        .where(
          and(eq(channelOverwrites.targetType, "role"), eq(channelOverwrites.targetId, role.id)),
        );
      await tx.delete(roles).where(eq(roles.id, role.id));
      // Close the gap it leaves.
      await tx
        .update(roles)
        .set({ position: sql`${roles.position} - 1` })
        .where(and(eq(roles.communityId, spaceId), gt(roles.position, role.position)));
    });
    await this.log(spaceId, actorId, "role.delete", role.id);
    await this.deps.bus.publish(`community:${spaceId}`, {
      type: "COMMUNITY_ROLE_DELETE",
      data: { communityId: spaceId.toString(), roleId: role.id.toString() },
    });
  }

  /**
   * A new order for the roles below you, highest first. They swap among the places they already
   * hold, so nothing at or above you moves.
   */
  async reorder(space: string, actorId: bigint, roleIds: readonly string[]): Promise<Role[]> {
    const { access, rank } = await this.manager(space, actorId);
    const spaceId = access.community.id;
    const movable = access.roles.filter((r) => r.id !== spaceId && r.position < rank);
    const wanted = roleIds.map(BigInt);
    const same =
      wanted.length === movable.length &&
      new Set(wanted).size === wanted.length &&
      wanted.every((id) => movable.some((r) => r.id === id));
    if (!same) {
      throw badRequest(
        "VALIDATION_FAILED",
        "List every role below yours, once each, highest first.",
      );
    }
    const places = movable.map((r) => r.position).sort((a, b) => b - a);
    const changes = wanted
      .map((id, i) => ({ id, position: places[i] ?? 1 }))
      .filter((c) => movable.find((r) => r.id === c.id)?.position !== c.position);
    if (changes.length === 0) return access.roles.map(toRole);

    const updated = await this.db.transaction(async (tx) => {
      const rows = [];
      for (const c of changes) {
        const [row] = await tx
          .update(roles)
          .set({ position: c.position })
          .where(and(eq(roles.id, c.id), eq(roles.communityId, spaceId)))
          .returning();
        if (row) rows.push(row);
      }
      return rows;
    });
    await this.log(spaceId, actorId, "role.reorder", null);
    await this.announce(spaceId, "COMMUNITY_ROLE_UPDATE", updated.map(toRole));
    const byId = new Map(updated.map((r) => [r.id, r]));
    return access.roles.map((r) => toRole(byId.get(r.id) ?? r));
  }
}
