import Svg, { Path } from "react-native-svg";
import { ICON_PATHS, type IconName } from "./icon-paths";

/** A Phosphor icon, decorative unless its parent labels it. */
export function Icon({ name, size = 24, color }: { name: IconName; size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256" fill={color} pointerEvents="none">
      {ICON_PATHS[name].map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
}
