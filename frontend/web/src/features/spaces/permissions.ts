import {
  type Channel,
  computeBasePermissions,
  computeChannelPermissions,
  has,
  type MemberContext,
  Permission,
  type SpaceDetail,
} from "@realm/contracts";

/**
 * The same resolver the server uses, run here only to shape the interface (which buttons show).
 * The server stays the authority on every action.
 */
function context(space: SpaceDetail): MemberContext {
  return {
    userId: space.self.user.id,
    ownerId: space.ownerId,
    communityId: space.id,
    roles: space.roles.map((r) => ({ id: r.id, permissions: BigInt(r.permissions) })),
    memberRoleIds: space.self.roleIds,
    timeoutUntil: space.self.timeoutUntil ? Date.parse(space.self.timeoutUntil) : null,
  };
}

export function spaceCan(space: SpaceDetail, bit: bigint) {
  return has(computeBasePermissions(context(space)), bit);
}

export function roomCan(space: SpaceDetail, room: Channel, bit: bigint) {
  const perms = computeChannelPermissions(
    context(space),
    room.overwrites.map((o) => ({
      targetType: o.targetType,
      targetId: o.targetId,
      allow: BigInt(o.allow),
      deny: BigInt(o.deny),
    })),
  );
  return has(perms, bit);
}

export { Permission };
