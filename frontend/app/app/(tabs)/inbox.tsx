import type { Conversation } from "@realm/contracts";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi } from "@/data";
import { useLiveEvent } from "@/live";
import { useSession } from "@/session";
import { Avatar } from "@/social/avatar";
import { AppScreen, Empty, Loading, Problem } from "@/social/screen";
import { ago } from "@/social/time";
import { fonts, roles } from "@/theme";

/** Inbox: your messages, one-to-one and group chats, newest first. */
export default function Inbox() {
  const insets = useSafeAreaInsets();
  const list = useApi<{ conversations: Conversation[] }>("/users/@me/channels");
  useFocusEffect(
    useCallback(() => {
      list.reload();
    }, [list.reload]),
  );
  // A new message in any of your conversations moves it to the top.
  useLiveEvent("MESSAGE_CREATE", (m) => {
    if (list.data?.conversations.some((c) => c.id === m.channelId) ?? true) list.reload();
  });
  useLiveEvent("CHANNEL_CREATE", () => list.reload());
  const items = [...(list.data?.conversations ?? [])].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      (b.lastMessage?.createdAt ?? b.createdAt).localeCompare(
        a.lastMessage?.createdAt ?? a.createdAt,
      ),
  );
  return (
    <AppScreen>
      <View style={[s.head, { paddingTop: insets.top + 10 }]}>
        <Text style={s.title} accessibilityRole="header">
          Inbox
        </Text>
        <Text style={s.note}>Not end-to-end encrypted yet</Text>
      </View>
      {list.error && !list.data ? (
        <Problem message={list.error} onRetry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => <Row c={item} />}
          ListEmptyComponent={
            <Empty
              title="No messages yet"
              line="Open someone's profile and tap Message to start a conversation."
            />
          }
        />
      )}
    </AppScreen>
  );
}

function title(c: Conversation, meId: string | null) {
  if (c.name) return c.name;
  const others = c.recipients.filter((r) => r.id !== meId);
  return others.map((r) => r.displayName).join(", ") || "Just you";
}

function preview(c: Conversation, meId: string | null) {
  const m = c.lastMessage;
  if (!m) return "Say hi";
  const who = m.authorId === meId ? "You: " : "";
  const body =
    m.content ||
    (m.place
      ? "Shared a place"
      : m.attachmentKind === "image"
        ? "Photo"
        : m.attachmentKind === "audio"
          ? "Voice message"
          : m.attachmentKind === "video"
            ? "Video"
            : "File");
  return `${who}${body}`;
}

function Row({ c }: { c: Conversation }) {
  const router = useRouter();
  const { session } = useSession();
  const meId = session.status === "signedIn" ? session.user.id : null;
  const other = c.recipients.find((r) => r.id !== meId) ?? c.recipients[0];
  const name = title(c, meId);
  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: "/chat/[id]", params: { id: c.id, title: name, kind: c.type } })
      }
      accessibilityRole="link"
      accessibilityLabel={`${name}. ${preview(c, meId)}`}
      style={s.row}
    >
      {other ? <Avatar user={other} size={52} /> : null}
      <View style={s.fill}>
        <View style={s.top}>
          <Text style={s.name} numberOfLines={1}>
            {name}
          </Text>
          {c.lastMessage ? <Text style={s.when}>{ago(c.lastMessage.createdAt)}</Text> : null}
        </View>
        <Text style={s.preview} numberOfLines={1}>
          {preview(c, meId)}
        </Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  head: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: roles.border,
  },
  title: { fontFamily: fonts.displayBold, fontSize: 28, color: roles.text, letterSpacing: -0.5 },
  note: { fontFamily: fonts.body, fontSize: 13.5, color: roles.textSoft, marginTop: 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 72,
  },
  top: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  name: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: roles.text },
  when: { fontFamily: fonts.body, fontSize: 13, color: roles.textSoft },
  preview: { fontFamily: fonts.body, fontSize: 14.5, color: roles.textSoft, marginTop: 2 },
});
