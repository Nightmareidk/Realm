import type { DiscoverSpace, SpaceDetail } from "@realm/contracts";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useApi } from "../data";
import { Icon } from "../icon";
import { mediaSource } from "../server";
import { compact } from "../social/time";
import { type NativeTheme, themes, useStyles, useTheme } from "../theme";

/**
 * Your Spaces, in Messages (where the talking happens): each with its picture as a rounded tile
 * in its own colour, how many are in it, and its Glow. Start a Space, join one with an invite,
 * or find one to join.
 */
export function SpacesList() {
  const { t } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const mine = useApi<{ spaces: SpaceDetail[] }>("/users/@me/communities");
  const discover = useApi<{ spaces: DiscoverSpace[] }>("/discover/communities?sort=active&limit=8");
  const others = discover.data?.spaces.filter((d) => !d.joined) ?? [];

  const header = (
    <View style={s.actions}>
      <Pressable
        onPress={() => router.push("/space/new")}
        accessibilityRole="button"
        style={({ pressed }) => [s.action, pressed && s.pressed]}
      >
        <LinearGradient
          colors={[t.colors.accent, t.colors.lights[1] ?? t.colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Icon name="Plus" size={22} color={t.colors.onAccent} />
        <Text style={[s.actionText, { color: t.colors.onAccent }]}>Start a Space</Text>
      </Pressable>
      <Pressable
        onPress={() => router.push("/space/join")}
        accessibilityRole="button"
        style={({ pressed }) => [s.action, s.actionGhost, pressed && s.pressed]}
      >
        <Icon name="Link" size={22} color={t.colors.text} />
        <Text style={s.actionText}>Join with an invite</Text>
      </Pressable>
    </View>
  );

  return (
    <FlatList
      data={mine.data?.spaces ?? []}
      keyExtractor={(x) => x.id}
      ListHeaderComponent={header}
      renderItem={({ item }) => (
        <SpaceRow
          name={item.name}
          accent={item.accent}
          iconUrl={item.iconUrl}
          line={`${compact(item.memberCount)} ${item.memberCount === 1 ? "member" : "members"} · ${rooms(item.channels.filter((c) => c.type === "text").length)}`}
          onPress={() => router.push({ pathname: "/space/[id]", params: { id: item.slug } })}
        />
      )}
      ListEmptyComponent={
        mine.loading ? null : (
          <Text style={s.empty}>
            Spaces are your groups: friends, a team, a class, a fan club. Rooms to chat in, voice
            rooms to hang out, and your own rules.
          </Text>
        )
      }
      ListFooterComponent={
        others.length ? (
          <View>
            <Text style={s.heading}>Spaces to find</Text>
            {others.map((d) => (
              <SpaceRow
                key={d.id}
                name={d.name}
                accent={d.accent}
                iconUrl={null}
                line={`${compact(d.memberCount)} members${d.description ? ` · ${d.description}` : ""}`}
                onPress={() => router.push({ pathname: "/space/[id]", params: { id: d.slug } })}
              />
            ))}
          </View>
        ) : null
      }
      onRefresh={mine.reload}
      refreshing={false}
      contentContainerStyle={s.pad}
    />
  );
}

const rooms = (n: number) => `${n} ${n === 1 ? "room" : "rooms"}`;

function SpaceRow({
  name,
  accent,
  iconUrl,
  line,
  onPress,
}: {
  name: string;
  accent: keyof typeof themes;
  iconUrl: string | null;
  line: string;
  onPress: () => void;
}) {
  const s = useStyles(make);
  const colour = themes[accent]?.accent ?? "#7ef2c4";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${name}. ${line}`}
      style={({ pressed }) => [s.row, pressed && s.pressed]}
    >
      <View style={[s.tile, { backgroundColor: colour }]}>
        {iconUrl ? (
          <Image source={mediaSource(iconUrl)} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Text style={s.tileText}>{name.trim().slice(0, 2).toUpperCase()}</Text>
        )}
      </View>
      <View style={s.fill}>
        <Text style={s.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={s.line} numberOfLines={1}>
          {line}
        </Text>
      </View>
      <Icon name="CaretRight" size={18} color="#8a8a92" />
    </Pressable>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    pad: { paddingBottom: 120 },
    pressed: { opacity: 0.8 },
    actions: { flexDirection: "row", gap: 10, padding: 16 },
    action: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      minHeight: 54,
      borderRadius: t.radius.card,
      overflow: "hidden",
    },
    actionGhost: { borderWidth: 1.5, borderColor: t.colors.borderStrong },
    actionText: { fontFamily: t.fonts.bold, fontSize: 14.5 * t.textScale, color: t.colors.text },
    heading: {
      fontFamily: t.fonts.bold,
      fontSize: 12.5 * t.textScale,
      color: t.colors.textSoft,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      paddingHorizontal: 18,
      paddingTop: 20,
      paddingBottom: 6,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: 16,
      paddingVertical: 9,
    },
    // Spaces are rounded squares, people are circles: you can tell them apart at a glance.
    tile: {
      width: 52,
      height: 52,
      borderRadius: 16,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
    },
    tileText: { fontFamily: t.fonts.display, fontSize: 18 * t.textScale, color: "#0b0b0e" },
    name: { fontFamily: t.fonts.bold, fontSize: 16 * t.textScale, color: t.colors.text },
    line: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 2,
    },
    empty: {
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      color: t.colors.textSoft,
      padding: 20,
      lineHeight: 22 * t.textScale,
    },
  });
