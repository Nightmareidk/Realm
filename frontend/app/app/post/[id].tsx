import type { Comment, CommentPage, Post } from "@realm/contracts";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
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
import { useApi } from "@/data";
import { Icon } from "@/icon";
import { ApiError, api } from "@/server";
import { useSession } from "@/session";
import { useSheet } from "@/sheet";
import { Avatar } from "@/social/avatar";
import { PostCard } from "@/social/post-card";
import { useSafety } from "@/social/safety";
import { AppScreen, Loading, Problem, TopBar } from "@/social/screen";
import { ago } from "@/social/time";
import { fonts, type NativeTheme, useStyles, useTheme } from "@/theme";

/** One post, its comments (replies sit under the comment they answer), and a box to add one. */
export default function PostScreen() {
  const { t } = useTheme();
  const s = useStyles(make);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { accent, onAccent } = useTheme();
  const { session } = useSession();
  const me = session.status === "signedIn" ? session.user : null;
  const post = useApi<Post>(`/posts/${id}`);
  const thread = useApi<CommentPage>(`/posts/${id}/comments`);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [sending, setSending] = useState(false);
  const input = useRef<TextInput>(null);
  const comments = useMemo(() => thread.data?.items ?? [], [thread.data]);
  const sheet = useSheet();
  const safety = useSafety();

  if (post.error && !post.data) {
    return (
      <AppScreen>
        <TopBar title="Post" />
        <Problem message={post.error} onRetry={post.reload} />
      </AppScreen>
    );
  }

  async function send() {
    const body = text.trim();
    if (!body || sending || !post.data) return;
    setSending(true);
    try {
      const made = await api<Comment>(`/posts/${id}/comments`, {
        body: { body, ...(replyTo ? { parentId: replyTo.id } : {}) },
      });
      thread.setData({ items: placeComment(comments, made), nextCursor: null });
      post.setData({ ...post.data, commentCount: post.data.commentCount + 1 });
      setText("");
      setReplyTo(null);
    } catch (err) {
      Alert.alert("Comment not sent", err instanceof ApiError ? err.message : "Try again.");
    } finally {
      setSending(false);
    }
  }

  function remove(c: Comment) {
    sheet({
      title: "Delete this comment?",
      line: "It's gone for everyone.",
      actions: [
        {
          label: "Delete",
          icon: "Trash",
          danger: true,
          onPress: async () => {
            try {
              await api(`/posts/${id}/comments/${c.id}`, { method: "DELETE" });
              thread.setData({ items: comments.filter((x) => x.id !== c.id), nextCursor: null });
              if (post.data) {
                post.setData({
                  ...post.data,
                  commentCount: Math.max(0, post.data.commentCount - (c.hidden ? 0 : 1)),
                });
              }
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
    });
  }

  function reply(c: Comment) {
    setReplyTo(c);
    input.current?.focus();
  }

  /** Long-press on a comment: reply, and report or delete as it's yours or theirs. */
  function options(c: Comment, canDelete: boolean) {
    const mine = me?.id === c.author.id;
    sheet({
      actions: [
        ...(c.hidden
          ? []
          : [{ label: "Reply", icon: "ArrowBendUpLeft" as const, onPress: () => reply(c) }]),
        ...(mine
          ? []
          : [
              {
                label: "Report comment",
                icon: "Flag" as const,
                danger: true,
                onPress: () => safety.report("comment", c.id, c.author),
              },
            ]),
        ...(canDelete
          ? [
              {
                label: "Delete comment",
                icon: "Trash" as const,
                danger: true,
                onPress: () => remove(c),
              },
            ]
          : []),
      ],
    });
  }

  return (
    <AppScreen>
      <TopBar title="Post" />
      <KeyboardAvoidingView behavior="padding" style={s.fill}>
        {!post.data ? (
          <Loading />
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(c) => c.id}
            ListHeaderComponent={
              <View style={s.postWrap}>
                <PostCard
                  post={post.data}
                  standalone
                  onChange={post.setData}
                  onRemoved={() => router.back()}
                />
                <Text style={s.heading}>
                  {comments.length ? "Comments" : "No comments yet. Start the conversation."}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const canDelete = Boolean(
                me && (me.id === item.author.id || me.id === post.data?.author.id),
              );
              return (
                <CommentRow
                  comment={item}
                  onReply={() => reply(item)}
                  onOptions={() => options(item, canDelete)}
                />
              );
            }}
            keyboardShouldPersistTaps="handled"
          />
        )}
        <View style={[s.composer, { paddingBottom: insets.bottom + 8 }]}>
          {replyTo ? (
            <View style={s.replying}>
              <Text style={s.replyingText} numberOfLines={1}>
                Replying to {replyTo.author.displayName}
              </Text>
              <Pressable onPress={() => setReplyTo(null)} accessibilityRole="button" hitSlop={10}>
                <Text style={s.cancel}>Cancel</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={s.row}>
            {me ? <Avatar user={me} size={34} /> : null}
            <TextInput
              ref={input}
              value={text}
              onChangeText={setText}
              placeholder={
                post.data ? `Add a comment for ${post.data.author.displayName}…` : "Add a comment…"
              }
              placeholderTextColor={t.colors.textMuted}
              selectionColor={accent}
              cursorColor={accent}
              multiline
              maxLength={1000}
              style={s.input}
              accessibilityLabel="Comment"
            />
            <Pressable
              onPress={send}
              disabled={!text.trim() || sending}
              accessibilityRole="button"
              accessibilityLabel="Post comment"
              accessibilityState={{ disabled: !text.trim() || sending }}
              style={[s.send, { backgroundColor: accent }, (!text.trim() || sending) && s.dim]}
            >
              <Icon name="ArrowUpBold" size={20} color={onAccent} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

/** A new comment goes after its thread: at the end, or after the last reply to its parent. */
function placeComment(list: Comment[], made: Comment): Comment[] {
  if (!made.parentId) return [...list, made];
  const root = list.find((c) => c.id === made.parentId);
  const rootId = root?.parentId ?? root?.id ?? made.parentId;
  let at = list.findIndex((c) => c.id === rootId);
  if (at < 0) return [...list, made];
  while (list[at + 1] && list[at + 1]?.depth === 1) at++;
  return [...list.slice(0, at + 1), made, ...list.slice(at + 1)];
}

function CommentRow({
  comment,
  onReply,
  onOptions,
}: {
  comment: Comment;
  onReply: () => void;
  onOptions: () => void;
}) {
  const { t } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  return (
    <Pressable
      onLongPress={onOptions}
      accessibilityHint="Long press for more, like reporting it"
      style={[s.comment, comment.depth > 0 && s.reply]}
    >
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/user/[username]",
            params: { username: comment.author.username },
          })
        }
        accessibilityRole="link"
        accessibilityLabel={comment.author.displayName}
      >
        <Avatar user={comment.author} size={comment.depth > 0 ? 28 : 34} />
      </Pressable>
      <View style={s.fill}>
        <Text style={s.body}>
          <Text style={s.author}>{comment.author.displayName} </Text>
          {comment.body}
        </Text>
        {comment.hidden ? (
          <Text style={s.hiddenText}>Taken down after reports. Only you can see it.</Text>
        ) : null}
        <View style={s.meta}>
          <Text style={s.metaText}>{ago(comment.createdAt)}</Text>
          {comment.hidden ? null : (
            <Pressable onPress={onReply} accessibilityRole="button" hitSlop={10}>
              <Text style={s.metaAction}>Reply</Text>
            </Pressable>
          )}
          <Pressable
            onPress={onOptions}
            accessibilityRole="button"
            accessibilityLabel="More"
            hitSlop={10}
          >
            <Icon name="DotsThreeBold" size={18} color={t.colors.textSoft} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    postWrap: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
      marginBottom: 6,
    },
    heading: {
      fontFamily: fonts.bold,
      fontSize: 15,
      color: t.colors.textSoft,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    comment: { flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
    reply: { paddingLeft: 58 },
    body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: t.colors.text },
    author: { fontFamily: fonts.bold },
    meta: { flexDirection: "row", gap: 16, marginTop: 4, alignItems: "center" },
    metaText: { fontFamily: fonts.body, fontSize: 13, color: t.colors.textSoft },
    metaAction: { fontFamily: fonts.bold, fontSize: 13, color: t.colors.textSoft },
    hiddenText: { fontFamily: fonts.bold, fontSize: 13, color: t.colors.danger, marginTop: 4 },
    composer: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
      backgroundColor: t.colors.bg,
      paddingHorizontal: 12,
      paddingTop: 8,
    },
    replying: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingBottom: 8,
      paddingHorizontal: 4,
    },
    replyingText: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, color: t.colors.textSoft },
    cancel: { fontFamily: fonts.bold, fontSize: 13.5, color: t.colors.text },
    row: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: t.colors.borderStrong,
      backgroundColor: t.colors.surfaceSunken,
      paddingHorizontal: 16,
      paddingTop: 11,
      paddingBottom: 11,
      fontFamily: fonts.body,
      fontSize: 15.5,
      color: t.colors.text,
    },
    send: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    dim: { opacity: 0.45 },
  });
