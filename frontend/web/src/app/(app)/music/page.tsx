import type { Metadata } from "next";
import { MusicHomeView } from "@/features/music/music-views";

export const metadata: Metadata = { title: "Music" };

export default function MusicPage() {
  return <MusicHomeView />;
}
