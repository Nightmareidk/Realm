import { MOODS, type SoundList } from "@realm/contracts";
import { useLocalSearchParams } from "expo-router";
import { useApi } from "@/data";
import { SongList } from "@/music/song-list";
import { AppScreen } from "@/social/screen";

/** A mood (Chill, Lo-fi, Workout…): songs from the free library that fit it. */
export default function Mood() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mood = MOODS.find((m) => m.id === id);
  const list = useApi<SoundList>(mood ? `/music/moods/${mood.id}` : null);
  const songs = list.data?.items ?? null;
  return (
    <AppScreen>
      <SongList
        title={mood?.label ?? "Music"}
        line={songs ? `${songs.length} songs, free to play and use` : "Finding songs…"}
        covers={songs?.slice(0, 4).map((x) => x.coverUrl) ?? []}
        seed={id ?? "mood"}
        songs={songs}
        loading={list.loading}
        error={mood ? list.error : "That mood isn't here."}
        onRetry={list.reload}
        emptyTitle="Nothing here right now"
        emptyLine="The free library didn't answer. Try again in a moment."
        from={mood?.label ?? "Music"}
      />
    </AppScreen>
  );
}
