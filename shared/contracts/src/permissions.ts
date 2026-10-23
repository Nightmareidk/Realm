/**
 * Community permissions: a 64-bit bitfield per role, plus per-channel overwrites.
 * The same resolver runs on clients (to shape UI) and on the server (the authority).
 * Serialized as decimal strings on the wire.
 */

const bit = (n: number) => 1n << BigInt(n);

export const Permission = {
  VIEW_CHANNEL: bit(0),
  SEND_MESSAGES: bit(1),
  READ_MESSAGE_HISTORY: bit(2),
  ADD_REACTIONS: bit(3),
  ATTACH_FILES: bit(4),
  EMBED_LINKS: bit(5),
  MENTION_EVERYONE: bit(6),
  MANAGE_MESSAGES: bit(7),
  PIN_MESSAGES: bit(8),
  CREATE_POSTS: bit(9),
  COMMENT: bit(10),
  MANAGE_POSTS: bit(11),
  MANAGE_CHANNELS: bit(12),
  MANAGE_ROLES: bit(13),
  MANAGE_COMMUNITY: bit(14),
  CREATE_INVITES: bit(15),
  KICK_MEMBERS: bit(16),
  BAN_MEMBERS: bit(17),
  TIMEOUT_MEMBERS: bit(18),
  CHANGE_NICKNAME: bit(19),
  MANAGE_NICKNAMES: bit(20),
  VIEW_AUDIT_LOG: bit(21),
  MODERATE_REPORTS: bit(22),
  // Voice (Phase 3) — reserved now so role data never needs migrating.
  CONNECT: bit(23),
  SPEAK: bit(24),
  VIDEO: bit(25),
  MUTE_MEMBERS: bit(26),
  DEAFEN_MEMBERS: bit(27),
  MOVE_MEMBERS: bit(28),
  PRIORITY_SPEAKER: bit(29),
  /** Bypasses every check and every channel overwrite. */
  ADMINISTRATOR: bit(40),
} as const;

export type PermissionName = keyof typeof Permission;

export const ALL_PERMISSIONS: bigint = Object.values(Permission).reduce((acc, p) => acc | p, 0n);

/** What `@everyone` can do in a freshly created community. */
export const DEFAULT_EVERYONE_PERMISSIONS: bigint =
  Permission.VIEW_CHANNEL |
  Permission.SEND_MESSAGES |
  Permission.READ_MESSAGE_HISTORY |
  Permission.ADD_REACTIONS |
  Permission.ATTACH_FILES |
  Permission.EMBED_LINKS |
  Permission.CREATE_POSTS |
  Permission.COMMENT |
  Permission.CREATE_INVITES |
  Permission.CHANGE_NICKNAME |
  Permission.CONNECT |
  Permission.SPEAK |
  Permission.VIDEO;

/** A timed-out member may read but not participate. */
const TIMEOUT_ALLOWED = Permission.VIEW_CHANNEL | Permission.READ_MESSAGE_HISTORY;

/** Permissions that are meaningless without the ability to send. */
const REQUIRES_SEND =
  Permission.MENTION_EVERYONE | Permission.ATTACH_FILES | Permission.EMBED_LINKS;

export function has(permissions: bigint, required: bigint): boolean {
  if ((permissions & Permission.ADMINISTRATOR) === Permission.ADMINISTRATOR) return true;
  return (permissions & required) === required;
}

export function toPermissionNames(permissions: bigint): PermissionName[] {
  return (Object.keys(Permission) as PermissionName[]).filter(
    (name) => (permissions & Permission[name]) === Permission[name],
  );
}

export interface RoleLike {
  id: string;
  permissions: bigint;
}

export interface OverwriteLike {
  targetType: "role" | "member";
  targetId: string;
  allow: bigint;
  deny: bigint;
}

export interface MemberContext {
  userId: string;
  ownerId: string;
  /** The community ID — also the ID of its `@everyone` role. */
  communityId: string;
  /** All roles in the community (the resolver picks the ones it needs). */
  roles: readonly RoleLike[];
  /** Role IDs assigned to this member (excluding `@everyone`). */
  memberRoleIds: readonly string[];
  /** Epoch ms; when in the future the member is timed out. */
  timeoutUntil?: number | null;
  now?: number;
}

/** Community-wide permissions, before channel overwrites. */
export function computeBasePermissions(ctx: MemberContext): bigint {
  if (ctx.userId === ctx.ownerId) return ALL_PERMISSIONS;

  const everyone = ctx.roles.find((r) => r.id === ctx.communityId);
  let permissions = everyone?.permissions ?? 0n;
  const assigned = new Set(ctx.memberRoleIds);
  for (const role of ctx.roles) {
    if (assigned.has(role.id)) permissions |= role.permissions;
  }

  if ((permissions & Permission.ADMINISTRATOR) === Permission.ADMINISTRATOR) return ALL_PERMISSIONS;

  const now = ctx.now ?? Date.now();
  if (ctx.timeoutUntil != null && ctx.timeoutUntil > now) {
    permissions &= TIMEOUT_ALLOWED;
  }
  return permissions;
}

/**
 * Effective permissions in one channel. Order (last wins):
 * base → @everyone overwrite → role overwrites (all denies, then all allows) → member overwrite.
 */
export function computeChannelPermissions(
  ctx: MemberContext,
  overwrites: readonly OverwriteLike[],
): bigint {
  const base = computeBasePermissions(ctx);
  if (base === ALL_PERMISSIONS) return ALL_PERMISSIONS;

  let permissions = base;

  const everyone = overwrites.find(
    (o) => o.targetType === "role" && o.targetId === ctx.communityId,
  );
  if (everyone) permissions = (permissions & ~everyone.deny) | everyone.allow;

  const assigned = new Set(ctx.memberRoleIds);
  let allow = 0n;
  let deny = 0n;
  for (const o of overwrites) {
    if (o.targetType === "role" && o.targetId !== ctx.communityId && assigned.has(o.targetId)) {
      allow |= o.allow;
      deny |= o.deny;
    }
  }
  permissions = (permissions & ~deny) | allow;

  const member = overwrites.find((o) => o.targetType === "member" && o.targetId === ctx.userId);
  if (member) permissions = (permissions & ~member.deny) | member.allow;

  // Timeouts win over overwrites.
  const now = ctx.now ?? Date.now();
  if (ctx.timeoutUntil != null && ctx.timeoutUntil > now) permissions &= TIMEOUT_ALLOWED;

  // Can't see it → can't do anything in it.
  if ((permissions & Permission.VIEW_CHANNEL) === 0n) return 0n;
  // Can't send → dependent permissions are meaningless.
  if ((permissions & Permission.SEND_MESSAGES) === 0n) permissions &= ~REQUIRES_SEND;

  return permissions;
}

export const serializePermissions = (p: bigint): string => p.toString();
export const parsePermissions = (s: string): bigint => BigInt(s);

/**
 * Every permission in plain words, in the groups the role editors show them in (app and website
 * alike). `danger` ones get a warning before they're switched on.
 */
export const PERMISSION_GROUPS: {
  title: string;
  items: { key: PermissionName; label: string; line: string; danger?: boolean }[];
}[] = [
  {
    title: "The Space",
    items: [
      {
        key: "VIEW_CHANNEL",
        label: "See rooms",
        line: "Open and read the rooms they're allowed in.",
      },
      { key: "CREATE_INVITES", label: "Invite people", line: "Make invite links." },
      {
        key: "CHANGE_NICKNAME",
        label: "Change their nickname",
        line: "Pick a different name here.",
      },
      {
        key: "MANAGE_CHANNELS",
        label: "Manage rooms",
        line: "Make, rename, sort and delete rooms.",
      },
      {
        key: "MANAGE_ROLES",
        label: "Manage roles",
        line: "Make and change roles below their own, and give them out.",
      },
      {
        key: "MANAGE_COMMUNITY",
        label: "Manage the Space",
        line: "Change its name, picture, rules and who can join.",
      },
      { key: "VIEW_AUDIT_LOG", label: "See the audit log", line: "See everything moderators did." },
    ],
  },
  {
    title: "Members",
    items: [
      {
        key: "TIMEOUT_MEMBERS",
        label: "Time people out",
        line: "Stop someone talking for a while.",
      },
      {
        key: "KICK_MEMBERS",
        label: "Remove people",
        line: "Put someone out. They can come back with an invite.",
      },
      { key: "BAN_MEMBERS", label: "Ban people", line: "Keep someone out for good.", danger: true },
      {
        key: "MANAGE_NICKNAMES",
        label: "Change others' nicknames",
        line: "Fix a name that breaks the rules.",
      },
      {
        key: "MODERATE_REPORTS",
        label: "Handle reports",
        line: "See what people reported and deal with it.",
      },
    ],
  },
  {
    title: "Chat",
    items: [
      { key: "SEND_MESSAGES", label: "Send messages", line: "Talk in rooms." },
      { key: "READ_MESSAGE_HISTORY", label: "Read old messages", line: "Scroll back past today." },
      { key: "ADD_REACTIONS", label: "React", line: "Add new reactions to messages." },
      { key: "ATTACH_FILES", label: "Send photos and files", line: "Attach things to messages." },
      { key: "EMBED_LINKS", label: "Link previews", line: "Links they send show a preview." },
      {
        key: "MENTION_EVERYONE",
        label: "Mention @everyone",
        line: "Ping every member at once.",
      },
      { key: "PIN_MESSAGES", label: "Pin messages", line: "Keep messages at the top of a room." },
      {
        key: "MANAGE_MESSAGES",
        label: "Delete others' messages",
        line: "Clean up what breaks the rules.",
      },
    ],
  },
  {
    title: "Boards",
    items: [
      { key: "CREATE_POSTS", label: "Post", line: "Start threads on boards." },
      { key: "COMMENT", label: "Comment", line: "Reply under posts." },
      { key: "MANAGE_POSTS", label: "Remove others' posts", line: "Take down posts and comments." },
    ],
  },
  {
    title: "Voice",
    items: [
      { key: "CONNECT", label: "Join voice rooms", line: "Go in and listen." },
      { key: "SPEAK", label: "Talk", line: "Use their mic." },
      { key: "VIDEO", label: "Camera and screen", line: "Turn on their camera or share a screen." },
      {
        key: "PRIORITY_SPEAKER",
        label: "Speak over others",
        line: "Others go quieter when they talk.",
      },
      { key: "MUTE_MEMBERS", label: "Mute others", line: "Turn off someone's mic." },
      { key: "DEAFEN_MEMBERS", label: "Deafen others", line: "Stop someone hearing the room." },
      { key: "MOVE_MEMBERS", label: "Move people", line: "Move someone to another voice room." },
    ],
  },
  {
    title: "Everything",
    items: [
      {
        key: "ADMINISTRATOR",
        label: "Administrator",
        line: "Every permission, in every room. Only for people you trust completely.",
        danger: true,
      },
    ],
  },
];
