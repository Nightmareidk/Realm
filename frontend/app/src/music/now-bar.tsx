import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown, ReduceMotion } from "react-native-reanimated";
import { Icon } from "../icon";
import { mediaSource, resolveUrl } from "../server";
import { type NativeTheme, useStyles, useTheme } from "../theme";
import { pauseSound, progress, resumeSound, stopSound, useNowPlaying } from "./player";

/** Sounds the bar stands in for; Stories, Clips and the picker show their own. */
const SHOWN = /^(post|bar):/;

/**
 * Now Playing, above the tabs: the song from a post keeps playing while you scroll, open chats
 * or change tabs. Cover, title, where it came from, a line for how far in, pause and close, and
 * "Use" to make something with it. In each look's own hand: a lit glass bar (Now Playing), a
 * printed strip (Wristband) or a plain line (Plain and clear).
 */
export function NowBar() {
  const { t } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const now = useNowPlaying();
  const [at, setAt] = useState(0);
  const shown = now && SHOWN.test(now.key);

  // The line moves while it plays.
  useEffect(() => {
    if (!shown || now?.paused) return;
    const id = setInterval(() => setAt(progress()), 400);
    return () => clearInterval(id);
  }, [shown, now?.paused]);

  if (!shown || !now) return null;
  const { sound, paused } = now;
  const cover = sound.coverUrl;
  const style = t.style.posts;
  const line = `${sound.artist}${now.from ? ` · from ${now.from}` : ""}`;

  return (
    <Animated.View
      entering={FadeInDown.duration(220).reduceMotion(ReduceMotion.System)}
      exiting={FadeOutDown.duration(160).reduceMotion(ReduceMotion.System)}
      style={[s.bar, style === "ticket" && s.ticket, style === "thread" && s.thread]}
      accessibilityLabel={`Now playing: ${sound.title} by ${line}`}
    >
      <View style={s.coverBox}>
        {cover ? (
          <Image
            source={cover.startsWith("/") ? mediaSource(cover) : { uri: resolveUrl(cover) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            recyclingKey={cover}
          />
        ) : (
          <Icon name="MusicNotesFill" size={18} color={t.colors.textSoft} />
        )}
      </View>
      <View style={s.fill}>
        <Text style={[s.title, style === "ticket" && s.titleTicket]} numberOfLines={1}>
          {sound.title}
        </Text>
        <Text style={s.line} numberOfLines={1}>
          {line}
        </Text>
      </View>
      <Pressable
        onPress={() => {
          pauseSound();
          router.push({
            pathname: "/create",
            params: { soundId: sound.id, start: String(now.startMs), length: String(now.playMs) },
          });
        }}
        accessibilityRole="button"
        accessibilityLabel={`Use ${sound.title} in a post`}
        style={({ pressed }) => [s.use, pressed && s.pressed]}
      >
        <Text style={s.useText}>Use</Text>
      </Pressable>
      <Pressable
        onPress={paused ? resumeSound : pauseSound}
        accessibilityRole="button"
        accessibilityLabel={paused ? "Play" : "Pause"}
        hitSlop={6}
        style={s.btn}
      >
        <Icon name={paused ? "PlayFill" : "PauseFill"} size={20} color={t.colors.text} />
      </Pressable>
      <Pressable
        onPress={stopSound}
        accessibilityRole="button"
        accessibilityLabel="Stop the music"
        hitSlop={6}
        style={s.btn}
      >
        <Icon name="X" size={18} color={t.colors.textSoft} />
      </Pressable>
      <View style={s.track} pointerEvents="none">
        <View style={[s.trackFill, { width: `${Math.round(at * 100)}%` }]} />
      </View>
    </Animated.View>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    pressed: { opacity: 0.7 },
    bar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 8,
      paddingLeft: 8,
      paddingRight: 6,
      height: 56,
      marginHorizontal: t.style.tabBar === "floating" ? 0 : 10,
      borderRadius: Math.min(18, t.radius.card),
      backgroundColor: t.colors.surfaceRaised,
      borderWidth: t.panels.border === "none" ? 0 : 1,
      borderColor: t.panels.border === "accent" ? t.colors.accent : t.colors.border,
      overflow: "hidden",
    },
    ticket: {
      borderRadius: 0,
      borderStyle: "dashed",
      borderWidth: 1.5,
      borderColor: t.colors.text,
    },
    thread: {
      borderRadius: 0,
      borderWidth: 0,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      backgroundColor: t.colors.bg,
      marginBottom: 0,
      marginHorizontal: 0,
    },
    coverBox: {
      width: 40,
      height: 40,
      borderRadius: Math.min(8, t.radius.box),
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.surfaceSunken,
    },
    title: { fontFamily: t.fonts.bold, fontSize: 14.5 * t.textScale, color: t.colors.text },
    titleTicket: {
      fontFamily: t.fonts.display,
      fontSize: 12.5 * t.textScale,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    line: {
      fontFamily: t.fonts.body,
      fontSize: 12.5 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 1,
    },
    use: {
      minHeight: 32,
      paddingHorizontal: 12,
      borderRadius: 999,
      justifyContent: "center",
      backgroundColor: t.colors.accent,
    },
    useText: { fontFamily: t.fonts.bold, fontSize: 13 * t.textScale, color: t.colors.onAccent },
    btn: { width: 38, height: 44, alignItems: "center", justifyContent: "center" },
    track: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 2,
      backgroundColor: "transparent",
    },
    trackFill: { height: 2, backgroundColor: t.colors.accent },
  });
