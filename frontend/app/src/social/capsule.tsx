import type { Post } from "@realm/contracts";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";
import { Icon } from "../icon";
import { api } from "../server";
import { type NativeTheme, useStyles, useTheme } from "../theme";

/** "23 days", "5 hours", "12 minutes": how long until a time capsule opens, as one big number. */
export function untilOpen(opensAt: string, now = Date.now()): { n: string; unit: string } {
  const ms = Date.parse(opensAt) - now;
  if (ms <= 60_000) return { n: "<1", unit: "minute" };
  const unit = (n: number, word: string) => ({ n: String(n), unit: n === 1 ? word : `${word}s` });
  // Rounded, so a capsule that opens in 22 days and 23 hours says 23 days.
  const days = ms / 86_400_000;
  if (days >= 2 * 365) return unit(Math.round(days / 365), "year");
  if (days >= 60) return unit(Math.round(days / 30.4), "month");
  if (days >= 1.5) return unit(Math.round(days), "day");
  const hours = ms / 3_600_000;
  if (hours >= 1) return unit(Math.round(hours), "hour");
  return unit(Math.max(1, Math.round(ms / 60_000)), "minute");
}

/** "Thursday 18 December 2026", with the time when it's close. */
export function opensOn(opensAt: string, now = Date.now()): string {
  const at = new Date(opensAt);
  const day = at.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  if (at.getTime() - now > 2 * 86_400_000) return day;
  return `${day}, ${at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

/** "18 Nov 2026": when a capsule was sealed. */
function shortDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** The time, ticking: every second in the last minute, every 30 seconds otherwise. */
function useNow(until: string | null) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!until) return;
    const close = Date.parse(until) - Date.now() < 120_000;
    const id = setInterval(() => setNow(Date.now()), close ? 1000 : 30_000);
    return () => clearInterval(id);
  }, [until]);
  return now;
}

/**
 * While a capsule is sealed and on screen: at the moment it opens, ask for it again, so what's
 * inside appears without a refresh. (Timers past ~24 days aren't kept; nobody stares that long.)
 */
export function useCapsuleOpening(post: Post, onChange: (p: Post) => void) {
  const opensAt = post.capsule?.sealed ? post.capsule.opensAt : null;
  useEffect(() => {
    if (!opensAt) return;
    const wait = Date.parse(opensAt) - Date.now() + 1500;
    if (wait > 2_000_000_000) return;
    const id = setTimeout(
      () => {
        api<Post>(`/posts/${post.id}`)
          .then((fresh) => {
            if (!fresh.capsule?.sealed)
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onChange({ ...fresh, repostedBy: post.repostedBy });
          })
          .catch(() => {});
      },
      Math.max(0, wait),
    );
    return () => clearTimeout(id);
  }, [opensAt, post.id, post.repostedBy, onChange]);
}

/**
 * A time capsule that hasn't opened, as everyone but its author sees it: that it exists, a
 * countdown, the day it opens, and "Remind me" (saving it, so they're told when it opens).
 * Each look has its own: Now Playing glows, Wristband is a ticket stub, Plain is a quiet box.
 */
export function SealedCapsule({
  post,
  onRemind,
  width,
}: {
  post: Post;
  onRemind: (on: boolean) => void;
  width: number;
}) {
  const { t } = useTheme();
  const s = useStyles(make);
  const opensAt = post.capsule?.opensAt ?? post.createdAt;
  const now = useNow(opensAt);
  const left = untilOpen(opensAt, now);
  const look = t.style.posts;
  const ticket = look === "ticket";
  const plain = look === "thread";
  const day = opensOn(opensAt, now);

  return (
    <View
      style={[
        s.box,
        { width },
        ticket && s.boxTicket,
        plain && s.boxPlain,
        look === "glow" && { borderColor: t.colors.accent },
      ]}
      accessible
      accessibilityLabel={`Time capsule from ${post.author.displayName}. Opens in ${left.n === "<1" ? "less than a minute" : `${left.n} ${left.unit}`}, on ${day}. What's inside stays sealed until then.`}
    >
      {look === "glow" && t.style.glow > 0 ? (
        // The light of the look: the theme's colour, fading down from the top.
        <LinearGradient
          pointerEvents="none"
          colors={[t.colors.accent, "transparent"]}
          style={[s.pool, { opacity: 0.1 + t.style.glow * 0.12 }]}
        />
      ) : null}
      <View style={[s.top, plain && s.topPlain]}>
        <View style={[s.ring, ticket && s.ringTicket, plain && s.ringPlain]}>
          <Icon name="HourglassMedium" size={plain ? 20 : 24} color={t.colors.accent} />
        </View>
        <Text style={[s.eyebrow, ticket && s.eyebrowTicket]}>
          {ticket ? "Time capsule · admit one" : "Time capsule"}
        </Text>
      </View>

      <View style={[s.count, plain && s.countPlain]}>
        <Text style={[s.n, plain && s.nPlain]} allowFontScaling={false}>
          {left.n}
        </Text>
        <Text style={s.unit}>{left.unit} to go</Text>
      </View>
      <Text style={[s.day, plain && s.left]}>Opens {day}</Text>
      <Text style={[s.hint, plain && s.left]}>
        Sealed {shortDay(post.createdAt)}. What's inside stays hidden until then.
      </Text>

      {ticket ? (
        <View style={s.tear} accessible={false}>
          <View style={[s.notch, s.notchLeft]} />
          <View style={s.tearLine} />
          <View style={[s.notch, s.notchRight]} />
        </View>
      ) : null}

      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          onRemind(!post.saved);
        }}
        accessibilityRole="button"
        accessibilityState={{ checked: post.saved }}
        accessibilityLabel={
          post.saved ? "Reminder set. Tap to cancel it." : "Remind me when it opens"
        }
        style={({ pressed }) => [
          s.remind,
          post.saved && s.remindOn,
          ticket && s.remindTicket,
          plain && s.remindPlain,
          pressed && s.pressed,
        ]}
      >
        <Icon
          name={post.saved ? "CheckBold" : "BellSimple"}
          size={16}
          color={post.saved ? t.colors.text : t.colors.onAccent}
        />
        <Text style={[s.remindText, post.saved && s.remindTextOn]}>
          {post.saved ? "We'll tell you when it opens" : "Remind me"}
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * The line above a capsule's content: for its author while it's sealed ("only you can see
 * this"), and for everyone once it has opened.
 */
export function CapsuleNote({ post, mine }: { post: Post; mine: boolean }) {
  const { t } = useTheme();
  const s = useStyles(make);
  const capsule = post.capsule;
  if (!capsule) return null;
  if (capsule.sealed && mine) {
    return (
      <View style={[s.note, s.noteSealed]} accessibilityRole="text">
        <Icon name="HourglassMedium" size={17} color={t.colors.accent} />
        <Text style={s.noteText}>
          <Text style={s.noteStrong}>Sealed until {opensOn(capsule.opensAt)}.</Text> Only you can
          see what's inside. Likes and comments open with it.
        </Text>
      </View>
    );
  }
  if (capsule.sealed) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(300).reduceMotion(ReduceMotion.System)}
      style={s.note}
      accessibilityRole="text"
    >
      <Icon name="EnvelopeSimpleOpen" size={17} color={t.colors.accent} />
      <Text style={s.noteText}>
        <Text style={s.noteStrong}>Time capsule</Text> · sealed {shortDay(post.createdAt)}, opened{" "}
        {shortDay(capsule.opensAt)}
      </Text>
    </Animated.View>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    box: {
      alignSelf: "center",
      overflow: "hidden",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 20,
      borderRadius: t.radius.media,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surfaceSunken,
    },
    boxTicket: {
      borderRadius: 0,
      borderStyle: "dashed",
      borderWidth: 2,
      borderColor: t.colors.borderStrong,
      backgroundColor: t.colors.surface,
    },
    boxPlain: {
      alignItems: "flex-start",
      paddingTop: 16,
      paddingBottom: 16,
      backgroundColor: "transparent",
    },
    pool: { position: "absolute", top: 0, left: 0, right: 0, height: 220 },
    top: { alignItems: "center", gap: 10 },
    topPlain: { flexDirection: "row", alignItems: "center" },
    ring: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: t.colors.accent,
      backgroundColor: t.colors.bg,
    },
    ringTicket: { borderRadius: 0, borderStyle: "dashed" },
    ringPlain: { width: 36, height: 36, borderRadius: 18, borderWidth: 1 },
    eyebrow: {
      fontFamily: t.fonts.bold,
      fontSize: 12.5 * t.textScale,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: t.colors.accent,
    },
    eyebrowTicket: { letterSpacing: 2 },
    count: { alignItems: "center", marginTop: 14 },
    countPlain: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 10 },
    n: {
      fontFamily: t.fonts.displayBold,
      fontSize: 64,
      lineHeight: 70,
      color: t.colors.text,
      fontVariant: ["tabular-nums"],
    },
    nPlain: { fontSize: 40, lineHeight: 46 },
    unit: {
      fontFamily: t.fonts.bold,
      fontSize: 16 * t.textScale,
      color: t.colors.textSoft,
    },
    day: {
      marginTop: 12,
      textAlign: "center",
      fontFamily: t.fonts.bold,
      fontSize: 15 * t.textScale,
      color: t.colors.text,
    },
    hint: {
      marginTop: 4,
      textAlign: "center",
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      lineHeight: 19 * t.textScale,
      color: t.colors.textSoft,
    },
    left: { textAlign: "left" },
    tear: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "stretch",
      marginTop: 18,
      marginHorizontal: -20,
    },
    tearLine: {
      flex: 1,
      marginHorizontal: 6,
      borderTopWidth: 2,
      borderStyle: "dashed",
      borderColor: t.colors.border,
    },
    notch: { width: 20, height: 20, borderRadius: 10, backgroundColor: t.colors.bg },
    notchLeft: { marginLeft: -10 },
    notchRight: { marginRight: -10 },
    remind: {
      marginTop: 18,
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 18,
      borderRadius: 999,
      backgroundColor: t.colors.accent,
    },
    remindOn: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: t.colors.borderStrong,
    },
    remindTicket: { borderRadius: 0 },
    remindPlain: { marginTop: 14 },
    remindText: { fontFamily: t.fonts.bold, fontSize: 15 * t.textScale, color: t.colors.onAccent },
    remindTextOn: { color: t.colors.text },
    pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
    note: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      marginHorizontal: 12,
      marginBottom: 8,
    },
    noteSealed: {
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surfaceSunken,
    },
    noteText: {
      flex: 1,
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      lineHeight: 19 * t.textScale,
      color: t.colors.textSoft,
    },
    noteStrong: { fontFamily: t.fonts.bold, color: t.colors.text },
  });
