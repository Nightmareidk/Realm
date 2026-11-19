import { useEffect } from "react";
import { type DimensionValue, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { type NativeTheme, useStyles } from "./theme";

/**
 * What a screen shows while its content loads: the outline of what's coming (a post, a row of
 * chats, a grid of photos), in the place it will be, instead of a spinner in the middle of
 * nothing. The screen then fills in without jumping.
 *
 * One slow pulse for the whole outline, not a shimmer per block: it's a single animated layer,
 * so it costs nothing on a weak phone, and it holds still when the system asks for less motion.
 */

export type LoadingShape = "feed" | "post" | "rows" | "songs" | "grid" | "profile" | "chat";

function Bone({
  w,
  h,
  r = 8,
  square,
}: {
  w: DimensionValue;
  h?: number;
  r?: number;
  /** As tall as it is wide (a photo, a grid tile). */
  square?: boolean;
}) {
  const s = useStyles(make);
  return (
    <View
      style={[s.bone, { width: w, borderRadius: r }, square ? { aspectRatio: 1 } : { height: h }]}
    />
  );
}

/** A post as Home draws it: who, the picture, the buttons, two lines of caption. */
function PostOutline() {
  const s = useStyles(make);
  return (
    <View style={s.post}>
      <View style={s.postHead}>
        <Bone w={36} h={36} r={18} />
        <Bone w={128} h={13} />
      </View>
      <View style={s.postMedia} />
      <View style={s.postActions}>
        <Bone w={26} h={26} r={13} />
        <Bone w={26} h={26} r={13} />
        <Bone w={26} h={26} r={13} />
      </View>
      <View style={s.postText}>
        <Bone w="72%" h={13} />
        <Bone w="44%" h={13} />
      </View>
    </View>
  );
}

/** A person, chat or song in a list: the picture, then a name and a line under it. */
function RowOutline({ songs, index }: { songs?: boolean; index: number }) {
  const s = useStyles(make);
  // Lines of different lengths, so the list doesn't look like a stack of identical bars.
  const widths: DimensionValue[][] = [
    ["46%", "72%"],
    ["38%", "58%"],
    ["52%", "66%"],
    ["41%", "49%"],
  ];
  const [name, line] = widths[index % widths.length] as [DimensionValue, DimensionValue];
  return (
    <View style={s.row}>
      {songs ? <Bone w={48} h={48} r={8} /> : <Bone w={52} h={52} r={26} />}
      <View style={s.rowText}>
        <Bone w={name} h={14} />
        <Bone w={line} h={12} />
      </View>
    </View>
  );
}

function GridOutline({ tiles = 12 }: { tiles?: number }) {
  const s = useStyles(make);
  return (
    <View style={s.grid}>
      {Array.from({ length: tiles }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholders, never reordered
        <View key={i} style={s.tile} />
      ))}
    </View>
  );
}

function ProfileOutline() {
  const s = useStyles(make);
  return (
    <View>
      <View style={s.profileTop}>
        <Bone w={88} h={88} r={44} />
        <View style={s.profileStats}>
          <Bone w={44} h={34} />
          <Bone w={44} h={34} />
          <Bone w={44} h={34} />
        </View>
      </View>
      <View style={s.profileText}>
        <Bone w="40%" h={15} />
        <Bone w="78%" h={12} />
        <Bone w="56%" h={12} />
      </View>
      <View style={s.profileButtons}>
        <View style={s.profileButton} />
        <View style={s.profileButton} />
      </View>
      <GridOutline tiles={9} />
    </View>
  );
}

/** A conversation: a few bubbles on each side, newest at the bottom. */
function ChatOutline() {
  const s = useStyles(make);
  const bubbles: { mine: boolean; w: DimensionValue; h: number }[] = [
    { mine: false, w: "58%", h: 42 },
    { mine: true, w: "44%", h: 42 },
    { mine: false, w: "70%", h: 64 },
    { mine: true, w: "62%", h: 42 },
    { mine: true, w: "36%", h: 42 },
    { mine: false, w: "48%", h: 42 },
  ];
  return (
    <View style={s.chat}>
      {bubbles.map((b, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholders, never reordered
        <View key={i} style={b.mine ? s.bubbleMine : s.bubbleTheirs}>
          <Bone w={b.w} h={b.h} r={20} />
        </View>
      ))}
    </View>
  );
}

export function Skeleton({ shape, count }: { shape: LoadingShape; count?: number }) {
  const s = useStyles(make);
  const glow = useSharedValue(1);
  useEffect(() => {
    glow.value = withRepeat(
      withTiming(0.6, {
        duration: 850,
        easing: Easing.inOut(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      -1,
      true,
    );
  }, [glow]);
  const pulse = useAnimatedStyle(() => ({ opacity: glow.value }));
  const many = (n: number) => Array.from({ length: count ?? n }, (_, i) => i);

  return (
    <Animated.View
      style={[shape === "chat" ? s.fill : s.wide, pulse]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
    >
      {shape === "feed" ? many(2).map((i) => <PostOutline key={i} />) : null}
      {shape === "post" ? <PostOutline /> : null}
      {shape === "rows" ? many(8).map((i) => <RowOutline key={i} index={i} />) : null}
      {shape === "songs" ? many(8).map((i) => <RowOutline key={i} index={i} songs />) : null}
      {shape === "grid" ? <GridOutline tiles={count} /> : null}
      {shape === "profile" ? <ProfileOutline /> : null}
      {shape === "chat" ? <ChatOutline /> : null}
    </Animated.View>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    wide: { width: "100%" },
    fill: { flex: 1, width: "100%" },
    // The theme's line colour: clear enough to read as a shape on any theme's background.
    bone: { backgroundColor: t.colors.border },

    // The same measures as the real post card, so the feed doesn't jump when it arrives.
    post: { paddingBottom: 14 },
    postHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingLeft: 12,
      paddingVertical: 8,
    },
    postMedia: { width: "100%", aspectRatio: 4 / 5, backgroundColor: t.colors.surfaceRaised },
    postActions: { flexDirection: "row", gap: 14, paddingHorizontal: 12, paddingTop: 10 },
    postText: { gap: 8, paddingHorizontal: 14, paddingTop: 12 },

    // The same height and spacing as a row in the Inbox.
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      minHeight: 72,
    },
    rowText: { flex: 1, gap: 8 },

    grid: { flexDirection: "row", flexWrap: "wrap" },
    tile: {
      width: "33.333%",
      aspectRatio: 1,
      borderWidth: 0.66,
      borderColor: t.colors.bg,
      backgroundColor: t.colors.surfaceSunken,
    },

    profileTop: { flexDirection: "row", alignItems: "center", gap: 24, padding: 16 },
    profileStats: { flex: 1, flexDirection: "row", justifyContent: "space-around" },
    profileText: { gap: 8, paddingHorizontal: 16 },
    profileButtons: { flexDirection: "row", gap: 8, padding: 16 },
    profileButton: {
      flex: 1,
      height: 40,
      borderRadius: 12,
      backgroundColor: t.colors.border,
    },

    chat: {
      flex: 1,
      justifyContent: "flex-end",
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 12,
    },
    bubbleMine: { alignItems: "flex-end" },
    bubbleTheirs: { alignItems: "flex-start" },
  });
