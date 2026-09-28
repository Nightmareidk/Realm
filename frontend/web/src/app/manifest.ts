import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Realm",
    short_name: "Realm",
    description: SITE.description,
    start_url: "/",
    display: "standalone",
    background_color: "#0b0c1f",
    theme_color: "#0b0c1f",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
