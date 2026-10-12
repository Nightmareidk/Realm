import {
  isMinor,
  type PublicUser,
  type SelfUser,
  type SessionInfo,
  type UserSettings,
} from "@realm/contracts";
import type { schema } from "@realm/db";

type UserRow = typeof schema.users.$inferSelect;
type SessionRow = typeof schema.sessions.$inferSelect;
type SettingsRow = typeof schema.userSettings.$inferSelect;

/**
 * Where a client reads an upload: through the API (`/api` on the web origin), which checks access
 * and then hands over a short-lived storage link. Never a public bucket address.
 */
export const mediaUrl = (id: bigint | string) => `/api/v1/media/${id}/raw`;

export function toPublicUser(u: UserRow): PublicUser {
  return {
    id: u.id.toString(),
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarMediaId ? mediaUrl(u.avatarMediaId) : null,
    bannerUrl: u.bannerMediaId ? mediaUrl(u.bannerMediaId) : null,
    accentColor: u.accentColor,
    bio: u.bio,
    pronouns: u.pronouns,
    createdAt: u.createdAt.toISOString(),
  };
}

export function toSelfUser(u: UserRow): SelfUser {
  return {
    ...toPublicUser(u),
    email: u.email,
    emailVerified: u.emailVerifiedAt !== null,
    teen: isMinor(u.birthDate),
  };
}

export function toSessionInfo(s: SessionRow, currentSessionId: bigint | null): SessionInfo {
  return {
    id: s.id.toString(),
    platform: s.platform,
    deviceName: s.deviceName,
    country: s.country,
    createdAt: s.createdAt.toISOString(),
    lastActiveAt: s.lastActiveAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    current: s.id === currentSessionId,
  };
}

export function toUserSettings(s: SettingsRow): UserSettings {
  return {
    theme: s.theme,
    accent: s.accent,
    reducedMotion: s.reducedMotion,
    locale: s.locale,
    profileVisibility: s.profileVisibility,
    dmPolicy: s.dmPolicy,
    friendRequestPolicy: s.friendRequestPolicy,
    showPresence: s.showPresence,
    showReadReceipts: s.showReadReceipts,
  };
}
