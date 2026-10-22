import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

const PAGES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/download", priority: 0.8, changeFrequency: "weekly" },
  { path: "/signup", priority: 0.7, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.5, changeFrequency: "monthly" },
  { path: "/help", priority: 0.4, changeFrequency: "monthly" },
  { path: "/themes/guide", priority: 0.5, changeFrequency: "monthly" },
  { path: "/terms", priority: 0.3, changeFrequency: "monthly" },
];

/** When this build was made: the public pages change with each release of the site. */
const BUILT = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE.origin}${path}`,
    lastModified: BUILT,
    changeFrequency,
    priority,
  }));
}
