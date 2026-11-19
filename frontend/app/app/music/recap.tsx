import type { WeekRecap } from "@realm/contracts";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, ReduceMotion } from "react-native-reanimated";
import { useApi } from "@/data";
import { Icon } from "@/icon";
import { NowBar } from "@/music/now-bar";
import { playList, useNowPlaying } from "@/music/player";
import { CoverArt, coverSource } from "@/music/ui";
import { mediaSource } from "@/server";
import { AppScreen, Empty, Loading, Problem, TopBar } from "@/social/screen";
import { compact } from "@/social/time";
import { type NativeTheme, useStyles, useTheme } from "@/theme";
import { Pill } from "@/ui";

const day = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/**
 * Your week: what you played in Music over the last seven days, and what happened on your
 * posts. Yours alone; nobody else can open it. The top song's cover lights the top of the page.
 */
export default function Recap() {
  const { t, accent } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const week = useApi<WeekRecap>("/music/recap");
  const now = useNowPlaying();
  const w = week.data;
  const songs = w?.topSongs.map((x) => x.sound) ?? [];
  const cover = songs[0]?.coverUrl ?? null;
  const quiet =
    w && w.plays === 0 && w.posts === 0 && w.likes === 0 && w.newFollowers === 0 && !w.topPost;

  return (
    <AppScreen>
      <TopBar title="Your week" />
      {week.error && !w ? (
        <Problem message={week.error} onRetry={week.reload} />
      ) : !w ? (
        <Loading shape="songs" />
      ) : quiet ? (
        <Empty
          title="Your week starts here"
          line="Play a few songs in Music, or share a post. Come back and this page fills in."
        >
          <Pill size="md" label="Open Music" onPress={() => router.replace("/music")} />
        </Empty>
      ) : (
        <ScrollView
          contentContainerStyle={s.body}
          refreshControl={
            <RefreshControl
              refreshing={week.loading}
              onRefresh={week.reload}
              tintColor={t.colors.textSoft}
              colors={[accent]}
              progressBackgroundColor={t.colors.surfaceRaised}
            />
          }
        >
          <Rise i={0}>
            <View style={s.hero}>
              {cover && t.style.glow > 0 ? (
                <Image
                  source={coverSource(cover)}
                  style={[s.glow, { opacity: 0.2 + t.style.glow * 0.35 }]}
                  blurRadius={48}
                  contentFit="cover"
                  transition={300}
                  accessible={false}
                />
              ) : null}
              <Text style={s.dates}>
                {day(w.from)} to {day(w.to)}
              </Text>
              <Text style={s.big} accessibilityLabel={`About ${w.minutes} minutes of music`}>
                {compact(w.minutes)}
              </Text>
              <Text style={s.bigLine}>{w.minutes === 1 ? "minute" : "minutes"} of music</Text>
              <View style={s.stats}>
                <Stat n={w.songs} label={w.songs === 1 ? "song" : "songs"} />
                <Stat n={w.plays} label={w.plays === 1 ? "play" : "plays"} />
              </View>
              {w.topArtist ? (
                <Text style={s.artist} numberOfLines={2}>
                  Most played artist: <Text style={s.strong}>{w.topArtist.name}</Text>
                </Text>
              ) : null}
            </View>
          </Rise>

          {songs.length ? (
            <Rise i={1}>
              <View style={s.headRow}>
                <Text style={s.heading} accessibilityRole="header">
                  Your top songs
                </Text>
                <Pill size="sm" label="Play all" onPress={() => playList(songs, 0, "Your week")} />
              </View>
              {w.topSongs.map((x, i) => {
                const on = now?.sound.id === x.sound.id;
                return (
                  <Pressable
                    key={x.sound.id}
                    onPress={() => playList(songs, i, "Your week")}
                    accessibilityRole="button"
                    accessibilityLabel={`Number ${i + 1}: ${x.sound.title} by ${x.sound.artist}, played ${x.plays} ${x.plays === 1 ? "time" : "times"}`}
                    style={({ pressed }) => [s.song, pressed && s.pressed]}
                  >
                    <Text style={[s.rank, i === 0 && { color: accent }]}>{i + 1}</Text>
                    <CoverArt urls={[x.sound.coverUrl]} size={48} seed={x.sound.id} radius={8} />
                    <View style={s.fill}>
                      <Text style={[s.songTitle, on && { color: accent }]} numberOfLines={1}>
                        {x.sound.title}
                      </Text>
                      <Text style={s.soft} numberOfLines={1}>
                        {x.sound.artist}
                      </Text>
                    </View>
                    <Text style={s.plays}>
                      {compact(x.plays)} {x.plays === 1 ? "play" : "plays"}
                    </Text>
                  </Pressable>
                );
              })}
            </Rise>
          ) : null}

          <Rise i={2}>
            <Text style={[s.heading, s.gap]} accessibilityRole="header">
              On your posts
            </Text>
            <View style={s.social}>
              <Stat n={w.likes} label={w.likes === 1 ? "like" : "likes"} boxed />
              <Stat
                n={w.newFollowers}
                label={w.newFollowers === 1 ? "new follower" : "new followers"}
                boxed
              />
              <Stat n={w.posts} label={w.posts === 1 ? "post" : "posts"} boxed />
            </View>
            {w.topPost ? (
              <Pressable
                onPress={() =>
                  router.push({ pathname: "/post/[id]", params: { id: w.topPost?.id ?? "" } })
                }
                accessibilityRole="link"
                accessibilityLabel={`Your most liked post this week, ${w.topPost.likes} likes`}
                style={({ pressed }) => [s.post, pressed && s.pressed]}
              >
                {w.topPost.thumbUrl ? (
                  <Image
                    source={mediaSource(w.topPost.thumbUrl)}
                    style={s.thumb}
                    contentFit="cover"
                    transition={150}
                    accessible={false}
                  />
                ) : (
                  <View style={[s.thumb, s.thumbWords]}>
                    <Icon name="Quotes" size={22} color={t.colors.textSoft} />
                  </View>
                )}
                <View style={s.fill}>
                  <Text style={s.soft}>Most liked this week</Text>
                  <Text style={s.songTitle} numberOfLines={2}>
                    {w.topPost.caption || "Your post"}
                  </Text>
                  <Text style={s.soft}>
                    {compact(w.topPost.likes)} {w.topPost.likes === 1 ? "like" : "likes"}
                  </Text>
                </View>
                <Icon name="CaretRight" size={18} color={t.colors.textSoft} />
              </Pressable>
            ) : null}
            <Text style={s.small}>
              Counted from songs you play in Music, each as its whole length. Only you can see this
              page.
            </Text>
          </Rise>
        </ScrollView>
      )}
      <NowBar floating />
    </AppScreen>
  );
}

/** Each part arrives a moment after the one above it. */
function Rise({ i, children }: { i: number; children: ReactNode }) {
  return (
    <Animated.View
      entering={FadeInDown.duration(360)
        .delay(i * 70)
        .reduceMotion(ReduceMotion.System)}
    >
      {children}
    </Animated.View>
  );
}

function Stat({ n, label, boxed = false }: { n: number; label: string; boxed?: boolean }) {
  const s = useStyles(make);
  return (
    <View style={[s.stat, boxed && s.statBoxed]} accessible accessibilityLabel={`${n} ${label}`}>
      <Text style={s.statN}>{compact(n)}</Text>
      <Text style={s.soft}>{label}</Text>
    </View>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1, minWidth: 0 },
    pressed: { opacity: 0.75 },
    body: { paddingBottom: 130 },
    hero: {
      marginHorizontal: 16,
      marginTop: 6,
      padding: 20,
      borderRadius: t.radius.card,
      overflow: "hidden",
      backgroundColor: t.colors.surfaceRaised,
    },
    glow: { position: "absolute", top: -40, left: -40, right: -40, bottom: -40 },
    dates: { fontFamily: t.fonts.body, fontSize: 14 * t.textScale, color: t.colors.textSoft },
    big: {
      fontFamily: t.fonts.displayBold,
      fontSize: 76 * t.textScale,
      lineHeight: 84 * t.textScale,
      color: t.colors.heading,
      fontVariant: ["tabular-nums"],
      marginTop: 6,
    },
    bigLine: {
      fontFamily: t.fonts.bold,
      fontSize: 18 * t.textScale,
      color: t.colors.text,
      marginTop: -2,
    },
    stats: { flexDirection: "row", gap: 28, marginTop: 18 },
    stat: { gap: 1 },
    statBoxed: {
      flex: 1,
      padding: 14,
      borderRadius: t.radius.box,
      backgroundColor: t.colors.surfaceRaised,
    },
    statN: {
      fontFamily: t.fonts.displayBold,
      fontSize: 24 * t.textScale,
      color: t.colors.text,
      fontVariant: ["tabular-nums"],
    },
    artist: {
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 16,
    },
    strong: { fontFamily: t.fonts.bold, color: t.colors.text },
    headRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingRight: 16,
      marginTop: 26,
      marginBottom: 6,
    },
    heading: {
      fontFamily: t.fonts.displayBold,
      fontSize: 20 * t.textScale,
      color: t.colors.heading,
      paddingHorizontal: 16,
    },
    gap: { marginTop: 26, marginBottom: 10 },
    song: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: 64,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    rank: {
      width: 22,
      textAlign: "center",
      fontFamily: t.fonts.displayBold,
      fontSize: 18 * t.textScale,
      color: t.colors.textSoft,
      fontVariant: ["tabular-nums"],
    },
    songTitle: { fontFamily: t.fonts.bold, fontSize: 15 * t.textScale, color: t.colors.text },
    soft: { fontFamily: t.fonts.body, fontSize: 13.5 * t.textScale, color: t.colors.textSoft },
    plays: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      color: t.colors.textSoft,
      fontVariant: ["tabular-nums"],
    },
    social: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
    post: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginHorizontal: 16,
      marginTop: 10,
      padding: 12,
      borderRadius: t.radius.box,
      borderWidth: 1.5,
      borderColor: t.colors.border,
    },
    thumb: {
      width: 64,
      height: 64,
      borderRadius: Math.min(14, t.radius.media),
      backgroundColor: t.colors.surfaceRaised,
    },
    thumbWords: { alignItems: "center", justifyContent: "center" },
    small: {
      fontFamily: t.fonts.body,
      fontSize: 12.5 * t.textScale,
      lineHeight: 18 * t.textScale,
      color: t.colors.textSoft,
      paddingHorizontal: 16,
      marginTop: 18,
    },
  });
