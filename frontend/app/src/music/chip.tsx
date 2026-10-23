import type { SoundUse } from "@realm/contracts";
import { Image } from "expo-image";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Icon } from "../icon";
import { mediaSource, resolveUrl } from "../server";
import { type NativeTheme, useStyles, useTheme } from "../theme";
import { toggleFeedSound, toggleSound, usePlaying } from "./player";

/**
 * The music on a post, Story or Clip: tap to hear its part, tap again to stop. It's drawn in the
 * theme's post style, so each look has its own:
 *  - Now Playing (glow): a lit pill with moving level bars while it plays;
 *  - Wristband (ticket): a printed strip in the display face, like a band's name on a stub;
 *  - Plain and clear (thread): one quiet line of text.
 * `over` is for sitting on a photo or video, where it's always light on a dark glass.
 */
export function SoundChip({
  sound,
  playKey,
  over,
  autoPlaying,
  from = null,
}: {
  sound: SoundUse;
  /** What the player calls this (the post or Story it's on), to know it's the one playing. */
  playKey: string;
  over?: boolean;
  /** Something else plays it (a Story), so the chip only shows it and doesn't toggle. */
  autoPlaying?: boolean;
  /** Where it's from, for the Now Playing bar ("Noor's post"). */
  from?: string | null;
}) {
  const { t } = useTheme();
  const s = useStyles(make);
  const now = usePlaying();
  // A post's song may be playing by itself as you scroll (feed:) or because you tapped it.
  const feedKey = playKey.replace(/^post:/, "feed:");
  const on = autoPlaying ?? (now === playKey || now === feedKey);
  const style = t.style.posts;
  const ink = over ? "#ffffff" : style === "glow" && on ? t.colors.onAccent : t.colors.text;
  const label = `${sound.title} · ${sound.artist}`;
  const body =
    style === "ticket" ? (
      <View style={[s.ticket, over && s.overDark, on && !over && s.ticketOn]}>
        <View style={[s.notch, s.notchLeft, over && s.notchOver]} />
        <Icon
          name={on ? "Waveform" : "MusicNotesFill"}
          size={15}
          color={over ? "#fff" : on ? t.colors.onAccent : t.colors.text}
        />
        <Text
          style={[s.ticketText, { color: over ? "#fff" : on ? t.colors.onAccent : t.colors.text }]}
          numberOfLines={1}
        >
          {sound.title}
          <Text style={s.ticketBy}> / {sound.artist}</Text>
        </Text>
      </View>
    ) : style === "thread" ? (
      <View style={s.thread}>
        <Icon name="MusicNotes" size={15} color={over ? "#fff" : t.colors.textSoft} />
        <Text style={[s.threadText, over && s.white]} numberOfLines={1}>
          {label}
        </Text>
        {on ? <Text style={[s.threadOn, over && s.white]}>Playing</Text> : null}
      </View>
    ) : (
      <View
        style={[s.glow, over && s.overDark, on && !over && s.glowOn, sound.coverUrl && s.glowCover]}
      >
        {sound.coverUrl ? (
          <Image
            source={
              sound.coverUrl.startsWith("/")
                ? mediaSource(sound.coverUrl)
                : { uri: resolveUrl(sound.coverUrl) }
            }
            style={s.cover}
            contentFit="cover"
            recyclingKey={sound.coverUrl}
          />
        ) : (
          <Icon name="MusicNotesFill" size={15} color={ink} />
        )}
        <Text style={[s.glowText, { color: ink }]} numberOfLines={1}>
          {sound.title}
          <Text style={s.glowArtist}> {sound.artist}</Text>
        </Text>
        {on ? <Bars color={over ? t.colors.accent : ink} /> : null}
      </View>
    );
  if (autoPlaying !== undefined) return <View accessibilityLabel={`Music: ${label}`}>{body}</View>;
  return (
    <Pressable
      onPress={() =>
        playKey.startsWith("post:")
          ? toggleFeedSound(sound, playKey.slice(5), from ?? "a post")
          : toggleSound(sound, playKey, from)
      }
      accessibilityRole="button"
      accessibilityLabel={on ? `Stop the music: ${label}` : `Play the music: ${label}`}
      hitSlop={6}
      style={({ pressed }) => [s.press, pressed && s.pressed]}
    >
      {body}
    </Pressable>
  );
}

/** Three level bars that move while music plays (still, if the phone asks for less motion). */
export function Bars({ color }: { color: string }) {
  return (
    <View style={bars.row}>
      {[0, 1, 2].map((i) => (
        <Bar key={i} i={i} color={color} />
      ))}
    </View>
  );
}

function Bar({ i, color }: { i: number; color: string }) {
  const still = useReducedMotion();
  const h = useSharedValue(0.5);
  useEffect(() => {
    if (still) return;
    h.value = withDelay(i * 120, withRepeat(withTiming(1, { duration: 320 + i * 90 }), -1, true));
    return () => cancelAnimation(h);
  }, [h, i, still]);
  const a = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.35 + h.value * 0.65 }] }));
  return <Animated.View style={[bars.bar, { backgroundColor: color }, a]} />;
}

const bars = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 13, width: 15 },
  bar: { flex: 1, height: 13, borderRadius: 1.5 },
});

const make = (t: NativeTheme) =>
  StyleSheet.create({
    press: { alignSelf: "flex-start", maxWidth: "100%" },
    pressed: { opacity: 0.7 },
    white: { color: "#ffffff" },
    overDark: { backgroundColor: "rgba(8,8,12,0.55)", borderColor: "rgba(255,255,255,0.28)" },
    // Now Playing
    glow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      minHeight: 32,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surfaceRaised,
      maxWidth: 280,
    },
    glowOn: {
      backgroundColor: t.colors.accent,
      borderColor: t.colors.accent,
      shadowColor: t.colors.accent,
      shadowOpacity: 0.55,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 0 },
      elevation: 6,
    },
    glowText: { fontFamily: t.fonts.bold, fontSize: 13.5 * t.textScale, flexShrink: 1 },
    glowArtist: { fontFamily: t.fonts.body, opacity: 0.8 },
    glowCover: { paddingLeft: 4 },
    cover: { width: 24, height: 24, borderRadius: 999 },
    // Wristband
    ticket: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      minHeight: 30,
      paddingLeft: 16,
      paddingRight: 12,
      borderWidth: 1.5,
      borderColor: t.colors.text,
      borderStyle: "dashed",
      maxWidth: 290,
    },
    ticketOn: {
      backgroundColor: t.colors.accent,
      borderColor: t.colors.accent,
      borderStyle: "solid",
    },
    notch: {
      position: "absolute",
      top: 9,
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: t.colors.bg,
    },
    notchLeft: { left: -5 },
    notchOver: { backgroundColor: "rgba(0,0,0,0.6)" },
    ticketText: {
      fontFamily: t.fonts.display,
      fontSize: 12 * t.textScale,
      letterSpacing: 1,
      textTransform: "uppercase",
      flexShrink: 1,
    },
    ticketBy: { fontFamily: t.fonts.bold, letterSpacing: 0.4, textTransform: "none" },
    // Plain and clear
    thread: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 28 },
    threadText: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      color: t.colors.textSoft,
      flexShrink: 1,
    },
    threadOn: {
      fontFamily: t.fonts.bold,
      fontSize: 12.5 * t.textScale,
      color: t.colors.text,
      textDecorationLine: "underline",
    },
  });
