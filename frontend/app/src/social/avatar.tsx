import type { UserSummary } from "@realm/contracts";
import { contrast } from "@realm/design-tokens";
import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { mediaSource } from "../server";
import { type NativeTheme, useStyles, useTheme } from "../theme";

/** Warm, readable fills for people without a picture, picked from their id so it never changes. */
const FILLS = ["#ffb547", "#8bd3ff", "#ff8fb1", "#b9f27c", "#d4c2f5", "#ffd28a"];
const INK = "#0b0b0e";

/** The theme's own bright colours first, then the warm fills: six, all readable under dark ink. */
function fillsOf(t: NativeTheme): string[] {
  const c = t.colors;
  const own = [c.accent, c.accent2, c.link, c.like].filter(
    (f) => f !== c.text && contrast(f, INK) >= 4.5,
  );
  return [...new Set([...own, ...FILLS])].slice(0, 6);
}

/** Someone's fill colour (the theme's when given): the same person always gets the same one. */
export function fillFor(id: string, t?: NativeTheme) {
  const fills = t ? fillsOf(t) : FILLS;
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return fills[h % fills.length] as string;
}

/** A person's picture, or their initial on their own colour. Circles are people (DESIGN.md). */
export function Avatar({
  user,
  size = 40,
  ring,
  square,
}: {
  user: Pick<UserSummary, "id" | "displayName" | "avatarUrl">;
  size?: number;
  /** A ring around it: "live" (here now) or "self" (the You tab). */
  ring?: "live" | "self";
  /** Fill a square tile (a Wristband story) instead of a circle. */
  square?: boolean;
}) {
  const { t } = useTheme();
  const s = useStyles(make);
  // A picture that won't load (deleted, or the link ran out) shows the initial, not a blank disc.
  const [broken, setBroken] = useState<string | null>(null);
  const picture = user.avatarUrl && broken !== user.avatarUrl ? user.avatarUrl : null;
  const inner = (
    <View
      style={[
        s.circle,
        {
          width: size,
          height: square ? size * 1.4 : size,
          borderRadius: square ? 0 : t.style.avatars === "rounded" ? size * 0.3 : size / 2,
          backgroundColor: fillFor(user.id, t),
        },
      ]}
      accessible={false}
    >
      {picture ? (
        <Image
          source={mediaSource(picture)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          recyclingKey={picture}
          transition={120}
          onError={() => setBroken(picture)}
        />
      ) : (
        <Text style={[s.initial, { fontSize: size * 0.4 }]} allowFontScaling={false}>
          {user.displayName.trim().charAt(0).toUpperCase() || "?"}
        </Text>
      )}
    </View>
  );
  if (!ring) return inner;
  const pad = size > 48 ? 4 : 3;
  return (
    <View
      style={[
        s.ring,
        {
          padding: pad,
          borderRadius: size,
          borderColor: ring === "live" ? t.colors.presence : t.colors.text,
        },
      ]}
    >
      {inner}
    </View>
  );
}

const make = (_t: NativeTheme) =>
  StyleSheet.create({
    circle: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
    initial: { fontFamily: _t.fonts.display, color: INK },
    ring: { borderWidth: 2.5 },
  });
