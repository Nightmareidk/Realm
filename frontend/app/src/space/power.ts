import { ALL_PERMISSIONS, has, type Member, type Role, type SpaceDetail } from "@realm/contracts";

/** A role's colour as CSS (#rrggbb), or null for "no colour". */
export const roleColour = (r: Pick<Role, "color">) =>
  r.color === null ? null : `#${r.color.toString(16).padStart(6, "0")}`;

/** How high someone stands in a Space: their highest role (the owner is above everyone). */
export function rankIn(space: SpaceDetail, userId: string, roleIds: readonly string[]) {
  if (space.ownerId === userId) return Number.POSITIVE_INFINITY;
  return Math.max(0, ...space.roles.filter((r) => roleIds.includes(r.id)).map((r) => r.position));
}

/**
 * What you may do in a Space, worked out the same way the server does (the server still checks
 * every action; this only decides which buttons to show).
 */
export function powerIn(space: SpaceDetail) {
  const me = space.self.user.id;
  const owner = space.ownerId === me;
  const perms = owner
    ? ALL_PERMISSIONS
    : space.roles
        .filter((r) => r.id === space.id || space.self.roleIds.includes(r.id))
        .reduce((all, r) => all | BigInt(r.permissions), 0n);
  const rank = rankIn(space, me, space.self.roleIds);
  return {
    owner,
    perms,
    rank,
    can: (bit: bigint) => owner || has(perms, bit),
    /** Someone you may act on: not you, not the owner, and below you. */
    above: (m: Member) =>
      m.user.id !== me && m.user.id !== space.ownerId && rankIn(space, m.user.id, m.roleIds) < rank,
  };
}

/** Roles from the top down, Everyone last. */
export const rolesTopDown = (space: SpaceDetail) =>
  [...space.roles].sort((a, b) => {
    if (a.id === space.id) return 1;
    if (b.id === space.id) return -1;
    return b.position - a.position;
  });
