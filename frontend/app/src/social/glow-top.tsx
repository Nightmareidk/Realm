import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import { mediaSource } from "../server";
import { useTheme } from "../theme";

/**
 * Look B's light at the top of a screen: a picture's own colours, blurred, or, with no picture,
 * a colour (a chat's, or the theme's lights), fading into the page. Only in looks that glow.
 */
export function GlowTop({ picture, colour }: { picture?: string | null; colour?: string | null }) {
  const { t } = useTheme();
  if (t.style.posts !== "glow" || t.style.glow <= 0) return null;
  const strength = 0.25 + t.style.glow * 0.3;
  return (
    <View style={styles.top} pointerEvents="none">
      {picture ? (
        <Image
          source={mediaSource(picture)}
          style={[StyleSheet.absoluteFill, { opacity: strength }]}
          blurRadius={60}
          contentFit="cover"
          transition={600}
          accessible={false}
        />
      ) : (
        <LinearGradient
          colors={[
            `${colour ?? t.colors.lights[0] ?? t.colors.accent}66`,
            `${t.colors.lights[1] ?? t.colors.accent}22`,
            "transparent",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={[StyleSheet.absoluteFill, { opacity: strength + 0.3 }]}
        />
      )}
      <LinearGradient
        colors={["transparent", t.colors.bg]}
        start={{ x: 0.5, y: 0.35 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: "absolute", top: 0, left: 0, right: 0, height: 340 },
});
