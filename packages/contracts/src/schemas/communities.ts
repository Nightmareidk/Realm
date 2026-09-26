import { z } from "zod";
import { Snowflake } from "../ids";
import { Limits } from "../limits";
import { IsoDateTime } from "./common";
import { UserSummary } from "./users";

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
    iconUrl: z.url().nullable(),
    bannerUrl: z.url().nullable(),
    ownerId: Snowflake,
    visibility: Visibility,
    joinPolicy: JoinPolicy,
    isNsfw: z.boolean(),
    memberCount: z.number().int(),
    rules: z.array(z.object({ title: z.string(), body: z.string() })),
    createdAt: IsoDateTime,
  })
  .meta({ id: "Community" });
export type Community = z.infer<typeof Community>;

export const CreateCommunityBody = z.object({
  name: z.string().trim().min(Limits.communityName.min).max(Limits.communityName.max),
  slug: CommunitySlug,
  description: z.string().trim().max(Limits.communityDescription.max).optional(),
  visibility: Visibility.default("private"),
  iconMediaId: Snowflake.optional(),
});
export type CreateCommunityBody = z.infer<typeof CreateCommunityBody>;

export const UpdateCommunityBody = CreateCommunityBody.extend({
  joinPolicy: JoinPolicy,
  isNsfw: z.boolean(),
  bannerMediaId: Snowflake.nullable(),
  rules: z.array(z.object({ title: z.string().max(100), body: z.string().max(1000) })).max(20),
}).partial();

export const CreateRoleBody = z.object({
  name: z.string().trim().min(Limits.roleName.min).max(Limits.roleName.max),
  color: z.number().int().min(0).max(0xffffff).nullable().optional(),
  permissions: PermissionBits.optional(),
  hoist: z.boolean().optional(),
  mentionable: z.boolean().optional(),
});
export const UpdateRoleBody = CreateRoleBody.partial();

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
    }),
    channelId: Snowflake.nullable(),
    inviter: UserSummary.nullable(),
    expiresAt: IsoDateTime.nullable(),
    maxUses: z.number().int().nullable(),
    uses: z.number().int(),
  })
  .meta({ id: "Invite" });
export type Invite = z.infer<typeof Invite>;
