import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The asset renderer is a dev tool, and the API is not for crawling.
      disallow: ["/render-3d", "/api/"],
    },
    sitemap: `${SITE.origin}/sitemap.xml`,
  };
}
