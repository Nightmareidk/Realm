import type { Conversation } from "@realm/contracts";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/icon";
import { ApiError, api } from "@/server";
import { useSession } from "@/session";
import { useSheet } from "@/sheet";
import { Avatar } from "@/social/avatar";
import { AppScreen, Empty, Loading, Problem } from "@/social/screen";
import { ago } from "@/social/time";
import { type NativeTheme, useStyles, useTheme } from "@/theme";
import {
  isMuted,
  isUnread,
  markRead,
  refreshUnread,
  setConversations,
  setMuted,
  useUnreadState,
} from "@/unread";

type Filter = "all" | "unread" | "groups";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "groups", label: "Groups" },
];

/**
 * Inbox: your messages, one-to-one and group chats. Pinned first, then newest; unread ones in
 * bold with a dot. Filter to Unread or Groups; long-press a chat to pin, mute or mark it read;
 * the pencil starts a new one.
 */
export default function Inbox() {
  const { t } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { accent } = useTheme();
  const { session } = useSession();
  const meId = session.status === "signedIn" ? session.user.id : null;
  const state = useUnreadState();
  const sheet = useSheet();
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!meId) return;
    refreshUnread(meId)
      .then(() => setError(null))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Couldn't load your chats."),
      );
  }, [meId]);
  useFocusEffect(reload);

  const items = [...state.conversations]
    .filter((c) =>
      filter === "unread" ? isUnread(c, state) : filter === "groups" ? c.type === "group_dm" : true,
    )
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        (b.lastMessage?.createdAt ?? b.createdAt).localeCompare(
          a.lastMessage?.createdAt ?? a.createdAt,
        ),
    );

  const failed = (err: unknown) =>
    sheet({
      title: "That didn't work",
      line: err instanceof ApiError ? err.message : "Try again.",
      actions: [],
    });

  function options(c: Conversation) {
    const name = title(c, meId);
    const muted = isMuted(c.id, state);
    sheet({
      title: name,
      actions: [
        {
          label: c.pinned ? "Unpin" : "Pin to the top",
          icon: "PushPin",
          onPress: async () => {
            try {
              const updated = await api<Conversation>(`/users/@me/channels/${c.id}`, {
                method: "PATCH",
                body: { pinned: !c.pinned },
              });
              setConversations(state.conversations.map((x) => (x.id === c.id ? updated : x)));
            } catch (err) {
              failed(err);
            }
          },
        },
        {
          label: muted ? "Unmute" : "Mute",
          icon: muted ? "SpeakerHigh" : "BellSlash",
          onPress: async () => {
            setMuted(c.id, !muted);
            try {
              await api(`/users/@me/mutes/channel/${c.id}`, {
                method: muted ? "DELETE" : "PUT",
                ...(muted ? {} : { body: {} }),
              });
            } catch (err) {
              setMuted(c.id, muted);
              failed(err);
            }
          },
        },
        ...(isUnread(c, state) && c.lastMessage
          ? [
              {
                label: "Mark as read",
                icon: "CheckBold" as const,
                onPress: () => {
                  const last = c.lastMessage;
                  if (!last) return;
                  markRead(c.id, last.id);
                  api(`/channels/${c.id}/ack`, { body: { messageId: last.id } }).catch(() => {});
                },
              },
            ]
          : []),
      ],
    });
  }

  return (
    <AppScreen>
      <View style={[s.head, { paddingTop: insets.top + 10 }]}>
        <View style={s.titleRow}>
          <Text style={s.title} accessibilityRole="header">
            Inbox
          </Text>
          <Pressable
            onPress={() => router.push("/new-message")}
            accessibilityRole="button"
            accessibilityLabel="New message"
            style={s.icon}
          >
            <Icon name="NotePencil" size={25} color={t.colors.text} />
          </Pressable>
        </View>
        <Text style={s.note}>Not end-to-end encrypted yet</Text>
        <View style={s.chips} accessibilityRole="tablist">
          {FILTERS.map((f) => {
            const on = filter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[
                  s.chip,
                  on && { backgroundColor: t.colors.text, borderColor: t.colors.text },
                ]}
              >
                <Text style={[s.chipText, on && { color: t.colors.bg }]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {error && !state.loaded ? (
        <Problem message={error} onRetry={reload} />
      ) : !state.loaded ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <Row
              c={item}
              meId={meId}
              unread={isUnread(item, state)}
              muted={isMuted(item.id, state)}
              accent={accent}
              onLongPress={() => options(item)}
            />
          )}
          ListEmptyComponent={
            filter === "all" ? (
              <Empty
                title="No messages yet"
                line="Tap the pencil to message someone, or open their profile and tap Message."
              />
            ) : (
              <Empty
                title={filter === "unread" ? "You're all caught up" : "No group chats yet"}
                line={filter === "unread" ? "Nothing unread right now." : undefined}
              />
            )
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

function Row({
  c,
  meId,
  unread,
  muted,
  accent,
  onLongPress,
}: {
  c: Conversation;
  meId: string | null;
  unread: boolean;
  muted: boolean;
  accent: string;
  onLongPress: () => void;
}) {
  const { t } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const other = c.recipients.find((r) => r.id !== meId) ?? c.recipients[0];
  const name = title(c, meId);
  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: "/chat/[id]", params: { id: c.id, title: name, kind: c.type } })
      }
      onLongPress={onLongPress}
      accessibilityRole="link"
      accessibilityLabel={`${name}${unread ? ", unread" : ""}${muted ? ", muted" : ""}${c.pinned ? ", pinned" : ""}. ${preview(c, meId)}`}
      accessibilityHint="Long press to pin, mute or mark as read"
      style={({ pressed }) => [s.row, pressed && { backgroundColor: t.colors.surface }]}
    >
      {other ? <Avatar user={other} size={52} /> : null}
      <View style={s.fill}>
        <View style={s.top}>
          <Text style={[s.name, unread && s.strong]} numberOfLines={1}>
            {name}
          </Text>
          {c.pinned ? <Icon name="PushPin" size={14} color={t.colors.textSoft} /> : null}
          {muted ? <Icon name="BellSlash" size={14} color={t.colors.textSoft} /> : null}
          {c.lastMessage ? (
            <Text style={[s.when, unread && { color: t.colors.text }]}>
              {ago(c.lastMessage.createdAt)}
            </Text>
          ) : null}
        </View>
        <View style={s.bottom}>
          <Text style={[s.preview, unread && s.previewUnread]} numberOfLines={1}>
            {preview(c, meId)}
          </Text>
          {unread ? (
            <View style={[s.dot, { backgroundColor: muted ? t.colors.textSoft : accent }]} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    head: {
      paddingHorizontal: 16,
      paddingBottom: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    title: {
      fontFamily: t.fonts.displayBold,
      fontSize: 28 * t.textScale,
      color: t.colors.text,
      letterSpacing: -0.5,
    },
    icon: {
      width: 48,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
      marginRight: -10,
    },
    note: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 2,
    },
    chips: { flexDirection: "row", gap: 8, marginTop: 12 },
    chip: {
      minHeight: 36,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: t.colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    chipText: { fontFamily: t.fonts.bold, fontSize: 14 * t.textScale, color: t.colors.text },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      minHeight: 72,
    },
    top: { flexDirection: "row", alignItems: "center", gap: 6 },
    name: { flex: 1, fontFamily: t.fonts.bold, fontSize: 16 * t.textScale, color: t.colors.text },
    strong: { fontFamily: t.fonts.bold },
    when: { fontFamily: t.fonts.body, fontSize: 13 * t.textScale, color: t.colors.textSoft },
    bottom: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
    preview: {
      flex: 1,
      fontFamily: t.fonts.body,
      fontSize: 14.5 * t.textScale,
      color: t.colors.textSoft,
    },
    previewUnread: { fontFamily: t.fonts.bold, color: t.colors.text },
    dot: { width: 10, height: 10, borderRadius: 5 },
  });
