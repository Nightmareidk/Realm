import { Platform, useWindowDimensions } from "react-native";

/** The left menu's width on a big screen (where the tabs move off the bottom). */
export const RAIL = 236;

/**
 * A computer's screen (the app in a browser, wider than a tablet held up): the tabs become a menu
 * down the left and screens sit centred at a readable width, as Instagram does on the web.
 */
export function useWide() {
  const { width } = useWindowDimensions();
  return Platform.OS === "web" && width >= 900;
}

/** How wide a screen's content is: the phone's width, or on a computer at most `max`. */
export function useContentWidth(max = 630) {
  const { width } = useWindowDimensions();
  const wide = Platform.OS === "web" && width >= 900;
  return wide ? Math.min(width - RAIL - 48, max) : width;
}
