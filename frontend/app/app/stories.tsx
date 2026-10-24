import type { Channel, HighlightDetail, Story, StoryRing, StoryViewer } from "@realm/contracts";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/icon";
import { leave } from "@/leave";
import { SoundChip } from "@/music/chip";
import { playUse, stopSound } from "@/music/player";
import { dropStory, loadStories, markSeen, useStories } from "@/music/stories";
import { ApiError, api, mediaSource } from "@/server";
import { useSession } from "@/session";
import { useSheet } from "@/sheet";
import { Avatar } from "@/social/avatar";
import { ago } from "@/social/time";
import { type NativeTheme, useStyles, useTheme } from "@/theme";

/** A photo shows for as long as its author chose (5 seconds to a minute); a video for its length. */
function lengthOf(st: Story) {
  if (st.media.kind === "video") {
    return Math.min(60_000, Math.max(3_000, st.media.durationMs ?? st.durationMs));
  }
  return Math.min(60_000, Math.max(5_000, st.durationMs));
}

/**
 * Stories, full screen: tap the right side for the next one, the left for the one before, hold to
 * pause. When someone's Stories end, the next person's start. Music plays its chosen part. On your
 * own you see how many people watched, and can delete one.
 */
export default function Stories() {
  const router = useRouter();
  const params = useLocalSearchParams<{ start?: string; highlight?: string }>();
  const feed = useStories();
  // A highlight from a profile plays its own kept Stories instead of the feed.
  const [kept, setKept] = useState<StoryRing[] | null>(null);
  useEffect(() => {
    if (!params.highlight) return;
    api<HighlightDetail>(`/stories/highlights/${params.highlight}`)
      .then((d) => {
        const first = d.stories[0];
        setKept(
          first
            ? [
                {
                  author: first.author,
                  stories: d.stories.map((st) => ({ ...st, seen: true })),
                  unseen: false,
                },
              ]
            : [],
        );
      })
      .catch(() => setKept([]));
  }, [params.highlight]);
  const rings = params.highlight ? kept : feed;
  const { session } = useSession();
  const me = session.status === "signedIn" ? session.user.id : null;

  // Opened from a link with nothing loaded yet: load first.
  useEffect(() => {
    if (!params.highlight && feed === null) loadStories();
  }, [feed, params.highlight]);

  // Which person and which of their Stories, kept by id so a deleted one doesn't shift you.
  const [at, setAt] = useState<{ author: string; story: string } | null>(null);
  useEffect(() => {
    if (at || !rings) return;
    const ring = rings.find((r) => r.author.id === params.start) ?? rings[0];
    if (!ring) {
      leave(router);
      return;
    }
    const first = ring.stories.find((st) => !st.seen) ?? ring.stories[0];
    if (first) setAt({ author: ring.author.id, story: first.id });
  }, [at, rings, params.start, router]);

  useEffect(() => () => stopSound(), []);

  const close = useCallback(() => {
    stopSound();
    if (router.canGoBack()) router.back();
    else router.replace("/home");
  }, [router]);

  if (!rings || !at) return <View style={styles.black} />;
  const ringIndex = rings.findIndex((r) => r.author.id === at.author);
  const ring = rings[ringIndex];
  const storyIndex = ring ? ring.stories.findIndex((st) => st.id === at.story) : -1;
  const story = ring?.stories[storyIndex];

  function step(dir: 1 | -1) {
    if (!rings || !ring) return close();
    const nextStory = ring.stories[storyIndex + dir];
    if (nextStory) return setAt({ author: ring.author.id, story: nextStory.id });
    const nextRing = rings[ringIndex + dir];
    if (!nextRing) return dir === 1 ? close() : undefined;
    const pick =
      dir === 1
        ? (nextRing.stories.find((st) => !st.seen) ?? nextRing.stories[0])
        : nextRing.stories[nextRing.stories.length - 1];
    if (pick) setAt({ author: nextRing.author.id, story: pick.id });
  }

  if (!ring || !story) {
    // What you were watching is gone (deleted, or it ended).
    return <Gone onClose={close} />;
  }
  return (
    <Viewer
      key={story.id}
      ring={ring}
      index={storyIndex}
      mine={ring.author.id === me}
      onNext={() => step(1)}
      onBack={() => step(-1)}
      onClose={close}
      onDeleted={() => {
        const id = story.id;
        step(1);
        dropStory(id);
      }}
    />
  );
}

function Gone({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 50);
    return () => clearTimeout(t);
  }, [onClose]);
  return <View style={styles.black} />;
}

function Viewer({
  ring,
  index,
  mine,
  onNext,
  onBack,
  onClose,
  onDeleted,
}: {
  ring: StoryRing;
  index: number;
  mine: boolean;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const s = useStyles(make);
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const sheet = useSheet();
  const router = useRouter();
  const story = ring.stories[index] as Story;
  // This viewer is for one Story (it's keyed by it), so what it plays is fixed when it opens.
  const [first] = useState(story);
  const progress = useSharedValue(0);
  const left = useRef(lengthOf(first));
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holding = useRef<ReturnType<typeof setTimeout> | null>(null);
  const next = useRef(onNext);
  next.current = onNext;
  const [held, setHeld] = useState(false);
  const isVideo = story.media.kind === "video";
  const player = useVideoPlayer(isVideo ? mediaSource(story.media.url) : null, (p) => {
    p.loop = false;
    // With music on it, the music plays instead of the video's own sound.
    p.muted = Boolean(story.sound);
  });

  const run = useCallback(() => {
    startedAt.current = Date.now();
    progress.value = withTiming(1, { duration: left.current, easing: Easing.linear });
    timer.current = setTimeout(() => next.current(), left.current);
    if (isVideo) player.play();
  }, [progress, isVideo, player]);

  const hold = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    cancelAnimation(progress);
    left.current = Math.max(0, left.current - (Date.now() - startedAt.current));
    if (isVideo) player.pause();
  }, [progress, isVideo, player]);

  useEffect(() => {
    run();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (holding.current) clearTimeout(holding.current);
    };
  }, [run]);
  useEffect(() => {
    if (!mine) markSeen(first.id);
    if (first.sound) playUse(first.sound, `story:${first.id}`);
    else stopSound();
  }, [first, mine]);

  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  function pause() {
    setHeld(true);
    hold();
    if (first.sound) stopSound();
  }
  function resume() {
    setHeld(false);
    run();
    if (first.sound) playUse(first.sound, `story:${first.id}`);
  }
  // A quick tap moves on; only holding a moment pauses.
  function pressIn() {
    holding.current = setTimeout(pause, 180);
  }
  function pressOut() {
    if (holding.current) clearTimeout(holding.current);
    holding.current = null;
    if (held) resume();
  }

  const [reply, setReply] = useState("");
  const [note, setNote] = useState<string | null>(null);

  /** A reply or a reaction goes to your chat with them, saying it was about their Story. */
  async function sendReply(text: string) {
    if (!text.trim()) return;
    try {
      const dm = await api<Channel>("/users/@me/channels", {
        body: { recipientIds: [ring.author.id] },
      });
      await api(`/channels/${dm.id}/messages`, {
        body: { content: `Replied to your Story: ${text.trim()}` },
      });
      setReply("");
      setNote("Sent");
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "Not sent");
    }
    setTimeout(() => setNote(null), 1800);
    resume();
  }

  /** Who watched your Story, newest first. */
  async function showViewers() {
    pause();
    try {
      const list = await api<{ items: StoryViewer[] }>(`/stories/${story.id}/viewers`);
      sheet({
        title: list.items.length ? "Watched by" : "Nobody's watched it yet",
        onCancel: resume,
        cancelLabel: "Close",
        actions: list.items.slice(0, 40).map((v) => ({
          label: `${v.user.displayName} · ${ago(v.viewedAt)}`,
          icon: "Eye" as const,
          onPress: () => {
            onClose();
            router.push({ pathname: "/user/[username]", params: { username: v.user.username } });
          },
        })),
      });
    } catch {
      resume();
    }
  }

  function remove() {
    pause();
    sheet({
      title: "Delete this Story?",
      line: "It's gone for everyone straight away.",
      onCancel: resume,
      actions: [
        {
          label: "Delete",
          icon: "Trash",
          danger: true,
          onPress: async () => {
            try {
              await api(`/stories/${story.id}`, { method: "DELETE" });
              onDeleted();
            } catch (err) {
              sheet({
                title: "Not deleted",
                line: err instanceof ApiError ? err.message : "Something went wrong. Try again.",
                onCancel: resume,
                actions: [],
              });
            }
          },
        },
      ],
    });
  }

  return (
    <View style={s.root}>
      {isVideo ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
        />
      ) : (
        <Image
          source={mediaSource(story.media.url)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={120}
          accessibilityLabel={story.caption ?? `A Story from ${ring.author.displayName}`}
        />
      )}
      <LinearGradient
        colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0)"]}
        style={[s.shadeTop, { height: insets.top + 120 }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.6)"]}
        style={[s.shadeBottom, { height: insets.bottom + 200 }]}
        pointerEvents="none"
      />

      {/* Tap zones: back on the left third, next on the rest; hold anywhere to pause. */}
      <View style={s.zones}>
        <Pressable
          style={s.zoneBack}
          onPress={() => !held && onBack()}
          onPressIn={pressIn}
          onPressOut={pressOut}
          accessibilityRole="button"
          accessibilityLabel="Previous Story"
        />
        <Pressable
          style={s.zoneNext}
          onPress={() => !held && onNext()}
          onPressIn={pressIn}
          onPressOut={pressOut}
          accessibilityRole="button"
          accessibilityLabel="Next Story"
        />
      </View>

      <View style={[s.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={s.bars} accessibilityLabel={`Story ${index + 1} of ${ring.stories.length}`}>
          {ring.stories.map((st, i) => (
            <View key={st.id} style={[s.track, t.style.stories === "bands" && s.trackSquare]}>
              {i < index ? <View style={[s.fillDone]} /> : null}
              {i === index ? <Animated.View style={[s.fillNow, fill]} /> : null}
            </View>
          ))}
        </View>
        <View style={s.who}>
          <Pressable
            onPress={() => {
              stopSound();
              router.push({
                pathname: "/user/[username]",
                params: { username: ring.author.username },
              });
            }}
            accessibilityRole="link"
            accessibilityLabel={`${ring.author.displayName}, ${ago(story.createdAt)}`}
            style={s.whoLink}
          >
            <Avatar user={ring.author} size={34} />
            <Text style={s.name} numberOfLines={1}>
              {mine ? "Your Story" : ring.author.displayName}
            </Text>
            <Text style={s.when}>{ago(story.createdAt)}</Text>
          </Pressable>
          {held ? <Icon name="PauseFill" size={18} color="#ffffff" /> : null}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close Stories"
            hitSlop={10}
            style={s.close}
          >
            <Icon name="X" size={26} color="#ffffff" />
          </Pressable>
        </View>
        {story.sound ? (
          <View style={s.music}>
            <SoundChip sound={story.sound} playKey={`story:${story.id}`} over autoPlaying={!held} />
          </View>
        ) : null}
      </View>

      <View style={[s.bottom, { paddingBottom: insets.bottom + 18 }]} pointerEvents="box-none">
        {story.caption ? <Text style={s.caption}>{story.caption}</Text> : null}
        {story.sound?.kind === "library" ? (
          <Text style={s.credit} numberOfLines={1}>
            Music: {story.sound.title} by {story.sound.artist}
            {story.sound.licence ? ` (${story.sound.licence})` : ""}
          </Text>
        ) : null}
        {mine ? (
          <View style={s.mineRow}>
            <Pressable
              onPress={showViewers}
              accessibilityRole="button"
              accessibilityLabel={`${story.views ?? 0} views. See who watched`}
              style={s.views}
            >
              <Icon name="Eye" size={20} color="#ffffff" />
              <Text style={s.viewsText}>
                {story.views === 1 ? "1 view" : `${story.views ?? 0} views`}
              </Text>
            </Pressable>
            <Pressable
              onPress={remove}
              accessibilityRole="button"
              accessibilityLabel="Delete this Story"
              hitSlop={8}
              style={s.trash}
            >
              <Icon name="Trash" size={22} color="#ffffff" />
            </Pressable>
          </View>
        ) : (
          <View style={s.replyArea}>
            {reply ? null : (
              <View style={s.quick}>
                {QUICK.map((q) => (
                  <Pressable
                    key={q}
                    onPress={() => sendReply(q)}
                    accessibilityRole="button"
                    accessibilityLabel={`React ${q}`}
                    style={s.quickBtn}
                  >
                    <Text style={s.quickText}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <View style={s.replyBar}>
              <TextInput
                value={reply}
                onChangeText={setReply}
                onFocus={pause}
                onBlur={() => !reply && resume()}
                placeholder={note ?? `Reply to ${ring.author.displayName.split(" ")[0]}…`}
                placeholderTextColor="rgba(255,255,255,0.8)"
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={() => sendReply(reply)}
                style={s.replyInput}
                accessibilityLabel={`Reply to ${ring.author.displayName}`}
              />
              {reply ? (
                <Pressable
                  onPress={() => sendReply(reply)}
                  accessibilityRole="button"
                  accessibilityLabel="Send reply"
                  style={s.replySend}
                >
                  <Text style={s.replySendText}>Send</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

/** Quick reactions to someone's Story (they arrive in your chat with them). */
const QUICK = ["❤️", "😂", "😮", "😢", "👏", "🔥"];

const styles = StyleSheet.create({ black: { flex: 1, backgroundColor: "#000" } });

const make = (t: NativeTheme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: "#000" },
    shadeTop: { position: "absolute", top: 0, left: 0, right: 0 },
    shadeBottom: { position: "absolute", bottom: 0, left: 0, right: 0 },
    zones: { ...StyleSheet.absoluteFill, flexDirection: "row" },
    zoneBack: { flex: 1 },
    zoneNext: { flex: 2 },
    top: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 10 },
    bars: { flexDirection: "row", gap: 4 },
    track: {
      flex: 1,
      height: 3,
      borderRadius: 2,
      overflow: "hidden",
      backgroundColor: "rgba(255,255,255,0.35)",
    },
    trackSquare: { borderRadius: 0, height: 4 },
    fillDone: { ...StyleSheet.absoluteFill, backgroundColor: "#ffffff" },
    fillNow: { height: "100%", backgroundColor: "#ffffff" },
    who: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
    whoLink: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
    name: {
      fontFamily: t.fonts.bold,
      fontSize: 15.5 * t.textScale,
      color: "#ffffff",
      flexShrink: 1,
    },
    when: { fontFamily: t.fonts.body, fontSize: 14 * t.textScale, color: "rgba(255,255,255,0.75)" },
    close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    music: { marginTop: 4, alignItems: "flex-start" },
    bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, gap: 10 },
    caption: {
      fontFamily: t.fonts.bold,
      fontSize: 18 * t.textScale,
      lineHeight: 25 * t.textScale,
      color: "#ffffff",
      textShadowColor: "rgba(0,0,0,0.5)",
      textShadowRadius: 8,
    },
    credit: {
      fontFamily: t.fonts.body,
      fontSize: 12.5 * t.textScale,
      color: "rgba(255,255,255,0.8)",
    },
    replyArea: { gap: 10 },
    quick: { flexDirection: "row", justifyContent: "center", gap: 8 },
    quickBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(9,9,12,0.45)",
    },
    quickText: { fontSize: 20 },
    replyBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minHeight: 48,
      paddingLeft: 16,
      paddingRight: 5,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.45)",
      backgroundColor: "rgba(9,9,12,0.35)",
    },
    replyInput: {
      flex: 1,
      fontFamily: t.fonts.body,
      fontSize: 15.5 * t.textScale,
      color: "#ffffff",
      paddingVertical: 10,
    },
    replySend: {
      paddingHorizontal: 16,
      height: 38,
      borderRadius: 19,
      justifyContent: "center",
      backgroundColor: "#ffffff",
    },
    replySendText: { fontFamily: t.fonts.bold, fontSize: 14 * t.textScale, color: "#0b0b0e" },
    mineRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    views: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
    viewsText: { fontFamily: t.fonts.bold, fontSize: 15 * t.textScale, color: "#ffffff" },
    trash: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.35)",
    },
  });
