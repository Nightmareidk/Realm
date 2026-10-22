import { memo, useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { motion, useTheme } from "./theme";

type Lights = { lights: readonly [string, string, string]; glow: number; id: string };

/**
 * The light field (DESIGN.md Signature): three soft fields in the theme's lights on its ground,
 * held still, with the same placements and strengths as the web's `body::before` (and the
 * readability check in @realm/contracts, which measures this exact layout).
 */
const Field = memo(function Field({ lights, glow, id }: Lights) {
  const [l1, l2, l3] = lights;
  if (glow <= 0) return null;
  return (
    <Svg style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id={`${id}1`} cx="18%" cy="100%" rx="62%" ry="80%">
          <Stop offset="0" stopColor={l1} stopOpacity={glow * 0.55} />
          <Stop offset="0.4" stopColor={l1} stopOpacity={glow * 0.19} />
          <Stop offset="0.72" stopColor={l1} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`${id}2`} cx="86%" cy="6%" rx="50%" ry="70%">
          <Stop offset="0" stopColor={l2} stopOpacity={glow * 0.42} />
          <Stop offset="0.42" stopColor={l2} stopOpacity={glow * 0.15} />
          <Stop offset="0.72" stopColor={l2} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`${id}3`} cx="60%" cy="62%" rx="42%" ry="60%">
          <Stop offset="0" stopColor={l3} stopOpacity={glow * 0.28} />
          <Stop offset="0.7" stopColor={l3} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id}1)`} />
      <Rect width="100%" height="100%" fill={`url(#${id}2)`} />
      <Rect width="100%" height="100%" fill={`url(#${id}3)`} />
    </Svg>
  );
});

const RELIGHT = Easing.bezier(0.77, 0, 0.175, 1);

function Fading({ on, children }: { on: boolean; children: React.ReactNode }) {
  const shown = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    shown.value = withTiming(on ? 1 : 0, {
      duration: motion.relight,
      easing: RELIGHT,
      reduceMotion: ReduceMotion.System,
    });
  }, [on, shown]);
  const style = useAnimatedStyle(() => ({ opacity: shown.value }));
  return <Animated.View style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>;
}

/**
 * The field in the current theme. A theme change is never a snap: the old light cross-fades into
 * the new over 0.8s (the Re-light Rule), or cuts when the phone asks for less motion.
 */
export function LightField() {
  const { t } = useTheme();
  const key = `f${t.colors.lights.join("").replace(/#/g, "")}${Math.round(t.style.glow * 100)}`;
  const lights = t.colors.lights;
  const glow = t.style.glow;
  const [shown, setShown] = useState<Lights[]>([{ lights, glow, id: key }]);
  useEffect(() => {
    setShown((prev) =>
      prev.at(-1)?.id === key ? prev : [...prev.slice(-1), { lights, glow, id: key }],
    );
  }, [key, lights, glow]);
  return (
    <Animated.View style={StyleSheet.absoluteFill} pointerEvents="none">
      {shown.map((l) => (
        <Fading key={l.id} on={l.id === key}>
          <Field lights={l.lights} glow={l.glow} id={l.id} />
        </Fading>
      ))}
    </Animated.View>
  );
}
