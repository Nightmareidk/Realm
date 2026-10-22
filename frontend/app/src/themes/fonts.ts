import { NATIVE_FONT } from "@realm/design-tokens";
import * as Font from "expo-font";

/**
 * The fonts a theme may pick, bundled with the app (free Google Fonts) and loaded only when a
 * theme asks for one, so the app doesn't load eleven fonts it isn't using. Funnel and Atkinson are
 * always loaded (app/_layout.tsx).
 */
const FILES: Record<string, () => Record<string, number>> = {
  bangers: () => ({
    Bangers_400Regular: require("@expo-google-fonts/bangers/400Regular/Bangers_400Regular.ttf"),
  }),
  fredoka: () => ({
    Fredoka_500Medium: require("@expo-google-fonts/fredoka/500Medium/Fredoka_500Medium.ttf"),
    Fredoka_700Bold: require("@expo-google-fonts/fredoka/700Bold/Fredoka_700Bold.ttf"),
  }),
  pacifico: () => ({
    Pacifico_400Regular: require("@expo-google-fonts/pacifico/400Regular/Pacifico_400Regular.ttf"),
  }),
  "press-start": () => ({
    PressStart2P_400Regular: require("@expo-google-fonts/press-start-2p/400Regular/PressStart2P_400Regular.ttf"),
  }),
  bebas: () => ({
    BebasNeue_400Regular: require("@expo-google-fonts/bebas-neue/400Regular/BebasNeue_400Regular.ttf"),
  }),
  righteous: () => ({
    Righteous_400Regular: require("@expo-google-fonts/righteous/400Regular/Righteous_400Regular.ttf"),
  }),
  orbitron: () => ({
    Orbitron_700Bold: require("@expo-google-fonts/orbitron/700Bold/Orbitron_700Bold.ttf"),
    Orbitron_800ExtraBold: require("@expo-google-fonts/orbitron/800ExtraBold/Orbitron_800ExtraBold.ttf"),
  }),
  "permanent-marker": () => ({
    PermanentMarker_400Regular: require("@expo-google-fonts/permanent-marker/400Regular/PermanentMarker_400Regular.ttf"),
  }),
  comfortaa: () => ({
    Comfortaa_400Regular: require("@expo-google-fonts/comfortaa/400Regular/Comfortaa_400Regular.ttf"),
    Comfortaa_700Bold: require("@expo-google-fonts/comfortaa/700Bold/Comfortaa_700Bold.ttf"),
  }),
  lexend: () => ({
    Lexend_400Regular: require("@expo-google-fonts/lexend/400Regular/Lexend_400Regular.ttf"),
    Lexend_700Bold: require("@expo-google-fonts/lexend/700Bold/Lexend_700Bold.ttf"),
  }),
  nunito: () => ({
    Nunito_400Regular: require("@expo-google-fonts/nunito/400Regular/Nunito_400Regular.ttf"),
    Nunito_700Bold: require("@expo-google-fonts/nunito/700Bold/Nunito_700Bold.ttf"),
  }),
};

/** Always there, so a theme can fall back to them while its own font loads. */
export const BUILT_IN_FONTS = new Set(["funnel", "atkinson", "system"]);

/** Load a theme font; true once it can be drawn. */
export async function loadFont(id: string): Promise<boolean> {
  if (BUILT_IN_FONTS.has(id)) return true;
  const files = FILES[id];
  if (!files || !NATIVE_FONT[id]) return false;
  try {
    await Font.loadAsync(files());
    return true;
  } catch {
    return false;
  }
}
