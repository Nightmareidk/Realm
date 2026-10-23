import type { Sound } from "@realm/contracts";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "../icon";
import { useSheet } from "../sheet";
import { Empty, Loading, Problem, TopBar } from "../social/screen";
import { type NativeTheme, useStyles, useTheme } from "../theme";
import { NowBar } from "./now-bar";
import { playList, setShuffle, useModes } from "./player";
import { CoverArt, coverSource, SongRow, songMenu } from "./ui";

/**
 * A list of songs, the way music apps show an album or playlist: the art big, lit behind in its
 * own colours; the name and how many songs; Play and Shuffle; then the songs.
 */
export function SongList({
  title,
  line,
  covers,
  seed,
  songs,
  loading,
  error,
  onRetry,
  emptyTitle,
  emptyLine,
  from,
  removeFrom,
  extra,
  right,
}: {
  title: string;
  line: string;
  covers: (string | null | undefined)[];
  seed: string;
  songs: Sound[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  emptyTitle: string;
  emptyLine: string;
  from: string;
  /** Your own playlist: songs can be taken out of it. */
  removeFrom?: { id: string; done: () => void };
  extra?: ReactNode;
  right?: ReactNode;
}) {
  const { t, accent, onAccent } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const sheet = useSheet();
  const [shuffleOn] = useModes();
  const glow = covers.find(Boolean);

  const header = (
    <View style={s.head}>
      {glow ? (
        <Image
          source={coverSource(glow)}
          style={[StyleSheet.absoluteFill, s.glow]}
          blurRadius={50}
          contentFit="cover"
        />
      ) : null}
      <LinearGradient colors={["transparent", t.colors.bg]} style={StyleSheet.absoluteFill} />
      <View style={s.art}>
        <CoverArt urls={covers} size={196} seed={seed} radius={Math.min(14, t.radius.card)} />
      </View>
      <Text style={s.title} accessibilityRole="header" numberOfLines={2}>
        {title}
      </Text>
      <Text style={s.line}>{line}</Text>
      {extra}
      {songs?.length ? (
        <View style={s.actions}>
          <Pressable
            onPress={() => setShuffle(shuffleOn !== "true")}
            accessibilityRole="switch"
            accessibilityState={{ checked: shuffleOn === "true" }}
            accessibilityLabel="Shuffle"
            style={s.round}
          >
            <Icon name="Shuffle" size={22} color={shuffleOn === "true" ? accent : t.colors.text} />
          </Pressable>
          <Pressable
            onPress={() =>
              songs[0] &&
              playList(
                songs,
                shuffleOn === "true" ? Math.floor(Math.random() * songs.length) : 0,
                from,
              )
            }
            accessibilityRole="button"
            accessibilityLabel={`Play ${title}`}
            style={[s.play, { backgroundColor: accent }]}
          >
            <Icon name="PlayFill" size={26} color={onAccent} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={s.fill}>
      <TopBar title="" right={right} />
      {error && !songs ? (
        <Problem message={error} onRetry={onRetry} />
      ) : loading && !songs ? (
        <Loading />
      ) : (
        <FlatList
          data={songs ?? []}
          keyExtractor={(x) => x.id}
          ListHeaderComponent={header}
          renderItem={({ item, index }) => (
            <SongRow
              sound={item}
              onPress={() => playList(songs ?? [], index, from)}
              onMore={() =>
                songMenu(sheet, router, item, { liked: item.liked ?? false, removeFrom })
              }
            />
          )}
          ListEmptyComponent={<Empty title={emptyTitle} line={emptyLine} />}
          contentContainerStyle={s.pad}
        />
      )}
      <NowBar floating />
    </View>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    pad: { paddingBottom: 120 },
    head: {
      alignItems: "center",
      paddingTop: 8,
      paddingBottom: 16,
      paddingHorizontal: 20,
      overflow: "hidden",
    },
    glow: { opacity: 0.45 },
    art: {
      shadowColor: "#000000",
      shadowOpacity: 0.45,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 12,
    },
    title: {
      fontFamily: t.fonts.display,
      fontSize: 26 * t.textScale,
      color: t.colors.heading,
      textAlign: "center",
      marginTop: 18,
    },
    line: {
      fontFamily: t.fonts.body,
      fontSize: 14 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 4,
    },
    actions: { flexDirection: "row", alignItems: "center", gap: 18, marginTop: 16 },
    round: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    play: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: "center",
      justifyContent: "center",
    },
  });
