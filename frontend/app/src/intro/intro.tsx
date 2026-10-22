import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  Easing,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { LightField } from "../light-field";
import { roles, THEME_ORDER, type ThemeId, themes, useTheme } from "../theme";
import { FadeSwap, Lead, Pill, TextLink, Title, Wordmark } from "../ui";
import { CARD, ProfileCard } from "./profile-card";
import { useTilt } from "./use-tilt";

/** What each colour's page says: what your colour and your profile do in Realm. */
const LINES: Record<ThemeId, string> = {
  mint: "Pick a colour and the whole app follows it. Swipe the card to try one.",
  orchid: "Your Spaces and what you're up to right now, all on one profile.",
  aqua: "Your colour goes everywhere with you: your profile, your buttons, your bubbles in every chat.",
  ember: "Tap the card to turn it over: who's around right now, and where.",
};

const SWIPE = 56;

/**
 * The app's introduction (the owner's pick, 2026-10-11: "Your profile, in your hand"). An example
 * profile card you tilt and swipe; each swipe re-lights the whole screen in the next theme, and
 * you start your profile in the colour you stop on.
 */
export function Intro() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { accentId: id, setTheme } = useTheme();
  const calm = useReducedMotion();
  const tilt = useTilt(!calm);
  const drag = useSharedValue(0);
  const flip = useSharedValue(0);
  const [flipped, setFlipped] = useState(false);
  const [stage, setStage] = useState({ w: 0, h: 0 });

  const index = THEME_ORDER.indexOf(id);
  const go = (to: number) => {
    const next = THEME_ORDER[(to + THEME_ORDER.length) % THEME_ORDER.length];
    if (!next || next === id) return;
    Haptics.selectionAsync();
    setTheme(next);
  };
  const turnOver = () => {
    const to = !flipped;
    setFlipped(to);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    flip.value = calm
      ? to
        ? 1
        : 0
      : withTiming(to ? 1 : 0, { duration: 520, easing: Easing.bezier(0.32, 0.72, 0, 1) });
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-22, 22])
    .onUpdate((e) => {
      drag.value = e.translationX;
    })
    .onEnd((e) => {
      const dir =
        e.translationX < -SWIPE || e.velocityX < -600
          ? 1
          : e.translationX > SWIPE || e.velocityX > 600
            ? -1
            : 0;
      if (dir !== 0) scheduleOnRN(go, index + dir);
      drag.value = withSpring(0, { damping: 16, stiffness: 160 });
    });
  const tap = Gesture.Tap()
    .maxDuration(300)
    .onEnd(() => {
      scheduleOnRN(turnOver);
    });

  // The card fills the stage it's given, from a small phone to a tall one.
  const scale = stage.h ? Math.min(1.08, (stage.h - 16) / CARD.h, (stage.w - 72) / CARD.w) : 0;
  const onStage = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setStage({ w: width, h: height });
  };

  return (
    <View style={s.screen}>
      <LightField />
      <View style={[s.top, { paddingTop: insets.top + 6 }]}>
        <Wordmark />
        <TextLink label="Sign in" onPress={() => router.push("/sign-in")} />
      </View>

      <GestureDetector gesture={Gesture.Race(pan, tap)}>
        <View
          style={s.stage}
          onLayout={onStage}
          accessible
          accessibilityRole="button"
          accessibilityLabel={
            flipped
              ? "Example profile, turned over: who's here now with Ama"
              : "Example profile: Ama, in Squad room"
          }
          accessibilityHint="Turns the card over"
          accessibilityActions={[
            { name: "activate" },
            { name: "increment", label: "Next colour" },
            { name: "decrement", label: "Previous colour" },
          ]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === "activate") turnOver();
            if (e.nativeEvent.actionName === "increment") go(index + 1);
            if (e.nativeEvent.actionName === "decrement") go(index - 1);
          }}
        >
          {scale > 0 && (
            <View importantForAccessibility="no-hide-descendants">
              <ProfileCard scale={scale} tiltX={tilt.x} tiltY={tilt.y} drag={drag} flip={flip} />
            </View>
          )}
        </View>
      </GestureDetector>

      <View style={s.dots} accessibilityRole="radiogroup" accessibilityLabel="Colour">
        {THEME_ORDER.map((t, i) => {
          const [l1, l2] = themes[t].lights;
          const on = t === id;
          return (
            <Pressable
              key={t}
              accessibilityRole="radio"
              accessibilityLabel={themes[t].name}
              accessibilityState={{ checked: on }}
              onPress={() => go(i)}
              style={s.dotHit}
            >
              <View style={[s.dotRing, on && s.dotRingOn]}>
                <LinearGradient
                  colors={[l1, l2]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.dot}
                />
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={s.copy}>
        <Title size={42}>Make it yours.</Title>
        <View style={s.leadBox}>
          <FadeSwap swapKey={id}>
            <Lead>{LINES[id]}</Lead>
          </FadeSwap>
        </View>
      </View>

      <View style={[s.actions, { paddingBottom: insets.bottom + 16 }]}>
        <Pill label="Create your profile" onPress={() => router.push("/sign-up")} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: roles.bg },
  top: {
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stage: { flex: 1, alignItems: "center", justifyContent: "center" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 4, marginTop: 4 },
  dotHit: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  dotRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  dotRingOn: { borderColor: roles.text },
  dot: { width: 28, height: 28, borderRadius: 14 },
  copy: { paddingHorizontal: 24, marginTop: 14 },
  leadBox: { marginTop: 10, minHeight: 78 },
  actions: { paddingHorizontal: 20, paddingTop: 14 },
});
