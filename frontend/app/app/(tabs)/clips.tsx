import type { Post } from "@realm/contracts";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  type LayoutChangeEvent,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePosts } from "@/data";
import { Icon } from "@/icon";
import { api, mediaSource } from "@/server";
import { Avatar } from "@/social/avatar";
import { LIKED } from "@/social/post-card";
import { Empty, Loading } from "@/social/screen";
import { compact } from "@/social/time";
import { fonts, type NativeTheme, useStyles } from "@/theme";
import { Pill } from "@/ui";

/**
 * Clips: short videos, one screen each. Swipe up for the next; tap to turn the sound on or off.
 * Only the Clip on screen plays, and nothing plays when you leave the tab.
 */
export default function Clips() {
  const s = useStyles(make);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const feed = usePosts("/clips");
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const [height, setHeight] = useState(0);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(false);
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setActive(first.index);
  }).current;

  return (
    <View
      style={s.screen}
      onLayout={(e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height)}
    >
      {feed.loading || !height ? (
        <Loading />
      ) : feed.items.length === 0 ? (
        <View style={[s.fill, { paddingTop: insets.top + 40 }]}>
          <Empty
            title="No Clips yet"
            line="Short videos from people you follow and public ones show up here."
          >
            <Pill
              label="Post a Clip"
              onPress={() => router.push({ pathname: "/create", params: { mode: "clip" } })}
            />
          </Empty>
        </View>
      ) : (
        <FlatList
          data={feed.items}
          keyExtractor={(p) => p.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
          onEndReached={feed.more}
          windowSize={3}
          renderItem={({ item, index }) => (
            <Clip
              post={item}
              height={height}
              playing={focused && index === active}
              muted={muted}
              onToggleSound={() => setMuted((m) => !m)}
              onChange={feed.update}
            />
          )}
        />
      )}
      <View style={[s.top, { paddingTop: insets.top + 4 }]} pointerEvents="box-none">
        <Text style={s.title} accessibilityRole="header">
          Clips
        </Text>
        <Pressable
          onPress={() => router.push({ pathname: "/create", params: { mode: "clip" } })}
          accessibilityRole="button"
          accessibilityLabel="Post a Clip"
          style={s.icon}
        >
          <Icon name="Camera" size={26} color="#ffffff" />
        </Pressable>
      </View>
    </View>
  );
}

function Clip({
  post,
  height,
  playing,
  muted,
  onToggleSound,
  onChange,
}: {
  post: Post;
  height: number;
  playing: boolean;
  muted: boolean;
  onToggleSound: () => void;
  onChange: (p: Post) => void;
}) {
  const s = useStyles(make);
  const router = useRouter();
  const video = post.media[0];
  const player = useVideoPlayer(video ? mediaSource(video.url) : null, (p) => {
    p.loop = true;
  });
  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);
  useEffect(() => {
    if (playing) player.play();
    else player.pause();
  }, [playing, player]);

  async function like() {
    const on = !post.liked;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange({ ...post, liked: on, likeCount: Math.max(0, post.likeCount + (on ? 1 : -1)) });
    try {
      onChange(await api<Post>(`/posts/${post.id}/like`, { method: on ? "PUT" : "DELETE" }));
    } catch {
      onChange(post);
    }
  }

  return (
    <View style={[s.clip, { height }]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onToggleSound}
        accessibilityRole="button"
        accessibilityLabel={muted ? "Turn sound on" : "Turn sound off"}
      >
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
        />
      </Pressable>
      {muted ? (
        <View style={s.mute} pointerEvents="none">
          <Icon name="SpeakerSlashFill" size={18} color="#ffffff" />
        </View>
      ) : null}

      <View style={s.side}>
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/user/[username]",
              params: { username: post.author.username },
            })
          }
          accessibilityRole="link"
          accessibilityLabel={post.author.displayName}
        >
          <Avatar user={post.author} size={44} />
        </Pressable>
        <SideButton
          icon={post.liked ? "HeartFill" : "Heart"}
          color={post.liked ? LIKED : "#ffffff"}
          label={compact(post.likeCount)}
          a11y={post.liked ? "Unlike" : "Like"}
          onPress={like}
        />
        <SideButton
          icon="ChatCircle"
          label={compact(post.commentCount)}
          a11y="Comments"
          onPress={() => router.push({ pathname: "/post/[id]", params: { id: post.id } })}
        />
        <SideButton
          icon="PaperPlaneTilt"
          label="Share"
          a11y="Share"
          onPress={() =>
            Share.share({
              message: `${post.author.displayName} on Realm${post.caption ? `: ${post.caption}` : ""}`,
            })
          }
        />
      </View>

      <View style={s.info} pointerEvents="box-none">
        <Text style={s.author}>{post.author.displayName}</Text>
        {post.caption ? (
          <Text style={s.caption} numberOfLines={2}>
            {post.caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function SideButton({
  icon,
  label,
  a11y,
  onPress,
  color = "#ffffff",
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  label: string;
  a11y: string;
  onPress: () => void;
  color?: string;
}) {
  const s = useStyles(make);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={s.sideBtn}
    >
      <Icon name={icon} size={30} color={color} />
      <Text style={s.sideLabel}>{label}</Text>
    </Pressable>
  );
}

const shadow = {
  textShadowColor: "rgba(0,0,0,0.6)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
};

const make = (t: NativeTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#000000" },
    fill: { flex: 1, backgroundColor: t.colors.bg },
    top: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
    },
    title: { fontFamily: fonts.displayBold, fontSize: 24, color: "#ffffff", ...shadow },
    icon: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
    clip: { width: "100%", backgroundColor: "#000000" },
    mute: {
      position: "absolute",
      top: "50%",
      alignSelf: "center",
      padding: 12,
      borderRadius: 999,
      backgroundColor: "rgba(11,11,14,0.6)",
    },
    side: { position: "absolute", right: 8, bottom: 28, alignItems: "center", gap: 14 },
    sideBtn: { alignItems: "center", minWidth: 52, minHeight: 52, justifyContent: "center" },
    sideLabel: {
      fontFamily: fonts.bold,
      fontSize: 12.5,
      color: "#ffffff",
      marginTop: 2,
      ...shadow,
    },
    info: { position: "absolute", left: 16, right: 84, bottom: 28 },
    author: { fontFamily: fonts.bold, fontSize: 16, color: "#ffffff", ...shadow },
    caption: {
      fontFamily: fonts.body,
      fontSize: 15,
      lineHeight: 21,
      color: "#ffffff",
      marginTop: 4,
      ...shadow,
    },
  });
