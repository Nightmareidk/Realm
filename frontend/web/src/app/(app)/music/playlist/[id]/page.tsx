import type { Metadata } from "next";
import { SongListView } from "@/features/music/music-views";

export const metadata: Metadata = { title: "Playlist" };

export default async function PlaylistPage({ params }: PageProps<"/music/playlist/[id]">) {
  const { id } = await params;
  return <SongListView key={id} kind="playlist" id={decodeURIComponent(id)} />;
}
