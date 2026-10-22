import type { ResolvedTheme } from "@realm/contracts";
import { nativeTheme } from "@realm/design-tokens";
import { LinearGradient } from "expo-linear-gradient";
import { memo } from "react";
import { StyleSheet, View } from "react-native";

/**
 * A tiny drawing of Realm in a theme: its ground and lights, the stories row in the theme's
 * style, one post (glow, ticket or thread), and the tab bar (floating or a bar). Drawn from the
 * theme's own values, so what you see in the store is what you get. No words: it sits under the
 * theme's name.
 */
export const ThemePreview = memo(function ThemePreview({
  theme,
  width = 150,
}: {
  theme: ResolvedTheme;
  width?: number;
}) {
  const n = nativeTheme(theme);
  const c = theme.colors;
  const u = width / 150;
  const h = Math.round(width * 1.78);
  const r = (v: number) => Math.round(v * u);
  const media = Math.min(n.radius.media, 14) * u;
  const [l1, l2, l3] = c.lights;
  const glow = theme.style.glow;

  const story = (i: number) => {
    const color = [c.accent, l1, l2, l3][i] ?? c.accent;
    if (theme.style.stories === "bands") {
      return (
        <View
          key={i}
          style={{
            width: r(24),
            height: r(34),
            borderRadius: r(5),
            backgroundColor: c.raised,
            overflow: "hidden",
            justifyContent: "flex-end",
          }}
        >
          <View style={{ height: r(7), backgroundColor: i < 2 ? color : c.line }} />
        </View>
      );
    }
    const thin = theme.style.stories === "thin";
    return (
      <View
        key={i}
        style={{
          width: r(22),
          height: r(22),
          borderRadius: r(11),
          borderWidth: thin ? Math.max(1, r(1.2)) : r(2),
          borderColor: thin ? (i < 2 ? c.text : c.line) : i < 2 ? color : c.line,
          padding: r(2),
        }}
      >
        <View style={{ flex: 1, borderRadius: r(9), backgroundColor: [l1, l2, l3, c.raised][i] }} />
      </View>
    );
  };

  const photo = (height: number) => (
    <LinearGradient
      colors={[l1, l2, l3]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ height, borderRadius: theme.style.posts === "ticket" ? 0 : media }}
    />
  );

  const post =
    theme.style.posts === "thread" ? (
      <View style={{ flexDirection: "row", gap: r(6), paddingHorizontal: r(8) }}>
        <View style={{ width: r(14), height: r(14), borderRadius: r(7), backgroundColor: l2 }} />
        <View style={{ flex: 1, gap: r(4) }}>
          <View
            style={{ width: "60%", height: r(4), borderRadius: r(2), backgroundColor: c.text }}
          />
          <View
            style={{ width: "80%", height: r(3), borderRadius: r(2), backgroundColor: c.textSoft }}
          />
          {photo(r(70))}
        </View>
      </View>
    ) : theme.style.posts === "ticket" ? (
      <View
        style={{
          marginHorizontal: r(8),
          backgroundColor: c.surface,
          borderRadius: r(8),
          overflow: "hidden",
        }}
      >
        {photo(r(66))}
        <View
          style={{
            height: r(8),
            marginHorizontal: r(6),
            borderBottomWidth: 1,
            borderStyle: "dashed",
            borderColor: c.line,
          }}
        />
        <View style={{ flexDirection: "row", alignItems: "center", gap: r(4), padding: r(6) }}>
          <View style={{ width: r(10), height: r(10), borderRadius: r(2), backgroundColor: l1 }} />
          <View style={{ flex: 1, height: r(3), borderRadius: r(2), backgroundColor: c.text }} />
        </View>
      </View>
    ) : (
      <View style={{ paddingHorizontal: r(8) }}>
        {glow > 0 ? (
          <View
            style={{
              position: "absolute",
              left: r(4),
              right: r(4),
              top: r(10),
              bottom: r(-6),
              borderRadius: r(20),
              backgroundColor: l1,
              opacity: 0.18 + glow * 0.3,
              transform: [{ scaleX: 1.08 }],
            }}
          />
        ) : null}
        {photo(r(84))}
        <View
          style={{
            position: "absolute",
            left: r(13),
            bottom: r(5),
            width: r(46),
            height: r(9),
            borderRadius: r(5),
            backgroundColor: c.ground,
            opacity: 0.85,
          }}
        />
      </View>
    );

  const floating = theme.style.tabBar === "floating";
  return (
    <View
      style={[
        s.frame,
        { width, height: h, borderRadius: r(18), backgroundColor: c.ground, borderColor: c.line },
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {glow > 0 ? (
        <LinearGradient
          colors={[l1, "transparent"]}
          start={{ x: 0, y: 1 }}
          end={{ x: 0.6, y: 0.3 }}
          style={[StyleSheet.absoluteFill, { opacity: glow * 0.5 }]}
        />
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", padding: r(8), gap: r(4) }}>
        <View
          style={{
            width: r(8),
            height: r(8),
            borderRadius: r(4),
            borderWidth: r(1.5),
            borderColor: c.text,
          }}
        />
        <View style={{ width: r(28), height: r(5), borderRadius: r(3), backgroundColor: c.text }} />
      </View>
      <View
        style={{ flexDirection: "row", gap: r(5), paddingHorizontal: r(8), marginBottom: r(8) }}
      >
        {[0, 1, 2, 3].map(story)}
      </View>
      {post}
      <View
        style={[
          s.bar,
          floating
            ? {
                left: r(10),
                right: r(10),
                bottom: r(8),
                height: r(18),
                borderRadius: r(9),
                backgroundColor: c.raised,
              }
            : {
                left: 0,
                right: 0,
                bottom: 0,
                height: r(20),
                backgroundColor: c.ground,
                borderTopWidth: 1,
                borderTopColor: c.line,
              },
        ]}
      >
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              width: r(5),
              height: r(5),
              borderRadius: r(3),
              backgroundColor: i === 0 ? c.text : c.textSoft,
              opacity: i === 0 ? 1 : 0.6,
            }}
          />
        ))}
        <View
          style={{ width: r(7), height: r(7), borderRadius: r(4), backgroundColor: c.accent }}
        />
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  frame: { overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
  bar: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
});
