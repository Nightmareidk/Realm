import type { Message, MessagePage } from "@realm/contracts";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/icon";
import { live, useLiveEvent, useLiveStatus } from "@/live";
import { ApiError, api } from "@/server";
import { useSession } from "@/session";
import { useSheet } from "@/sheet";
import { Avatar } from "@/social/avatar";
import { useSafety } from "@/social/safety";
import { AppScreen, Loading, TopBar } from "@/social/screen";
import { fonts, roles, useTheme } from "@/theme";

/** A short id for an outgoing message, so its echo can be matched. */
const nonce = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/** Whether snowflake `a` is older than `b` (as numbers: a longer ID is a later one). */
const older = (a: string, b: string) => (a.length === b.length ? a < b : a.length < b.length);

/** How long "typing…" shows after the last signal (the gateway sends one every few seconds). */
const TYPING_MS = 8_000;
/** Without the live connection, look for new messages this often. */
const FALLBACK_MS = 10_000;

/**
 * A conversation or a Space room: newest at the bottom, your messages in your colour, and a box to
 * write. Messages arrive live; if the live connection is down it checks every few seconds, and
 * catches up when it's back. Long-press someone's message to report it.
 */
export default function Chat() {
  const { id, title, kind } = useLocalSearchParams<{ id: string; title?: string; kind?: string }>();
  const insets = useSafeAreaInsets();
  const { accent, onAccent } = useTheme();
  const { session } = useSession();
  const meId = session.status === "signedIn" ? session.user.id : null;
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  /** Who's typing here, and until when. */
  const [typing, setTyping] = useState<Record<string, number>>({});
  const mounted = useRef(true);
  const status = useLiveStatus();
  const sheet = useSheet();
  const safety = useSafety();

  const load = useCallback(async () => {
    try {
      const page = await api<MessagePage>(`/channels/${id}/messages?limit=50`);
      if (mounted.current) setMessages(page.messages);
    } catch {
      if (mounted.current) setMessages((m) => m ?? []);
    }
  }, [id]);

  // Load on open and whenever the live line comes back (to fill the gap); without it, check often.
  useFocusEffect(
    useCallback(() => {
      mounted.current = true;
      load();
      const t = status === "live" ? null : setInterval(load, FALLBACK_MS);
      return () => {
        mounted.current = false;
        if (t) clearInterval(t);
      };
    }, [load, status]),
  );

  /** Put a message in its place: newest first, its own optimistic copy replaced. */
  const upsert = useCallback((m: Message) => {
    setMessages((list) => {
      const rest = (list ?? []).filter((x) => x.id !== m.id && !(m.nonce && x.nonce === m.nonce));
      const at = rest.findIndex((x) => older(x.id, m.id));
      return at === -1 ? [...rest, m] : [...rest.slice(0, at), m, ...rest.slice(at)];
    });
  }, []);

  useLiveEvent("MESSAGE_CREATE", (m) => {
    if (m.channelId !== id) return;
    upsert(m);
    setTyping(({ [m.author.id]: _, ...rest }) => rest);
  });
  useLiveEvent("MESSAGE_UPDATE", (m) => {
    if (m.channelId !== id) return;
    setMessages((list) => list?.map((x) => (x.id === m.id ? m : x)) ?? list);
  });
  useLiveEvent("MESSAGE_DELETE", (d) => {
    if (d.channelId !== id) return;
    setMessages((list) => list?.filter((x) => x.id !== d.id) ?? list);
  });
  useLiveEvent("TYPING_START", (d) => {
    if (d.channelId !== id || d.userId === meId) return;
    setTyping((t) => ({ ...t, [d.userId]: Date.now() + TYPING_MS }));
  });

  // Typing markers fade on their own once nobody's been typing for a while.
  const anyTyping = Object.keys(typing).length > 0;
  useEffect(() => {
    if (!anyTyping) return;
    const t = setInterval(() => {
      const now = Date.now();
      setTyping((all) => {
        const left = Object.fromEntries(Object.entries(all).filter(([, until]) => until > now));
        return Object.keys(left).length === Object.keys(all).length ? all : left;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [anyTyping]);

  async function send() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const made = await api<Message>(`/channels/${id}/messages`, {
        body: { content, nonce: nonce() },
      });
      upsert(made);
      live.sent(id);
      setText("");
    } catch (err) {
      Alert.alert("Not sent", err instanceof ApiError ? err.message : "Try again.");
    } finally {
      setSending(false);
    }
  }

  /** Long-press: report someone else's message (or block them, from a DM). */
  function options(m: Message) {
    if (m.author.id === meId) return;
    sheet({
      actions: [
        {
          label: "Report message",
          icon: "Flag",
          danger: true,
          onPress: () => safety.report("message", m.id, m.author),
        },
        {
          label: `Block @${m.author.username}`,
          icon: "Prohibit",
          danger: true,
          onPress: () => safety.block(m.author),
        },
      ],
    });
  }

  const typers = Object.keys(typing).map(
    (uid) => messages?.find((m) => m.author.id === uid)?.author.displayName ?? "Someone",
  );

  const isDm = kind === "dm" || kind === "group_dm";
  return (
    <AppScreen>
      <TopBar title={title ?? "Chat"} />
      {isDm ? (
        <View style={s.notice}>
          <Text style={s.noticeText}>Not end-to-end encrypted yet</Text>
        </View>
      ) : null}
      <KeyboardAvoidingView behavior="padding" style={s.fill}>
        {!messages ? (
          <Loading />
        ) : (
          <FlatList
            inverted
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={s.list}
            renderItem={({ item, index }) => (
              <Bubble
                m={item}
                onLongPress={() => options(item)}
                mine={item.author.id === meId}
                // In an inverted list the next item is the one above.
                showName={kind !== "dm" && messages[index + 1]?.author.id !== item.author.id}
                accent={accent}
                onAccent={onAccent}
              />
            )}
            ListEmptyComponent={<Text style={s.empty}>No messages yet. Say hi.</Text>}
          />
        )}
        {typers.length ? (
          <Text style={s.typing} accessibilityLiveRegion="polite" numberOfLines={1}>
            {typers.length === 1
              ? `${typers[0]} is typing…`
              : `${typers.slice(0, 2).join(" and ")}${typers.length > 2 ? " and others" : ""} are typing…`}
          </Text>
        ) : null}
        <View style={[s.composer, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            value={text}
            onChangeText={(v) => {
              setText(v);
              if (v.trim()) live.typing(id);
            }}
            placeholder={`Message ${title ?? ""}`.trim()}
            placeholderTextColor={roles.textMuted}
            selectionColor={accent}
            cursorColor={accent}
            multiline
            maxLength={4000}
            style={s.input}
            accessibilityLabel="Message"
          />
          <Pressable
            onPress={send}
            disabled={!text.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel="Send"
            accessibilityState={{ disabled: !text.trim() || sending }}
            style={[s.send, { backgroundColor: accent }, (!text.trim() || sending) && s.dim]}
          >
            <Icon name="ArrowUpBold" size={20} color={onAccent} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

function Bubble({
  m,
  mine,
  showName,
  accent,
  onAccent,
  onLongPress,
}: {
  m: Message;
  mine: boolean;
  showName: boolean;
  accent: string;
  onAccent: string;
  onLongPress: () => void;
}) {
  const time = new Date(m.createdAt).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const body = m.hidden
    ? "Hidden after reports"
    : m.content ||
      (m.attachments.length ? "Sent a file" : m.place ? `Shared a place: ${m.place.name}` : "");
  if (mine) {
    return (
      <View style={s.mineRow}>
        <View style={[s.bubble, { backgroundColor: accent }]}>
          <Text style={[s.text, { color: onAccent }]}>
            {body}
            <Text style={[s.time, { color: onAccent, opacity: 0.7 }]}> {time}</Text>
          </Text>
        </View>
      </View>
    );
  }
  return (
    <Pressable
      onLongPress={onLongPress}
      accessibilityHint="Long press to report it"
      style={s.theirsRow}
    >
      {showName ? <Avatar user={m.author} size={28} /> : <View style={s.gap} />}
      <View style={s.col}>
        {showName ? <Text style={s.author}>{m.author.displayName}</Text> : null}
        <View style={[s.bubble, s.theirs]}>
          <Text style={s.text}>
            {body}
            <Text style={s.time}> {time}</Text>
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  notice: { alignItems: "center", paddingVertical: 6 },
  noticeText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: roles.textSoft,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(11,11,14,0.65)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.14)",
  },
  list: { paddingHorizontal: 10, paddingVertical: 12, gap: 4 },
  empty: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: roles.textSoft,
    textAlign: "center",
    padding: 24,
    transform: [{ scaleY: -1 }],
  },
  mineRow: { alignItems: "flex-end", marginTop: 2 },
  theirsRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 2 },
  gap: { width: 28 },
  col: { maxWidth: "80%" },
  author: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: roles.textSoft,
    marginLeft: 12,
    marginBottom: 3,
    marginTop: 8,
  },
  bubble: { maxWidth: "80%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  theirs: { backgroundColor: roles.surfaceSunken, maxWidth: "100%" },
  text: { fontFamily: fonts.body, fontSize: 15.5, lineHeight: 21, color: roles.text },
  time: { fontFamily: fonts.body, fontSize: 11.5, color: roles.textSoft },
  typing: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    color: roles.textSoft,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: roles.border,
    backgroundColor: roles.bg,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 130,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: roles.borderStrong,
    backgroundColor: roles.surfaceSunken,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: fonts.body,
    fontSize: 15.5,
    color: roles.text,
  },
  send: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  dim: { opacity: 0.45 },
});
