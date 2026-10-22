import type { ThemeAccent } from "@realm/contracts";
import { StyleSheet, Text, View } from "react-native";
import { fonts, type NativeTheme, themes, useStyles } from "../theme";

/** A Space's badge: its initials on its own colour, a rounded square (things are squircles). */
export function SpaceBadge({
  name,
  accent,
  size = 44,
}: {
  name: string;
  accent: ThemeAccent;
  size?: number;
}) {
  const s = useStyles(make);
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?";
  return (
    <View
      style={[
        s.badge,
        {
          width: size,
          height: size,
          borderRadius: size * 0.3,
          backgroundColor: themes[accent].accent,
        },
      ]}
      accessible={false}
    >
      <Text
        style={[s.text, { fontSize: size * 0.36, color: themes[accent].onAccent }]}
        allowFontScaling={false}
      >
        {initials}
      </Text>
    </View>
  );
}

const make = (_t: NativeTheme) =>
  StyleSheet.create({
    badge: { alignItems: "center", justifyContent: "center" },
    text: { fontFamily: fonts.display },
  });
