import type { Comment, CommentPage, Post } from "@realm/contracts";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
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
import { alert } from "@/alert";
import { useApi } from "@/data";
import { Icon } from "@/icon";
import { useWide } from "@/layout";
import { leave } from "@/leave";
import { ApiError, api, mediaSource } from "@/server";
import { useSession } from "@/session";
import { useSheet } from "@/sheet";
import { Avatar } from "@/social/avatar";
import { PostCard } from "@/social/post-card";
import { useSafety } from "@/social/safety";
import { AppScreen, Loading, Problem, TopBar } from "@/social/screen";
import { ago } from "@/social/time";
import { type NativeTheme, useStyles, useTheme } from "@/theme";

/** One post, its comments (replies sit under the comment they answer), and a box to add one. */
export default function PostScreen() {
  const wide = useWide();
  const [photo, setPhoto] = useState(0);
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
      alert("Comment not sent", err instanceof ApiError ? err.message : "Try again.");
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

  // On a computer: the photos big on the left, the post and its comments on the right.
  const side = wide && post.data?.kind === "image" && post.data.media.length > 0;
  const shown = post.data?.media[Math.min(photo, (post.data?.media.length ?? 1) - 1)];
  return (
    <AppScreen max={side ? 1240 : 680}>
      <TopBar title="Post" />
      <View style={[s.fill, side && s.duo]}>
        {side && post.data && shown ? (
          <View style={s.duoMedia}>
            <Image
              source={mediaSource(shown.url)}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
            />
            {post.data.media.length > 1 ? (
              <>
                {photo > 0 ? (
                  <Pressable
                    onPress={() => setPhoto(photo - 1)}
                    accessibilityRole="button"
                    accessibilityLabel="Previous photo"
                    style={[s.arrow, s.arrowLeft]}
                  >
                    <Icon name="CaretLeft" size={20} color="#000000" />
                  </Pressable>
                ) : null}
                {photo < post.data.media.length - 1 ? (
                  <Pressable
                    onPress={() => setPhoto(photo + 1)}
                    accessibilityRole="button"
                    accessibilityLabel="Next photo"
                    style={[s.arrow, s.arrowRight]}
                  >
                    <Icon name="CaretRight" size={20} color="#000000" />
                  </Pressable>
                ) : null}
                <View style={s.dots} pointerEvents="none">
                  {post.data.media.map((m, i) => (
                    <View key={m.id} style={[s.dot, i === photo && s.dotOn]} />
                  ))}
                </View>
              </>
            ) : null}
          </View>
        ) : null}
        <KeyboardAvoidingView behavior="padding" style={side ? s.duoSide : s.fill}>
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
                    noMedia={side}
                    onChange={post.setData}
                    onRemoved={() => leave(router)}
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
                  post.data
                    ? `Add a comment for ${post.data.author.displayName}…`
                    : "Add a comment…"
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
      </View>
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
    duo: {
      flexDirection: "row",
      margin: 16,
      borderRadius: 14,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    duoMedia: { flexGrow: 1, flexShrink: 1, flexBasis: 0, backgroundColor: "#000000", minHeight: 420 },
    // A fixed-width column beside the photo: never grows, never squeezed.
    duoSide: { width: 420, flexGrow: 0, flexShrink: 0, backgroundColor: t.colors.bg },
    arrow: {
      position: "absolute",
      top: "50%",
      width: 32,
      height: 32,
      marginTop: -16,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.85)",
    },
    arrowLeft: { left: 14 },
    arrowRight: { right: 14 },
    dots: {
      position: "absolute",
      bottom: 14,
      left: 0,
      right: 0,
      flexDirection: "row",
      justifyContent: "center",
      gap: 5,
    },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.45)" },
    dotOn: { backgroundColor: "#ffffff" },
    fill: { flex: 1 },
    postWrap: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
      marginBottom: 6,
    },
    heading: {
      fontFamily: t.fonts.bold,
      fontSize: 15 * t.textScale,
      color: t.colors.textSoft,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    comment: { flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
    reply: { paddingLeft: 58 },
    body: {
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      lineHeight: 22 * t.textScale,
      color: t.colors.text,
    },
    author: { fontFamily: t.fonts.bold },
    meta: { flexDirection: "row", gap: 16, marginTop: 4, alignItems: "center" },
    metaText: { fontFamily: t.fonts.body, fontSize: 13 * t.textScale, color: t.colors.textSoft },
    metaAction: { fontFamily: t.fonts.bold, fontSize: 13 * t.textScale, color: t.colors.textSoft },
    hiddenText: {
      fontFamily: t.fonts.bold,
      fontSize: 13 * t.textScale,
      color: t.colors.danger,
      marginTop: 4,
    },
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
    replyingText: {
      flex: 1,
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      color: t.colors.textSoft,
    },
    cancel: { fontFamily: t.fonts.bold, fontSize: 13.5 * t.textScale, color: t.colors.text },
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
      fontFamily: t.fonts.body,
      fontSize: 15.5 * t.textScale,
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
