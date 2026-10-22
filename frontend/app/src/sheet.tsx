import * as Haptics from "expo-haptics";
import { createContext, type ReactNode, useCallback, useContext, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, ReduceMotion, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "./icon";
import type { IconName } from "./icon-paths";
import { motion, type NativeTheme, useStyles, useTheme } from "./theme";

export interface SheetAction {
  label: string;
  icon?: IconName;
  /** Destructive (delete, block): said in the danger colour, and always in words too. */
  danger?: boolean;
  onPress: () => void;
}

export interface SheetSpec {
  title?: string;
  /** What will happen, for a choice that needs saying before you make it. */
  line?: string;
  /** Something above the actions, like a row of reactions. It gets `close` to finish with. */
  top?: (close: () => void) => ReactNode;
  actions: SheetAction[];
  /** Closed without choosing (Cancel, the backdrop, the back button). */
  onCancel?: () => void;
}

const SheetContext = createContext<((spec: SheetSpec) => void) | null>(null);

/**
 * The app's one menu: a sheet up from the bottom, in thumb reach, with Cancel last. It stands in
 * for system alerts, which on Android hold only three buttons and in the browser preview none.
 * Choosing closes it first, so a choice can open the next sheet (an "Are you sure?").
 */
export function SheetProvider({ children }: { children: ReactNode }) {
  const { t } = useTheme();
  const s = useStyles(make);
  const [spec, setSpec] = useState<SheetSpec | null>(null);
  const insets = useSafeAreaInsets();
  const close = useCallback(() => setSpec(null), []);
  const cancel = useCallback(() => {
    const onCancel = spec?.onCancel;
    setSpec(null);
    onCancel?.();
  }, [spec]);
  const open = useCallback((next: SheetSpec) => setSpec(next), []);
  return (
    <SheetContext.Provider value={open}>
      {children}
      <Modal
        visible={spec !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={cancel}
      >
        <View style={s.root}>
          <Pressable
            style={s.backdrop}
            onPress={cancel}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
          />
          {spec ? (
            <Animated.View
              key={spec.title ?? spec.actions.map((a) => a.label).join()}
              entering={SlideInDown.duration(motion.slow)
                .easing(Easing.out(Easing.exp))
                .reduceMotion(ReduceMotion.System)}
              style={[s.sheet, { paddingBottom: insets.bottom + 10 }]}
              accessibilityViewIsModal
            >
              <View style={s.grip} />
              {spec.title ? (
                <Text style={s.title} accessibilityRole="header">
                  {spec.title}
                </Text>
              ) : null}
              {spec.line ? <Text style={s.line}>{spec.line}</Text> : null}
              {spec.top ? <View style={s.top}>{spec.top(close)}</View> : null}
              <View style={spec.title || spec.line ? s.actionsSpaced : undefined}>
                {spec.actions.map((a) => (
                  <Pressable
                    key={a.label}
                    accessibilityRole="button"
                    onPress={() => {
                      if (a.danger) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      close();
                      a.onPress();
                    }}
                    style={({ pressed }) => [s.row, pressed && s.rowPressed]}
                  >
                    {a.icon ? (
                      <Icon
                        name={a.icon}
                        size={22}
                        color={a.danger ? t.colors.danger : t.colors.text}
                      />
                    ) : null}
                    <Text style={[s.rowText, a.danger && s.danger]}>{a.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={cancel}
                style={({ pressed }) => [s.cancel, pressed && s.rowPressed]}
              >
                <Text style={s.cancelText}>Cancel</Text>
              </Pressable>
            </Animated.View>
          ) : null}
        </View>
      </Modal>
    </SheetContext.Provider>
  );
}

/** Opens the menu sheet: `sheet({ title, actions })`. */
export function useSheet() {
  const open = useContext(SheetContext);
  if (!open) throw new Error("useSheet needs SheetProvider");
  return open;
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    root: { flex: 1, justifyContent: "flex-end" },
    backdrop: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: "rgba(0,0,0,0.6)",
    },
    sheet: {
      backgroundColor: t.colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      paddingHorizontal: 10,
      paddingTop: 8,
    },
    grip: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.colors.borderStrong,
      marginBottom: 10,
    },
    title: {
      fontFamily: t.fonts.displayBold,
      fontSize: 20 * t.textScale,
      color: t.colors.text,
      paddingHorizontal: 12,
      marginTop: 4,
    },
    line: {
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      lineHeight: 22 * t.textScale,
      color: t.colors.textSoft,
      paddingHorizontal: 12,
      marginTop: 6,
    },
    actionsSpaced: { marginTop: 12 },
    top: { paddingHorizontal: 4, paddingTop: 2, paddingBottom: 8 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      minHeight: 54,
      paddingHorizontal: 12,
      borderRadius: 14,
    },
    rowPressed: { backgroundColor: t.colors.surfaceRaised },
    rowText: {
      flex: 1,
      fontFamily: t.fonts.bold,
      fontSize: 16.5 * t.textScale,
      color: t.colors.text,
    },
    danger: { color: t.colors.danger },
    cancel: {
      minHeight: 54,
      marginTop: 6,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    cancelText: {
      fontFamily: t.fonts.bold,
      fontSize: 16.5 * t.textScale,
      color: t.colors.textSoft,
    },
  });
