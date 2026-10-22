import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useEffect, useMemo } from "react";
import { Image as RNImage, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, G, Path, Pattern, Rect } from "react-native-svg";
import { ICON_PATHS } from "../icon-paths";
import { LightField } from "../light-field";
import { mediaSource } from "../server";
import { useTheme } from "../theme";

/**
 * A theme's art (docs/THEMING.md): the wallpaper, a pattern, and things that fall or float. It all
 * sits behind the content and never takes a tap, so nothing a theme draws can cover a button, a
 * message or a safety label. Effects stop when the phone asks for less motion.
 */

/** A theme picture (`media:<id>`) as an image source; anything else isn't loaded. */
export function themeImage(ref: string | undefined) {
  const id = ref?.match(/^media:([1-9]\d{0,19})$/)?.[1];
  return id ? mediaSource(`/api/v1/media/${id}/raw`) : null;
}

/** A 24-unit drawing for each built-in shape: Phosphor icons where one fits, else drawn here. */
const BAT =
  "M12 8.2c-.6 0-1 .6-1.2 1.3L9.5 8.7C8.2 9.5 6 9.7 3.5 8.9c.9 1 1.4 2.3 1.4 3.6 1.2-.6 2.7-.6 3.6.2.7-.8 1.9-1 2.7-.3.3-.6.5-.9.8-.9s.5.3.8.9c.8-.7 2-.5 2.7.3.9-.8 2.4-.8 3.6-.2 0-1.3.5-2.6 1.4-3.6-2.5.8-4.7.6-6-.2l-1.3.8c-.2-.7-.6-1.3-1.2-1.3Z";
const ICON_SHAPE: Record<string, keyof typeof ICON_PATHS> = {
  stars: "StarFill",
  hearts: "HeartFill",
  sparkles: "SparkleFill",
  paws: "PawPrintFill",
  flowers: "FlowerFill",
  petals: "FlowerFill",
  bolts: "LightningFill",
  notes: "MusicNoteFill",
  leaves: "LeafFill",
  snow: "Snowflake",
};

/** One shape at `size`, centred on (x, y). */
function Shape({
  shape,
  x,
  y,
  size,
  color,
}: {
  shape: string;
  x: number;
  y: number;
  size: number;
  color: string;
}) {
  const icon = ICON_SHAPE[shape];
  if (icon) {
    const k = size / 256;
    return (
      <G transform={`translate(${x - size / 2} ${y - size / 2}) scale(${k})`} fill={color}>
        {ICON_PATHS[icon].map((d) => (
          <Path key={d} d={d} />
        ))}
      </G>
    );
  }
  const k = size / 24;
  const at = `translate(${x - size / 2} ${y - size / 2}) scale(${k})`;
  switch (shape) {
    case "bats":
      return <Path d={BAT} transform={at} fill={color} />;
    case "dots":
      return <Path d="M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" transform={at} fill={color} />;
    case "bubbles":
      return (
        <Path
          d="M12 5a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z"
          transform={at}
          fill={color}
        />
      );
    case "confetti":
      return <Path d="M9 6h4l2 12h-4Z" transform={at} fill={color} />;
    case "rain":
      return <Path d="M11 2h2v14h-2Z" transform={at} fill={color} />;
    default:
      return null;
  }
}

/** A repeating pattern over the ground: a built-in shape, lines, or the theme's own small picture. */
const PatternLayer = memo(function PatternLayer() {
  const { t } = useTheme();
  const p = t.art.pattern;
  if (!p) return null;
  if (p.shape === "image") {
    const src = themeImage(p.image);
    return src ? (
      <RNImage
        source={src}
        resizeMode="repeat"
        style={[StyleSheet.absoluteFill, { opacity: p.opacity }]}
      />
    ) : null;
  }
  const tile = Math.round(36 * p.size);
  const line = (d: string) => <Path d={d} stroke={p.color} strokeWidth={1.2} fill="none" />;
  const content =
    p.shape === "grid" ? (
      line(`M0 0H${tile}M0 0V${tile}`)
    ) : p.shape === "stripes" ? (
      line(`M0 ${tile}L${tile} 0`)
    ) : p.shape === "checks" ? (
      <Rect width={tile / 2} height={tile / 2} fill={p.color} />
    ) : p.shape === "waves" ? (
      line(`M0 ${tile / 2}Q${tile / 4} ${tile / 4} ${tile / 2} ${tile / 2}T${tile} ${tile / 2}`)
    ) : (
      <Shape shape={p.shape} x={tile / 2} y={tile / 2} size={tile * 0.45} color={p.color} />
    );
  return (
    <Svg style={[StyleSheet.absoluteFill, { opacity: p.opacity }]}>
      <Defs>
        <Pattern id="themePattern" width={tile} height={tile} patternUnits="userSpaceOnUse">
          {content}
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#themePattern)" />
    </Svg>
  );
});

const COUNT = { few: 8, some: 14, lots: 22 } as const;
/** Steady pseudo-random numbers, so effects look the same each time they're drawn. */
const rand = (i: number, k: number) => {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

function Faller({
  i,
  shape,
  color,
  height,
  width,
}: {
  i: number;
  shape: string;
  color: string;
  height: number;
  width: number;
}) {
  const fall = useSharedValue(0);
  const size = 10 + rand(i, 1) * 14;
  const x = rand(i, 2) * width;
  const duration = 7000 + rand(i, 3) * 9000;
  const sway = 12 + rand(i, 5) * 24;
  const rises = shape === "bubbles";
  useEffect(() => {
    fall.value = withDelay(
      rand(i, 4) * duration,
      withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false),
    );
  }, [fall, duration, i]);
  const style = useAnimatedStyle(() => {
    const y = rises ? height + 20 - fall.value * (height + 40) : -30 + fall.value * (height + 60);
    return {
      transform: [
        { translateX: x + Math.sin(fall.value * Math.PI * 4) * sway },
        { translateY: y },
        { rotate: `${fall.value * (shape === "rain" ? 0 : 240)}deg` },
      ],
    };
  });
  return (
    <Animated.View style={[s.faller, { width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Shape shape={shape} x={size / 2} y={size / 2} size={size} color={color} />
      </Svg>
    </Animated.View>
  );
}

/** Things that fall (or, for bubbles, rise) gently behind everything. */
const EffectLayer = memo(function EffectLayer() {
  const { t } = useTheme();
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const e = t.art.effect;
  const items = useMemo(() => (e ? Array.from({ length: COUNT[e.amount] }, (_, i) => i) : []), [e]);
  if (!e || reduced) return null;
  return (
    <View style={[StyleSheet.absoluteFill, s.effects]} pointerEvents="none">
      {items.map((i) => (
        <Faller key={i} i={i} shape={e.shape} color={e.color} height={height} width={width} />
      ))}
    </View>
  );
});

/** Everything a theme draws behind a screen, in order: wallpaper, lights, pattern, effects. */
export function Backdrop({ lightOpacity = 0.38 }: { lightOpacity?: number }) {
  const { t } = useTheme();
  const w = t.art.wallpaper;
  const src = themeImage(w?.image);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {w && src ? (
        <>
          <Image
            source={src}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition={w.focus ?? "center"}
            blurRadius={w.blur === "strong" ? 28 : w.blur === "soft" ? 10 : 0}
            accessible={false}
          />
          {/* Brightness: darker under 1, lighter over it (colour strength is the website's). */}
          {(w.brightness ?? 1) !== 1 ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                (w.brightness ?? 1) < 1
                  ? { backgroundColor: "#000000", opacity: 1 - (w.brightness ?? 1) }
                  : { backgroundColor: "#ffffff", opacity: ((w.brightness ?? 1) - 1) * 0.6 },
              ]}
            />
          ) : null}
          <LinearGradient
            colors={[w.overlay ?? t.colors.bg, w.overlay2 ?? w.overlay ?? t.colors.bg]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.4, y: 1 }}
            style={[StyleSheet.absoluteFill, { opacity: w.dim }]}
          />
        </>
      ) : null}
      {w && src ? null : (
        <View style={[StyleSheet.absoluteFill, { opacity: lightOpacity }]}>
          <LightField />
        </View>
      )}
      <PatternLayer />
      <EffectLayer />
    </View>
  );
}

/** A theme sticker in one of the spots kept for them; nothing when the theme has none. */
export function Sticker({
  slot,
  size = 40,
}: {
  slot: "header" | "empty" | "profile";
  size?: number;
}) {
  const { t } = useTheme();
  const src = themeImage(t.art.stickers?.[slot]);
  if (!src) return null;
  return (
    <Image
      source={src}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessible={false}
      pointerEvents="none"
    />
  );
}

const s = StyleSheet.create({
  faller: { position: "absolute", left: 0, top: 0 },
  effects: { overflow: "hidden" },
});
