import type { ErrorBoundaryProps } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { type NativeTheme, useStyles } from "./theme";

/**
 * When a screen crashes: say so plainly and offer another try, instead of a blank or frozen app.
 * It can show before anything else has loaded (even the fonts), so it leans on nothing: plain
 * views, the system font, and the ink colours.
 */
export function CrashScreen({ error, retry }: ErrorBoundaryProps) {
  const s = useStyles(make);
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <View style={s.screen} accessibilityRole="alert">
      <Text style={s.title} accessibilityRole="header">
        Something went wrong.
      </Text>
      <Text style={s.line}>
        This screen ran into a problem. It's not something you did, and trying again usually fixes
        it. Your messages and posts are safe.
      </Text>
      <Pressable
        onPress={() => retry()}
        accessibilityRole="button"
        style={({ pressed }) => [s.button, pressed && { opacity: 0.8 }]}
      >
        <Text style={s.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.colors.bg,
      justifyContent: "center",
      paddingHorizontal: 28,
      gap: 14,
    },
    title: { fontSize: 28 * t.textScale, fontWeight: "800", color: t.colors.text },
    line: { fontSize: 17 * t.textScale, lineHeight: 26 * t.textScale, color: t.colors.textSoft },
    button: {
      marginTop: 12,
      minHeight: 56,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.text,
    },
    buttonText: { fontSize: 17 * t.textScale, fontWeight: "700", color: t.colors.bg },
  });
