import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSIONS,
  computeBasePermissions,
  computeChannelPermissions,
  DEFAULT_EVERYONE_PERMISSIONS,
  has,
  type MemberContext,
  PERMISSION_GROUPS,
  Permission,
} from "./permissions";

const COMMUNITY = "100";
const MOD_ROLE = "200";
const MUTED_ROLE = "300";

const ctx = (overrides: Partial<MemberContext> = {}): MemberContext => ({
  userId: "1",
  ownerId: "999",
  communityId: COMMUNITY,
  roles: [
    { id: COMMUNITY, permissions: DEFAULT_EVERYONE_PERMISSIONS },
    { id: MOD_ROLE, permissions: Permission.MANAGE_MESSAGES | Permission.KICK_MEMBERS },
    { id: MUTED_ROLE, permissions: 0n },
  ],
  memberRoleIds: [],
  now: 1_000,
  ...overrides,
});

describe("base permissions", () => {
  it("gives the owner everything", () => {
    expect(computeBasePermissions(ctx({ userId: "999" }))).toBe(ALL_PERMISSIONS);
  });

  it("unions @everyone with assigned roles", () => {
    const p = computeBasePermissions(ctx({ memberRoleIds: [MOD_ROLE] }));
    expect(has(p, Permission.SEND_MESSAGES)).toBe(true);
    expect(has(p, Permission.KICK_MEMBERS)).toBe(true);
    expect(has(p, Permission.BAN_MEMBERS)).toBe(false);
  });

  it("treats ADMINISTRATOR as all permissions", () => {
    const c = ctx({ memberRoleIds: ["400"] });
    const roles = [...c.roles, { id: "400", permissions: Permission.ADMINISTRATOR }];
    expect(computeBasePermissions({ ...c, roles })).toBe(ALL_PERMISSIONS);
  });

  it("restricts timed-out members to reading", () => {
    const p = computeBasePermissions(ctx({ timeoutUntil: 5_000 }));
    expect(has(p, Permission.VIEW_CHANNEL)).toBe(true);
    expect(has(p, Permission.SEND_MESSAGES)).toBe(false);
  });
});

describe("channel overwrites", () => {
  it("applies @everyone deny, then role allow, then member deny", () => {
    const overwrites = [
      { targetType: "role", targetId: COMMUNITY, allow: 0n, deny: Permission.SEND_MESSAGES },
      { targetType: "role", targetId: MOD_ROLE, allow: Permission.SEND_MESSAGES, deny: 0n },
    ] as const;

    const member = computeChannelPermissions(ctx(), overwrites);
    expect(has(member, Permission.SEND_MESSAGES)).toBe(false);

    const mod = computeChannelPermissions(ctx({ memberRoleIds: [MOD_ROLE] }), overwrites);
    expect(has(mod, Permission.SEND_MESSAGES)).toBe(true);

    const mutedMod = computeChannelPermissions(ctx({ memberRoleIds: [MOD_ROLE] }), [
      ...overwrites,
      { targetType: "member", targetId: "1", allow: 0n, deny: Permission.SEND_MESSAGES },
    ]);
    expect(has(mutedMod, Permission.SEND_MESSAGES)).toBe(false);
  });

  it("role denies lose to role allows at the same level", () => {
    const p = computeChannelPermissions(ctx({ memberRoleIds: [MOD_ROLE, MUTED_ROLE] }), [
      { targetType: "role", targetId: MUTED_ROLE, allow: 0n, deny: Permission.SEND_MESSAGES },
      { targetType: "role", targetId: MOD_ROLE, allow: Permission.SEND_MESSAGES, deny: 0n },
    ]);
    expect(has(p, Permission.SEND_MESSAGES)).toBe(true);
  });

  it("returns nothing when the channel can't be seen", () => {
    const p = computeChannelPermissions(ctx(), [
      { targetType: "role", targetId: COMMUNITY, allow: 0n, deny: Permission.VIEW_CHANNEL },
    ]);
    expect(p).toBe(0n);
  });

  it("drops send-dependent permissions when sending is denied", () => {
    const p = computeChannelPermissions(ctx(), [
      { targetType: "role", targetId: COMMUNITY, allow: 0n, deny: Permission.SEND_MESSAGES },
    ]);
    expect(has(p, Permission.ATTACH_FILES)).toBe(false);
    expect(has(p, Permission.READ_MESSAGE_HISTORY)).toBe(true);
  });

  it("administrators bypass overwrites", () => {
    const p = computeChannelPermissions(ctx({ userId: "999" }), [
      { targetType: "role", targetId: COMMUNITY, allow: 0n, deny: Permission.VIEW_CHANNEL },
    ]);
    expect(p).toBe(ALL_PERMISSIONS);
  });
});

describe("permission labels", () => {
  it("names every permission exactly once, in plain words", () => {
    const keys = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual(Object.keys(Permission).sort());
  });
});
