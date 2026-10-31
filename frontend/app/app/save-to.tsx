import type { Collection } from "@realm/contracts";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { alert } from "@/alert";
import { postsChanged, useApi } from "@/data";
import { Icon } from "@/icon";
import { leave } from "@/leave";
import { ApiError, api, mediaSource } from "@/server";
import { AppScreen, Loading, Problem, TopBar } from "@/social/screen";
import { type NativeTheme, useStyles, useTheme } from "@/theme";
import { Pill } from "@/ui";

/**
 * Save a post into one of your collections, or a new one. Putting it in a collection saves it
 * too, as on Instagram. Only you ever see your collections.
 */
export default function SaveTo() {
  const { t, accent } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { post } = useLocalSearchParams<{ post: string }>();
  const list = useApi<{ items: Collection[] }>("/users/@me/collections");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function put(c: Collection) {
    if (busy || !post || !/^\d{1,20}$/.test(post)) return;
    setBusy(true);
    try {
      await api(`/users/@me/collections/${c.id}/posts/${post}`, { method: "PUT" });
      postsChanged();
      leave(router);
    } catch (err) {
      setBusy(false);
      alert("Not saved", err instanceof ApiError ? err.message : "Try again.");
    }
  }

  async function createAndSave() {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    try {
      const c = await api<Collection>("/users/@me/collections", { body: { name: n } });
      setBusy(false);
      await put(c);
    } catch (err) {
      setBusy(false);
      alert("Not made", err instanceof ApiError ? err.message : "Try again.");
    }
  }

  return (
    <AppScreen>
      <TopBar title="Save to a collection" />
      {list.error && !list.data ? (
        <Problem message={list.error} onRetry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : (
        <FlatList
          data={list.data.items}
          keyExtractor={(c) => c.id}
          numColumns={2}
          columnWrapperStyle={s.cols}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 24 }]}
          ListHeaderComponent={
            <View style={s.newRow}>
              <Icon name="FolderSimplePlus" size={22} color={t.colors.textSoft} />
              <TextInput
                value={name}
                onChangeText={setName}
                maxLength={40}
                placeholder="New collection"
                placeholderTextColor={t.colors.textMuted}
                selectionColor={accent}
                returnKeyType="done"
                onSubmitEditing={createAndSave}
                accessibilityLabel="New collection name"
                style={s.input}
              />
              <Pill
                size="sm"
                label="Save"
                onPress={createAndSave}
                pending={busy}
                pendingLabel="Saving"
              />
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => void put(item)}
              accessibilityRole="button"
              accessibilityLabel={`Save to ${item.name}, ${item.count} saved`}
              style={({ pressed }) => [s.tile, pressed && { opacity: 0.8 }]}
            >
              <View style={s.cover}>
                {item.covers.slice(0, 4).map((u) => (
                  <Image key={u} source={mediaSource(u)} style={s.coverImg} contentFit="cover" />
                ))}
              </View>
              <Text style={s.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={s.count}>{item.count} saved</Text>
            </Pressable>
          )}
        />
      )}
    </AppScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    body: { padding: 16, gap: 16 },
    cols: { gap: 12 },
    newRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
    input: {
      flex: 1,
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: t.colors.surfaceRaised,
      fontFamily: t.fonts.body,
      fontSize: 16 * t.textScale,
      color: t.colors.text,
    },
    tile: { flex: 1 },
    cover: {
      aspectRatio: 1,
      borderRadius: 18,
      overflow: "hidden",
      flexDirection: "row",
      flexWrap: "wrap",
      backgroundColor: t.colors.surfaceRaised,
    },
    coverImg: { width: "50%", height: "50%" },
    name: {
      fontFamily: t.fonts.bold,
      fontSize: 15 * t.textScale,
      color: t.colors.text,
      marginTop: 6,
    },
    count: { fontFamily: t.fonts.body, fontSize: 13 * t.textScale, color: t.colors.textSoft },
  });
