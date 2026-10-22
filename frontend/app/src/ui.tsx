import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { forwardRef, type ReactNode, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Icon } from "./icon";
import { fonts, motion, type NativeTheme, useStyles, useTheme } from "./theme";

/** The Mark: a ring with the action colour caught inside it, off-centre. Plus the wordmark. */
export function Wordmark() {
  const s = useStyles(make);
  const { accent } = useTheme();
  const dot = useAnimatedStyle(() => ({
    backgroundColor: withTiming(accent, {
      duration: motion.relight,
      reduceMotion: ReduceMotion.System,
    }),
  }));
  return (
    <View style={s.brand} accessible accessibilityRole="header" accessibilityLabel="Realm">
      <View style={s.mark}>
        <Animated.View style={[s.markDot, dot]} />
      </View>
      <Text style={s.word}>realm</Text>
    </View>
  );
}

/**
 * Every pill (DESIGN.md Buttons): the action (the one thing to press, in the theme's colour,
 * re-lit with it), ghost, and quiet. Press scales to 0.97. Pending keeps its place and says what
 * it's doing.
 */
export function Pill({
  kind = "action",
  label,
  onPress,
  pending,
  pendingLabel,
  style,
  size = "lg",
}: {
  kind?: "action" | "ghost" | "quiet";
  /** lg 56dp for a screen's main action; md 44dp for actions in a row. */
  size?: "lg" | "md";
  label: string;
  onPress: () => void;
  pending?: boolean;
  pendingLabel?: string;
  style?: ViewStyle;
}) {
  const { t } = useTheme();
  const s = useStyles(make);
  const { accent, onAccent } = useTheme();
  const fill = useAnimatedStyle(() =>
    kind === "action"
      ? {
          backgroundColor: withTiming(accent, {
            duration: motion.relight,
            reduceMotion: ReduceMotion.System,
          }),
        }
      : {},
  );
  const ink = useAnimatedStyle(() =>
    kind === "action"
      ? {
          color: withTiming(onAccent, {
            duration: motion.relight,
            reduceMotion: ReduceMotion.System,
          }),
        }
      : {},
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={pending ? (pendingLabel ?? label) : label}
      accessibilityState={{ busy: Boolean(pending) }}
      onPress={() => {
        if (pending) return;
        if (kind === "action") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={style}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            s.pill,
            size === "md" && s.pillMd,
            kind === "ghost" && s.ghost,
            fill,
            pressed && { transform: [{ scale: 0.97 }] },
            pressed && kind !== "action" && { backgroundColor: t.colors.surfaceRaised },
          ]}
        >
          {pending && (
            <ActivityIndicator color={kind === "action" ? onAccent : t.colors.text} size="small" />
          )}
          <Animated.Text
            style={[
              s.pillLabel,
              size === "md" && s.pillLabelMd,
              kind === "quiet" && { color: t.colors.textSoft },
              ink,
            ]}
          >
            {pending ? (pendingLabel ?? label) : label}
          </Animated.Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

/** A text link (Ink, bold, underlined), at least 48dp tall to tap. */
export function TextLink({
  label,
  onPress,
  style,
}: {
  label: string;
  onPress: () => void;
  style?: TextStyle;
}) {
  const s = useStyles(make);
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [s.linkHit, pressed && { opacity: 0.7 }]}
    >
      <Text style={[s.link, style]}>{label}</Text>
    </Pressable>
  );
}

/** The back control for a stack screen: Android's own Back gesture works too. */
export function BackButton() {
  const { t } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      style={({ pressed }) => [s.back, pressed && { backgroundColor: t.colors.surfaceRaised }]}
    >
      <Icon name="CaretLeft" size={24} color={t.colors.text} />
    </Pressable>
  );
}

/** A screen's one title, in Funnel. */
export function Title({ children, size = 40 }: { children: ReactNode; size?: number }) {
  const s = useStyles(make);
  return (
    <Text accessibilityRole="header" style={[s.title, { fontSize: size, lineHeight: size * 1.02 }]}>
      {children}
    </Text>
  );
}

export function Lead({ children, style }: { children: ReactNode; style?: TextStyle }) {
  const s = useStyles(make);
  return <Text style={[s.lead, style]}>{children}</Text>;
}

/** A field (DESIGN.md Inputs): bold label, hint between label and field, error under it. */
export const Field = forwardRef<
  TextInput,
  TextInputProps & { label: string; hint?: string; error?: string; secret?: boolean }
>(function Field({ label, hint, error, secret, style, ...input }, ref) {
  const { t } = useTheme();
  const s = useStyles(make);
  const [focused, setFocused] = useState(false);
  const [shown, setShown] = useState(false);
  const { accent } = useTheme();
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
      <View
        style={[
          s.box,
          focused && { borderColor: accent, borderWidth: 2 },
          error ? { borderColor: t.colors.dangerLine } : null,
        ]}
      >
        <TextInput
          {...input}
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={hint}
          placeholderTextColor={t.colors.textMuted}
          selectionColor={accent}
          cursorColor={accent}
          secureTextEntry={secret && !shown}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={[s.input, style]}
        />
        {secret ? (
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="Show password"
            accessibilityState={{ checked: shown }}
            onPress={() => setShown((v) => !v)}
            style={s.show}
          >
            <Text style={s.showText}>{shown ? "Hide" : "Show"}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View style={s.errorRow} accessibilityLiveRegion="polite">
          <Icon name="WarningCircle" size={18} color={t.colors.danger} />
          <Text style={s.error}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
});

/** A notice above a form's submit: what went wrong, said once. */
export function Notice({ children }: { children: ReactNode }) {
  const { t } = useTheme();
  const s = useStyles(make);
  return (
    <View style={s.notice} accessibilityLiveRegion="polite">
      <Icon name="WarningCircle" size={20} color={t.colors.danger} />
      <Text style={s.noticeText}>{children}</Text>
    </View>
  );
}

/** Fades content in once, from already-visible layout (no layout jumps). */
export function FadeSwap({ swapKey, children }: { swapKey: string; children: ReactNode }) {
  const o = useSharedValue(1);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the fade replays whenever the content it holds changes (swapKey).
  useEffect(() => {
    o.value = 0;
    o.value = withTiming(1, { duration: motion.slow, reduceMotion: ReduceMotion.System });
  }, [swapKey, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    brand: { flexDirection: "row", alignItems: "center", gap: 9 },
    mark: { width: 24, height: 24, borderRadius: 12, borderWidth: 2.4, borderColor: t.colors.text },
    markDot: { position: "absolute", width: 7, height: 7, borderRadius: 3.5, top: 2.5, right: 2 },
    word: { fontFamily: fonts.display, fontSize: 23, color: t.colors.text, letterSpacing: -0.7 },
    pill: {
      minHeight: 56,
      borderRadius: 999,
      paddingHorizontal: 28,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    pillMd: { minHeight: 44, paddingHorizontal: 18 },
    pillLabelMd: { fontSize: 15 },
    ghost: { borderWidth: 1.5, borderColor: t.colors.borderStrong },
    pillLabel: { fontFamily: fonts.bold, fontSize: 17, color: t.colors.text },
    linkHit: { minHeight: 48, justifyContent: "center" },
    link: {
      fontFamily: fonts.bold,
      fontSize: 16,
      color: t.colors.text,
      textDecorationLine: "underline",
    },
    back: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: -8,
    },
    title: { fontFamily: fonts.display, color: t.colors.text, letterSpacing: -1.4 },
    lead: { fontFamily: fonts.body, fontSize: 17, lineHeight: 26, color: t.colors.textSoft },
    field: { gap: 6 },
    label: { fontFamily: fonts.bold, fontSize: 16, color: t.colors.text },
    hint: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: t.colors.textSoft },
    box: {
      minHeight: 56,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: t.colors.borderStrong,
      backgroundColor: "rgba(11,11,14,0.7)",
      flexDirection: "row",
      alignItems: "center",
      marginTop: 2,
    },
    input: {
      flex: 1,
      minHeight: 52,
      paddingHorizontal: 16,
      fontFamily: fonts.body,
      fontSize: 17,
      color: t.colors.text,
    },
    show: { minWidth: 64, minHeight: 48, alignItems: "center", justifyContent: "center" },
    showText: { fontFamily: fonts.bold, fontSize: 15, color: t.colors.text },
    errorRow: { flexDirection: "row", gap: 6, alignItems: "flex-start", marginTop: 2 },
    error: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 14,
      lineHeight: 20,
      color: t.colors.danger,
    },
    notice: {
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
      padding: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: t.colors.dangerLine,
      backgroundColor: "rgba(11,11,14,0.7)",
    },
    noticeText: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 15,
      lineHeight: 22,
      color: t.colors.text,
    },
  });
