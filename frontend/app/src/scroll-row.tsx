import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  type FlatListProps,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  type PressableStateCallbackType,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
  View,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { Icon } from "./icon";
import { type NativeTheme, useStyles, useTheme } from "./theme";

const FINE = "(hover: hover) and (pointer: fine)";

/**
 * True in a browser driven by a mouse (a computer), where nothing can be swiped. Phones, tablets
 * and the app on a phone are always false, so they never see the arrows below.
 */
export function useFinePointer() {
  const [fine, setFine] = useState(
    () =>
      Platform.OS === "web" && typeof window !== "undefined" && !!window.matchMedia?.(FINE).matches,
  );
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(FINE);
    const on = () => setFine(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return fine;
}

/** A round arrow button over the edge of something that scrolls sideways (mouse users only). */
export function EdgeArrow({
  side,
  top,
  onPress,
  label,
  inset = 6,
  big = false,
}: {
  side: "left" | "right";
  /** The arrow's centre from the top; the middle when not given. */
  top?: number;
  onPress: () => void;
  label: string;
  /** How far in from that edge. */
  inset?: number;
  /** A larger arrow, for full-screen viewers. */
  big?: boolean;
}) {
  const s = useStyles(make);
  const { t } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      // react-native-web adds `hovered`; the native types don't know it.
      style={({ hovered, pressed }: PressableStateCallbackType & { hovered?: boolean }) => [
        s.arrow,
        side === "left" ? { left: inset } : { right: inset },
        big && s.big,
        top === undefined ? (big ? s.middleBig : s.middle) : { top: top - (big ? 22 : 18) },
        hovered && s.hovered,
        pressed && s.pressed,
      ]}
    >
      <Icon
        name={side === "left" ? "CaretLeft" : "CaretRight"}
        size={big ? 22 : 18}
        color={t.colors.text}
      />
    </Pressable>
  );
}

/**
 * A row that scrolls sideways: a drop-in for `<ScrollView horizontal>`. Fingers swipe it as
 * before; in a browser with a mouse, round arrows appear at the ends while there's more to see.
 */
export function HScroll({
  children,
  arrowTop,
  onScroll,
  onLayout,
  onContentSizeChange,
  ...rest
}: Omit<ScrollViewProps, "horizontal"> & { children: ReactNode; arrowTop?: number }) {
  const fine = useFinePointer();
  const calm = useReducedMotion();
  const ref = useRef<ScrollView>(null);
  const [x, setX] = useState(0);
  const [width, setWidth] = useState(0);
  const [inner, setInner] = useState(0);

  const scrolled = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setX(e.nativeEvent.contentOffset.x);
      onScroll?.(e);
    },
    [onScroll],
  );

  if (!fine) {
    return (
      <ScrollView
        horizontal
        onScroll={onScroll}
        onLayout={onLayout}
        onContentSizeChange={onContentSizeChange}
        {...rest}
      >
        {children}
      </ScrollView>
    );
  }

  const go = (dir: 1 | -1) =>
    ref.current?.scrollTo({
      x: Math.max(0, Math.min(inner - width, x + dir * width * 0.8)),
      animated: !calm,
    });

  return (
    <View>
      <ScrollView
        ref={ref}
        horizontal
        scrollEventThrottle={32}
        onScroll={scrolled}
        onLayout={(e: LayoutChangeEvent) => {
          setWidth(e.nativeEvent.layout.width);
          onLayout?.(e);
        }}
        onContentSizeChange={(w, h) => {
          setInner(w);
          onContentSizeChange?.(w, h);
        }}
        {...rest}
      >
        {children}
      </ScrollView>
      {x > 1 ? (
        <EdgeArrow side="left" top={arrowTop} onPress={() => go(-1)} label="Scroll back" />
      ) : null}
      {x + width < inner - 1 ? (
        <EdgeArrow side="right" top={arrowTop} onPress={() => go(1)} label="Scroll on" />
      ) : null}
    </View>
  );
}

/** `<FlatList horizontal>` with the same mouse arrows as HScroll. */
export function HList<T>({
  arrowTop,
  onScroll,
  onLayout,
  onContentSizeChange,
  ...rest
}: Omit<FlatListProps<T>, "horizontal"> & { arrowTop?: number }) {
  const fine = useFinePointer();
  const calm = useReducedMotion();
  const ref = useRef<FlatList<T>>(null);
  const [x, setX] = useState(0);
  const [width, setWidth] = useState(0);
  const [inner, setInner] = useState(0);

  const scrolled = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setX(e.nativeEvent.contentOffset.x);
      onScroll?.(e);
    },
    [onScroll],
  );

  if (!fine) {
    return (
      <FlatList
        horizontal
        onScroll={onScroll}
        onLayout={onLayout}
        onContentSizeChange={onContentSizeChange}
        {...rest}
      />
    );
  }

  const go = (dir: 1 | -1) =>
    ref.current?.scrollToOffset({
      offset: Math.max(0, Math.min(inner - width, x + dir * width * 0.8)),
      animated: !calm,
    });

  return (
    <View>
      <FlatList
        ref={ref}
        horizontal
        scrollEventThrottle={32}
        onScroll={scrolled}
        onLayout={(e: LayoutChangeEvent) => {
          setWidth(e.nativeEvent.layout.width);
          onLayout?.(e);
        }}
        onContentSizeChange={(w, h) => {
          setInner(w);
          onContentSizeChange?.(w, h);
        }}
        {...rest}
      />
      {x > 1 ? (
        <EdgeArrow side="left" top={arrowTop} onPress={() => go(-1)} label="Scroll back" />
      ) : null}
      {x + width < inner - 1 ? (
        <EdgeArrow side="right" top={arrowTop} onPress={() => go(1)} label="Scroll on" />
      ) : null}
    </View>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    arrow: {
      position: "absolute",
      zIndex: 2,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.surfaceRaised,
      borderWidth: 1,
      borderColor: t.colors.borderStrong,
      boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
    },
    big: { width: 44, height: 44, borderRadius: 22 },
    middle: { top: "50%", marginTop: -18 },
    middleBig: { top: "50%", marginTop: -22 },
    hovered: { transform: [{ scale: 1.06 }] },
    pressed: { transform: [{ scale: 0.94 }] },
  });
