import type { MediaRef, Message } from "@realm/contracts";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Icon } from "../icon";
import { mediaSource } from "../server";
import { Avatar } from "../social/avatar";
import { fonts, roles } from "../theme";

/** The same quick six as the website; double-tap sends the first. */
export const QUICK_REACTIONS = ["❤️", "😂", "👍", "😮", "😢", "🔥"] as const;

/** How far a bubble must be pulled to the right to reply to it. */
const REPLY_AT = 56;
const BUBBLE_MAX = 280;

export const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

/** What a message is, said in words: its text, or what it holds. */
export function bodyOf(m: Pick<Message, "hidden" | "content" | "attachments" | "place">) {
  if (m.hidden) return "Hidden after reports";
  if (m.content) return m.content;
  if (m.place) return `Shared a place: ${m.place.name}`;
  const first = m.attachments[0];
  if (!first) return "";
  return first.kind === "image"
    ? m.attachments.length > 1
      ? `${m.attachments.length} photos`
      : "Photo"
    : first.kind === "video"
      ? "Video"
      : first.kind === "audio"
        ? "Voice message"
        : (first.filename ?? "File");
}

/** The line a system message stands for ("Noor joined"), shown in the middle of the chat. */
function systemLine(m: Message) {
  const who = m.author.displayName;
  switch (m.type) {
    case "system_join":
      return `${who} joined`;
    case "system_pin":
      return `${who} pinned a message`;
    case "system_channel_rename":
      return `${who} renamed the chat${m.content ? ` to "${m.content}"` : ""}`;
    case "system_recipient_add":
      return `${who} added someone to the chat`;
    case "system_recipient_remove":
      return `${who} left the chat`;
    default:
      return m.content;
  }
}

/**
 * One message in a chat. Yours sit on the right in your colour, others' on the left. Pull it to
 * the right to reply, double-tap to send a heart, long-press for everything else. Each gesture is
 * also an accessibility action, so screen-reader users have the same choices.
 */
type RowProps = {
  m: Message;
  mine: boolean;
  /** Group chats and rooms: the sender's name above their first message in a run. */
  showName: boolean;
  /** "Seen" under your newest message, once the other person has read it. */
  seen: boolean;
  accent: string;
  onAccent: string;
  onReply: (m: Message) => void;
  onReact: (m: Message, emoji: string) => void;
  onMenu: (m: Message) => void;
};

export const MessageRow = memo(function MessageRow(props: RowProps) {
  if (props.m.type.startsWith("system_")) {
    return <Text style={s.system}>{systemLine(props.m)}</Text>;
  }
  return <Bubble {...props} />;
});

function Bubble({ m, mine, showName, seen, accent, onAccent, onReply, onReact, onMenu }: RowProps) {
  const shift = useSharedValue(0);
  const armed = useSharedValue(false);

  const canTouch = !m.hidden;
  const replyNow = () => onReply(m);
  const heart = () => {
    Haptics.selectionAsync();
    if (!m.reactions.some((r) => r.emoji === QUICK_REACTIONS[0] && r.me)) {
      onReact(m, QUICK_REACTIONS[0]);
    }
  };
  const menu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onMenu(m);
  };
  const tick = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

  const pan = Gesture.Pan()
    .activeOffsetX(14)
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      const x = Math.max(0, Math.min(e.translationX, REPLY_AT + 24));
      shift.value = x;
      if (x >= REPLY_AT && !armed.value) {
        armed.value = true;
        scheduleOnRN(tick);
      } else if (x < REPLY_AT) {
        armed.value = false;
      }
    })
    .onEnd(() => {
      if (armed.value) scheduleOnRN(replyNow);
      armed.value = false;
      shift.value = withSpring(0, {
        damping: 18,
        stiffness: 240,
        reduceMotion: ReduceMotion.System,
      });
    });
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scheduleOnRN(heart);
    });
  const hold = Gesture.LongPress()
    .minDuration(420)
    .onStart(() => {
      scheduleOnRN(menu);
    });
  const gestures = canTouch ? Gesture.Race(pan, hold, doubleTap) : hold;

  const moved = useAnimatedStyle(() => ({ transform: [{ translateX: shift.value }] }));
  const hint = useAnimatedStyle(() => ({ opacity: Math.min(1, shift.value / REPLY_AT) }));

  const images = m.hidden ? [] : m.attachments.filter((a) => a.kind === "image");
  const files = m.hidden ? [] : m.attachments.filter((a) => a.kind !== "image");
  const text = m.hidden ? "Hidden after reports" : m.content;
  const ink = mine ? onAccent : roles.text;
  const soft = mine ? onAccent : roles.textSoft;

  const bubble = (
    <View
      style={[
        s.bubble,
        mine ? { backgroundColor: accent } : s.theirs,
        images.length > 0 && !text && s.bare,
      ]}
    >
      {m.replyTo ? (
        <View style={[s.quote, mine ? s.quoteMine : s.quoteTheirs]}>
          <Text style={[s.quoteName, { color: ink }]} numberOfLines={1}>
            {m.replyTo.author.displayName}
          </Text>
          <Text style={[s.quoteText, { color: soft }]} numberOfLines={2}>
            {m.replyTo.content ?? "Deleted message"}
          </Text>
        </View>
      ) : null}
      {images.map((a) => (
        <Photo key={a.id} media={a} />
      ))}
      {files.map((a) => (
        <View key={a.id} style={s.file}>
          <Icon name="Article" size={18} color={ink} />
          <Text style={[s.fileName, { color: ink }]} numberOfLines={1}>
            {a.filename ??
              (a.kind === "video" ? "Video" : a.kind === "audio" ? "Voice message" : "File")}
          </Text>
        </View>
      ))}
      {text || m.place ? (
        <Text style={[s.text, { color: ink }, m.hidden && s.hiddenText]}>
          {text || `Shared a place: ${m.place?.name}`}
          <Text style={[s.time, { color: soft }]}>
            {"  "}
            {m.editedAt ? "edited · " : ""}
            {timeOf(m.createdAt)}
          </Text>
        </Text>
      ) : (
        <Text style={[s.time, s.timeAlone, { color: soft }]}>{timeOf(m.createdAt)}</Text>
      )}
    </View>
  );

  return (
    <View
      style={[s.row, mine ? s.rowMine : s.rowTheirs]}
      accessible
      accessibilityLabel={`${mine ? "You" : m.author.displayName}: ${bodyOf(m)}. ${timeOf(m.createdAt)}${m.editedAt ? ", edited" : ""}${seen ? ". Seen" : ""}`}
      accessibilityActions={[
        { name: "reply", label: "Reply" },
        { name: "heart", label: "React with a heart" },
        { name: "menu", label: "More options" },
      ]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "reply") replyNow();
        if (e.nativeEvent.actionName === "heart") heart();
        if (e.nativeEvent.actionName === "menu") menu();
      }}
    >
      {!mine ? showName ? <Avatar user={m.author} size={28} /> : <View style={s.gap} /> : null}
      <View style={[s.col, mine && s.colMine]}>
        {showName && !mine ? <Text style={s.author}>{m.author.displayName}</Text> : null}
        <View>
          <Animated.View style={[s.replyHint, hint]} pointerEvents="none">
            <Icon name="ArrowBendUpLeft" size={18} color={roles.textSoft} />
          </Animated.View>
          <GestureDetector gesture={gestures}>
            <Animated.View style={moved}>{bubble}</Animated.View>
          </GestureDetector>
        </View>
        {m.reactions.length ? (
          <View style={[s.reactions, mine && s.reactionsMine]}>
            {m.reactions.map((r) => (
              <Pressable
                key={r.emoji}
                onPress={() => onReact(m, r.emoji)}
                accessibilityRole="button"
                accessibilityLabel={`${r.emoji} ${r.count}${r.me ? ", yours. Tap to take it back" : ". Tap to add yours"}`}
                style={[s.reaction, r.me && { borderColor: accent }]}
              >
                <Text style={s.reactionText}>
                  {r.emoji} {r.count}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {seen ? <Text style={s.seen}>Seen</Text> : null}
      </View>
    </View>
  );
}

/** A photo in a message, sized from what the server measured, so the chat doesn't jump. */
function Photo({ media }: { media: MediaRef }) {
  const ratio = media.width && media.height ? media.width / media.height : 4 / 3;
  const width = BUBBLE_MAX - 8;
  const height = Math.min(360, Math.max(140, width / ratio));
  return (
    <Image
      source={mediaSource(media.url)}
      style={[s.photo, { width, height }]}
      contentFit="cover"
      recyclingKey={media.id}
      transition={120}
      accessibilityLabel="Photo"
    />
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 3 },
  rowMine: { justifyContent: "flex-end" },
  rowTheirs: { justifyContent: "flex-start" },
  gap: { width: 28 },
  col: { maxWidth: "82%" },
  colMine: { alignItems: "flex-end" },
  author: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: roles.textSoft,
    marginLeft: 12,
    marginBottom: 3,
    marginTop: 8,
  },
  bubble: {
    maxWidth: BUBBLE_MAX,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 6,
  },
  // A photo on its own: a thin frame (the side padding has to be undone by name, not by "padding").
  bare: { paddingHorizontal: 4, paddingVertical: 4 },
  theirs: { backgroundColor: roles.surfaceSunken },
  text: { fontFamily: fonts.body, fontSize: 15.5, lineHeight: 21 },
  hiddenText: { fontStyle: "italic" },
  time: { fontFamily: fonts.body, fontSize: 11.5, opacity: 0.75 },
  timeAlone: { alignSelf: "flex-end", paddingHorizontal: 8, paddingBottom: 2 },
  quote: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  quoteMine: { backgroundColor: "rgba(0,0,0,0.14)" },
  quoteTheirs: { backgroundColor: "rgba(255,255,255,0.07)" },
  quoteName: { fontFamily: fonts.bold, fontSize: 13 },
  quoteText: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 18 },
  photo: { borderRadius: 14, backgroundColor: roles.surfaceRaised },
  file: { flexDirection: "row", alignItems: "center", gap: 8 },
  fileName: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 14.5 },
  replyHint: { position: "absolute", left: 4, top: 0, bottom: 0, justifyContent: "center" },
  reactions: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 3, marginLeft: 6 },
  reactionsMine: { justifyContent: "flex-end", marginLeft: 0, marginRight: 6 },
  reaction: {
    minHeight: 30,
    minWidth: 44,
    paddingHorizontal: 9,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: roles.border,
    backgroundColor: roles.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  reactionText: { fontFamily: fonts.bold, fontSize: 13, color: roles.text },
  seen: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: roles.textSoft,
    marginTop: 3,
    marginRight: 6,
  },
  system: {
    alignSelf: "center",
    fontFamily: fonts.body,
    fontSize: 13,
    color: roles.textSoft,
    paddingVertical: 8,
    paddingHorizontal: 20,
    textAlign: "center",
  },
});
