import type { Comment, Post } from "@realm/contracts";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { FadeIn, ReduceMotion, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { alert } from "../alert";
import { Icon } from "../icon";
import { live } from "../live";
import { ApiError, api } from "../server";
import { useSession } from "../session";
import { useSheet } from "../sheet";
import { type NativeTheme, useStyles, useTheme } from "../theme";
import { Avatar } from "./avatar";
import { useSafety } from "./safety";
import { ago } from "./time";
import { Verified } from "./verified";

/** Tap one to add it to your comment, as on Instagram. */
const QUICK = ["❤️", "🙌", "🔥", "👏", "😢", "😍", "😮", "😂"];

/**
 * Comments, up from the bottom over the post (Instagram's way): everything said, replies tucked
 * under what they answer, and the box to add yours, always there, even when nobody has said
 * anything yet. New comments arrive live while it's open.
 */
export function CommentsSheet({
  post,
  visible,
  onClose,
  onCount,
}: {
  post: Post;
  visible: boolean;
  onClose: () => void;
  /** How many comments there are now, for the post's own count. */
  onCount?: (n: number) => void;
}) {
  const { t, accent } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { session } = useSession();
  const me = session.status === "signedIn" ? session.user : null;
  const sheet = useSheet();
  const safety = useSafety();
  const [items, setItems] = useState<Comment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [sending, setSending] = useState(false);
  const input = useRef<TextInput>(null);

  // Load when it opens, and hear new comments while it's open.
  useEffect(() => {
    if (!visible) return;
    let open = true;
    setError(null);
    api<{ items: Comment[] }>(`/posts/${post.id}/comments`)
      .then((r) => open && setItems(r.items))
      .catch(
        (err) => open && setError(err instanceof ApiError ? err.message : "Comments didn't load."),
      );
    live.watchPosts(`comments:${post.id}`, [post.id]);
    const off = live.on((type, data) => {
      if (type === "COMMENT_CREATE") {
        const c = data as Comment;
        if (c.postId !== post.id) return;
        setItems((now) => (now?.some((x) => x.id === c.id) ? now : place(now ?? [], c)));
      }
      if (type === "COMMENT_DELETE") {
        const d = data as { postId: string; id: string };
        if (d.postId === post.id) setItems((now) => now?.filter((x) => x.id !== d.id) ?? now);
      }
    });
    return () => {
      open = false;
      off();
      live.watchPosts(`comments:${post.id}`, []);
    };
  }, [visible, post.id]);

  useEffect(() => {
    if (items) onCount?.(items.length);
  }, [items, onCount]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    Haptics.selectionAsync();
    try {
      const made = await api<Comment>(`/posts/${post.id}/comments`, {
        body: { body, ...(replyTo ? { parentId: replyTo.id } : {}) },
      });
      setItems((now) => (now?.some((x) => x.id === made.id) ? now : place(now ?? [], made)));
      setText("");
      setReplyTo(null);
    } catch (err) {
      alert("Comment not sent", err instanceof ApiError ? err.message : "Try again.");
    } finally {
      setSending(false);
    }
  }

  function menu(c: Comment) {
    const mine = c.author.id === me?.id;
    const canDelete = mine || post.author.id === me?.id;
    sheet({
      title: c.author.displayName,
      line: c.body.slice(0, 120),
      actions: [
        { label: "Reply", icon: "ArrowBendUpLeft", onPress: () => reply(c) },
        ...(canDelete
          ? [
              {
                label: "Delete comment",
                icon: "Trash" as const,
                danger: true,
                onPress: async () => {
                  setItems((now) => now?.filter((x) => x.id !== c.id) ?? now);
                  try {
                    await api(`/posts/${post.id}/comments/${c.id}`, { method: "DELETE" });
                  } catch (err) {
                    alert("Not deleted", err instanceof ApiError ? err.message : "Try again.");
                  }
                },
              },
            ]
          : []),
        ...(!mine
          ? [
              {
                label: "Report comment",
                icon: "Flag" as const,
                danger: true,
                onPress: () => safety.report("comment", c.id, c.author),
              },
            ]
          : []),
      ],
    });
  }

  async function like(c: Comment) {
    const on = !c.liked;
    const put = (x: Partial<Comment>) =>
      setItems((now) => now?.map((y) => (y.id === c.id ? { ...y, ...x } : y)) ?? now);
    put({ liked: on, likeCount: c.likeCount + (on ? 1 : -1) });
    try {
      put(
        await api<{ likeCount: number; liked: boolean }>(
          `/posts/${post.id}/comments/${c.id}/like`,
          { method: on ? "PUT" : "DELETE" },
        ),
      );
    } catch {
      put({ liked: c.liked, likeCount: c.likeCount });
    }
  }

  function reply(c: Comment) {
    setReplyTo(c);
    setText((now) =>
      now.startsWith(`@${c.author.username} `) ? now : `@${c.author.username} ${now}`,
    );
    input.current?.focus();
  }

  const openPerson = (username: string) => {
    onClose();
    router.push({ pathname: "/user/[username]", params: { username } });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={s.root}>
        <Pressable
          style={s.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close comments"
        />
        <Animated.View
          entering={SlideInDown.duration(280).reduceMotion(ReduceMotion.System)}
          style={[s.sheet, { height: Math.round(height * 0.78) }]}
          accessibilityViewIsModal
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={s.fill}
          >
            <View style={s.grip} />
            <Text style={s.title} accessibilityRole="header">
              Comments
            </Text>
            {error && !items ? (
              <Text style={s.empty}>{error}</Text>
            ) : !items ? (
              <ActivityIndicator color={t.colors.textSoft} style={s.spinner} />
            ) : (
              <FlatList
                data={items}
                keyExtractor={(c) => c.id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={s.list}
                renderItem={({ item }) => (
                  <Animated.View
                    entering={FadeIn.duration(200)}
                    style={[s.row, item.depth > 0 && s.reply]}
                  >
                    <Pressable
                      onPress={() => openPerson(item.author.username)}
                      accessibilityRole="link"
                      accessibilityLabel={item.author.displayName}
                    >
                      <Avatar user={item.author} size={item.depth > 0 ? 28 : 34} />
                    </Pressable>
                    <Pressable
                      onLongPress={() => menu(item)}
                      delayLongPress={350}
                      accessibilityHint="Hold for reply, delete or report"
                      style={s.fill}
                    >
                      <View style={s.who}>
                        <Text style={s.name}>{item.author.username}</Text>
                        <Verified kind={item.author.verified} size={13} />
                        <Text style={s.when}>{ago(item.createdAt)}</Text>
                        {item.author.id === post.author.id ? (
                          <Text style={s.authorTag}>Author</Text>
                        ) : null}
                      </View>
                      <Text style={[s.body, item.hidden && s.hidden]}>
                        {item.hidden ? "Hidden after reports. Only you can see it." : item.body}
                      </Text>
                      <View style={s.under}>
                        <Pressable
                          onPress={() => reply(item)}
                          accessibilityRole="button"
                          hitSlop={6}
                        >
                          <Text style={s.replyLink}>Reply</Text>
                        </Pressable>
                        {item.likeCount > 0 ? (
                          <Text style={s.replyLink}>
                            {item.likeCount} {item.likeCount === 1 ? "like" : "likes"}
                          </Text>
                        ) : null}
                        {Platform.OS === "web" ? (
                          <Pressable
                            onPress={() => menu(item)}
                            accessibilityRole="button"
                            accessibilityLabel="More"
                            hitSlop={6}
                          >
                            <Icon name="DotsThreeBold" size={16} color={t.colors.textSoft} />
                          </Pressable>
                        ) : null}
                      </View>
                    </Pressable>
                    {item.hidden ? null : (
                      <Pressable
                        onPress={() => like(item)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: item.liked }}
                        accessibilityLabel={item.liked ? "Unlike the comment" : "Like the comment"}
                        hitSlop={8}
                        style={s.likeBtn}
                      >
                        <Icon
                          name={item.liked ? "HeartFill" : "Heart"}
                          size={16}
                          color={item.liked ? "#ff6b8b" : t.colors.textSoft}
                        />
                      </Pressable>
                    )}
                  </Animated.View>
                )}
                ListEmptyComponent={
                  <View style={s.emptyBox}>
                    <Icon name="ChatCircle" size={44} color={t.colors.text} />
                    <Text style={s.emptyTitle}>No comments yet</Text>
                    <Text style={s.emptyLine}>Start the conversation.</Text>
                  </View>
                }
              />
            )}

            <View style={[s.compose, { paddingBottom: insets.bottom + 8 }]}>
              <View style={s.quick}>
                {QUICK.map((e) => (
                  <Pressable
                    key={e}
                    onPress={() => {
                      setText((now) => now + e);
                      input.current?.focus();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${e}`}
                    hitSlop={4}
                  >
                    <Text style={s.quickEmoji}>{e}</Text>
                  </Pressable>
                ))}
              </View>
              {replyTo ? (
                <View style={s.replying}>
                  <Text style={s.replyingText} numberOfLines={1}>
                    Replying to {replyTo.author.username}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setReplyTo(null);
                      setText((now) => now.replace(`@${replyTo.author.username} `, ""));
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel reply"
                    hitSlop={8}
                  >
                    <Icon name="X" size={16} color={t.colors.textSoft} />
                  </Pressable>
                </View>
              ) : null}
              <View style={s.inputRow}>
                {me ? <Avatar user={me} size={34} /> : null}
                <TextInput
                  ref={input}
                  value={text}
                  onChangeText={setText}
                  placeholder={`Add a comment for ${post.author.username}…`}
                  placeholderTextColor={t.colors.textMuted}
                  selectionColor={accent}
                  cursorColor={accent}
                  maxLength={2200}
                  multiline
                  numberOfLines={1}
                  style={[s.input, Platform.OS === "web" && ({ outlineStyle: "none" } as object)]}
                  accessibilityLabel="Add a comment"
                  onKeyPress={(e) => {
                    const k = e.nativeEvent as { key: string; shiftKey?: boolean };
                    if (Platform.OS === "web" && k.key === "Enter" && !k.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <Pressable
                  onPress={send}
                  disabled={!text.trim() || sending}
                  accessibilityRole="button"
                  accessibilityLabel="Post comment"
                  hitSlop={6}
                >
                  <Text style={[s.post, { color: accent }, (!text.trim() || sending) && s.off]}>
                    {sending ? "Posting" : "Post"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Put a comment in its place: replies right after the comment (thread) they answer. */
function place(list: Comment[], c: Comment): Comment[] {
  if (!c.parentId) return [...list, c];
  const thread = list.findIndex((x) => x.id === c.parentId);
  if (thread === -1) return [...list, c];
  let end = thread + 1;
  while (end < list.length && (list[end]?.depth ?? 0) > 0) end++;
  return [...list.slice(0, end), c, ...list.slice(end)];
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    root: { flex: 1, justifyContent: "flex-end" },
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.55)" },
    sheet: {
      backgroundColor: t.colors.surface,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      overflow: "hidden",
    },
    grip: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.colors.borderStrong,
      marginTop: 8,
    },
    title: {
      fontFamily: t.fonts.bold,
      fontSize: 16 * t.textScale,
      color: t.colors.text,
      textAlign: "center",
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    spinner: { marginTop: 40 },
    list: { paddingVertical: 8, flexGrow: 1 },
    row: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 9 },
    reply: { paddingLeft: 62 },
    who: { flexDirection: "row", alignItems: "center", gap: 5 },
    name: { fontFamily: t.fonts.bold, fontSize: 13.5 * t.textScale, color: t.colors.text },
    when: { fontFamily: t.fonts.body, fontSize: 12.5 * t.textScale, color: t.colors.textSoft },
    authorTag: {
      fontFamily: t.fonts.bold,
      fontSize: 11 * t.textScale,
      color: t.colors.textSoft,
      backgroundColor: t.colors.surfaceRaised,
      paddingHorizontal: 6,
      borderRadius: 4,
      overflow: "hidden",
    },
    body: {
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      lineHeight: 21 * t.textScale,
      color: t.colors.text,
      marginTop: 2,
    },
    hidden: { fontStyle: "italic", color: t.colors.textSoft },
    under: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 5 },
    replyLink: { fontFamily: t.fonts.bold, fontSize: 12.5 * t.textScale, color: t.colors.textSoft },
    likeBtn: { width: 32, alignItems: "center", paddingTop: 4 },
    empty: {
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      color: t.colors.textSoft,
      textAlign: "center",
      padding: 30,
    },
    emptyBox: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 60,
    },
    emptyTitle: {
      fontFamily: t.fonts.displayBold,
      fontSize: 22 * t.textScale,
      color: t.colors.heading,
      marginTop: 8,
    },
    emptyLine: { fontFamily: t.fonts.body, fontSize: 15 * t.textScale, color: t.colors.textSoft },
    compose: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
      paddingHorizontal: 14,
      paddingTop: 8,
      backgroundColor: t.colors.surface,
    },
    quick: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 6,
      paddingBottom: 8,
    },
    quickEmoji: { fontSize: 24 },
    replying: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginBottom: 6,
      borderRadius: 10,
      backgroundColor: t.colors.surfaceRaised,
    },
    replyingText: {
      flex: 1,
      fontFamily: t.fonts.body,
      fontSize: 13 * t.textScale,
      color: t.colors.textSoft,
    },
    inputRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    input: {
      flex: 1,
      minWidth: 0,
      minHeight: 42,
      maxHeight: 110,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: t.colors.borderStrong,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      color: t.colors.text,
    },
    post: { fontFamily: t.fonts.bold, fontSize: 15 * t.textScale },
    off: { opacity: 0.4 },
  });
