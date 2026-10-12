import { memo } from "react";
import { StyleSheet } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { Relit } from "./relit";
import { type ThemeId, themes } from "./theme";

/**
 * The light field (DESIGN.md Signature): three soft fields in a theme's lights on the ink ground,
 * held still, with the same placements and strengths as the web's `body::before`.
 */
const Field = memo(function Field({ id }: { id: ThemeId }) {
  const { lights, glow } = themes[id];
  const [l1, l2, l3] = lights;
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

/**
 * The field in the current theme. A theme change is never a snap: the old light cross-fades into
 * the new over 0.8s (the Re-light Rule), or cuts when the phone asks for less motion.
 */
export function LightField() {
  return <Relit render={(id) => <Field id={id} />} />;
}
