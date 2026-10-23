import { z } from "zod";
import { Snowflake } from "../ids";
import { Limits } from "../limits";
import { IsoDateTime } from "./common";
import { SpaceLocation } from "./media";
import { ThemeAccent, UserSummary } from "./users";

/** Permission bitfields travel as decimal strings. */
export const PermissionBits = z.string().regex(/^\d{1,20}$/);

export const CommunitySlug = z
  .string()
  .trim()
  .toLowerCase()
  .min(Limits.communitySlug.min)
  .max(Limits.communitySlug.max)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Lowercase letters, numbers and dashes");

export const Visibility = z.enum(["public", "private"]);
export const JoinPolicy = z.enum(["open", "request", "invite"]);

export const Role = z
  .object({
    id: Snowflake,
    communityId: Snowflake,
    name: z.string(),
    color: z.number().int().nullable(),
    position: z.number().int(),
    permissions: PermissionBits,
    hoist: z.boolean(),
    mentionable: z.boolean(),
  })
  .meta({ id: "Role" });
export type Role = z.infer<typeof Role>;

export const Member = z
  .object({
    user: UserSummary,
    communityId: Snowflake,
    nickname: z.string().nullable(),
    roleIds: z.array(Snowflake),
    joinedAt: IsoDateTime,
    timeoutUntil: IsoDateTime.nullable(),
  })
  .meta({ id: "Member" });
export type Member = z.infer<typeof Member>;

export const Community = z
  .object({
    id: Snowflake,
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    iconUrl: z.string().nullable(),
    bannerUrl: z.string().nullable(),
    ownerId: Snowflake,
    /** The Space's colour: its badge and the light behind its header (one of the four themes). */
    accent: ThemeAccent,
    visibility: Visibility,
    joinPolicy: JoinPolicy,
    isNsfw: z.boolean(),
    memberCount: z.number().int(),
    rules: z.array(z.object({ title: z.string(), body: z.string() })),
    /** The city it says it's in; public Spaces with one can be found nearby. */
    city: z.string().nullable(),
    createdAt: IsoDateTime,
  })
  .meta({ id: "Community" });
export type Community = z.infer<typeof Community>;

export const CommunityName = z
  .string()
  .trim()
  .min(Limits.communityName.min, `At least ${Limits.communityName.min} characters`)
  .max(Limits.communityName.max, `At most ${Limits.communityName.max} characters`);

export const CommunityDescription = z.string().trim().max(Limits.communityDescription.max);

/** "Just us" is private and invite-only; "Anyone" is public and open (docs/research §5a). */
export const CreateCommunityBody = z.object({
  name: CommunityName,
  /** Made from the name when left out. */
  slug: CommunitySlug.optional(),
  description: CommunityDescription.optional(),
  visibility: Visibility.default("private"),
  accent: ThemeAccent.default("mint"),
  iconMediaId: Snowflake.optional(),
});
export type CreateCommunityBody = z.infer<typeof CreateCommunityBody>;

// No defaults here: a PATCH must never change a field it didn't name.
export const UpdateCommunityBody = z
  .object({
    name: CommunityName,
    slug: CommunitySlug,
    description: CommunityDescription.nullable(),
    visibility: Visibility,
    accent: ThemeAccent,
    joinPolicy: JoinPolicy,
    isNsfw: z.boolean(),
    iconMediaId: Snowflake.nullable(),
    bannerMediaId: Snowflake.nullable(),
    rules: z.array(z.object({ title: z.string().max(100), body: z.string().max(1000) })).max(20),
    /** Its city (null clears it). */
    location: SpaceLocation.nullable(),
  })
  .partial();
export type UpdateCommunityBody = z.infer<typeof UpdateCommunityBody>;

export const CreateRoleBody = z.object({
  name: z.string().trim().min(Limits.roleName.min).max(Limits.roleName.max),
  color: z.number().int().min(0).max(0xffffff).nullable().optional(),
  permissions: PermissionBits.optional(),
  hoist: z.boolean().optional(),
  mentionable: z.boolean().optional(),
});
export type CreateRoleBody = z.infer<typeof CreateRoleBody>;
export const UpdateRoleBody = CreateRoleBody.partial();
export type UpdateRoleBody = z.infer<typeof UpdateRoleBody>;
/** A new order for the roles you can move, highest first. */
export const ReorderRolesBody = z.object({ roleIds: z.array(Snowflake).min(1).max(250) });
export type ReorderRolesBody = z.infer<typeof ReorderRolesBody>;
/** Most roles a Space can have (Everyone included). */
export const SPACE_ROLE_LIMIT = 100;

export const Invite = z
  .object({
    code: z.string(),
    community: Community.pick({
      id: true,
      slug: true,
      name: true,
      iconUrl: true,
      memberCount: true,
      description: true,
      accent: true,
      visibility: true,
    }),
    /** Room names, for public Spaces only: a private Space shows nothing inside before you join. */
    rooms: z.array(z.string()),
    /** How many members are around right now. */
    hereNow: z.number().int(),
    channelId: Snowflake.nullable(),
    inviter: UserSummary.nullable(),
    expiresAt: IsoDateTime.nullable(),
    maxUses: z.number().int().nullable(),
    uses: z.number().int(),
    createdAt: IsoDateTime,
  })
  .meta({ id: "Invite" });
export type Invite = z.infer<typeof Invite>;

/** Link settings (docs/research §5a): how long it lasts (0 = never) and how many uses (0 = no limit). */
export const INVITE_MAX_AGES = [1800, 3600, 86_400, 604_800, 0] as const;
export const INVITE_MAX_USES = [0, 1, 5, 10, 25] as const;

export const CreateInviteBody = z.object({
  maxAgeSeconds: z.literal(INVITE_MAX_AGES).default(604_800),
  maxUses: z.literal(INVITE_MAX_USES).default(0),
});
export type CreateInviteBody = z.infer<typeof CreateInviteBody>;
