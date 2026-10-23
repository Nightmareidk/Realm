import type { Metadata } from "next";
import { SongListView } from "@/features/music/music-views";

export const metadata: Metadata = { title: "Music" };

export default async function MoodPage({ params }: PageProps<"/music/mood/[mood]">) {
  const { mood } = await params;
  return <SongListView key={mood} kind="mood" id={decodeURIComponent(mood)} />;
}
