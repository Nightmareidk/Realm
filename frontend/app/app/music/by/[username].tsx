import type { SoundList } from "@realm/contracts";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable } from "react-native";
import { useApi } from "@/data";
import { Icon } from "@/icon";
import { SongList } from "@/music/song-list";
import { useSession } from "@/session";
import { AppScreen } from "@/social/screen";
import { useTheme } from "@/theme";

/** The songs someone has shared on Realm. On your own page, the + shares another. */
export default function SongsBy() {
  const { t } = useTheme();
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username: string }>();
  const { session } = useSession();
  const mine =
    session.status === "signedIn" &&
    session.user.username.toLowerCase() === (username ?? "").toLowerCase();
  const list = useApi<SoundList>(`/sounds/by/${encodeURIComponent(username ?? "")}`);
  const songs = list.data?.items ?? null;
  const count = songs?.length ?? 0;

  return (
    <AppScreen>
      <SongList
        title={mine ? "Your music" : `@${username}`}
        line={
          songs ? `${count} ${count === 1 ? "song" : "songs"}${mine ? "" : " shared on Realm"}` : ""
        }
        covers={(songs ?? []).map((x) => x.coverUrl)}
        seed={username ?? ""}
        songs={songs}
        loading={!list.data && !list.error}
        error={list.error}
        onRetry={list.reload}
        onChanged={list.reload}
        emptyTitle={mine ? "No songs yet" : "No songs here yet"}
        emptyLine={
          mine
            ? "Share a song you made with the + at the top."
            : "When they share a song, it shows here."
        }
        from={mine ? "Your music" : `@${username}`}
        right={
          mine ? (
            <Pressable
              onPress={() => router.push("/music/upload")}
              accessibilityRole="button"
              accessibilityLabel="Share a song"
              hitSlop={8}
            >
              <Icon name="Plus" size={24} color={t.colors.text} />
            </Pressable>
          ) : undefined
        }
      />
    </AppScreen>
  );
}
