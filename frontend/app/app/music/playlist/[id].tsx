import type { PlaylistDetail } from "@realm/contracts";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, StyleSheet } from "react-native";
import { alert } from "@/alert";
import { useApi } from "@/data";
import { Icon } from "@/icon";
import { leave } from "@/leave";
import { SongList } from "@/music/song-list";
import { ApiError, api } from "@/server";
import { useSheet } from "@/sheet";
import { AppScreen } from "@/social/screen";
import { useTheme } from "@/theme";

/** A playlist: its songs in your order. Yours can be shared publicly, or deleted. */
export default function PlaylistScreen() {
  const { t } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const sheet = useSheet();
  const list = useApi<PlaylistDetail>(`/music/playlists/${id}`);
  const { reload } = list;
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  const p = list.data;

  function menu() {
    if (!p?.mine) return;
    sheet({
      title: p.name,
      actions: [
        {
          label: p.isPublic ? "Make it private" : "Share it publicly",
          icon: p.isPublic ? "Lock" : "Globe",
          onPress: async () => {
            try {
              list.setData(
                await api<PlaylistDetail>(`/music/playlists/${p.id}`, {
                  method: "PATCH",
                  body: { isPublic: !p.isPublic },
                }),
              );
            } catch (err) {
              alert("Not changed", err instanceof ApiError ? err.message : "Try again.");
            }
          },
        },
        {
          label: "Delete playlist",
          icon: "Trash",
          danger: true,
          onPress: () =>
            alert(`Delete ${p.name}?`, "The songs stay in Realm; only this list goes.", [
              { text: "Keep it", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                  try {
                    await api(`/music/playlists/${p.id}`, { method: "DELETE" });
                    leave(router, "/music");
                  } catch (err) {
                    alert("Not deleted", err instanceof ApiError ? err.message : "Try again.");
                  }
                },
              },
            ]),
        },
      ],
    });
  }

  const line = p
    ? `${p.isPublic ? "Public" : "Private"} playlist · ${p.count} ${p.count === 1 ? "song" : "songs"}${p.mine ? "" : ` · by @${p.owner.username}`}`
    : "";

  return (
    <AppScreen>
      <SongList
        title={p?.name ?? ""}
        line={line}
        covers={p?.covers ?? []}
        seed={id ?? "list"}
        songs={p?.items ?? null}
        loading={list.loading}
        error={list.error}
        onRetry={reload}
        emptyTitle="No songs yet"
        emptyLine="Add songs from Music, the player, or any song's menu."
        from={p?.name ?? "a playlist"}
        removeFrom={p?.mine ? { id: p.id, done: reload } : undefined}
        right={
          p?.mine ? (
            <Pressable
              onPress={menu}
              accessibilityRole="button"
              accessibilityLabel="Playlist options"
              style={styles.btn}
            >
              <Icon name="DotsThreeBold" size={22} color={t.colors.text} />
            </Pressable>
          ) : null
        }
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  btn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
