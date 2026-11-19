import { Redirect } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { type LoadingShape, Skeleton } from "@/skeleton";
import { AppScreen, TopBar } from "@/social/screen";
import { type NativeTheme, useStyles, useTheme } from "@/theme";

/**
 * Developer builds only: every loading outline on one screen, for checking them at any window
 * width and in every look without signing in or a server.
 */

const SHAPES: { id: LoadingShape; label: string }[] = [
  { id: "feed", label: "Home" },
  { id: "rows", label: "Inbox" },
  { id: "songs", label: "Songs" },
  { id: "grid", label: "Grid" },
  { id: "profile", label: "Profile" },
  { id: "chat", label: "Chat" },
];

export default function LoadingShapes() {
  const { t } = useTheme();
  const s = useStyles(make);
  const [shape, setShape] = useState<LoadingShape>("feed");
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <AppScreen>
      <TopBar title="Loading outlines" />
      <View style={s.tabs} accessibilityRole="tablist">
        {SHAPES.map((x) => {
          const on = x.id === shape;
          return (
            <Pressable
              key={x.id}
              onPress={() => setShape(x.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[s.tab, on && { backgroundColor: t.colors.text }]}
            >
              <Text style={[s.tabText, on && { color: t.colors.bg }]}>{x.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {shape === "chat" ? (
        <Skeleton shape="chat" />
      ) : (
        <ScrollView>
          <Skeleton shape={shape} />
        </ScrollView>
      )}
    </AppScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 12 },
    tab: {
      minHeight: 36,
      paddingHorizontal: 14,
      justifyContent: "center",
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.borderStrong,
    },
    tabText: { fontFamily: t.fonts.bold, fontSize: 14 * t.textScale, color: t.colors.text },
  });
