import type { RegionId } from "./map/star-chart";

export interface RegionMeta {
  id: RegionId;
  name: string;
  /** One line under the map label and in the legend. */
  tagline: string;
  /** Section anchor on the landing page. */
  href: string;
}

export const REGIONS: RegionMeta[] = [
  {
    id: "spaces",
    name: "Spaces",
    tagline: "Group chat with a room for every topic",
    href: "#spaces",
  },
  { id: "feed", name: "Feed", tagline: "Posts and clips from your people", href: "#feed" },
  { id: "profiles", name: "Profiles", tagline: "One identity across all of it", href: "#profiles" },
  { id: "boards", name: "Boards", tagline: "Threaded discussion that lasts", href: "#boards" },
];

export const regionById = (id: RegionId) => REGIONS.find((r) => r.id === id) as RegionMeta;
