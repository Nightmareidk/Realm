import { ChatCircle, Compass, House, type Icon, Rows, SquaresFour } from "@phosphor-icons/react";

export type Destination = { href: string; label: string; icon: Icon };

/** The five destinations (docs/UX-ARCHITECTURE.md), in the top bar's order. */
export const DESTINATIONS: Destination[] = [
  { href: "/home", label: "Home", icon: House },
  { href: "/spaces", label: "Spaces", icon: SquaresFour },
  { href: "/messages", label: "Messages", icon: ChatCircle },
  { href: "/feed", label: "Feed", icon: Rows },
  { href: "/explore", label: "Explore", icon: Compass },
];

/** Phones put Messages after Feed; Explore lives behind the search button in the header. */
export const TABS: string[] = ["/home", "/spaces", "/feed", "/messages"];

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
