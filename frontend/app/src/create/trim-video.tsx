import { Image } from "expo-image";
import { useVideoPlayer, type VideoThumbnail, VideoView } from "expo-video";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BackHandler,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { alert } from "../alert";
import { Icon } from "../icon";
import { type NativeTheme, useStyles, useTheme } from "../theme";
import { type TrimmedVideo, trimVideo } from "../video-trim";

/** The shortest part worth keeping. */
const MIN_MS = 1_000;
const THUMBS = 8;
const HANDLE = 20;
/**
 * How far the handles stay from the sides of the screen. On Android with swipe navigation, a swipe
 * that starts near a side means Back (24dp normally, about 40dp at the most sensitive setting), so
 * a handle closer than that closes the trimmer instead of moving.
 */
const EDGE = 44;

function seconds(ms: number) {
  const s = ms / 1000;
  return s < 10 ? `${s.toFixed(1)} s` : `${Math.round(s)} s`;
}
function at(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Basic video editing: keep one part of the video. Drag either end of the strip, or drag the
 * chosen part along it; the video above plays just that part, over and over. Done cuts it out
 * into a new file on the phone (the video in the gallery is never changed).
 */
export function VideoTrimmer({
  video,
  limitMs,
  maxBytes,
  note,
  must,
  onDone,
  onCancel,
}: {
  video: { uri: string; durationMs: number; sizeBytes?: number };
  /** The longest a video can be. */
  limitMs: number;
  /** The biggest file Realm takes: the part kept must fit under it. */
  maxBytes: number;
  /** Why it has to be cut, said at the top ("Clips can be up to 60 seconds…"). */
  note?: string;
  /** Too long or too big as it is: Done always cuts, even if nothing was dragged. */
  must?: boolean;
  onDone: (trimmed: TrimmedVideo) => void;
  onCancel: () => void;
}) {
  const { accent, onAccent } = useTheme();
  const s = useStyles(make);
  const insets = useSafeAreaInsets();
  const [duration, setDuration] = useState(video.durationMs);
  // The longest part that can be kept: the length limit, and small enough to upload (judged
  // from the whole file's size per second, with a little room to spare).
  const capFor = (total: number) =>
    video.sizeBytes && total > 0
      ? Math.min(limitMs, Math.floor((maxBytes * 0.92) / (video.sizeBytes / total)))
      : limitMs;
  const maxMs = capFor(duration);
  const [range, setRange] = useState(() => ({
    start: 0,
    end: Math.min(video.durationMs, capFor(video.durationMs)),
  }));
  const [now, setNow] = useState(0);
  const [stripW, setStripW] = useState(0);
  const [thumbs, setThumbs] = useState<VideoThumbnail[]>([]);
  const [busy, setBusy] = useState(false);
  const rangeRef = useRef(range);
  rangeRef.current = range;
  const grab = useRef(range);
  const lastSeek = useRef(0);

  const player = useVideoPlayer({ uri: video.uri }, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.1;
    p.play();
  });

  // Android's back button (Escape in the browser) closes the trimmer, not the whole screen.
  useEffect(() => {
    if (Platform.OS === "web") {
      const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
      globalThis.addEventListener?.("keydown", onKey);
      return () => globalThis.removeEventListener?.("keydown", onKey);
    }
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onCancel();
      return true;
    });
    return () => sub.remove();
  }, [onCancel]);

  // Play only the chosen part, over and over.
  useEffect(() => {
    const time = player.addListener("timeUpdate", ({ currentTime }) => {
      const ms = currentTime * 1000;
      setNow(ms);
      const { start, end } = rangeRef.current;
      if (ms >= end || ms < start - 400) player.currentTime = start / 1000;
    });
    const ended = player.addListener("playToEnd", () => {
      player.currentTime = rangeRef.current.start / 1000;
      player.play();
    });
    return () => {
      time.remove();
      ended.remove();
    };
  }, [player]);

  // The strip of little pictures along the bottom, once the video is ready.
  useEffect(() => {
    let gone = false;
    let asked = false;
    const load = () => {
      if (asked) return;
      asked = true;
      // The player's own measure wins when the picker's is missing or off.
      const measured = player.duration > 0 ? player.duration * 1000 : 0;
      const total = measured > 0 ? measured : video.durationMs;
      if (measured > 0 && Math.abs(measured - video.durationMs) > 1000) {
        setDuration(measured);
        const cap =
          video.sizeBytes && measured > 0
            ? Math.min(limitMs, Math.floor((maxBytes * 0.92) / (video.sizeBytes / measured)))
            : limitMs;
        setRange({ start: 0, end: Math.min(measured, cap) });
      }
      // Browsers can't make the little pictures; the strip stays plain there.
      if (Platform.OS === "web" || !(total > 0)) return;
      const times = Array.from({ length: THUMBS }, (_, i) => ((i + 0.5) / THUMBS) * (total / 1000));
      try {
        player
          .generateThumbnailsAsync(times, { maxWidth: 160 })
          .then((t) => !gone && setThumbs(t))
          .catch(() => {});
      } catch {
        // No pictures, still trimmable.
      }
    };
    if (player.status === "readyToPlay") load();
    const sub = player.addListener("statusChange", ({ status }) => {
      if (status === "readyToPlay") load();
    });
    return () => {
      gone = true;
      sub.remove();
    };
  }, [player, video.durationMs, video.sizeBytes, limitMs, maxBytes]);

  const perMs = duration > 0 ? stripW / duration : 0;

  // runOnJS: the ends move with React state, which is plenty for one strip.
  const gestures = useMemo(() => {
    // Seeking on every move would stutter: at most about ten times a second while dragging.
    const seek = (ms: number, force = false) => {
      const t = Date.now();
      if (!force && t - lastSeek.current < 90) return;
      lastSeek.current = t;
      player.currentTime = ms / 1000;
    };
    const begin = () => {
      grab.current = rangeRef.current;
      player.pause();
    };
    const finish = () => {
      seek(rangeRef.current.start, true);
      player.play();
    };
    const span = Math.min(maxMs, duration);
    const startEnd = Gesture.Pan()
      .runOnJS(true)
      .minDistance(0)
      .hitSlop({ horizontal: 14, vertical: 12 })
      .onStart(begin)
      .onUpdate((e) => {
        if (!perMs) return;
        const { end } = grab.current;
        const start = Math.min(
          end - MIN_MS,
          Math.max(0, end - span, grab.current.start + e.translationX / perMs),
        );
        setRange({ start, end });
        seek(start);
      })
      .onEnd(finish);
    const endEnd = Gesture.Pan()
      .runOnJS(true)
      .minDistance(0)
      .hitSlop({ horizontal: 14, vertical: 12 })
      .onStart(begin)
      .onUpdate((e) => {
        if (!perMs) return;
        const { start } = grab.current;
        const end = Math.max(
          start + MIN_MS,
          Math.min(duration, start + span, grab.current.end + e.translationX / perMs),
        );
        setRange({ start, end });
        seek(end);
      })
      .onEnd(finish);
    const slide = Gesture.Pan()
      .runOnJS(true)
      .onStart(begin)
      .onUpdate((e) => {
        if (!perMs) return;
        const length = grab.current.end - grab.current.start;
        const start = Math.min(
          duration - length,
          Math.max(0, grab.current.start + e.translationX / perMs),
        );
        setRange({ start, end: start + length });
        seek(start);
      })
      .onEnd(finish);
    return { startEnd, endEnd, slide };
  }, [perMs, duration, maxMs, player]);

  async function done() {
    if (busy) return;
    const { start, end } = rangeRef.current;
    if (!must && start < 50 && end > duration - 50) {
      onCancel();
      return;
    }
    setBusy(true);
    player.pause();
    try {
      onDone(await trimVideo(video.uri, start, end));
    } catch (err) {
      setBusy(false);
      player.play();
      alert(
        "That didn't trim",
        err instanceof Error && err.message ? err.message : "Try again, or pick another video.",
      );
    }
  }

  const left = range.start * perMs;
  const right = range.end * perMs;
  const playX = Math.min(right, Math.max(left, now * perMs));

  return (
    <View style={s.root}>
      <View style={[s.top, { paddingTop: insets.top + 6 }]}>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={
            must ? "Cancel: choose another video" : "Cancel: keep the whole video"
          }
          style={s.round}
        >
          <Icon name="X" size={24} color="#ffffff" />
        </Pressable>
        <Text style={s.title} accessibilityRole="header">
          Trim video
        </Text>
        <Pressable
          onPress={() => void done()}
          disabled={busy || !duration}
          accessibilityRole="button"
          accessibilityLabel="Done"
          style={[s.done, { backgroundColor: accent }, (busy || !duration) && s.busy]}
        >
          <Text style={[s.doneText, { color: onAccent }]}>{busy ? "Trimming" : "Done"}</Text>
        </Pressable>
      </View>
      {note ? <Text style={s.note}>{note}</Text> : null}

      <Pressable
        style={s.stage}
        onPress={() => (player.playing ? player.pause() : player.play())}
        accessibilityRole="button"
        accessibilityLabel="Play or pause"
      >
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          nativeControls={false}
        />
      </Pressable>

      <View style={[s.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <View style={s.times}>
          <Text style={s.time}>
            {at(range.start)} to {at(range.end)}
          </Text>
          <Text style={s.length}>
            {seconds(range.end - range.start)}
            {maxMs < duration ? ` of up to ${seconds(maxMs)}` : ""}
          </Text>
        </View>

        <View
          style={s.strip}
          onLayout={(e: LayoutChangeEvent) => setStripW(e.nativeEvent.layout.width)}
        >
          <View style={s.thumbs} pointerEvents="none">
            {Array.from({ length: THUMBS }, (_, i) => {
              const thumb = thumbs[i];
              return thumb ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: a fixed row of pictures.
                <Image key={i} source={thumb} style={s.thumb} contentFit="cover" />
              ) : (
                // biome-ignore lint/suspicious/noArrayIndexKey: a fixed row of pictures.
                <View key={i} style={[s.thumb, s.thumbEmpty]} />
              );
            })}
          </View>
          {stripW ? (
            <>
              <View style={[s.dim, { left: 0, width: left }]} pointerEvents="none" />
              <View style={[s.dim, { left: right, right: 0 }]} pointerEvents="none" />
              <GestureDetector gesture={gestures.slide}>
                <View
                  style={[
                    s.window,
                    { left, width: Math.max(0, right - left), borderColor: accent },
                  ]}
                  accessibilityLabel={`Keeping ${at(range.start)} to ${at(range.end)}`}
                />
              </GestureDetector>
              <View style={[s.playhead, { left: playX - 1 }]} pointerEvents="none" />
              <GestureDetector gesture={gestures.startEnd}>
                <View
                  style={[s.handle, { left: left - HANDLE, backgroundColor: accent }]}
                  accessibilityRole="adjustable"
                  accessibilityLabel={`Start, ${at(range.start)}`}
                >
                  <View style={[s.grip, { backgroundColor: onAccent }]} />
                </View>
              </GestureDetector>
              <GestureDetector gesture={gestures.endEnd}>
                <View
                  style={[s.handle, { left: right, backgroundColor: accent }]}
                  accessibilityRole="adjustable"
                  accessibilityLabel={`End, ${at(range.end)}`}
                >
                  <View style={[s.grip, { backgroundColor: onAccent }]} />
                </View>
              </GestureDetector>
            </>
          ) : null}
        </View>
        <Text style={s.hint}>Drag the ends to choose the part to keep.</Text>
      </View>
    </View>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: "#000000" },
    busy: { opacity: 0.6 },
    top: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 10,
      paddingBottom: 6,
    },
    round: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.12)",
    },
    title: { fontFamily: t.fonts.bold, fontSize: 16 * t.textScale, color: "#ffffff" },
    done: {
      minHeight: 40,
      minWidth: 76,
      paddingHorizontal: 18,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    doneText: { fontFamily: t.fonts.bold, fontSize: 15 * t.textScale },
    note: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      lineHeight: 19 * t.textScale,
      color: "#ffffff",
      textAlign: "center",
      paddingHorizontal: 24,
      paddingVertical: 6,
    },
    stage: { flex: 1, marginVertical: 8, overflow: "hidden" },
    bottom: { paddingHorizontal: EDGE + HANDLE, gap: 10 },
    times: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
    time: { fontFamily: t.fonts.bold, fontSize: 14 * t.textScale, color: "#ffffff" },
    length: {
      fontFamily: t.fonts.body,
      fontSize: 13 * t.textScale,
      color: "rgba(255,255,255,0.72)",
    },
    strip: { height: 58 },
    thumbs: {
      ...StyleSheet.absoluteFill,
      flexDirection: "row",
      borderRadius: 8,
      overflow: "hidden",
    },
    thumb: { flex: 1, height: "100%" },
    thumbEmpty: {
      backgroundColor: "rgba(255,255,255,0.1)",
      borderRightWidth: 1,
      borderColor: "#000000",
    },
    dim: { position: "absolute", top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.62)" },
    window: { position: "absolute", top: 0, bottom: 0, borderTopWidth: 3, borderBottomWidth: 3 },
    playhead: {
      position: "absolute",
      top: -4,
      bottom: -4,
      width: 2,
      borderRadius: 1,
      backgroundColor: "#ffffff",
    },
    handle: {
      position: "absolute",
      top: 0,
      bottom: 0,
      width: HANDLE,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
    },
    grip: { width: 3, height: 20, borderRadius: 2, opacity: 0.8 },
    hint: {
      fontFamily: t.fonts.body,
      fontSize: 13 * t.textScale,
      color: "rgba(255,255,255,0.72)",
      textAlign: "center",
    },
  });
