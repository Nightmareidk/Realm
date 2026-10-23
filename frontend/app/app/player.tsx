import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  FlatList,
  type GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/icon";
import { leave } from "@/leave";
import {
  clock,
  credit,
  cycleRepeat,
  like,
  pauseSound,
  playAt,
  position,
  resumeSound,
  seek,
  setShuffle,
  skip,
  useLiked,
  useModes,
  useNowPlaying,
} from "@/music/player";
import { addToPlaylist, CoverArt, coverSource } from "@/music/ui";
import { useSheet } from "@/sheet";
import { type NativeTheme, useStyles, useTheme } from "@/theme";

/**
 * The player, full screen (tap the Now Playing bar): the cover big, its colours lighting the
 * whole screen (Look B), the song and artist, like, the line to drag through the song, shuffle,
 * back, play, next, repeat, and what's up next. Closing it keeps the song playing.
 */
export default function Player() {
  const { t, accent, onAccent } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const sheet = useSheet();
  const insets = useSafeAreaInsets();
  const now = useNowPlaying();
  const liked = useLiked(now?.sound);
  const [shuffle, repeat] = useModes();
  const [pos, setPos] = useState({ at: 0, length: 0 });
  const [width, setWidth] = useState(1);
  const [showQueue, setShowQueue] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setPos(position()), 300);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return (
      <View style={[s.root, s.center]}>
        <Text style={s.empty}>Nothing's playing</Text>
        <Pressable
          onPress={() => router.replace("/music")}
          accessibilityRole="link"
          style={s.emptyBtn}
        >
          <Text style={s.emptyBtnText}>Open Music</Text>
        </Pressable>
      </View>
    );
  }
  const { sound } = now;
  const cover = sound.coverUrl;
  const listed = Boolean(now.queue && now.queue.length > 1);
  const scrub = (e: GestureResponderEvent) => {
    const x = Math.max(0, Math.min(width, e.nativeEvent.locationX));
    seek(now.startMs + (x / width) * now.playMs);
  };
  const done = pos.length ? pos.at / pos.length : 0;

  return (
    <View style={s.root}>
      {cover ? (
        <Image
          source={coverSource(cover)}
          style={[StyleSheet.absoluteFill, s.glow]}
          blurRadius={70}
          contentFit="cover"
        />
      ) : null}
      <LinearGradient
        colors={["rgba(0,0,0,0.15)", t.colors.bg]}
        locations={[0, 0.85]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[s.top, { paddingTop: insets.top + 6 }]}>
        <Pressable
          onPress={() => leave(router, "/music")}
          accessibilityRole="button"
          accessibilityLabel="Close the player"
          style={s.icon}
        >
          <Icon name="CaretDown" size={26} color={t.colors.text} />
        </Pressable>
        <View style={s.topMid}>
          <Text style={s.topLabel}>Playing from</Text>
          <Text style={s.topFrom} numberOfLines={1}>
            {now.from ?? "a post"}
          </Text>
        </View>
        <Pressable
          onPress={() => addToPlaylist(sheet, router, sound)}
          accessibilityRole="button"
          accessibilityLabel="Add to a playlist"
          style={s.icon}
        >
          <Icon name="Plus" size={24} color={t.colors.text} />
        </Pressable>
      </View>

      {showQueue && now.queue ? (
        <FlatList
          style={s.queue}
          data={now.queue}
          keyExtractor={(x, i) => `${x.id}-${i}`}
          ListHeaderComponent={<Text style={s.queueHead}>Up next</Text>}
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() => playAt(index)}
              accessibilityRole="button"
              accessibilityLabel={`Play ${item.title}`}
              style={({ pressed }) => [s.queueRow, pressed && { opacity: 0.7 }]}
            >
              <CoverArt urls={[item.coverUrl]} size={44} seed={item.id} />
              <View style={s.fill}>
                <Text
                  style={[s.queueTitle, index === now.at && { color: accent }]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text style={s.queueLine} numberOfLines={1}>
                  {item.artist}
                </Text>
              </View>
            </Pressable>
          )}
        />
      ) : (
        <View style={s.artWrap}>
          <View style={s.art}>
            <CoverArt
              urls={[cover]}
              size={300}
              seed={sound.id}
              radius={Math.min(18, t.radius.card)}
            />
          </View>
        </View>
      )}

      <View style={[s.bottom, { paddingBottom: insets.bottom + 18 }]}>
        <View style={s.titleRow}>
          <View style={s.fill}>
            <Text style={s.title} numberOfLines={1}>
              {sound.title}
            </Text>
            <Text style={s.artist} numberOfLines={1}>
              {sound.artist}
            </Text>
          </View>
          <Pressable
            onPress={() => like(sound, !liked)}
            accessibilityRole="button"
            accessibilityLabel={liked ? "Remove from Liked songs" : "Add to Liked songs"}
            hitSlop={8}
            style={s.icon}
          >
            <Icon
              name={liked ? "HeartFill" : "Heart"}
              size={28}
              color={liked ? accent : t.colors.text}
            />
          </Pressable>
        </View>

        <View
          style={s.scrub}
          onLayout={(e) => setWidth(Math.max(1, e.nativeEvent.layout.width))}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={scrub}
          onResponderMove={scrub}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Where in the song"
          accessibilityValue={{ text: `${clock(pos.at)} of ${clock(pos.length)}` }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(e) =>
            seek(
              now.startMs + pos.at + (e.nativeEvent.actionName === "increment" ? 10_000 : -10_000),
            )
          }
        >
          <View style={s.track} pointerEvents="none">
            <View
              style={[s.trackFill, { width: `${done * 100}%`, backgroundColor: t.colors.text }]}
            />
            <View style={[s.knob, { left: `${done * 100}%` }]} />
          </View>
        </View>
        <View style={s.times}>
          <Text style={s.time}>{clock(pos.at)}</Text>
          <Text style={s.time}>-{clock(Math.max(0, pos.length - pos.at))}</Text>
        </View>

        <View style={s.controls}>
          <Pressable
            onPress={() => setShuffle(shuffle !== "true")}
            disabled={!listed}
            accessibilityRole="switch"
            accessibilityState={{ checked: shuffle === "true", disabled: !listed }}
            accessibilityLabel="Shuffle"
            style={[s.icon, !listed && s.off]}
          >
            <Icon name="Shuffle" size={24} color={shuffle === "true" ? accent : t.colors.text} />
          </Pressable>
          <Pressable
            onPress={() => skip(-1)}
            disabled={!listed}
            accessibilityRole="button"
            accessibilityLabel="Previous"
            style={[s.big, !listed && s.off]}
          >
            <Icon name="SkipBackFill" size={32} color={t.colors.text} />
          </Pressable>
          <Pressable
            onPress={now.paused ? resumeSound : pauseSound}
            accessibilityRole="button"
            accessibilityLabel={now.paused ? "Play" : "Pause"}
            style={[s.play, { backgroundColor: t.colors.text }]}
          >
            <Icon name={now.paused ? "PlayFill" : "PauseFill"} size={30} color={t.colors.bg} />
          </Pressable>
          <Pressable
            onPress={() => skip(1)}
            disabled={!listed}
            accessibilityRole="button"
            accessibilityLabel="Next"
            style={[s.big, !listed && s.off]}
          >
            <Icon name="SkipForwardFill" size={32} color={t.colors.text} />
          </Pressable>
          <Pressable
            onPress={cycleRepeat}
            disabled={!listed}
            accessibilityRole="button"
            accessibilityLabel={
              repeat === "one"
                ? "Repeat this song"
                : repeat === "all"
                  ? "Repeat the list"
                  : "Repeat off"
            }
            style={[s.icon, !listed && s.off]}
          >
            <Icon
              name={repeat === "one" ? "RepeatOnce" : "Repeat"}
              size={24}
              color={repeat === "off" ? t.colors.textSoft : accent}
            />
          </Pressable>
        </View>

        <View style={s.extras}>
          <Text style={s.credit} numberOfLines={1}>
            {credit(sound) ?? (sound.creator ? `Original sound by @${sound.creator.username}` : "")}
          </Text>
          <Pressable
            onPress={() => {
              pauseSound();
              router.push({
                pathname: "/create",
                params: { soundId: sound.id, start: String(now.startMs), length: "15000" },
              });
            }}
            accessibilityRole="button"
            style={[s.use, { backgroundColor: accent }]}
          >
            <Text style={[s.useText, { color: onAccent }]}>Use</Text>
          </Pressable>
          {listed ? (
            <Pressable
              onPress={() => setShowQueue(!showQueue)}
              accessibilityRole="button"
              accessibilityLabel={showQueue ? "Show the cover" : "Up next"}
              style={s.icon}
            >
              <Icon name="ListBullets" size={24} color={showQueue ? accent : t.colors.text} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    root: { flex: 1, backgroundColor: t.colors.bg },
    center: { alignItems: "center", justifyContent: "center", gap: 14 },
    empty: { fontFamily: t.fonts.displayBold, fontSize: 20 * t.textScale, color: t.colors.text },
    emptyBtn: {
      paddingHorizontal: 18,
      minHeight: 44,
      borderRadius: 22,
      justifyContent: "center",
      backgroundColor: t.colors.surfaceRaised,
    },
    emptyBtnText: { fontFamily: t.fonts.bold, fontSize: 15 * t.textScale, color: t.colors.text },
    glow: { opacity: 0.6 },
    top: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8 },
    topMid: { flex: 1, alignItems: "center" },
    topLabel: {
      fontFamily: t.fonts.body,
      fontSize: 11.5 * t.textScale,
      color: t.colors.textSoft,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    topFrom: { fontFamily: t.fonts.bold, fontSize: 14 * t.textScale, color: t.colors.text },
    icon: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
    big: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
    off: { opacity: 0.35 },
    artWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
    art: {
      shadowColor: "#000000",
      shadowOpacity: 0.5,
      shadowRadius: 30,
      shadowOffset: { width: 0, height: 16 },
      elevation: 16,
    },
    queue: { flex: 1, paddingHorizontal: 16 },
    queueHead: {
      fontFamily: t.fonts.displayBold,
      fontSize: 18 * t.textScale,
      color: t.colors.heading,
      marginVertical: 10,
    },
    queueRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
    queueTitle: { fontFamily: t.fonts.bold, fontSize: 15 * t.textScale, color: t.colors.text },
    queueLine: { fontFamily: t.fonts.body, fontSize: 13 * t.textScale, color: t.colors.textSoft },
    bottom: { paddingHorizontal: 24 },
    titleRow: { flexDirection: "row", alignItems: "center" },
    title: { fontFamily: t.fonts.display, fontSize: 24 * t.textScale, color: t.colors.text },
    artist: {
      fontFamily: t.fonts.body,
      fontSize: 16 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 2,
    },
    scrub: { height: 30, justifyContent: "center", marginTop: 14 },
    track: { height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)" },
    trackFill: { height: 4, borderRadius: 2 },
    knob: {
      position: "absolute",
      top: -5,
      width: 14,
      height: 14,
      marginLeft: -7,
      borderRadius: 7,
      backgroundColor: t.colors.text,
    },
    times: { flexDirection: "row", justifyContent: "space-between" },
    time: {
      fontFamily: t.fonts.body,
      fontSize: 12.5 * t.textScale,
      color: t.colors.textSoft,
      fontVariant: ["tabular-nums"],
    },
    controls: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 10,
    },
    play: {
      width: 70,
      height: 70,
      borderRadius: 35,
      alignItems: "center",
      justifyContent: "center",
    },
    extras: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18 },
    credit: {
      flex: 1,
      fontFamily: t.fonts.body,
      fontSize: 12 * t.textScale,
      color: t.colors.textSoft,
    },
    use: { minHeight: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: "center" },
    useText: { fontFamily: t.fonts.bold, fontSize: 13.5 * t.textScale },
  });
