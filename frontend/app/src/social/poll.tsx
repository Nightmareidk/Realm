import type { Post } from "@realm/contracts";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { alert } from "../alert";
import { Icon } from "../icon";
import { ApiError, api } from "../server";
import { type NativeTheme, useStyles, useTheme } from "../theme";
import { compact } from "./time";

/** "2 days left", "5 hours left", "Ends in a few minutes". */
function left(endsAt: string) {
  const ms = Date.parse(endsAt) - Date.now();
  if (ms <= 0) return "Final result";
  const hours = Math.round(ms / 3_600_000);
  if (hours >= 48) return `${Math.round(hours / 24)} days left`;
  if (hours >= 24) return "1 day left";
  if (hours >= 2) return `${hours} hours left`;
  if (ms >= 3_600_000) return "1 hour left";
  const mins = Math.round(ms / 60_000);
  return mins > 1 ? `${mins} minutes left` : "Ends in a minute";
}

/**
 * A poll on a post. Before you vote: the choices as buttons, and no numbers, so nobody just
 * follows the crowd. After (or once it's over, or on your own post): each choice as a bar that
 * fills to its share, yours marked with a tick.
 */
export function PollCard({ post, onChange }: { post: Post; onChange: (p: Post) => void }) {
  const s = useStyles(make);
  const poll = post.poll;
  const [busy, setBusy] = useState(false);
  if (!poll) return null;
  const open = poll.options.every((o) => o.votes !== null);
  // Your own poll shows its numbers from the start, and you can still vote in it.
  const canVote = !poll.ended && poll.voted === null;

  async function vote(choice: number) {
    if (busy || !poll) return;
    setBusy(true);
    Haptics.selectionAsync();
    // Shown at once: your choice counted, the bars drawn.
    onChange({
      ...post,
      poll: {
        ...poll,
        voted: choice,
        total: poll.total + 1,
        options: poll.options.map((o, i) => ({
          ...o,
          votes: (o.votes ?? 0) + (i === choice ? 1 : 0),
        })),
      },
    });
    try {
      onChange({
        ...(await api<Post>(`/posts/${post.id}/poll/vote`, { method: "PUT", body: { choice } })),
        repostedBy: post.repostedBy,
      });
    } catch (err) {
      onChange(post);
      alert("Your vote didn't count", err instanceof ApiError ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  const top = Math.max(0, ...poll.options.map((o) => o.votes ?? 0));
  return (
    <View style={s.poll}>
      {poll.options.map((o, i) =>
        open ? (
          <Bar
            // biome-ignore lint/suspicious/noArrayIndexKey: a poll's choices never move.
            key={i}
            text={o.text}
            votes={o.votes ?? 0}
            total={poll.total}
            mine={poll.voted === i}
            leading={top > 0 && o.votes === top}
            index={i}
            onPress={canVote && !busy ? () => vote(i) : undefined}
          />
        ) : (
          <Pressable
            // biome-ignore lint/suspicious/noArrayIndexKey: a poll's choices never move.
            key={i}
            onPress={() => vote(i)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Vote for ${o.text}`}
            style={({ pressed }) => [s.choice, pressed && s.choicePressed]}
          >
            <Text style={s.choiceText} numberOfLines={2}>
              {o.text}
            </Text>
          </Pressable>
        ),
      )}
      <Text style={s.foot}>
        {compact(poll.total)} {poll.total === 1 ? "vote" : "votes"} · {left(poll.endsAt)}
        {!open ? " · Vote to see results" : canVote ? " · Tap a choice to vote" : ""}
      </Text>
    </View>
  );
}

/** One choice with its share: the bar grows from the left when the numbers arrive. */
function Bar({
  text,
  votes,
  total,
  mine,
  leading,
  index,
  onPress,
}: {
  text: string;
  votes: number;
  total: number;
  mine: boolean;
  leading: boolean;
  index: number;
  /** Set while you can still vote (your own poll, before you have). */
  onPress?: () => void;
}) {
  const { t, accent } = useTheme();
  const s = useStyles(make);
  const share = total > 0 ? votes / total : 0;
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.value = withDelay(
      index * 40,
      withTiming(share, {
        duration: 420,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [share, index, grow]);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(0.0001, grow.value) }] }));
  const percent = Math.round(share * 100);
  return (
    <Pressable
      style={({ pressed }) => [s.bar, pressed && onPress ? s.barPressed : null]}
      onPress={onPress}
      disabled={!onPress}
      accessible
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={`${onPress ? "Vote for " : ""}${text}, ${percent} percent${mine ? ", your vote" : ""}`}
    >
      <Animated.View
        style={[
          s.fill,
          { backgroundColor: mine ? accent : t.colors.borderStrong, opacity: mine ? 0.32 : 0.5 },
          fill,
        ]}
      />
      <Text style={[s.barText, (leading || mine) && s.barTextStrong]} numberOfLines={2}>
        {text}
      </Text>
      {mine ? <Icon name="CheckCircleFill" size={17} color={accent} /> : null}
      <Text style={[s.percent, (leading || mine) && s.barTextStrong]}>{percent}%</Text>
    </Pressable>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    poll: { paddingHorizontal: 14, paddingTop: 2, paddingBottom: 4, gap: 8 },
    choice: {
      minHeight: 46,
      justifyContent: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: t.radius.input,
      borderWidth: 1.5,
      borderColor: t.colors.borderStrong,
    },
    choicePressed: { backgroundColor: t.colors.surfaceRaised, transform: [{ scale: 0.985 }] },
    choiceText: {
      fontFamily: t.fonts.bold,
      fontSize: 15.5 * t.textScale,
      color: t.colors.text,
    },
    bar: {
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: t.radius.input,
      overflow: "hidden",
      backgroundColor: t.colors.surface,
    },
    barPressed: { transform: [{ scale: 0.985 }] },
    fill: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: "100%",
      transformOrigin: "left",
    },
    barText: {
      flex: 1,
      fontFamily: t.fonts.body,
      fontSize: 15.5 * t.textScale,
      color: t.colors.text,
    },
    barTextStrong: { fontFamily: t.fonts.bold },
    percent: {
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      color: t.colors.text,
      fontVariant: ["tabular-nums"],
      minWidth: 44,
      textAlign: "right",
    },
    foot: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      color: t.colors.textSoft,
      paddingTop: 2,
    },
  });
