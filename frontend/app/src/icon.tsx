import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { ICON_PATHS, type IconName } from "./icon-paths";

/** A Phosphor icon, decorative unless given a `label` (then it's read out, as an image). */
export function Icon({
  name,
  size = 24,
  color,
  label,
}: {
  name: IconName;
  size?: number;
  color: string;
  label?: string;
}) {
  const svg = (
    <Svg width={size} height={size} viewBox="0 0 256 256" fill={color} pointerEvents="none">
      {ICON_PATHS[name].map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
  if (!label) return svg;
  // The label goes on a wrapper: the drawing itself takes no accessibility props on the web.
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}>
      {svg}
    </View>
  );
}
