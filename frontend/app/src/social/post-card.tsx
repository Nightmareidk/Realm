import type { MediaRef, Post } from "@realm/contracts";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
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
import { postLink } from "../chat/post-link";
import { postsChanged } from "../data";
import { Icon } from "../icon";
import { useContentWidth } from "../layout";
import { SoundChip } from "../music/chip";
import { feedStop } from "../music/player";
import { EdgeArrow, useFinePointer } from "../scroll-row";
import { ApiError, api, mediaSource } from "../server";
import { useSession } from "../session";
import { useSheet } from "../sheet";
import { type NativeTheme, useStyles, useTheme } from "../theme";
import { Avatar } from "./avatar";
import { CapsuleNote, SealedCapsule, useCapsuleOpening } from "./capsule";
import { CommentsSheet } from "./comments-sheet";
import { MentionText } from "./mention-text";
import { PollCard } from "./poll";
import { QuotedCard } from "./quoted";
import { useSafety } from "./safety";
import { ago, agoLong, compact } from "./time";
import { Verified } from "./verified";

/** The like colour: a warm pink, the one hue that means "loved" across social apps. */
export const LIKED = "#ff5f7a";
/** The repost colour: the green people know from sharing on other apps. */
export const REPOSTED = "#2fbf71";

/** A post's photos and videos all sit in one tall frame, 4:5, the way Instagram shows them. */
export const FRAME = 4 / 5;

/** Taller than wide: it fills the frame. Anything else shows whole, with black above and below. */
function isPortrait(m: MediaRef) {
  return !m.width || !m.height || m.height > m.width;
}

/** The first photo in a post (a post can start with a video), for the colours around it. */
export function firstPhoto(media: MediaRef[]) {
  return media.find((m) => m.kind === "image");
}

/* Whether videos in the feed play with sound. Like Instagram: muted at first, and once you turn the
   sound on it stays on for the next video, until you turn it off again. */
let feedMuted = true;
const muteListeners = new Set<() => void>();
function setFeedMuted(muted: boolean) {
  feedMuted = muted;
  for (const l of muteListeners) l();
}
function useFeedMuted() {
  return useSyncExternalStore(
    (l) => {
      muteListeners.add(l);
      return () => muteListeners.delete(l);
    },
    () => feedMuted,
  );
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
  noMedia = false,
  active,
}: {
  post: Post;
  onChange: (p: Post) => void;
  onRemoved?: (id: string) => void;
  /** On the post's own screen: no "view comments" link, the full caption. */
  standalone?: boolean;
  /** The photos are shown beside it (a post's page on a computer). */
  noMedia?: boolean;
  /** The post the feed has on screen: its video plays by itself. A post's own screen always is. */
  active?: boolean;
}) {
  const { t } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const width = useContentWidth(680);
  const [expanded, setExpanded] = useState(standalone);
  const { session } = useSession();
  const sheet = useSheet();
  const meId = session.status === "signedIn" ? session.user.id : null;
  // A hidden like count is the author's alone.
  const showLikes = !post.hideLikes || post.author.id === meId;
  // A time capsule that hasn't opened: nobody likes, comments or shares it yet, and only its
  // author sees what's inside.
  const sealed = Boolean(post.capsule?.sealed);
  const sealedForMe = sealed && post.author.id !== meId;
  useCapsuleOpening(post, onChange);

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

  // Repost: share someone else's public post with your followers. Never your own, never a
  // Space post or a followers-only one (the server checks this too).
  const canRepost =
    meId !== null &&
    post.author.id !== meId &&
    post.visibility === "public" &&
    !post.space &&
    !sealed;
  async function setRepost(on: boolean) {
    if (post.reposted === on) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onChange({
      ...post,
      reposted: on,
      repostCount: Math.max(0, post.repostCount + (on ? 1 : -1)),
    });
    try {
      onChange({
        ...(await api<Post>(`/posts/${post.id}/repost`, { method: on ? "PUT" : "DELETE" })),
        repostedBy: post.repostedBy,
      });
    } catch {
      onChange(post);
    }
  }
  const by = post.repostedBy;
  // Repost as it is, or quote it with your own words on top (your own posts can be quoted too).
  const canQuote = meId !== null && post.visibility === "public" && !post.space && !sealed;
  const quote = () => router.push({ pathname: "/create", params: { quote: post.id } });
  const shareOn = () =>
    canRepost
      ? sheet({
          actions: [
            {
              label: post.reposted ? "Undo repost" : "Repost",
              icon: "Repeat",
              onPress: () => void setRepost(!post.reposted),
            },
            { label: "Quote", icon: "Quotes", onPress: quote },
          ],
        })
      : quote();

  const open = () => router.push({ pathname: "/post/[id]", params: { id: post.id } });
  // Comments come up from the bottom over the post, as on Instagram.
  const [commenting, setCommenting] = useState(false);
  const comments = () => setCommenting(true);
  const profile = () =>
    router.push({ pathname: "/user/[username]", params: { username: post.author.username } });

  // Posts with only words read as a conversation in every look (the owner, 2026-11-19), so they
  // are clearly apart from photos: name and @handle on one line, smaller text, counts by the icons.
  const wordsOnly = post.kind === "text" && !sealedForMe;
  const kind = wordsOnly ? "thread" : t.style.posts;
  const media = sealedForMe ? (
    <SealedCapsule
      post={post}
      onRemind={setSave}
      width={kind === "thread" ? width - 72 : width - 24}
    />
  ) : post.kind === "text" ? (
    <Pressable onPress={standalone ? undefined : open} style={s.textPost}>
      <Text style={s.textBody}>
        <MentionText text={post.caption ?? ""} />
      </Text>
    </Pressable>
  ) : post.kind === "clip" ? (
    // In a feed the tile opens the post's own screen, and there the Clip plays.
    // Sized and rounded like photos, inside the card's side gaps.
    standalone ? (
      <ClipPlayer
        post={post}
        width={kind === "thread" ? width - 72 : width - 24}
        radius={kind === "ticket" ? 0 : t.radius.media}
      />
    ) : (
      <ClipTile
        post={post}
        onPress={open}
        width={kind === "thread" ? width - 72 : width - 24}
        radius={kind === "ticket" ? 0 : t.radius.media}
      />
    )
  ) : (
    <Photos
      media={post.media}
      onDoubleTap={() => setLike(true)}
      width={kind === "thread" ? width - 72 : width - 24}
      radius={kind === "ticket" ? 0 : t.radius.media}
      active={active ?? standalone}
    />
  );
  const glowSource = post.kind === "image" ? firstPhoto(post.media) : undefined;
  const soundOnPhoto = kind === "glow" && post.kind === "image";
  const from = `${post.author.displayName}'s post`;
  const reposts = post.repostCount ?? 0;
  const counts = [
    showLikes && post.likeCount > 0
      ? `${compact(post.likeCount)} ${post.likeCount === 1 ? "like" : "likes"}`
      : !showLikes && post.liked
        ? "Liked by you and others"
        : "",
    reposts > 0 ? `${compact(reposts)} ${reposts === 1 ? "repost" : "reposts"}` : "",
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <View style={[s.card, kind === "ticket" && s.ticket, kind === "thread" && s.thread]}>
      {by ? (
        <Pressable
          onPress={() =>
            router.push({ pathname: "/user/[username]", params: { username: by.username } })
          }
          accessibilityRole="link"
          style={s.reposted}
        >
          <Icon name="Repeat" size={15} color={t.colors.textSoft} />
          <Text style={s.repostedText} numberOfLines={1}>
            {by.id === meId ? "You" : by.displayName} reposted
          </Text>
        </Pressable>
      ) : null}
      <View style={[s.head, wordsOnly && s.headWords]}>
        <Pressable
          onPress={profile}
          style={s.who}
          accessibilityRole="link"
          accessibilityLabel={`${post.author.displayName}${post.space ? `, in ${post.space.name}` : ""}, ${agoLong(post.createdAt)}`}
        >
          <Avatar user={post.author} size={36} />
          <View style={s.whoText}>
            <View style={s.nameRow}>
              <Text style={[s.name, wordsOnly && s.nameWords]} numberOfLines={1}>
                {post.author.displayName}
              </Text>
              <Verified kind={post.author.verified} size={15} />
              {wordsOnly ? (
                <Text style={s.handle} numberOfLines={1}>
                  @{post.author.username} · {ago(post.createdAt)}
                </Text>
              ) : null}
            </View>
            {wordsOnly && !post.space && post.visibility !== "followers" ? null : (
              <Text style={s.meta} numberOfLines={1}>
                {post.space ? (
                  <>
                    in <Text style={s.metaStrong}>{post.space.name}</Text>
                    {wordsOnly ? "" : " · "}
                  </>
                ) : null}
                {wordsOnly ? "" : ago(post.createdAt)}
                {post.visibility === "followers"
                  ? `${wordsOnly && !post.space ? "" : " · "}Followers`
                  : ""}
              </Text>
            )}
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
      <CapsuleNote post={post} mine={post.author.id === meId} />

      {post.sound && post.kind !== "clip" && !soundOnPhoto ? (
        <View style={[s.sound, kind === "thread" && s.threadIndent]}>
          <SoundChip sound={post.sound} playKey={`post:${post.id}`} from={from} />
        </View>
      ) : null}
      {kind === "thread" && post.caption && post.kind !== "text" ? (
        <Text style={[s.caption, s.threadIndent]} numberOfLines={expanded ? undefined : 4}>
          <MentionText text={post.caption} />
        </Text>
      ) : null}
      {noMedia && post.kind === "image" ? (
        post.sound ? (
          <View style={s.sound}>
            <SoundChip sound={post.sound} playKey={`post:${post.id}`} from={from} />
          </View>
        ) : null
      ) : (
        <View style={[kind === "glow" && s.mediaWrap, kind === "thread" && s.threadIndent]}>
          {kind === "glow" && glowSource && t.style.glow > 0 ? (
            // The photo lights the room: a soft, blurred copy of itself behind it.
            <Image
              transition={150}
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
      )}
      {post.poll ? (
        <View style={kind === "thread" && s.threadIndent}>
          <PollCard post={post} onChange={onChange} />
        </View>
      ) : null}
      {post.quoted ? (
        <View style={kind === "thread" && s.threadIndent}>
          <QuotedCard quoted={post.quoted} />
        </View>
      ) : null}
      {kind === "ticket" && !noMedia && !sealedForMe ? (
        <View style={s.tear} accessible={false}>
          <View style={[s.notch, s.notchLeft]} />
          <View style={s.tearLine} />
          <View style={[s.notch, s.notchRight]} />
        </View>
      ) : null}

      <View style={[s.actions, kind === "thread" && s.threadIndentActions]}>
        {sealed ? null : (
          <IconButton
            name={post.liked ? "HeartFill" : "Heart"}
            color={post.liked ? t.colors.like : t.colors.text}
            label={post.liked ? "Unlike" : "Like"}
            onPress={() => setLike(!post.liked)}
            small={wordsOnly}
            count={wordsOnly && showLikes && post.likeCount > 0 ? compact(post.likeCount) : ""}
          />
        )}
        {post.commentsOff || sealed ? null : (
          <IconButton
            name="ChatCircle"
            label="Comments"
            onPress={comments}
            small={wordsOnly}
            count={wordsOnly && post.commentCount > 0 ? compact(post.commentCount) : ""}
          />
        )}
        {canQuote ? (
          <IconButton
            small={wordsOnly}
            count={wordsOnly && reposts > 0 ? compact(reposts) : ""}
            name="Repeat"
            color={post.reposted ? REPOSTED : t.colors.text}
            label={
              canRepost ? (post.reposted ? "Reposted. Undo or quote" : "Repost or quote") : "Quote"
            }
            onPress={shareOn}
          />
        ) : null}
        <IconButton
          small={wordsOnly}
          name="PaperPlaneTilt"
          label="Send"
          onPress={() =>
            router.push({ pathname: "/send", params: { link: postLink(post.id), what: "post" } })
          }
        />
        <View style={s.grow} />
        {sealedForMe ? null : (
          <IconButton
            small={wordsOnly}
            name={post.saved ? "BookmarkSimpleFill" : "BookmarkSimple"}
            label={post.saved ? "Remove from saved" : "Save"}
            onPress={() => setSave(!post.saved)}
          />
        )}
      </View>

      {counts && !wordsOnly ? <Text style={s.likes}>{counts}</Text> : null}
      {post.tags.length ? (
        <Text style={[s.caption, s.soft]} numberOfLines={2}>
          <Icon name="UserCircleFill" size={14} color={t.colors.textSoft} /> with{" "}
          <MentionText text={post.tags.map((u) => `@${u.username}`).join(", ")} />
        </Text>
      ) : null}
      {post.caption && post.kind !== "text" && kind !== "thread" ? (
        <Pressable onPress={() => setExpanded(true)} disabled={expanded}>
          <Text style={s.caption} numberOfLines={expanded ? undefined : 2}>
            <Text style={s.captionName}>{post.author.displayName} </Text>
            <MentionText text={post.caption} />
          </Text>
        </Pressable>
      ) : null}
      {!standalone && !wordsOnly && post.commentCount > 0 && !post.commentsOff ? (
        <Pressable onPress={comments} accessibilityRole="link" style={s.commentsLink}>
          <Text style={s.soft}>
            View{" "}
            {post.commentCount === 1 ? "1 comment" : `all ${compact(post.commentCount)} comments`}
          </Text>
        </Pressable>
      ) : null}
      <CommentsSheet
        post={post}
        visible={commenting}
        onClose={() => setCommenting(false)}
        onCount={(n) => {
          if (n !== post.commentCount && commenting) onChange({ ...post, commentCount: n });
        }}
      />
    </View>
  );
});

function IconButton({
  name,
  label,
  onPress,
  color,
  small,
  count,
}: {
  name: Parameters<typeof Icon>[0]["name"];
  label: string;
  onPress: () => void;
  color?: string;
  /** Posts with only words: smaller icons with their count beside them. */
  small?: boolean;
  count?: string;
}) {
  const { t } = useTheme();
  const s = useStyles(make);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count ? `${label}, ${count}` : label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        s.iconBtn,
        small && s.iconBtnSmall,
        pressed && { transform: [{ scale: 0.9 }] },
      ]}
    >
      <Icon name={name} size={small ? 21 : 27} color={color ?? t.colors.text} />
      {count ? (
        <Text style={[s.count, color && color !== t.colors.text ? { color } : null]}>{count}</Text>
      ) : null}
    </Pressable>
  );
}

/**
 * A post's photos and videos, swiped sideways when there's more than one. A double-tap likes, with a
 * heart. Each one sits in the same 4:5 frame: a tall one fills it, a wide or square one shows whole
 * with black above and below. A video plays by itself, muted, while its post is on screen.
 */
function Photos({
  media,
  onDoubleTap,
  width,
  radius = 0,
  active = false,
}: {
  media: MediaRef[];
  onDoubleTap: () => void;
  width: number;
  radius?: number;
  active?: boolean;
}) {
  const s = useStyles(make);
  const height = width / FRAME;
  const videos = media.filter((m) => m.kind === "video").length;
  const photos = media.length - videos;
  const what = [
    photos ? `${photos} ${photos === 1 ? "photo" : "photos"}` : "",
    videos ? `${videos} ${videos === 1 ? "video" : "videos"}` : "",
  ]
    .filter(Boolean)
    .join(" and ");
  const [index, setIndex] = useState(0);
  // With a mouse nothing can be swiped, so arrows step through the photos.
  const fine = useFinePointer();
  const list = useRef<FlatList<MediaRef>>(null);
  const show = (i: number) => {
    const to = Math.max(0, Math.min(media.length - 1, i));
    list.current?.scrollToOffset({ offset: to * width, animated: true });
    setIndex(to);
  };
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
        style={{ width, height, borderRadius: radius, overflow: "hidden", backgroundColor: "#000" }}
        accessible={videos === 0}
        accessibilityLabel={`${media.length === 1 && !videos ? "Photo" : what}. Double tap to like.`}
      >
        <FlatList
          ref={list}
          data={media}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(m) => m.id}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          extraData={`${active}-${index}`}
          renderItem={({ item, index: i }) =>
            item.kind === "video" ? (
              <FeedVideo media={item} width={width} height={height} play={active && i === index} />
            ) : (
              <Image
                source={mediaSource(item.url)}
                style={{ width, height, backgroundColor: "#000" }}
                contentFit={isPortrait(item) ? "cover" : "contain"}
                recyclingKey={item.id}
                transition={150}
              />
            )
          }
        />
        <Animated.View style={[s.burst, heart]} pointerEvents="none">
          <Icon name="HeartFill" size={96} color="#ffffff" />
        </Animated.View>
        {fine && index > 0 ? (
          <EdgeArrow side="left" onPress={() => show(index - 1)} label="Previous photo" />
        ) : null}
        {fine && index < media.length - 1 ? (
          <EdgeArrow side="right" onPress={() => show(index + 1)} label="Next photo" />
        ) : null}
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

/**
 * A video in a post. It starts loading the first time its post is on screen, plays (muted, looping)
 * while it is, and pauses when the post scrolls away, another screen opens or the app is left. The
 * speaker button turns the sound on or off for every video in the feed, as on Instagram.
 */
function FeedVideo({
  media,
  width,
  height,
  play,
}: {
  media: MediaRef;
  width: number;
  height: number;
  play: boolean;
}) {
  const s = useStyles(make);
  const muted = useFeedMuted();
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const on = play && focused;
  // Nothing loads until it's first on screen, so a long feed doesn't download every video.
  const [started, setStarted] = useState(on);
  useEffect(() => {
    if (on) setStarted(true);
  }, [on]);
  const player = useVideoPlayer(started ? mediaSource(media.url) : null, (p) => {
    p.loop = true;
    p.muted = feedMuted;
  });
  useEffect(() => {
    try {
      player.muted = muted;
    } catch {
      /* already gone */
    }
  }, [player, muted]);
  useEffect(() => {
    try {
      if (on) player.play();
      else player.pause();
    } catch {
      /* already gone */
    }
  }, [player, on]);
  const secs = Math.round((media.durationMs ?? 0) / 1000);
  return (
    <View style={{ width, height, backgroundColor: "#000" }}>
      {started ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit={isPortrait(media) ? "cover" : "contain"}
          nativeControls={false}
          // Android: the default surface stays black inside a rounded frame in a list.
          surfaceType="textureView"
          accessibilityLabel="Video"
        />
      ) : null}
      {!on ? (
        <View style={s.videoIdle} pointerEvents="none">
          <View style={s.play}>
            <Icon name="PlayFill" size={30} color="#ffffff" />
          </View>
        </View>
      ) : null}
      {secs > 0 && !on ? (
        <Text style={[s.length, { right: undefined, left: 12 }]} pointerEvents="none">
          {`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`}
        </Text>
      ) : null}
      <Pressable
        onPress={() => {
          // Sound on: the post's song (if any) stops, so the two don't play over each other.
          if (muted) feedStop();
          setFeedMuted(!muted);
        }}
        accessibilityRole="button"
        accessibilityLabel={muted ? "Turn the sound on" : "Turn the sound off"}
        hitSlop={10}
        style={({ pressed }) => [s.mute, pressed && { opacity: 0.7 }]}
      >
        <Icon
          name={muted ? "SpeakerSlashFill" : "SpeakerSimpleHighFill"}
          size={16}
          color="#ffffff"
        />
      </Pressable>
    </View>
  );
}

/** A Clip in a list: a dark frame with its length; it plays on its own screen and in Clips. */
export function ClipTile({
  post,
  onPress,
  width,
  radius = 0,
}: {
  post: Post;
  onPress: () => void;
  width: number;
  radius?: number;
}) {
  const s = useStyles(make);
  const ms = post.media[0]?.durationMs ?? 0;
  const length = ms
    ? `${Math.floor(ms / 60000)}:${String(Math.round(ms / 1000) % 60).padStart(2, "0")}`
    : "";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Play Clip${length ? `, ${length}` : ""}`}
      style={[s.clip, { width, height: width * 1.1, borderRadius: radius, overflow: "hidden" }]}
    >
      <View style={s.play}>
        <Icon name="PlayFill" size={30} color="#ffffff" />
      </View>
      {length ? <Text style={s.length}>{length}</Text> : null}
    </Pressable>
  );
}

/**
 * A Clip on its own post screen: it plays right there, with the phone's usual video controls
 * (play, pause, seek, full screen). With music on it, the music plays instead of the video's own
 * sound, as in Clips. It pauses when you leave the screen.
 */
function ClipPlayer({ post, width, radius = 0 }: { post: Post; width: number; radius?: number }) {
  const s = useStyles(make);
  const video = post.media[0];
  const player = useVideoPlayer(video ? mediaSource(video.url) : null, (p) => {
    p.loop = true;
    p.muted = Boolean(post.sound);
  });
  useFocusEffect(
    useCallback(() => {
      return () => {
        try {
          player.pause();
        } catch {
          // The player is already gone with the screen.
        }
      };
    }, [player]),
  );
  return (
    <View
      style={[s.clip, { width, height: width * 1.1, borderRadius: radius, overflow: "hidden" }]}
    >
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls
        accessibilityLabel={`Clip by ${post.author.displayName}`}
        fullscreenOptions={{ enable: true, orientation: "default" }}
      />
    </View>
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
  const router = useRouter();
  const sheet = useSheet();
  const safety = useSafety();
  if (session.status !== "signedIn") return null;
  const mine = session.user.id === post.author.id;
  const meId = session.user.id;
  const toCollection = {
    label: "Save to a collection",
    icon: "FolderSimple" as const,
    onPress: () => router.push({ pathname: "/save-to", params: { post: post.id } }),
  };
  /** The author's switches: hide the like count, turn comments off, archive. */
  const set = async (body: { hideLikes?: boolean; commentsOff?: boolean; archived?: boolean }) => {
    try {
      const p = await api<Post>(`/posts/${post.id}`, { method: "PATCH", body });
      if (body.archived) {
        onRemoved?.(post.id);
        postsChanged();
      } else onChange(p);
    } catch (err) {
      failed(err);
    }
  };
  const failed = (err: unknown) =>
    sheet({
      title: "That didn't work",
      line: err instanceof ApiError ? err.message : "Something went wrong. Try again.",
      actions: [],
    });

  const showMenu = () => {
    const copy = {
      label: "Copy link",
      icon: "Link" as const,
      onPress: () => Clipboard.setStringAsync(postLink(post.id)),
    };
    if (!mine) {
      const tagged = post.tags.some((u) => u.id === meId);
      sheet({
        actions: [
          copy,
          toCollection,
          ...(tagged
            ? [
                {
                  label: "Remove me from this post",
                  icon: "UserMinus" as const,
                  onPress: async () => {
                    try {
                      await api(`/posts/${post.id}/tags/@me`, { method: "DELETE" });
                      onChange({ ...post, tags: post.tags.filter((u) => u.id !== meId) });
                    } catch (err) {
                      failed(err);
                    }
                  },
                },
              ]
            : []),
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
          label: post.pinned ? "Unpin from your profile" : "Pin to your profile",
          icon: "PushPin",
          onPress: async () => {
            try {
              onChange(
                await api<Post>(`/posts/${post.id}/pin`, {
                  method: post.pinned ? "DELETE" : "PUT",
                }),
              );
            } catch (err) {
              failed(err);
            }
          },
        },
        copy,
        toCollection,
        {
          label: post.hideLikes ? "Show like count" : "Hide like count",
          icon: "EyeSlash",
          onPress: () => void set({ hideLikes: !post.hideLikes }),
        },
        {
          label: post.commentsOff ? "Turn on comments" : "Turn off comments",
          icon: "ChatCircleSlash",
          onPress: () => void set({ commentsOff: !post.commentsOff }),
        },
        {
          label: "Archive",
          icon: "Archive",
          onPress: () => void set({ archived: true }),
        },
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
    nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
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
    reposted: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      minHeight: 32,
      paddingLeft: 22,
      paddingRight: 12,
      paddingTop: 6,
    },
    repostedText: {
      fontFamily: t.fonts.bold,
      fontSize: 13 * t.textScale,
      color: t.colors.textSoft,
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
    // Posts with only words: the text sits under the name, beside the picture's column.
    textPost: { paddingBottom: 2 },
    textBody: {
      fontFamily: t.fonts.body,
      fontSize: 16 * t.textScale,
      lineHeight: 23 * t.textScale,
      color: t.colors.text,
    },
    headWords: { paddingBottom: 0 },
    nameWords: { flexShrink: 1 },
    handle: {
      flexShrink: 1,
      fontFamily: t.fonts.body,
      fontSize: 14 * t.textScale,
      color: t.colors.textSoft,
      marginLeft: 2,
    },
    actions: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingTop: 4 },
    iconBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
    iconBtnSmall: {
      width: undefined,
      minWidth: 48,
      flexDirection: "row",
      justifyContent: "flex-start",
      gap: 5,
      paddingHorizontal: 8,
    },
    count: { fontFamily: t.fonts.body, fontSize: 13 * t.textScale, color: t.colors.textSoft },
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
    videoIdle: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    mute: {
      position: "absolute",
      right: 10,
      bottom: 10,
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.55)",
    },
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
