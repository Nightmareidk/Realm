import { Image } from "expo-image";
import { FlipType, ImageManipulator, type ImageRef } from "expo-image-manipulator";
import { useCallback, useEffect, useState } from "react";
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
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { alert } from "../alert";
import { Icon } from "../icon";
import type { IconName } from "../icon-paths";
import { HScroll } from "../scroll-row";
import { saveFormatFor } from "../shrink";
import { type NativeTheme, useStyles, useTheme } from "../theme";

/**
 * The working copy is at most this many pixels on its long side: quick to turn and crop, and still
 * sharper than what's posted (1600).
 */
const WORK_SIDE = 2400;
const MAX_ZOOM = 5;

/** The shapes a photo can be cut to. Posts show at 4:5 in the feed; Stories fill a 9:16 screen. */
const SHAPES = [
  { key: "original", label: "Original", ratio: null },
  { key: "square", label: "Square", ratio: 1 },
  { key: "tall", label: "4:5", ratio: 4 / 5 },
  { key: "story", label: "9:16", ratio: 9 / 16 },
  { key: "wide", label: "16:9", ratio: 16 / 9 },
] as const;
type Shape = (typeof SHAPES)[number]["key"];

export interface EditedPhoto {
  uri: string;
  width: number;
  height: number;
  mimeType: string;
}

function release(ref: ImageRef | null | undefined) {
  try {
    ref?.release();
  } catch {
    // Already let go.
  }
}

/**
 * Basic photo editing, full screen on black like the Story editor: cut it to a shape (drag to move
 * it in the frame, pinch or double-tap to zoom), turn it a quarter at a time, or mirror it. Done
 * saves a new copy; the photo in the gallery is never changed.
 */
export function PhotoEditor({
  photo,
  onDone,
  onCancel,
}: {
  photo: { uri: string; width: number; height: number; mimeType?: string | null };
  onDone: (edited: EditedPhoto) => void;
  onCancel: () => void;
}) {
  const { accent, onAccent } = useTheme();
  const s = useStyles(make);
  const insets = useSafeAreaInsets();
  const [base, setBase] = useState<ImageRef | null>(null);
  const [view, setView] = useState<ImageRef | null>(null);
  const [turns, setTurns] = useState(0);
  const [mirrored, setMirrored] = useState(false);
  const [shape, setShape] = useState<Shape>("original");
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [broken, setBroken] = useState(false);

  const zoom = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startZoom = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const recentre = useCallback(() => {
    zoom.value = 1;
    x.value = 0;
    y.value = 0;
  }, [zoom, x, y]);

  // Android's back button (Escape in the browser) closes the editor, not the whole screen.
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

  // The working copy, made once: big camera photos are scaled down first.
  useEffect(() => {
    let gone = false;
    const context = ImageManipulator.manipulate(photo.uri);
    if (Math.max(photo.width, photo.height) > WORK_SIDE) {
      context.resize(photo.width >= photo.height ? { width: WORK_SIDE } : { height: WORK_SIDE });
    }
    context
      .renderAsync()
      .then((ref) => (gone ? release(ref) : setBase(ref)))
      .catch(() => !gone && setBroken(true));
    return () => {
      gone = true;
    };
  }, [photo.uri, photo.width, photo.height]);
  useEffect(() => () => release(base), [base]);

  // The photo as it's turned and mirrored now.
  useEffect(() => {
    if (!base) return;
    if (!turns && !mirrored) {
      setView(base);
      return;
    }
    let gone = false;
    const context = ImageManipulator.manipulate(base);
    if (turns) context.rotate(turns * 90);
    if (mirrored) context.flip(FlipType.Horizontal);
    context
      .renderAsync()
      .then((ref) => (gone ? release(ref) : setView(ref)))
      .catch(() => !gone && setBroken(true));
    return () => {
      gone = true;
    };
  }, [base, turns, mirrored]);
  useEffect(
    () => () => {
      if (view !== base) release(view);
    },
    [view, base],
  );

  // The frame: the chosen shape, as big as fits. The photo covers it at zoom 1.
  const imgW = view?.width ?? photo.width;
  const imgH = view?.height ?? photo.height;
  const ratio = SHAPES.find((o) => o.key === shape)?.ratio ?? imgW / imgH;
  const frameW = area ? Math.min(area.width, area.height * ratio) : 0;
  const frameH = frameW / ratio;
  const fit = Math.max(frameW / imgW, frameH / imgH);
  const shownW = imgW * fit;
  const shownH = imgH * fit;

  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate((e) => {
      const mx = Math.max(0, (shownW * zoom.value - frameW) / 2);
      const my = Math.max(0, (shownH * zoom.value - frameH) / 2);
      x.value = Math.min(mx, Math.max(-mx, startX.value + e.translationX));
      y.value = Math.min(my, Math.max(-my, startY.value + e.translationY));
    });
  const pinch = Gesture.Pinch()
    .onStart(() => {
      startZoom.value = zoom.value;
    })
    .onUpdate((e) => {
      zoom.value = Math.min(MAX_ZOOM, Math.max(1, startZoom.value * e.scale));
      const mx = Math.max(0, (shownW * zoom.value - frameW) / 2);
      const my = Math.max(0, (shownH * zoom.value - frameH) / 2);
      x.value = Math.min(mx, Math.max(-mx, x.value));
      y.value = Math.min(my, Math.max(-my, y.value));
    });
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const to = zoom.value > 1.05 ? 1 : 2;
      zoom.value = withTiming(to, { duration: 200 });
      if (to === 1) {
        x.value = withTiming(0, { duration: 200 });
        y.value = withTiming(0, { duration: 200 });
      }
    });
  const gesture = Gesture.Simultaneous(pan, pinch, doubleTap);
  const moved = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: zoom.value }],
  }));

  function turn() {
    // Mirrored, a quarter turn to the right is a quarter turn back before the mirror.
    setTurns((n) => (n + (mirrored ? 3 : 1)) % 4);
    recentre();
  }
  function mirror() {
    setMirrored((m) => !m);
    recentre();
  }
  function reset() {
    setTurns(0);
    setMirrored(false);
    setShape("original");
    recentre();
  }

  async function done() {
    if (!view || busy) return;
    const cropping = shape !== "original" || zoom.value > 1.001;
    if (!cropping && !turns && !mirrored) {
      onCancel();
      return;
    }
    setBusy(true);
    try {
      const context = ImageManipulator.manipulate(view);
      if (cropping) {
        const scale = fit * zoom.value;
        const width = Math.max(1, Math.min(imgW, Math.floor(frameW / scale)));
        const height = Math.max(1, Math.min(imgH, Math.floor(frameH / scale)));
        const centreX = imgW / 2 - x.value / scale;
        const centreY = imgH / 2 - y.value / scale;
        context.crop({
          originX: Math.round(Math.min(imgW - width, Math.max(0, centreX - width / 2))),
          originY: Math.round(Math.min(imgH - height, Math.max(0, centreY - height / 2))),
          width,
          height,
        });
      }
      const out = await context.renderAsync();
      const { format, mimeType } = saveFormatFor(photo.mimeType);
      const saved = await out.saveAsync({ compress: 0.92, format });
      release(out);
      onDone({ uri: saved.uri, width: saved.width, height: saved.height, mimeType });
    } catch {
      setBusy(false);
      alert("Your changes weren't saved", "Try again, or use the photo as it is.");
    }
  }

  const tool = (icon: IconName, label: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      disabled={!view || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.tool, pressed && s.pressed]}
    >
      <View style={s.toolIcon}>
        <Icon name={icon} size={22} color="#ffffff" />
      </View>
      <Text style={s.toolLabel}>{label}</Text>
    </Pressable>
  );

  const left = area ? (area.width - frameW) / 2 : 0;
  const top = area ? (area.height - frameH) / 2 : 0;

  return (
    <View style={s.root}>
      <View style={[s.top, { paddingTop: insets.top + 6 }]}>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel: keep the photo as it was"
          style={s.round}
        >
          <Icon name="X" size={24} color="#ffffff" />
        </Pressable>
        <Text style={s.title} accessibilityRole="header">
          Edit photo
        </Text>
        <Pressable
          onPress={() => void done()}
          disabled={!view || busy}
          accessibilityRole="button"
          accessibilityLabel="Done"
          style={[s.done, { backgroundColor: accent }, (!view || busy) && s.busy]}
        >
          <Text style={[s.doneText, { color: onAccent }]}>{busy ? "Saving" : "Done"}</Text>
        </Pressable>
      </View>

      <View
        style={s.area}
        onLayout={(e: LayoutChangeEvent) =>
          setArea({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
        }
      >
        {broken ? (
          <Text style={s.hint}>This photo can't be edited. Use it as it is, or pick another.</Text>
        ) : view && area ? (
          <GestureDetector gesture={gesture}>
            <View style={StyleSheet.absoluteFill} collapsable={false}>
              <Animated.View
                style={[
                  s.photo,
                  {
                    width: shownW,
                    height: shownH,
                    left: (area.width - shownW) / 2,
                    top: (area.height - shownH) / 2,
                  },
                  moved,
                ]}
              >
                <Image source={view} style={StyleSheet.absoluteFill} contentFit="fill" />
              </Animated.View>
              {/* Outside the frame is dimmed; the frame has a grid of thirds. */}
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <View style={[s.dim, { left: 0, right: 0, top: 0, height: top }]} />
                <View style={[s.dim, { left: 0, right: 0, top: top + frameH, bottom: 0 }]} />
                <View style={[s.dim, { left: 0, width: left, top, height: frameH }]} />
                <View style={[s.dim, { left: left + frameW, right: 0, top, height: frameH }]} />
                <View style={[s.frame, { left, top, width: frameW, height: frameH }]}>
                  <View style={[s.lineV, { left: "33.33%" }]} />
                  <View style={[s.lineV, { left: "66.66%" }]} />
                  <View style={[s.lineH, { top: "33.33%" }]} />
                  <View style={[s.lineH, { top: "66.66%" }]} />
                </View>
              </View>
            </View>
          </GestureDetector>
        ) : (
          <Text style={s.hint}>Getting the photo ready</Text>
        )}
      </View>

      <Text style={s.hint}>
        {Platform.OS === "web"
          ? "Drag to move it. Double-click to zoom."
          : "Drag to move it. Pinch or double-tap to zoom."}
      </Text>

      {/* A sideways ScrollView grows to fill free space on a phone; keep it to one row of chips. */}
      <HScroll
        showsHorizontalScrollIndicator={false}
        style={s.shapeRow}
        contentContainerStyle={s.shapes}
        accessibilityRole="radiogroup"
      >
        {SHAPES.map((o) => {
          const on = shape === o.key;
          return (
            <Pressable
              key={o.key}
              onPress={() => {
                setShape(o.key);
                recentre();
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={o.key === "original" ? "Original shape" : `Shape ${o.label}`}
              style={[s.shape, on && { backgroundColor: accent, borderColor: accent }]}
            >
              <Text style={[s.shapeText, on && { color: onAccent }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </HScroll>

      <View style={[s.tools, { paddingBottom: insets.bottom + 14 }]}>
        {tool("ArrowClockwise", "Turn", turn)}
        {tool("FlipHorizontal", "Mirror", mirror)}
        {tool("ArrowCounterClockwise", "Reset", reset)}
      </View>
    </View>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: "#000000" },
    pressed: { opacity: 0.7 },
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
    area: { flex: 1, margin: 16, overflow: "hidden", justifyContent: "center" },
    photo: { position: "absolute" },
    dim: { position: "absolute", backgroundColor: "rgba(0,0,0,0.62)" },
    frame: {
      position: "absolute",
      borderWidth: 1.5,
      borderColor: "rgba(255,255,255,0.95)",
    },
    lineV: {
      position: "absolute",
      top: 0,
      bottom: 0,
      width: StyleSheet.hairlineWidth,
      backgroundColor: "rgba(255,255,255,0.45)",
    },
    lineH: {
      position: "absolute",
      left: 0,
      right: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: "rgba(255,255,255,0.45)",
    },
    hint: {
      fontFamily: t.fonts.body,
      fontSize: 13 * t.textScale,
      color: "rgba(255,255,255,0.72)",
      textAlign: "center",
      paddingHorizontal: 24,
    },
    shapeRow: { flexGrow: 0, flexShrink: 0 },
    shapes: {
      gap: 8,
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 6,
    },
    shape: {
      minHeight: 36,
      paddingHorizontal: 16,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.28)",
      backgroundColor: "rgba(255,255,255,0.08)",
    },
    shapeText: { fontFamily: t.fonts.bold, fontSize: 13.5 * t.textScale, color: "#ffffff" },
    tools: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 28,
      paddingTop: 10,
    },
    tool: { alignItems: "center", gap: 4, minWidth: 64 },
    toolIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.12)",
    },
    toolLabel: { fontFamily: t.fonts.bold, fontSize: 12 * t.textScale, color: "#ffffff" },
  });
