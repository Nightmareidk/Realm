import { type Conversation, canStillEdit, type Message, type MessagePage } from "@realm/contracts";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { bodyOf, MessageRow, QUICK_REACTIONS, timeOf } from "@/chat/message-row";
import { Icon } from "@/icon";
import { live, useLiveEvent, useLiveStatus } from "@/live";
import { ApiError, api, upload } from "@/server";
import { useSession } from "@/session";
import { useSheet } from "@/sheet";
import { shrinkPhoto } from "@/shrink";
import { useSafety } from "@/social/safety";
import { AppScreen, Loading, TopBar } from "@/social/screen";
import { fonts, type NativeTheme, useStyles, useTheme } from "@/theme";
import { markRead, olderId } from "@/unread";

/** A short id for an outgoing message, so its echo can be matched. */
const nonce = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/** How long "typing…" shows after the last signal (the gateway sends one every few seconds). */
const TYPING_MS = 8_000;
/** Without the live connection, look for new messages this often. */
const FALLBACK_MS = 10_000;
/** Photos in one message, at most. */
const MAX_PHOTOS = 4;

type Photo = { uri: string; width: number; height: number; mimeType?: string | null };

/** A message on its way: shown at once, then swapped for the real one when it arrives. */
interface Outgoing {
  nonce: string;
  content: string;
  replyTo: Message | null;
  photos: Photo[];
  state: "sending" | "failed";
  error?: string;
}

type Row = { kind: "message"; m: Message } | { kind: "outgoing"; o: Outgoing };

/**
 * A conversation or a Space room, newest at the bottom.
 *
 * - **Sending:** messages show at once, as "Sending", or "Not sent, tap to try again" with the
 *   reason. Photos can go along (made smaller first).
 * - **On a message:** pull it right to reply, double-tap for a heart, long-press to react, copy,
 *   edit (15 minutes), delete or report.
 * - **Live:** messages and "typing…" arrive over the live connection, checked every few seconds
 *   while it's down. Reading marks the chat read, and in a DM, "Seen" shows under your last
 *   message once they've read it.
 */
export default function Chat() {
  const { t } = useTheme();
  const s = useStyles(make);
  const { id, title, kind } = useLocalSearchParams<{ id: string; title?: string; kind?: string }>();
  const insets = useSafeAreaInsets();
  const { accent, onAccent } = useTheme();
  const { session } = useSession();
  const meId = session.status === "signedIn" ? session.user.id : null;
  const isDm = kind === "dm" || kind === "group_dm";
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [outgoing, setOutgoing] = useState<Outgoing[]>([]);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [saving, setSaving] = useState(false);
  const [typing, setTyping] = useState<Record<string, number>>({});
  /** How far the others in a conversation have read, by person. */
  const [seenBy, setSeenBy] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const focused = useRef(true);
  const input = useRef<TextInput>(null);
  const status = useLiveStatus();
  const sheet = useSheet();
  const safety = useSafety();

  const load = useCallback(async () => {
    try {
      const page = await api<MessagePage>(`/channels/${id}/messages?limit=50`);
      if (focused.current) setMessages(page.messages);
      setProblem(null);
    } catch (err) {
      if (!focused.current) return;
      setMessages((m) => m ?? []);
      setProblem(err instanceof ApiError ? err.message : "Couldn't load this chat.");
    }
  }, [id]);

  // In a conversation, where the others have read up to ("Seen").
  useEffect(() => {
    if (!isDm) return;
    api<{ conversations: Conversation[] }>("/users/@me/channels")
      .then(({ conversations }) => {
        const c = conversations.find((x) => x.id === id);
        if (c) setSeenBy(Object.fromEntries(c.seen.map((x) => [x.userId, x.messageId])));
      })
      .catch(() => {});
  }, [id, isDm]);

  // Load on open and whenever the live line comes back (to fill the gap); without it, check often.
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      load();
      const t = status === "live" ? null : setInterval(load, FALLBACK_MS);
      return () => {
        focused.current = false;
        if (t) clearInterval(t);
      };
    }, [load, status]),
  );

  /** Put a message in its place: newest first, its outgoing copy taken away. */
  const upsert = useCallback((m: Message) => {
    setMessages((list) => {
      const rest = (list ?? []).filter((x) => x.id !== m.id);
      const at = rest.findIndex((x) => olderId(x.id, m.id));
      return at === -1 ? [...rest, m] : [...rest.slice(0, at), m, ...rest.slice(at)];
    });
    if (m.nonce) setOutgoing((all) => all.filter((o) => o.nonce !== m.nonce));
  }, []);

  /** Change one reaction on a message, from you or (live) from someone else. */
  const adjust = useCallback((messageId: string, emoji: string, on: boolean, byMe: boolean) => {
    setMessages(
      (list) =>
        list?.map((m) => {
          if (m.id !== messageId) return m;
          const r = m.reactions.find((x) => x.emoji === emoji);
          // My own reaction comes back live too: count it once.
          if (byMe && r && r.me === on) return m;
          if (!r && !on) return m;
          const reactions = r
            ? m.reactions
                .map((x) =>
                  x.emoji === emoji
                    ? { ...x, count: x.count + (on ? 1 : -1), me: byMe ? on : x.me }
                    : x,
                )
                .filter((x) => x.count > 0)
            : [...m.reactions, { emoji, count: 1, me: byMe }];
          return { ...m, reactions };
        }) ?? list,
    );
  }, []);

  useLiveEvent("MESSAGE_CREATE", (m) => {
    if (m.channelId !== id) return;
    upsert(m);
    setTyping(({ [m.author.id]: _, ...rest }) => rest);
  });
  useLiveEvent("MESSAGE_UPDATE", (m) => {
    if (m.channelId === id)
      setMessages((list) => list?.map((x) => (x.id === m.id ? m : x)) ?? list);
  });
  useLiveEvent("MESSAGE_DELETE", (d) => {
    if (d.channelId === id) setMessages((list) => list?.filter((x) => x.id !== d.id) ?? list);
  });
  useLiveEvent("MESSAGE_REACTION_ADD", (d) => {
    if (d.channelId === id) adjust(d.messageId, d.emoji, true, d.userId === meId);
  });
  useLiveEvent("MESSAGE_REACTION_REMOVE", (d) => {
    if (d.channelId === id) adjust(d.messageId, d.emoji, false, d.userId === meId);
  });
  useLiveEvent("MESSAGE_ACK", (d) => {
    if (d.channelId === id && d.userId !== meId) {
      setSeenBy((all) => ({ ...all, [d.userId]: d.messageId }));
    }
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

  // Reading the newest message marks the chat read (here, in the Inbox, and for "Seen").
  const newest = messages?.[0]?.id;
  useEffect(() => {
    if (!newest || !focused.current) return;
    markRead(id, newest);
    api(`/channels/${id}/ack`, { body: { messageId: newest } }).catch(() => {});
  }, [id, newest]);

  /** Send (or send again) one outgoing message: photos first, then the message itself. */
  const deliver = useCallback(
    async (o: Outgoing) => {
      setOutgoing((all) => [
        ...all.filter((x) => x.nonce !== o.nonce),
        { ...o, state: "sending", error: undefined },
      ]);
      try {
        const attachmentIds: string[] = [];
        for (const p of o.photos) {
          const small = await shrinkPhoto(p);
          attachmentIds.push(
            await upload({ uri: small.uri, kind: "image", mimeType: small.mimeType }),
          );
        }
        const made = await api<Message>(`/channels/${id}/messages`, {
          body: {
            content: o.content,
            nonce: o.nonce,
            attachmentIds,
            ...(o.replyTo ? { replyToId: o.replyTo.id } : {}),
          },
        });
        upsert(made);
        live.sent(id);
      } catch (err) {
        setOutgoing((all) =>
          all.map((x) =>
            x.nonce === o.nonce
              ? {
                  ...x,
                  state: "failed",
                  error: err instanceof ApiError ? err.message : "Something went wrong.",
                }
              : x,
          ),
        );
      }
    },
    [id, upsert],
  );

  async function send() {
    const content = text.trim();
    if (editing) {
      if (!content || saving) return;
      setSaving(true);
      try {
        upsert(
          await api<Message>(`/channels/${id}/messages/${editing.id}`, {
            method: "PATCH",
            body: { content },
          }),
        );
        setEditing(null);
        setText("");
      } catch (err) {
        sheet({
          title: "Not changed",
          line: err instanceof ApiError ? err.message : "Try again.",
          actions: [],
        });
      } finally {
        setSaving(false);
      }
      return;
    }
    if (!content && photos.length === 0) return;
    Haptics.selectionAsync();
    const o: Outgoing = {
      nonce: nonce(),
      content,
      replyTo,
      photos,
      state: "sending",
    };
    setText("");
    setPhotos([]);
    setReplyTo(null);
    deliver(o);
  }

  async function pickPhotos() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS,
      quality: 0.85,
    });
    if (res.canceled) return;
    setPhotos((now) => [...now, ...res.assets].slice(0, MAX_PHOTOS));
  }

  const react = useCallback(
    async (m: Message, emoji: string) => {
      const on = !m.reactions.some((r) => r.emoji === emoji && r.me);
      adjust(m.id, emoji, on, true);
      try {
        await api(`/channels/${id}/messages/${m.id}/reactions/${encodeURIComponent(emoji)}/@me`, {
          method: on ? "PUT" : "DELETE",
        });
      } catch (err) {
        adjust(m.id, emoji, !on, true);
        sheet({
          title: "Reaction not added",
          line: err instanceof ApiError ? err.message : "Try again.",
          actions: [],
        });
      }
    },
    [adjust, id, sheet],
  );

  const reply = useCallback((m: Message) => {
    setEditing(null);
    setReplyTo(m);
    input.current?.focus();
  }, []);

  /** Long-press: react, reply, copy, and edit or delete yours, or report someone else's. */
  const menu = useCallback(
    (m: Message) => {
      const mine = m.author.id === meId;
      const editable = mine && !m.hidden && m.content && canStillEdit(m.createdAt);
      sheet({
        top: m.hidden
          ? undefined
          : (close) => (
              <View style={s.quick} accessibilityRole="menu">
                {QUICK_REACTIONS.map((e) => {
                  const on = m.reactions.some((r) => r.emoji === e && r.me);
                  return (
                    <Pressable
                      key={e}
                      onPress={() => {
                        close();
                        react(m, e);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={on ? `Take back ${e}` : `React with ${e}`}
                      style={({ pressed }) => [
                        s.quickOne,
                        on && { backgroundColor: t.colors.surfaceRaised, borderColor: accent },
                        pressed && { transform: [{ scale: 0.92 }] },
                      ]}
                    >
                      <Text style={s.quickEmoji}>{e}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ),
        actions: [
          ...(m.hidden
            ? []
            : [{ label: "Reply", icon: "ArrowBendUpLeft" as const, onPress: () => reply(m) }]),
          ...(m.content && !m.hidden
            ? [
                {
                  label: "Copy text",
                  icon: "Copy" as const,
                  onPress: () => Clipboard.setStringAsync(m.content),
                },
              ]
            : []),
          ...(editable
            ? [
                {
                  label: "Edit",
                  icon: "NotePencil" as const,
                  onPress: () => {
                    setReplyTo(null);
                    setEditing(m);
                    setText(m.content);
                    input.current?.focus();
                  },
                },
              ]
            : []),
          ...(mine
            ? [
                {
                  label: "Delete",
                  icon: "Trash" as const,
                  danger: true,
                  onPress: () =>
                    sheet({
                      title: "Delete this message?",
                      line: "It's gone for everyone in this chat.",
                      actions: [
                        {
                          label: "Delete",
                          icon: "Trash",
                          danger: true,
                          onPress: async () => {
                            try {
                              await api(`/channels/${id}/messages/${m.id}`, { method: "DELETE" });
                              setMessages((list) => list?.filter((x) => x.id !== m.id) ?? list);
                            } catch (err) {
                              sheet({
                                title: "Not deleted",
                                line: err instanceof ApiError ? err.message : "Try again.",
                                actions: [],
                              });
                            }
                          },
                        },
                      ],
                    }),
                },
              ]
            : [
                {
                  label: "Report message",
                  icon: "Flag" as const,
                  danger: true,
                  onPress: () => safety.report("message", m.id, m.author),
                },
                {
                  label: `Block @${m.author.username}`,
                  icon: "Prohibit" as const,
                  danger: true,
                  onPress: () => safety.block(m.author),
                },
              ]),
        ],
      });
    },
    [
      accent,
      id,
      meId,
      react,
      reply,
      safety,
      sheet,
      t.colors.surfaceRaised,
      s.quickOne,
      s.quickEmoji,
      s.quick,
    ],
  );

  // "Seen" goes under your newest message that the others have read.
  const seenUpTo = Object.values(seenBy).reduce<string | null>(
    (best, x) => (!best || olderId(best, x) ? x : best),
    null,
  );
  const myNewest = messages?.find((m) => m.author.id === meId && !m.type.startsWith("system_"));
  const seenId =
    isDm && outgoing.length === 0 && myNewest && seenUpTo && !olderId(seenUpTo, myNewest.id)
      ? myNewest.id
      : null;

  const rows = useMemo<Row[]>(
    () => [
      ...[...outgoing].reverse().map((o) => ({ kind: "outgoing" as const, o })),
      ...(messages ?? []).map((m) => ({ kind: "message" as const, m })),
    ],
    [messages, outgoing],
  );

  const typers = Object.keys(typing).map(
    (uid) => messages?.find((m) => m.author.id === uid)?.author.displayName ?? "Someone",
  );
  const canSend = editing
    ? text.trim().length > 0 && !saving
    : text.trim().length > 0 || photos.length > 0;

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
            data={rows}
            keyExtractor={(r) => (r.kind === "message" ? r.m.id : `out-${r.o.nonce}`)}
            contentContainerStyle={s.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item, index }) => {
              if (item.kind === "outgoing") {
                return (
                  <OutgoingRow o={item.o} accent={accent} onAccent={onAccent} onRetry={deliver} />
                );
              }
              const m = item.m;
              const above = rows[index + 1];
              const sameRun = above?.kind === "message" && above.m.author.id === m.author.id;
              return (
                <MessageRow
                  m={m}
                  mine={m.author.id === meId}
                  showName={kind !== "dm" && !sameRun}
                  seen={m.id === seenId}
                  accent={accent}
                  onAccent={onAccent}
                  onReply={reply}
                  onReact={react}
                  onMenu={menu}
                />
              );
            }}
            ListEmptyComponent={
              <Text style={s.empty}>{problem ?? "No messages yet. Say hi."}</Text>
            }
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
          {replyTo || editing ? (
            <View style={s.context}>
              <Icon
                name={editing ? "NotePencil" : "ArrowBendUpLeft"}
                size={18}
                color={t.colors.textSoft}
              />
              <View style={s.fill}>
                <Text style={s.contextTitle} numberOfLines={1}>
                  {editing ? "Editing your message" : `Replying to ${replyTo?.author.displayName}`}
                </Text>
                <Text style={s.contextLine} numberOfLines={1}>
                  {bodyOf((editing ?? replyTo) as Message)}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  if (editing) setText("");
                  setEditing(null);
                  setReplyTo(null);
                }}
                accessibilityRole="button"
                accessibilityLabel={editing ? "Stop editing" : "Cancel reply"}
                style={s.iconButton}
              >
                <Icon name="X" size={18} color={t.colors.text} />
              </Pressable>
            </View>
          ) : null}
          {photos.length ? (
            <View style={s.picked}>
              {photos.map((p, i) => (
                <View key={p.uri}>
                  <Image source={{ uri: p.uri }} style={s.pickedPhoto} contentFit="cover" />
                  <Pressable
                    onPress={() => setPhotos((all) => all.filter((_, j) => j !== i))}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove photo ${i + 1}`}
                    hitSlop={8}
                    style={s.unpick}
                  >
                    <Icon name="X" size={14} color="#ffffff" />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
          <View style={s.row}>
            {!editing ? (
              <Pressable
                onPress={pickPhotos}
                disabled={photos.length >= MAX_PHOTOS}
                accessibilityRole="button"
                accessibilityLabel="Add photos"
                style={[s.iconButton, photos.length >= MAX_PHOTOS && s.dim]}
              >
                <Icon name="Image" size={24} color={t.colors.text} />
              </Pressable>
            ) : null}
            <TextInput
              ref={input}
              value={text}
              onChangeText={(v) => {
                setText(v);
                if (v.trim() && !editing) live.typing(id);
              }}
              placeholder={editing ? "Edit message" : `Message ${title ?? ""}`.trim()}
              placeholderTextColor={t.colors.textMuted}
              selectionColor={accent}
              cursorColor={accent}
              multiline
              maxLength={4000}
              style={s.input}
              accessibilityLabel={editing ? "Edit message" : "Message"}
            />
            <Pressable
              onPress={send}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel={editing ? "Save changes" : "Send"}
              accessibilityState={{ disabled: !canSend }}
              style={[s.send, { backgroundColor: accent }, !canSend && s.dim]}
            >
              <Icon name={editing ? "CheckBold" : "ArrowUpBold"} size={20} color={onAccent} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

/** A message on its way: "Sending", or "Not sent" with the reason and a tap to try again. */
function OutgoingRow({
  o,
  accent,
  onAccent,
  onRetry,
}: {
  o: Outgoing;
  accent: string;
  onAccent: string;
  onRetry: (o: Outgoing) => void;
}) {
  const { t } = useTheme();
  const s = useStyles(make);
  const failed = o.state === "failed";
  return (
    <Pressable
      onPress={failed ? () => onRetry(o) : undefined}
      disabled={!failed}
      accessibilityRole={failed ? "button" : undefined}
      accessibilityLabel={
        failed
          ? `Not sent: ${o.content || "photo"}. ${o.error ?? ""} Tap to try again.`
          : `Sending: ${o.content || "photo"}`
      }
      style={s.outRow}
    >
      <View style={[s.outBubble, { backgroundColor: accent }, !failed && s.sending]}>
        {o.photos.length ? (
          <Text style={[s.outText, { color: onAccent }]}>
            {o.photos.length === 1 ? "Photo" : `${o.photos.length} photos`}
          </Text>
        ) : null}
        {o.content ? <Text style={[s.outText, { color: onAccent }]}>{o.content}</Text> : null}
      </View>
      <Text style={[s.outState, failed && { color: t.colors.danger }]}>
        {failed
          ? `Not sent. ${o.error ?? ""} Tap to try again.`
          : `Sending · ${timeOf(new Date().toISOString())}`}
      </Text>
    </Pressable>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    notice: { alignItems: "center", paddingVertical: 6 },
    noticeText: {
      fontFamily: fonts.bold,
      fontSize: 12.5,
      color: t.colors.textSoft,
      paddingHorizontal: 11,
      paddingVertical: 5,
      borderRadius: 999,
      overflow: "hidden",
      backgroundColor: "rgba(11,11,14,0.65)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.14)",
    },
    list: { paddingHorizontal: 10, paddingVertical: 12 },
    empty: {
      fontFamily: fonts.body,
      fontSize: 15,
      color: t.colors.textSoft,
      textAlign: "center",
      padding: 24,
      transform: [{ scaleY: -1 }],
    },
    typing: {
      fontFamily: fonts.body,
      fontSize: 13.5,
      color: t.colors.textSoft,
      paddingHorizontal: 16,
      paddingBottom: 4,
    },
    composer: {
      paddingHorizontal: 10,
      paddingTop: 8,
      gap: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
      backgroundColor: t.colors.bg,
    },
    context: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingLeft: 8,
      borderRadius: 14,
      backgroundColor: t.colors.surface,
    },
    contextTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: t.colors.text },
    contextLine: { fontFamily: fonts.body, fontSize: 13.5, color: t.colors.textSoft },
    picked: { flexDirection: "row", gap: 8, paddingHorizontal: 4 },
    pickedPhoto: {
      width: 64,
      height: 64,
      borderRadius: 12,
      backgroundColor: t.colors.surfaceRaised,
    },
    unpick: {
      position: "absolute",
      top: 3,
      right: 3,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(11,11,14,0.75)",
    },
    row: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
    iconButton: { width: 44, height: 46, alignItems: "center", justifyContent: "center" },
    input: {
      flex: 1,
      minHeight: 46,
      maxHeight: 130,
      borderRadius: 23,
      borderWidth: 1.5,
      borderColor: t.colors.borderStrong,
      backgroundColor: t.colors.surfaceSunken,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 12,
      fontFamily: fonts.body,
      fontSize: 15.5,
      color: t.colors.text,
    },
    send: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
    },
    dim: { opacity: 0.45 },
    quick: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
    quickOne: {
      flex: 1,
      height: 52,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
    },
    quickEmoji: { fontSize: 26 },
    outRow: { alignItems: "flex-end", marginTop: 3 },
    outBubble: {
      maxWidth: 280,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 9,
      gap: 4,
    },
    sending: { opacity: 0.7 },
    outText: { fontFamily: fonts.body, fontSize: 15.5, lineHeight: 21 },
    outState: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: t.colors.textSoft,
      marginTop: 3,
      marginRight: 6,
      maxWidth: 280,
      textAlign: "right",
    },
  });
