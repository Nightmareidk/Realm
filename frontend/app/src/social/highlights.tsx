import type { Highlight } from "@realm/contracts";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { alert } from "../alert";
import { useApi } from "../data";
import { Icon } from "../icon";
import { api, mediaSource } from "../server";
import { useSheet } from "../sheet";
import { type NativeTheme, useStyles, useTheme } from "../theme";

/**
 * Highlights on a profile: Stories kept after their day, in named circles. On your own there's
 * a "New" circle first; hold one of yours to delete it.
 */
export function Highlights({ username, mine }: { username: string; mine: boolean }) {
  const { t } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const sheet = useSheet();
  const list = useApi<{ items: Highlight[] }>(
    `/stories/highlights/of/${encodeURIComponent(username)}`,
  );
  const items = list.data?.items ?? [];
  if (!mine && !items.length) return null;

  function options(h: Highlight) {
    sheet({
      title: h.title,
      actions: [
        {
          label: "Delete the highlight",
          icon: "Trash",
          danger: true,
          onPress: () =>
            alert(`Delete "${h.title}"?`, "The Stories stay in your archive.", [
              { text: "Keep it", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                  await api(`/stories/highlights/${h.id}`, { method: "DELETE" }).catch(() => {});
                  list.reload();
                },
              },
            ]),
        },
      ],
    });
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}
      accessibilityLabel="Highlights"
    >
      {mine ? (
        <Pressable
          onPress={() => router.push("/highlight-new")}
          accessibilityRole="button"
          accessibilityLabel="New highlight"
          style={s.item}
        >
          <View style={[s.circle, s.newCircle]}>
            <Icon name="Plus" size={24} color={t.colors.textSoft} />
          </View>
          <Text style={s.title}>New</Text>
        </Pressable>
      ) : null}
      {items.map((h) => (
        <Pressable
          key={h.id}
          onPress={() => router.push({ pathname: "/stories", params: { highlight: h.id } })}
          onLongPress={mine ? () => options(h) : undefined}
          accessibilityRole="button"
          accessibilityLabel={`Highlight ${h.title}`}
          accessibilityHint={mine ? "Hold to delete it" : undefined}
          style={s.item}
        >
          <View style={s.circle}>
            {h.cover ? (
              <Image source={mediaSource(h.cover.url)} style={s.cover} contentFit="cover" />
            ) : (
              <View style={[s.cover, { backgroundColor: t.colors.surface }]} />
            )}
          </View>
          <Text style={s.title} numberOfLines={1}>
            {h.title}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    row: { gap: 16, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 4 },
    item: { width: 72, alignItems: "center", gap: 6 },
    circle: {
      width: 70,
      height: 70,
      borderRadius: 35,
      padding: 3,
      borderWidth: 1.5,
      borderColor: t.colors.borderStrong,
      backgroundColor: t.colors.surfaceRaised,
    },
    newCircle: {
      alignItems: "center",
      justifyContent: "center",
      borderStyle: "dashed",
      backgroundColor: "transparent",
    },
    cover: { flex: 1, borderRadius: 32 },
    title: {
      fontFamily: t.fonts.bold,
      fontSize: 12.5 * t.textScale,
      color: t.colors.text,
      maxWidth: 72,
    },
  });
