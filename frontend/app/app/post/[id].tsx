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
import { Avatar } from "@/social/avatar";
import { PostCard } from "@/social/post-card";
import { AppScreen, Loading, Problem, TopBar } from "@/social/screen";
import { ago } from "@/social/time";
import { fonts, roles, useTheme } from "@/theme";

/** One post, its comments (replies sit under the comment they answer), and a box to add one. */
export default function PostScreen() {
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
    Alert.alert("Delete this comment?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await api(`/posts/${id}/comments/${c.id}`, { method: "DELETE" });
          thread.setData({ items: comments.filter((x) => x.id !== c.id), nextCursor: null });
          if (post.data)
            post.setData({ ...post.data, commentCount: Math.max(0, post.data.commentCount - 1) });
        },
      },
    ]);
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
            renderItem={({ item }) => (
              <CommentRow
                comment={item}
                canDelete={Boolean(
                  me && (me.id === item.author.id || me.id === post.data?.author.id),
                )}
                onReply={() => {
                  setReplyTo(item);
                  input.current?.focus();
                }}
                onDelete={() => remove(item)}
              />
            )}
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
              placeholderTextColor={roles.textMuted}
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
  canDelete,
  onReply,
  onDelete,
}: {
  comment: Comment;
  canDelete: boolean;
  onReply: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  return (
    <Pressable
      onLongPress={canDelete ? onDelete : undefined}
      accessibilityHint={canDelete ? "Long press to delete" : undefined}
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
        <View style={s.meta}>
          <Text style={s.metaText}>{ago(comment.createdAt)}</Text>
          <Pressable onPress={onReply} accessibilityRole="button" hitSlop={10}>
            <Text style={s.metaAction}>Reply</Text>
          </Pressable>
          {canDelete ? (
            <Pressable onPress={onDelete} accessibilityRole="button" hitSlop={10}>
              <Text style={s.metaText}>Delete</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  postWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: roles.border,
    marginBottom: 6,
  },
  heading: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: roles.textSoft,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  comment: { flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  reply: { paddingLeft: 58 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: roles.text },
  author: { fontFamily: fonts.bold },
  meta: { flexDirection: "row", gap: 16, marginTop: 4, alignItems: "center" },
  metaText: { fontFamily: fonts.body, fontSize: 13, color: roles.textSoft },
  metaAction: { fontFamily: fonts.bold, fontSize: 13, color: roles.textSoft },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: roles.border,
    backgroundColor: roles.bg,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  replying: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 8,
    paddingHorizontal: 4,
  },
  replyingText: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, color: roles.textSoft },
  cancel: { fontFamily: fonts.bold, fontSize: 13.5, color: roles.text },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: roles.borderStrong,
    backgroundColor: roles.surfaceSunken,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    fontFamily: fonts.body,
    fontSize: 15.5,
    color: roles.text,
  },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  dim: { opacity: 0.45 },
});
