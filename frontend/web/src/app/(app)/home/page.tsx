import type { Metadata } from "next";
import { HomeWall } from "@/features/app/home-wall";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Home" };

/**
 * Home (the owner's "Wall", 2026-10-05): who's around, what's live, and your Spaces. The live
 * parts come from the realtime store, so the page itself only needs who you are.
 */
export default async function HomePage() {
  const viewer = await getViewer();
  const first = viewer?.displayName.split(/\s+/)[0] ?? "there";
  return <HomeWall firstName={first} emailVerified={viewer?.emailVerified ?? false} />;
}
