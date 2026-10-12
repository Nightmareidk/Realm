import { type ReactNode, useEffect } from "react";
import { StyleSheet, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { motion, THEME_ORDER, type ThemeId, useTheme } from "./theme";

const RELIGHT = Easing.bezier(0.77, 0, 0.175, 1);

function Layer({ on, children }: { on: boolean; children: ReactNode }) {
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
 * Something drawn in the theme's lights (a banner, the card's foil, a swatch), drawn once per
 * theme and cross-faded, so a theme change re-lights it instead of snapping.
 */
export function Relit({
  render,
  style,
}: {
  render: (id: ThemeId) => ReactNode;
  style?: ViewStyle;
}) {
  const { id } = useTheme();
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      {THEME_ORDER.map((t) => (
        <Layer key={t} on={t === id}>
          {render(t)}
        </Layer>
      ))}
    </Animated.View>
  );
}
