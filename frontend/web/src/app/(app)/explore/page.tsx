import type { Metadata } from "next";
import { SearchView } from "@/features/social/search-view";

export const metadata: Metadata = { title: "Search" };

/** Search and Explore: people, Spaces and songs, and a grid of what's good right now. */
export default function ExplorePage() {
  return <SearchView />;
}
