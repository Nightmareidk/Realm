import type { Metadata } from "next";
import { SongListView } from "@/features/music/music-views";

export const metadata: Metadata = { title: "Liked songs" };

export default function LikedPage() {
  return <SongListView kind="liked" />;
}
