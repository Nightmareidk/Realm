import type { Metadata } from "next";
import { HomeFeed } from "@/features/social/home-feed";

export const metadata: Metadata = { title: "Home" };

/**
 * Home (Look B, the owner's pick 2026-10-22): Stories, posts from people you follow with their
 * songs, and who's around. Everything loads in the browser with your session.
 */
export default function HomePage() {
  return <HomeFeed />;
}
