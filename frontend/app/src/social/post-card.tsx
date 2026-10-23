import type { MediaRef, Post } from "@realm/contracts";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { memo, useState } from "react";
import {
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { postsChanged } from "../data";
import { Icon } from "../icon";
import { SoundChip } from "../music/chip";
import { ApiError, api, mediaSource } from "../server";
import { useSession } from "../session";
import { useSheet } from "../sheet";
import { type NativeTheme, useStyles, useTheme } from "../theme";
import { Avatar } from "./avatar";
import { useSafety } from "./safety";
import { ago, agoLong, compact } from "./time";

/** The like colour: a warm pink, the one hue that means "loved" across social apps. */
export const LIKED = "#ff5f7a";

/** Photos and Clips are framed between 4:5 (portrait) and 1.91:1 (landscape), as people expect. */
export function frameRatio(m: MediaRef | undefined) {
  if (!m?.width || !m.height) return 4 / 5;
  return Math.min(1.91, Math.max(0.8, m.width / m.height));
}

/**
 * One post in a feed: who and where, the photos (double-tap to like), like / comment / share /
 * save, the likes, the caption and a way into the comments.
 */
export const PostCard = memo(function PostCard({
  post,
  onChange,
  onRemoved,
  standalone = false,
}: {
  post: Post;
  onChange: (p: Post) => void;
  onRemoved?: (id: string) => void;
  /** On the post's own screen: no "view comments" link, the full caption. */
  standalone?: boolean;
}) {
  const { t } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [expanded, setExpanded] = useState(standalone);

  async function setLike(on: boolean) {
    if (post.liked === on) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange({ ...post, liked: on, likeCount: Math.max(0, post.likeCount + (on ? 1 : -1)) });
    try {
      onChange(await api<Post>(`/posts/${post.id}/like`, { method: on ? "PUT" : "DELETE" }));
    } catch {
      onChange(post);
    }
  }

  async function setSave(on: boolean) {
    Haptics.selectionAsync();
    onChange({ ...post, saved: on });
    try {
      onChange(await api<Post>(`/posts/${post.id}/save`, { method: on ? "PUT" : "DELETE" }));
    } catch {
      onChange(post);
    }
  }

  const open = () => router.push({ pathname: "/post/[id]", params: { id: post.id } });
  const profile = () =>
    router.push({ pathname: "/user/[username]", params: { username: post.author.username } });

  const kind = t.style.posts;
  const media =
    post.kind === "text" ? (
      <Pressable onPress={standalone ? undefined : open} style={s.textPost}>
        <Text style={s.textBody}>{post.caption}</Text>
      </Pressable>
    ) : post.kind === "clip" ? (
      <ClipTile post={post} onPress={open} />
    ) : (
      <Photos
        media={post.media}
        onDoubleTap={() => setLike(true)}
        width={kind === "thread" ? width - 72 : width - 24}
        radius={kind === "ticket" ? 0 : t.radius.media}
      />
    );
  const glowSource = post.kind === "image" ? post.media[0] : undefined;
  const soundOnPhoto = kind === "glow" && post.kind === "image";
  const from = `${post.author.displayName}'s post`;

  return (
    <View style={[s.card, kind === "ticket" && s.ticket, kind === "thread" && s.thread]}>
      <View style={s.head}>
        <Pressable
          onPress={profile}
          style={s.who}
          accessibilityRole="link"
          accessibilityLabel={`${post.author.displayName}${post.space ? `, in ${post.space.name}` : ""}, ${agoLong(post.createdAt)}`}
        >
          <Avatar user={post.author} size={36} />
          <View style={s.whoText}>
            <Text style={s.name} numberOfLines={1}>
              {post.author.displayName}
            </Text>
            <Text style={s.meta} numberOfLines={1}>
              {post.space ? (
                <>
                  in <Text style={s.metaStrong}>{post.space.name}</Text> ·{" "}
                </>
              ) : null}
              {ago(post.createdAt)}
              {post.visibility === "followers" ? " · Followers" : ""}
            </Text>
          </View>
        </Pressable>
        <PostMenu post={post} onChange={onChange} onRemoved={onRemoved} />
      </View>
      {post.hidden ? (
        <View style={s.hidden} accessibilityRole="alert">
          <Icon name="WarningCircle" size={18} color={t.colors.danger} />
          <Text style={s.hiddenText}>
            Taken down after reports. Only you can see it now; you can still delete it.
          </Text>
        </View>
      ) : null}

      {post.sound && post.kind !== "clip" && !soundOnPhoto ? (
        <View style={[s.sound, kind === "thread" && s.threadIndent]}>
          <SoundChip sound={post.sound} playKey={`post:${post.id}`} from={from} />
        </View>
      ) : null}
      {kind === "thread" && post.caption && post.kind !== "text" ? (
        <Text style={[s.caption, s.threadIndent]} numberOfLines={expanded ? undefined : 4}>
          {post.caption}
        </Text>
      ) : null}
      <View style={[kind === "glow" && s.mediaWrap, kind === "thread" && s.threadIndent]}>
        {kind === "glow" && glowSource && t.style.glow > 0 ? (
          // The photo lights the room: a soft, blurred copy of itself behind it.
          <Image
            source={mediaSource(glowSource.url)}
            style={[s.glow, { opacity: 0.25 + t.style.glow * 0.45 }]}
            blurRadius={36}
            contentFit="cover"
            recyclingKey={`glow-${glowSource.id}`}
            accessible={false}
          />
        ) : null}
        {media}
        {soundOnPhoto && post.sound ? (
          // Now Playing: the song sits on the photo it goes with.
          <View style={s.soundOver} pointerEvents="box-none">
            <SoundChip sound={post.sound} playKey={`post:${post.id}`} over from={from} />
          </View>
        ) : null}
      </View>
      {kind === "ticket" ? (
        <View style={s.tear} accessible={false}>
          <View style={[s.notch, s.notchLeft]} />
          <View style={s.tearLine} />
          <View style={[s.notch, s.notchRight]} />
        </View>
      ) : null}

      <View style={[s.actions, kind === "thread" && s.threadIndentActions]}>
        <IconButton
          name={post.liked ? "HeartFill" : "Heart"}
          color={post.liked ? LIKED : t.colors.text}
          label={post.liked ? "Unlike" : "Like"}
          onPress={() => setLike(!post.liked)}
        />
        <IconButton name="ChatCircle" label="Comments" onPress={open} />
        <IconButton
          name="PaperPlaneTilt"
          label="Share"
          onPress={() =>
            Share.share({
              message: `${post.author.displayName} on Realm${post.caption ? `: ${post.caption}` : ""}`,
            })
          }
        />
        <View style={s.grow} />
        <IconButton
          name={post.saved ? "BookmarkSimpleFill" : "BookmarkSimple"}
          label={post.saved ? "Remove from saved" : "Save"}
          onPress={() => setSave(!post.saved)}
        />
      </View>

      {post.likeCount > 0 ? (
        <Text style={s.likes}>
          {compact(post.likeCount)} {post.likeCount === 1 ? "like" : "likes"}
        </Text>
      ) : null}
      {post.caption && post.kind !== "text" && kind !== "thread" ? (
        <Pressable onPress={() => setExpanded(true)} disabled={expanded}>
          <Text style={s.caption} numberOfLines={expanded ? undefined : 2}>
            <Text style={s.captionName}>{post.author.displayName} </Text>
            {post.caption}
          </Text>
        </Pressable>
      ) : null}
      {!standalone && post.commentCount > 0 ? (
        <Pressable onPress={open} accessibilityRole="link" style={s.commentsLink}>
          <Text style={s.soft}>
            View{" "}
            {post.commentCount === 1 ? "1 comment" : `all ${compact(post.commentCount)} comments`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
});

function IconButton({
  name,
  label,
  onPress,
  color,
}: {
  name: Parameters<typeof Icon>[0]["name"];
  label: string;
  onPress: () => void;
  color?: string;
}) {
  const { t } = useTheme();
  const s = useStyles(make);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [s.iconBtn, pressed && { transform: [{ scale: 0.9 }] }]}
    >
      <Icon name={name} size={27} color={color ?? t.colors.text} />
    </Pressable>
  );
}

/** Photos, swiped sideways when there's more than one. A double-tap likes, with a heart. */
function Photos({
  media,
  onDoubleTap,
  width,
  radius = 0,
}: {
  media: MediaRef[];
  onDoubleTap: () => void;
  width: number;
  radius?: number;
}) {
  const { t } = useTheme();
  const s = useStyles(make);
  const height = width / frameRatio(media[0]);
  const [index, setIndex] = useState(0);
  const burst = useSharedValue(0);
  const heart = useAnimatedStyle(() => ({
    opacity: burst.value > 0 ? 1 : 0,
    transform: [{ scale: burst.value }],
  }));
  const like = () => {
    onDoubleTap();
    burst.value = withSequence(
      withSpring(1.15, { damping: 9, stiffness: 260, reduceMotion: ReduceMotion.System }),
      withDelay(450, withTiming(0, { duration: 160, reduceMotion: ReduceMotion.System })),
    );
  };
  const tap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scheduleOnRN(like);
    });

  return (
    <GestureDetector gesture={tap}>
      <View
        style={{ width, height, borderRadius: radius, overflow: "hidden" }}
        accessible
        accessibilityLabel={`${media.length === 1 ? "Photo" : `${media.length} photos`}. Double tap to like.`}
      >
        <FlatList
          data={media}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(m) => m.id}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <Image
              source={mediaSource(item.url)}
              style={{ width, height, backgroundColor: t.colors.surfaceSunken }}
              contentFit="cover"
              recyclingKey={item.id}
              transition={150}
            />
          )}
        />
        <Animated.View style={[s.burst, heart]} pointerEvents="none">
          <Icon name="HeartFill" size={96} color="#ffffff" />
        </Animated.View>
        {media.length > 1 ? (
          <View style={s.dots} pointerEvents="none">
            {media.map((m, i) => (
              <View key={m.id} style={[s.dot, i === index && s.dotOn]} />
            ))}
          </View>
        ) : null}
      </View>
    </GestureDetector>
  );
}

/** A Clip in a list: a dark frame with its length; it plays on its own screen and in Clips. */
export function ClipTile({ post, onPress }: { post: Post; onPress: () => void }) {
  const s = useStyles(make);
  const { width } = useWindowDimensions();
  const ms = post.media[0]?.durationMs ?? 0;
  const length = ms
    ? `${Math.floor(ms / 60000)}:${String(Math.round(ms / 1000) % 60).padStart(2, "0")}`
    : "";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Play Clip${length ? `, ${length}` : ""}`}
      style={[s.clip, { width, height: width * 1.1 }]}
    >
      <View style={s.play}>
        <Icon name="PlayFill" size={30} color="#ffffff" />
      </View>
      {length ? <Text style={s.length}>{length}</Text> : null}
    </Pressable>
  );
}

/**
 * A post's menu. Yours: who sees it, or delete. Someone else's: report it, or block them.
 */
function PostMenu({
  post,
  onChange,
  onRemoved,
}: {
  post: Post;
  onChange: (p: Post) => void;
  onRemoved?: (id: string) => void;
}) {
  const { t } = useTheme();
  const s = useStyles(make);
  const { session } = useSession();
  const sheet = useSheet();
  const safety = useSafety();
  if (session.status !== "signedIn") return null;
  const mine = session.user.id === post.author.id;
  const failed = (err: unknown) =>
    sheet({
      title: "That didn't work",
      line: err instanceof ApiError ? err.message : "Something went wrong. Try again.",
      actions: [],
    });

  const showMenu = () => {
    if (!mine) {
      sheet({
        actions: [
          {
            label: "Report post",
            icon: "Flag",
            danger: true,
            onPress: () => safety.report("post", post.id, post.author),
          },
          {
            label: `Block @${post.author.username}`,
            icon: "Prohibit",
            danger: true,
            onPress: () =>
              safety.block(post.author, () => {
                onRemoved?.(post.id);
              }),
          },
        ],
      });
      return;
    }
    const next = post.visibility === "public" ? "followers" : "public";
    sheet({
      title: "Your post",
      actions: [
        {
          label: next === "public" ? "Show to everyone" : "Only my followers",
          icon: next === "public" ? "Globe" : "Lock",
          onPress: async () => {
            try {
              onChange(
                await api<Post>(`/posts/${post.id}`, {
                  method: "PATCH",
                  body: { visibility: next },
                }),
              );
            } catch (err) {
              failed(err);
            }
          },
        },
        {
          label: "Delete post",
          icon: "Trash",
          danger: true,
          onPress: () =>
            sheet({
              title: "Delete this post?",
              line: "It's gone for everyone, with its likes and comments.",
              actions: [
                {
                  label: "Delete",
                  icon: "Trash",
                  danger: true,
                  onPress: async () => {
                    try {
                      await api(`/posts/${post.id}`, { method: "DELETE" });
                      onRemoved?.(post.id);
                      postsChanged();
                    } catch (err) {
                      failed(err);
                    }
                  },
                },
              ],
            }),
        },
      ],
    });
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Post options"
      onPress={showMenu}
      style={s.iconBtn}
    >
      <Icon name="DotsThreeBold" size={22} color={t.colors.textSoft} />
    </Pressable>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    card: { paddingBottom: 14 },
    // Look A: a ticket stub, the photo on top and a tear line above the details.
    ticket: {
      marginHorizontal: 12,
      marginBottom: 16,
      borderRadius: t.radius.box,
      backgroundColor: t.colors.surface,
      overflow: "hidden",
    },
    // Look C: a thread, divided by thin lines.
    thread: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
      paddingBottom: 10,
    },
    threadIndent: { marginLeft: 58, marginRight: 14 },
    sound: { paddingHorizontal: 12, paddingBottom: 10 },
    soundOver: { position: "absolute", left: 10, right: 10, bottom: 10, alignItems: "flex-start" },
    threadIndentActions: { marginLeft: 46 },
    mediaWrap: { marginHorizontal: 12 },
    glow: {
      position: "absolute",
      top: "8%",
      left: "-4%",
      right: "-4%",
      bottom: "-6%",
      borderRadius: 40,
      transform: [{ scale: 1.04 }],
    },
    tear: { height: 20, flexDirection: "row", alignItems: "center" },
    tearLine: {
      flex: 1,
      marginHorizontal: 6,
      borderTopWidth: 2,
      borderStyle: "dashed",
      borderColor: t.colors.border,
    },
    notch: { width: 20, height: 20, borderRadius: 10, backgroundColor: t.colors.bg },
    notchLeft: { marginLeft: -10 },
    notchRight: { marginRight: -10 },
    hidden: {
      flexDirection: "row",
      gap: 8,
      alignItems: "flex-start",
      marginHorizontal: 12,
      marginBottom: 8,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: t.colors.dangerLine,
    },
    hiddenText: {
      flex: 1,
      fontFamily: t.fonts.body,
      fontSize: 14 * t.textScale,
      lineHeight: 20 * t.textScale,
      color: t.colors.text,
    },
    head: {
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: 12,
      paddingRight: 4,
      paddingVertical: 8,
    },
    who: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48 },
    whoText: { flex: 1 },
    name: { fontFamily: t.fonts.bold, fontSize: 15 * t.textScale, color: t.colors.text },
    meta: {
      fontFamily: t.fonts.body,
      fontSize: 13 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 1,
    },
    metaStrong: { fontFamily: t.fonts.bold, color: t.colors.text },
    textPost: { paddingHorizontal: 16, paddingVertical: 10 },
    textBody: {
      fontFamily: t.fonts.body,
      fontSize: 20 * t.textScale,
      lineHeight: 29 * t.textScale,
      color: t.colors.text,
    },
    actions: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingTop: 4 },
    iconBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
    grow: { flex: 1 },
    likes: {
      fontFamily: t.fonts.bold,
      fontSize: 15 * t.textScale,
      color: t.colors.text,
      paddingHorizontal: 14,
    },
    caption: {
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      lineHeight: 22 * t.textScale,
      color: t.colors.text,
      paddingHorizontal: 14,
      marginTop: 4,
    },
    captionName: { fontFamily: t.fonts.bold },
    commentsLink: { paddingHorizontal: 14, paddingVertical: 6 },
    soft: { fontFamily: t.fonts.body, fontSize: 14 * t.textScale, color: t.colors.textSoft },
    burst: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    dots: {
      position: "absolute",
      bottom: 10,
      left: 0,
      right: 0,
      flexDirection: "row",
      justifyContent: "center",
      gap: 5,
    },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.45)" },
    dotOn: { backgroundColor: "#ffffff" },
    clip: { backgroundColor: "#06080c", alignItems: "center", justifyContent: "center" },
    play: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(11,11,14,0.6)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.2)",
    },
    length: {
      position: "absolute",
      right: 12,
      bottom: 12,
      fontFamily: t.fonts.bold,
      fontSize: 13 * t.textScale,
      color: "#ffffff",
      backgroundColor: "rgba(11,11,14,0.7)",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      overflow: "hidden",
    },
  });
