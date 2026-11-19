import type { ListeningFriend, ListeningFriends } from "@realm/contracts";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";
import { Icon } from "../icon";
import { HList } from "../scroll-row";
import { api } from "../server";
import { Avatar } from "../social/avatar";
import { type NativeTheme, useStyles, useTheme } from "../theme";
import { Bars } from "./chip";
import { listenAlong, useNowPlaying } from "./player";
import { CoverArt } from "./ui";

/** How often the list is asked for again while its screen is open. */
const EVERY_MS = 30_000;

/** Friends playing a song right now, kept fresh while the screen is in front. */
export function useFriendsListening() {
  const [items, setItems] = useState<ListeningFriend[]>([]);
  // When the server answered, so "Listen along" can add the time since.
  const asOf = useRef(Date.now());
  const load = useCallback(() => {
    api<ListeningFriends>("/music/friends")
      .then((r) => {
        asOf.current = Date.now();
        setItems(r.items);
      })
      .catch(() => {});
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(load, EVERY_MS);
      return () => clearInterval(timer);
    }, [load]),
  );
  return { items, asOf, reload: load };
}

/**
 * "Listening now": friends (people who follow each other) with the song each is playing. Tap
 * Listen along and the same song starts at the moment they're at. On Music it explains itself
 * when nobody is listening; on Home (`quiet`) it only shows when someone is.
 */
export function FriendsListening({ quiet = false }: { quiet?: boolean }) {
  const { t, accent } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const { items, asOf } = useFriendsListening();
  const now = useNowPlaying();

  if (!items.length) {
    if (quiet) return null;
    return (
      <View style={s.hint}>
        <View style={s.hintIcon}>
          <Icon name="Headphones" size={20} color={t.colors.text} />
        </View>
        <View style={s.fill}>
          <Text style={s.hintTitle}>Listen along with friends</Text>
          <Text style={s.hintLine}>
            When a friend plays a song, they show up here and you can join at the same moment.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Animated.View
      entering={FadeIn.duration(220).reduceMotion(ReduceMotion.System)}
      style={quiet ? s.onHome : undefined}
    >
      {quiet ? null : (
        <Text style={s.heading} accessibilityRole="header">
          Listening now
        </Text>
      )}
      <HList
        data={items}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(f) => f.user.id}
        contentContainerStyle={s.row}
        renderItem={({ item }) => {
          const along = now?.sound.id === item.sound.id && !now.paused;
          return (
            <View style={s.card}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/user/[username]",
                    params: { username: item.user.username },
                  })
                }
                accessibilityRole="link"
                accessibilityLabel={`${item.user.displayName} is listening to ${item.sound.title} by ${item.sound.artist}`}
                style={s.who}
              >
                <View>
                  <CoverArt
                    urls={[item.sound.coverUrl]}
                    size={48}
                    seed={item.sound.id}
                    radius={10}
                  />
                  <View style={s.face}>
                    <Avatar user={item.user} size={22} />
                  </View>
                </View>
                <View style={s.fill}>
                  <Text style={s.name} numberOfLines={1}>
                    {item.user.displayName}
                  </Text>
                  <Text style={s.song} numberOfLines={1}>
                    {item.sound.title} · {item.sound.artist}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (along) return;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  listenAlong(item, asOf.current);
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  along
                    ? `You're listening along with ${item.user.displayName}`
                    : `Listen along with ${item.user.displayName}`
                }
                accessibilityState={{ selected: along }}
                style={({ pressed }) => [
                  s.join,
                  along ? s.joined : { backgroundColor: accent },
                  pressed && !along && s.pressed,
                ]}
              >
                {along ? (
                  <Bars color={t.colors.text} />
                ) : (
                  <Icon name="Headphones" size={16} color={t.colors.onAccent} />
                )}
                <Text style={[s.joinText, { color: along ? t.colors.text : t.colors.onAccent }]}>
                  {along ? "Listening along" : "Listen along"}
                </Text>
              </Pressable>
            </View>
          );
        }}
      />
    </Animated.View>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1, minWidth: 0 },
    pressed: { transform: [{ scale: 0.97 }] },
    heading: {
      fontFamily: t.fonts.displayBold,
      fontSize: 20 * t.textScale,
      color: t.colors.heading,
      paddingHorizontal: 16,
      marginBottom: 10,
    },
    row: { paddingHorizontal: 16, gap: 10 },
    onHome: { paddingTop: 4, paddingBottom: 12 },
    card: {
      width: 264,
      gap: 10,
      padding: 12,
      borderRadius: t.radius.box,
      backgroundColor: t.colors.surfaceRaised,
    },
    who: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
    face: {
      position: "absolute",
      right: -6,
      bottom: -6,
      borderRadius: 13,
      borderWidth: 2,
      borderColor: t.colors.bg,
    },
    name: { fontFamily: t.fonts.bold, fontSize: 15 * t.textScale, color: t.colors.text },
    song: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 1,
    },
    join: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 999,
      paddingHorizontal: 16,
    },
    joined: { borderWidth: 1.5, borderColor: t.colors.borderStrong },
    joinText: { fontFamily: t.fonts.bold, fontSize: 14.5 * t.textScale },
    hint: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginHorizontal: 16,
      padding: 14,
      borderRadius: t.radius.box,
      borderWidth: 1.5,
      borderColor: t.colors.border,
    },
    hintIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.surfaceRaised,
    },
    hintTitle: { fontFamily: t.fonts.bold, fontSize: 15 * t.textScale, color: t.colors.text },
    hintLine: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      lineHeight: 19 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 2,
    },
  });
