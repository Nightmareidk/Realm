import type { UserSummary } from "@realm/contracts";
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { mediaSource } from "../server";
import { fonts, type NativeTheme, useStyles, useTheme } from "../theme";

/** Warm, readable fills for people without a picture, picked from their id so it never changes. */
const FILLS = ["#ffb547", "#8bd3ff", "#ff8fb1", "#b9f27c", "#d4c2f5", "#ffd28a"];

export function fillFor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return FILLS[h % FILLS.length] as string;
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
  const inner = (
    <View
      style={[
        s.circle,
        {
          width: size,
          height: square ? size * 1.4 : size,
          borderRadius: square ? 0 : t.style.avatars === "rounded" ? size * 0.3 : size / 2,
          backgroundColor: fillFor(user.id),
        },
      ]}
      accessible={false}
    >
      {user.avatarUrl ? (
        <Image
          source={mediaSource(user.avatarUrl)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          recyclingKey={user.avatarUrl}
          transition={120}
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
    initial: { fontFamily: fonts.display, color: "#0b0b0e" },
    ring: { borderWidth: 2.5 },
  });
