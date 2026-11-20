import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BackHandler,
  type LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut, ReduceMotion } from "react-native-reanimated";
import Svg, { Path, Rect } from "react-native-svg";
import { Icon } from "./icon";
import type { IconName } from "./icon-paths";
import { remember } from "./remember";
import { useSession } from "./session";
import { motion, type NativeTheme, useStyles, useTheme } from "./theme";
import { Pill } from "./ui";

/**
 * The welcome tour: seven short steps, shown once to each person on this phone, the first time
 * they reach Home. Each step lights up the real button it's about (the rest of the screen dims)
 * and explains it in a card beside it. Settings › Take the tour again shows it again.
 *
 * A button joins the tour with `useTourSpot("id")` on its ref. When a spot isn't on screen (a
 * computer's layout has no bottom tabs), its card simply shows in the middle.
 */
type Step = { spot: string | null; icon: IconName; title: string; body: string };

const STEPS: Step[] = [
  {
    spot: null,
    icon: "SparkleFill",
    title: "Welcome to Realm",
    body: "Here's a quick look at where everything is. Seven short steps.",
  },
  {
    spot: "create",
    icon: "PlusSquare",
    title: "Make something",
    body: "Tap + to share a post, a Story that lasts a day, or a Clip.",
  },
  {
    spot: "activity",
    icon: "Heart",
    title: "Your activity",
    body: "Likes, comments, mentions and new followers show up behind the heart.",
  },
  {
    spot: "tab-explore",
    icon: "MagnifyingGlass",
    title: "Search",
    body: "Find people and Spaces to join, and see what's popular.",
  },
  {
    spot: "tab-clips",
    icon: "PlayCircle",
    title: "Clips",
    body: "Short videos, one after another. Swipe to see the next one.",
  },
  {
    spot: "tab-inbox",
    icon: "ChatCircle",
    title: "Messages",
    body: "Your chats, group chats and Spaces, all in one place.",
  },
  {
    spot: "tab-you",
    icon: "Gear",
    title: "You and Settings",
    body: "Your profile. The gear at the top opens Settings: themes, notifications, help, and this tour again.",
  },
];

const doneKey = (userId: string) => `realm.tour-done.${userId}`;

type Spots = Map<string, RefObject<View | null>>;

interface TourApi {
  spots: Spots;
  active: boolean;
  /** Show the tour from the first step. */
  start(): void;
}

const TourContext = createContext<TourApi | null>(null);

export function TourProvider({ children }: { children: ReactNode }) {
  const spots = useRef<Spots>(new Map()).current;
  const [step, setStep] = useState<number | null>(null);
  const { session } = useSession();
  const userId = session.status === "signedIn" ? session.user.id : null;

  const start = useCallback(() => setStep(0), []);
  const close = useCallback(() => {
    setStep(null);
    if (userId) void remember.set(doneKey(userId), "1");
  }, [userId]);

  // Signed out mid-tour: put it away.
  useEffect(() => {
    if (!userId) setStep(null);
  }, [userId]);

  const value = useMemo<TourApi>(
    () => ({ spots, active: step !== null, start }),
    [spots, step, start],
  );
  return (
    <TourContext.Provider value={value}>
      {children}
      {step !== null ? (
        <Overlay step={step} spots={spots} onStep={setStep} onClose={close} />
      ) : null}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour needs TourProvider");
  return ctx;
}

/** Marks a button as a stop on the tour: put the returned ref on it. */
export function useTourSpot(id: string) {
  const ctx = useContext(TourContext);
  const ref = useRef<View>(null);
  useEffect(() => {
    if (!ctx) return;
    ctx.spots.set(id, ref);
    return () => {
      if (ctx.spots.get(id) === ref) ctx.spots.delete(id);
    };
  }, [ctx, id]);
  return ref;
}

/** Whether this person has been through the tour on this phone. */
export async function tourDone(userId: string) {
  return (await remember.get(doneKey(userId))) === "1";
}

type Box = { x: number; y: number; w: number; h: number };

/** Space around a lit button, and the gap between it and its card. */
const PAD = 6;
const GAP = 16;
const EDGE = 16;

function Overlay({
  step,
  spots,
  onStep,
  onClose,
}: {
  step: number;
  spots: Spots;
  onStep: (n: number) => void;
  onClose: () => void;
}) {
  const { t, accent } = useTheme();
  const s = useStyles(make);
  const root = useRef<View>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [hole, setHole] = useState<Box | null>(null);
  const [placed, setPlaced] = useState(false);
  const current = STEPS[step] ?? STEPS[0];
  const last = step === STEPS.length - 1;

  // Find where this step's button is, relative to the tour itself (so status bars never shift it).
  useEffect(() => {
    if (!size) return;
    let gone = false;
    setPlaced(false);
    const timer = setTimeout(() => {
      const target = current?.spot ? spots.get(current.spot)?.current : null;
      const frame = root.current;
      if (!target || !frame) {
        setHole(null);
        setPlaced(true);
        return;
      }
      frame.measureInWindow((ox, oy) => {
        target.measureInWindow((x, y, w, h) => {
          if (gone) return;
          const fits = w > 0 && h > 0 && y - oy >= 0 && y - oy + h <= size.h;
          setHole(
            fits ? { x: x - ox - PAD, y: y - oy - PAD, w: w + PAD * 2, h: h + PAD * 2 } : null,
          );
          setPlaced(true);
        });
      });
    }, 120);
    return () => {
      gone = true;
      clearTimeout(timer);
    };
  }, [size, current, spots]);

  // Android's back button: a step back, or out of the tour from the first step. On the web (where
  // BackHandler doesn't exist) the Escape key closes it.
  useEffect(() => {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step > 0) onStep(step - 1);
      else onClose();
      return true;
    });
    return () => sub.remove();
  }, [step, onStep, onClose]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((old) => (old && old.w === width && old.h === height ? old : { w: width, h: height }));
  };

  const cardW = size ? Math.min(size.w - EDGE * 2, 380) : 0;
  const below = hole && size ? hole.y + hole.h / 2 < size.h / 2 : false;
  const cx = hole ? hole.x + hole.w / 2 : 0;
  const left = size && hole ? Math.min(Math.max(cx - cardW / 2, EDGE), size.w - EDGE - cardW) : 0;
  const arrowX = hole ? Math.min(Math.max(cx - left - 8, 22), cardW - 38) : 0;
  const radius = hole ? Math.min(18, hole.h / 2) : 0;

  const card = (
    <Animated.View
      key={step}
      entering={FadeIn.duration(motion.base).reduceMotion(ReduceMotion.System)}
      style={[s.card, { width: cardW || undefined }]}
      accessibilityViewIsModal
      accessibilityLiveRegion="polite"
    >
      <View style={s.cardFill} pointerEvents="none" />
      {hole ? (
        <View
          pointerEvents="none"
          style={[s.arrow, below ? s.arrowUp : s.arrowDown, { left: arrowX }]}
        >
          <View style={s.arrowFill} />
        </View>
      ) : null}
      <View style={s.head}>
        <View style={[s.mark, { backgroundColor: accent }]}>
          <Icon name={current?.icon ?? "SparkleFill"} size={18} color={t.colors.onAccent} />
        </View>
        <Text style={s.count}>
          Step {step + 1} of {STEPS.length}
        </Text>
        {!last ? (
          <Text
            style={s.skip}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Skip the tour"
            suppressHighlighting
          >
            Skip
          </Text>
        ) : null}
      </View>
      <Text style={s.title} accessibilityRole="header">
        {current?.title}
      </Text>
      <Text style={s.body}>{current?.body}</Text>
      <View style={s.foot}>
        <View style={s.dots} accessibilityElementsHidden importantForAccessibility="no">
          {STEPS.map((st, i) => (
            <View
              key={st.title}
              style={[s.dot, i === step && [s.dotOn, { backgroundColor: accent }]]}
            />
          ))}
        </View>
        {step > 0 ? (
          <Pill size="md" kind="quiet" label="Back" onPress={() => onStep(step - 1)} />
        ) : null}
        <Pill
          size="md"
          label={last ? "Start exploring" : step === 0 ? "Show me" : "Next"}
          onPress={() => (last ? onClose() : onStep(step + 1))}
        />
      </View>
    </Animated.View>
  );

  return (
    <View
      ref={root}
      onLayout={onLayout}
      style={StyleSheet.absoluteFill}
      // Nothing behind the tour reacts while it's open.
      onStartShouldSetResponder={() => true}
    >
      <Animated.View
        entering={FadeIn.duration(motion.slow).reduceMotion(ReduceMotion.System)}
        exiting={FadeOut.duration(motion.fast).reduceMotion(ReduceMotion.System)}
        style={StyleSheet.absoluteFill}
        pointerEvents="box-none"
      >
        {size ? (
          <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Path
              d={`M0 0H${size.w}V${size.h}H0Z${hole ? rounded(hole, radius) : ""}`}
              fill="rgba(3,3,6,0.76)"
              fillRule="evenodd"
            />
            {hole ? (
              <Rect
                x={hole.x}
                y={hole.y}
                width={hole.w}
                height={hole.h}
                rx={radius}
                fill="none"
                stroke={accent}
                strokeWidth={2.5}
              />
            ) : null}
          </Svg>
        ) : null}
        {size && placed ? (
          hole ? (
            <View
              style={[
                s.place,
                { left },
                below ? { top: hole.y + hole.h + GAP } : { bottom: size.h - hole.y + GAP },
              ]}
            >
              {card}
            </View>
          ) : (
            <View style={s.middle}>{card}</View>
          )
        ) : null}
      </Animated.View>
    </View>
  );
}

/** A rounded rectangle as a path, drawn the other way round so it cuts a hole in the shade. */
function rounded({ x, y, w, h }: Box, r: number) {
  return `M${x + r} ${y}A${r} ${r} 0 0 0 ${x} ${y + r}V${y + h - r}A${r} ${r} 0 0 0 ${x + r} ${y + h}H${x + w - r}A${r} ${r} 0 0 0 ${x + w} ${y + h - r}V${y + r}A${r} ${r} 0 0 0 ${x + w - r} ${y}Z`;
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    place: { position: "absolute" },
    middle: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
    // A solid ground first, then the theme's raised colour on it, so see-through themes stay crisp.
    card: {
      borderRadius: 22,
      padding: 18,
      gap: 8,
      backgroundColor: t.colors.bg,
      borderWidth: 1,
      borderColor: t.colors.borderStrong,
      shadowColor: "#000000",
      shadowOpacity: 0.45,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 16,
    },
    cardFill: {
      ...StyleSheet.absoluteFill,
      borderRadius: 21,
      backgroundColor: t.colors.surfaceRaised,
    },
    arrow: {
      position: "absolute",
      width: 16,
      height: 16,
      backgroundColor: t.colors.bg,
      borderColor: t.colors.borderStrong,
      transform: [{ rotate: "45deg" }],
      overflow: "hidden",
    },
    arrowFill: { ...StyleSheet.absoluteFill, backgroundColor: t.colors.surfaceRaised },
    arrowUp: { top: -8.5, borderLeftWidth: 1, borderTopWidth: 1 },
    arrowDown: { bottom: -8.5, borderRightWidth: 1, borderBottomWidth: 1 },
    head: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 2 },
    mark: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    count: {
      flex: 1,
      fontFamily: t.fonts.bold,
      fontSize: 12.5 * t.textScale,
      letterSpacing: 0.4,
      color: t.colors.textSoft,
    },
    skip: {
      fontFamily: t.fonts.bold,
      fontSize: 14 * t.textScale,
      color: t.colors.textSoft,
      paddingVertical: 8,
      paddingHorizontal: 6,
      marginRight: -6,
    },
    title: {
      fontFamily: t.fonts.displayBold,
      fontSize: 22 * t.textScale,
      lineHeight: 27 * t.textScale,
      color: t.colors.text,
    },
    body: {
      fontFamily: t.fonts.body,
      fontSize: 15.5 * t.textScale,
      lineHeight: 22 * t.textScale,
      color: t.colors.textSoft,
    },
    foot: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
    dots: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.colors.borderStrong },
    dotOn: { width: 18 },
  });
