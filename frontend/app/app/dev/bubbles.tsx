import type { Message, UserSummary } from "@realm/contracts";
import { Redirect } from "expo-router";
import { FlatList, StyleSheet } from "react-native";
import { MessageRow } from "@/chat/message-row";
import { AppScreen, TopBar } from "@/social/screen";
import { useTheme } from "@/theme";

/**
 * Developer builds only: a made-up conversation drawn with the real chat bubbles, for checking
 * their layout at any window width and in every look without signing in or a server. Nothing
 * here is sent anywhere.
 */

const them: UserSummary = {
  id: "2",
  username: "noor",
  displayName: "Noor",
  avatarUrl: null,
  accentColor: null,
};
const me: UserSummary = { ...them, id: "1", username: "you", displayName: "You" };

function sample(id: number, author: UserSummary, content: string, extra: Partial<Message> = {}) {
  const message: Message = {
    id: String(id),
    channelId: "9",
    author,
    type: "default",
    content,
    attachments: [],
    reactions: [],
    replyTo: null,
    mentions: [],
    mentionEveryone: false,
    pinned: false,
    place: null,
    hidden: false,
    editedAt: null,
    createdAt: new Date(Date.UTC(2026, 10, 15, 18, id)).toISOString(),
    nonce: null,
    viewLimit: null,
    viewsLeft: null,
    opened: false,
    ...extra,
  };
  return message;
}

const LONG =
  "A long one, to see how a bubble wraps when the window is narrow: it should never be cut off at either edge, whatever is beside it.";

// Newest first, as the chat screen keeps them.
const MESSAGES = [
  sample(6, me, "Short one"),
  sample(5, them, LONG, { editedAt: new Date(Date.UTC(2026, 10, 15, 18, 6)).toISOString() }),
  sample(4, me, LONG, { reactions: [{ emoji: "🔥", count: 1, me: false }] }),
  sample(3, them, "Replying to you", {
    type: "reply",
    replyTo: { id: "2", author: me, content: "Are we still on for tonight?" },
  }),
  sample(2, me, "Are we still on for tonight?"),
  sample(1, them, "hello, can you read this?", {
    reactions: [{ emoji: "❤️", count: 1, me: true }],
  }),
];

const nothing = () => {};

export default function Bubbles() {
  const theme = useTheme();
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <AppScreen>
      <TopBar title="Chat bubbles" />
      <FlatList
        inverted
        data={MESSAGES}
        keyExtractor={(m) => m.id}
        contentContainerStyle={s.list}
        renderItem={({ item }) => (
          <MessageRow
            m={item}
            mine={item.author.id === me.id}
            showName={false}
            status={item.id === "6" ? "seen" : null}
            accent={theme.accent}
            onAccent={theme.onAccent}
            onReply={nothing}
            onReact={nothing}
            onMenu={nothing}
            onOpenPhoto={nothing}
          />
        )}
      />
    </AppScreen>
  );
}

// The same padding as the chat screen's list.
const s = StyleSheet.create({ list: { paddingHorizontal: 10, paddingVertical: 12 } });
