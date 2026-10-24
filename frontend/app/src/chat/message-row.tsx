import type { MediaRef, Message } from "@realm/contracts";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { memo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
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
import { type NativeTheme, useStyles, useTheme } from "../theme";
import { linkedPostId, PostLinkCard } from "./post-link";

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

/** Pressable state on the web also says when the mouse is over it. */
type Hover = { pressed: boolean; hovered?: boolean };

/** A mouse and a big screen (the website, the browser preview): menus open from buttons. */
const POINTER = Platform.OS === "web";

/**
 * One message in a chat. Yours sit on the right in your colour, others' on the left. On a phone:
 * pull it to the right to reply, double-tap to send a heart, hold for everything else. With a
 * mouse, pointing at it shows the same choices as buttons (react, reply, more). Each gesture is
 * also an accessibility action, so screen-reader users have the same choices.
 */
type RowProps = {
  m: Message;
  mine: boolean;
  /** Group chats and rooms: the sender's name above their first message in a run. */
  showName: boolean;
  /** Under your newest message: "Sent", then "Seen" once the other person has read it. */
  status: "sent" | "seen" | null;
  accent: string;
  onAccent: string;
  onReply: (m: Message) => void;
  onReact: (m: Message, emoji: string) => void;
  onMenu: (m: Message) => void;
  /** A photo tapped: open it full screen (or, sent to view once, ask for it). */
  onOpenPhoto: (m: Message, index: number) => void;
};

export const MessageRow = memo(function MessageRow(props: RowProps) {
  const s = useStyles(make);
  if (props.m.type.startsWith("system_")) {
    return <Text style={s.system}>{systemLine(props.m)}</Text>;
  }
  return <Bubble {...props} />;
});

function Bubble({
  m,
  mine,
  showName,
  status,
  accent,
  onAccent,
  onReply,
  onReact,
  onMenu,
  onOpenPhoto,
}: RowProps) {
  const { t } = useTheme();
  const s = useStyles(make);
  const [hover, setHover] = useState(false);
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
  const shared = m.hidden ? null : linkedPostId(m.content);
  const ink = mine ? onAccent : t.colors.text;
  const soft = mine ? onAccent : t.colors.textSoft;

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
      {m.viewLimit && images.length ? (
        <OnceCard m={m} mine={mine} ink={ink} soft={soft} onOpen={() => onOpenPhoto(m, 0)} />
      ) : (
        images.map((a, i) => (
          <Pressable
            key={a.id}
            onPress={() => onOpenPhoto(m, i)}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Photo ${i + 1} of ${images.length}. Open full screen`}
          >
            <Photo media={a} />
          </Pressable>
        ))
      )}
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

  // With a mouse: react, reply and more, beside the bubble while the pointer is on the message.
  const tools = POINTER ? (
    <View
      style={[s.tools, mine && s.toolsMine, !hover && s.toolsHidden]}
      pointerEvents={hover ? "auto" : "none"}
    >
      {canTouch ? (
        <>
          <Pressable
            onPress={heart}
            accessibilityRole="button"
            accessibilityLabel="React with a heart"
            style={({ hovered }: Hover) => [s.tool, hovered && s.toolOn]}
          >
            <Icon name="Heart" size={17} color={t.colors.textSoft} />
          </Pressable>
          <Pressable
            onPress={replyNow}
            accessibilityRole="button"
            accessibilityLabel="Reply"
            style={({ hovered }: Hover) => [s.tool, hovered && s.toolOn]}
          >
            <Icon name="ArrowBendUpLeft" size={17} color={t.colors.textSoft} />
          </Pressable>
        </>
      ) : null}
      <Pressable
        onPress={() => onMenu(m)}
        accessibilityRole="button"
        accessibilityLabel="More options"
        style={({ hovered }: Hover) => [s.tool, hovered && s.toolOn]}
      >
        <Icon name="DotsThreeBold" size={17} color={t.colors.textSoft} />
      </Pressable>
    </View>
  ) : null;

  return (
    <Pressable
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      disabled={!POINTER}
      style={[s.row, mine ? s.rowMine : s.rowTheirs]}
      accessible
      accessibilityLabel={`${mine ? "You" : m.author.displayName}: ${bodyOf(m)}. ${timeOf(m.createdAt)}${m.editedAt ? ", edited" : ""}${status === "seen" ? ". Seen" : status === "sent" ? ". Sent" : ""}`}
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
      {mine ? tools : null}
      <View style={[s.col, mine && s.colMine]}>
        {showName && !mine ? <Text style={s.author}>{m.author.displayName}</Text> : null}
        <View>
          <Animated.View style={[s.replyHint, hint]} pointerEvents="none">
            <Icon name="ArrowBendUpLeft" size={18} color={t.colors.textSoft} />
          </Animated.View>
          <GestureDetector gesture={gestures}>
            <Animated.View style={moved}>
              {shared ? <PostLinkCard id={shared} /> : null}
              {bubble}
            </Animated.View>
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
        {status ? <Text style={s.seen}>{status === "seen" ? "Seen" : "Sent"}</Text> : null}
      </View>
      {mine ? null : tools}
    </Pressable>
  );
}

/**
 * A photo sent to view once (or with one replay): no picture in the chat, just a card. Its sender
 * sees Delivered, then Opened; the other person taps to view, until the views are used.
 */
function OnceCard({
  m,
  mine,
  ink,
  soft,
  onOpen,
}: {
  m: Message;
  mine: boolean;
  ink: string;
  soft: string;
  onOpen: () => void;
}) {
  const s = useStyles(make);
  const left = m.viewsLeft ?? m.viewLimit ?? 0;
  const gone = !mine && left <= 0;
  const title = m.viewLimit === 2 ? "Photo · replay allowed" : "Photo · view once";
  const line = mine
    ? m.opened
      ? "Opened"
      : "Delivered"
    : gone
      ? "Opened"
      : left === 2
        ? "Tap to view"
        : m.viewLimit === 2
          ? "Tap to view again"
          : "Tap to view";
  return (
    <Pressable
      onPress={onOpen}
      disabled={mine || gone}
      accessibilityRole={mine || gone ? undefined : "button"}
      accessibilityLabel={`${title}. ${line}`}
      style={({ pressed }) => [s.once, pressed && s.oncePressed]}
    >
      <View style={[s.onceIcon, { borderColor: ink }, gone && s.onceGone]}>
        <Text style={[s.onceNumber, { color: ink }]}>{m.viewLimit}</Text>
      </View>
      <View>
        <Text style={[s.onceTitle, { color: ink }]}>{title}</Text>
        <Text style={[s.onceLine, { color: soft }]}>{line}</Text>
      </View>
    </Pressable>
  );
}

/** A photo in a message, sized from what the server measured, so the chat doesn't jump. */
function Photo({ media }: { media: MediaRef }) {
  const s = useStyles(make);
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

const make = (t: NativeTheme) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 3 },
    rowMine: { justifyContent: "flex-end" },
    rowTheirs: { justifyContent: "flex-start" },
    gap: { width: 28 },
    col: { maxWidth: "82%" },
    colMine: { alignItems: "flex-end" },
    author: {
      fontFamily: t.fonts.bold,
      fontSize: 12.5 * t.textScale,
      color: t.colors.textSoft,
      marginLeft: 12,
      marginBottom: 3,
      marginTop: 8,
    },
    bubble: {
      maxWidth: BUBBLE_MAX,
      borderRadius: t.style.bubbles === "square" ? 6 : t.style.bubbles === "soft" ? 12 : 20,
      paddingHorizontal: 14,
      paddingVertical: 9,
      gap: 6,
    },
    // A photo on its own: a thin frame (the side padding has to be undone by name, not by "padding").
    bare: { paddingHorizontal: 4, paddingVertical: 4 },
    theirs: { backgroundColor: t.colors.surfaceSunken },
    text: { fontFamily: t.fonts.body, fontSize: 15.5 * t.textScale, lineHeight: 21 * t.textScale },
    hiddenText: { fontStyle: "italic" },
    time: { fontFamily: t.fonts.body, fontSize: 11.5 * t.textScale, opacity: 0.75 },
    timeAlone: { alignSelf: "flex-end", paddingHorizontal: 8, paddingBottom: 2 },
    quote: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
    quoteMine: { backgroundColor: "rgba(0,0,0,0.14)" },
    quoteTheirs: { backgroundColor: "rgba(255,255,255,0.07)" },
    quoteName: { fontFamily: t.fonts.bold, fontSize: 13 * t.textScale },
    quoteText: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      lineHeight: 18 * t.textScale,
    },
    photo: { borderRadius: 14, backgroundColor: t.colors.surfaceRaised },
    file: { flexDirection: "row", alignItems: "center", gap: 8 },
    fileName: { flexShrink: 1, fontFamily: t.fonts.bold, fontSize: 14.5 * t.textScale },
    replyHint: { position: "absolute", left: 4, top: 0, bottom: 0, justifyContent: "center" },
    reactions: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 3, marginLeft: 6 },
    reactionsMine: { justifyContent: "flex-end", marginLeft: 0, marginRight: 6 },
    reaction: {
      minHeight: 30,
      minWidth: 44,
      paddingHorizontal: 9,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    reactionText: { fontFamily: t.fonts.bold, fontSize: 13 * t.textScale, color: t.colors.text },
    once: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 6,
      paddingRight: 8,
      minWidth: 180,
    },
    oncePressed: { opacity: 0.7 },
    onceIcon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 2,
      borderStyle: "dashed",
      alignItems: "center",
      justifyContent: "center",
    },
    onceGone: { opacity: 0.5, borderStyle: "solid" },
    onceNumber: { fontFamily: t.fonts.bold, fontSize: 13 * t.textScale },
    onceTitle: { fontFamily: t.fonts.bold, fontSize: 14.5 * t.textScale },
    onceLine: { fontFamily: t.fonts.body, fontSize: 13 * t.textScale, marginTop: 1 },
    tools: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "center",
      gap: 2,
      marginHorizontal: 6,
    },
    toolsMine: { flexDirection: "row-reverse" },
    toolsHidden: { opacity: 0 },
    tool: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
    },
    toolOn: { backgroundColor: t.colors.surfaceRaised },
    seen: {
      fontFamily: t.fonts.body,
      fontSize: 12 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 3,
      marginRight: 6,
    },
    system: {
      alignSelf: "center",
      fontFamily: t.fonts.body,
      fontSize: 13 * t.textScale,
      color: t.colors.textSoft,
      paddingVertical: 8,
      paddingHorizontal: 20,
      textAlign: "center",
    },
  });
