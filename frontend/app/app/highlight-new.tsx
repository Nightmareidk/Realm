import type { Highlight, Story } from "@realm/contracts";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useApi } from "@/data";
import { leave } from "@/leave";
import { ApiError, api, mediaSource } from "@/server";
import { AppScreen, Empty, Loading, TopBar } from "@/social/screen";
import { type NativeTheme, useStyles, useTheme } from "@/theme";
import { Pill } from "@/ui";

/**
 * A new highlight: pick Stories from any day (they play in the order you pick them), name it,
 * and it goes on your profile.
 */
export default function NewHighlight() {
  const { t, accent } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const archive = useApi<{ items: Story[] }>("/stories/archive");
  const [picked, setPicked] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!picked.length) return setError("Pick at least one Story.");
    if (!title.trim()) return setError("Give it a name.");
    setBusy(true);
    setError(null);
    try {
      await api<Highlight>("/stories/highlights", {
        body: { title: title.trim(), storyIds: picked },
      });
      leave(router, "/you");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Not saved. Try again.");
      setBusy(false);
    }
  }

  const items = archive.data?.items ?? [];
  return (
    <AppScreen>
      <TopBar title="New highlight" />
      {archive.loading && !archive.data ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty title="No Stories yet" line="Share a Story first; then keep the best ones here." />
      ) : (
        <FlatList
          data={items}
          numColumns={3}
          keyExtractor={(st) => st.id}
          contentContainerStyle={s.grid}
          columnWrapperStyle={s.gridRow}
          ListHeaderComponent={
            <Text style={s.lead}>
              Pick Stories from any day. They play in the order you pick them.
            </Text>
          }
          renderItem={({ item }) => {
            const n = picked.indexOf(item.id);
            return (
              <Pressable
                onPress={() =>
                  setPicked((p) => (n >= 0 ? p.filter((x) => x !== item.id) : [...p, item.id]))
                }
                accessibilityRole="checkbox"
                accessibilityState={{ checked: n >= 0 }}
                accessibilityLabel={`Story from ${new Date(item.createdAt).toLocaleDateString()}`}
                style={s.cell}
              >
                {item.media.kind === "image" ? (
                  <Image
                    source={mediaSource(item.media.url)}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    style={[StyleSheet.absoluteFill, { backgroundColor: t.colors.surfaceRaised }]}
                  />
                )}
                <View style={[s.mark, n >= 0 && { backgroundColor: accent, borderColor: accent }]}>
                  {n >= 0 ? (
                    <Text style={[s.markText, { color: t.colors.onAccent }]}>{n + 1}</Text>
                  ) : null}
                </View>
                <Text style={s.date}>
                  {new Date(item.createdAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                  })}
                </Text>
              </Pressable>
            );
          }}
          ListFooterComponent={
            <View style={s.foot}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Name it, like Summer or Gigs"
                placeholderTextColor={t.colors.textMuted}
                selectionColor={accent}
                cursorColor={accent}
                maxLength={30}
                style={s.input}
                accessibilityLabel="Highlight name"
              />
              {error ? <Text style={s.error}>{error}</Text> : null}
              <Pill
                label={
                  picked.length ? `Add to your profile (${picked.length})` : "Add to your profile"
                }
                pending={busy}
                pendingLabel="Saving"
                onPress={save}
              />
            </View>
          }
        />
      )}
    </AppScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    grid: { padding: 12, paddingBottom: 120, gap: 6 },
    gridRow: { gap: 6 },
    lead: {
      fontFamily: t.fonts.body,
      fontSize: 14.5 * t.textScale,
      color: t.colors.textSoft,
      paddingHorizontal: 4,
      paddingBottom: 8,
    },
    cell: {
      flex: 1,
      aspectRatio: 9 / 16,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: t.colors.surfaceRaised,
    },
    mark: {
      position: "absolute",
      top: 6,
      right: 6,
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.85)",
      backgroundColor: "rgba(9,9,12,0.45)",
      alignItems: "center",
      justifyContent: "center",
    },
    markText: { fontFamily: t.fonts.bold, fontSize: 12 },
    date: {
      position: "absolute",
      left: 6,
      bottom: 4,
      fontFamily: t.fonts.bold,
      fontSize: 11,
      color: "#ffffff",
    },
    foot: { gap: 10, paddingTop: 14 },
    input: {
      minHeight: 50,
      borderRadius: t.radius.input,
      borderWidth: 1.5,
      borderColor: t.colors.borderStrong,
      paddingHorizontal: 14,
      fontFamily: t.fonts.body,
      fontSize: 16 * t.textScale,
      color: t.colors.text,
    },
    error: { fontFamily: t.fonts.bold, fontSize: 14 * t.textScale, color: t.colors.danger },
  });
