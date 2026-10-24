import {
  ChatCircle,
  Heart,
  House,
  type Icon,
  MagnifyingGlass,
  MusicNotes,
  PlayCircle,
} from "@phosphor-icons/react";

export type Destination = { href: string; label: string; icon: Icon };

/**
 * Where you can go (Look B, the owner's pick 2026-10-22): Home, Search, Clips, Music, Messages
 * and Activity, then Create. Your Spaces and chats sit in "Your places" below.
 */
export const DESTINATIONS: Destination[] = [
  { href: "/home", label: "Home", icon: House },
  { href: "/explore", label: "Search", icon: MagnifyingGlass },
  { href: "/clips", label: "Clips", icon: PlayCircle },
  { href: "/music", label: "Music", icon: MusicNotes },
  { href: "/messages", label: "Messages", icon: ChatCircle },
  { href: "/activity", label: "Activity", icon: Heart },
];

/** Phones: four tabs and you. */
export const TABS: string[] = ["/home", "/explore", "/clips", "/messages"];

/** Settings, in groups (docs/research/2026-10-phase1-app-shell.md §7.6). */
export const SETTINGS: {
  group: string;
  items: { href: string; label: string; soon?: boolean }[];
}[] = [
  {
    group: "You",
    items: [
      { href: "/settings/account", label: "Account" },
      { href: "/settings/profile", label: "Profile" },
      { href: "/settings/privacy", label: "Privacy and safety" },
      { href: "/settings/verification", label: "Verification" },
    ],
  },
  {
    group: "App",
    items: [
      { href: "/settings/themes", label: "Themes" },
      { href: "/settings/appearance", label: "Appearance" },
      { href: "/settings/notifications", label: "Notifications" },
    ],
  },
  { group: "Security", items: [{ href: "/settings/devices", label: "Devices" }] },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
