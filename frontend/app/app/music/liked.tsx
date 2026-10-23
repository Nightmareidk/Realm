import type { SoundList } from "@realm/contracts";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { useApi } from "@/data";
import { SongList } from "@/music/song-list";
import { AppScreen } from "@/social/screen";

/** Your Liked songs: every song you hearted, newest first. */
export default function Liked() {
  const list = useApi<SoundList>("/music/liked");
  const { reload } = list;
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  const songs = list.data?.items ?? null;
  return (
    <AppScreen>
      <SongList
        title="Liked songs"
        line={songs ? `${songs.length} ${songs.length === 1 ? "song" : "songs"}` : ""}
        covers={songs?.slice(0, 4).map((x) => x.coverUrl) ?? []}
        seed="liked"
        songs={songs}
        loading={list.loading}
        error={list.error}
        onRetry={reload}
        emptyTitle="Songs you like show up here"
        emptyLine="Tap the heart on a song in the player, or in its menu."
        from="Liked songs"
      />
    </AppScreen>
  );
}
