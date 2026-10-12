import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { interpolate, type SharedValue, useAnimatedStyle } from "react-native-reanimated";
import { Icon } from "../icon";
import { Relit } from "../relit";
import { fonts, roles, type ThemeId, themes } from "../theme";

/** The card is drawn at this size and scaled to fit the screen, like a printed card. */
export const CARD = { w: 292, h: 432 } as const;

/** The example person and their people: labelled Example on the card, never presented as real. */
const PEOPLE = [
  { initial: "T", name: "Theo", colour: "#8bd3ff", now: "In Squad room" },
  { initial: "K", name: "Kenji", colour: "#ff8fb1", now: "In Squad room" },
  { initial: "N", name: "Noor", colour: "#b9f27c", now: "Typing in the late crew" },
  { initial: "A", name: "Ama", colour: "#ffb547", now: "In Squad room" },
];
const SPACES = [
  { initials: "LN", colour: "#8bd3ff" },
  { initials: "RF", colour: "#ff8fb1" },
  { initials: "MC", colour: "#b9f27c" },
];

function lights(id: ThemeId) {
  const [l1, l2, l3] = themes[id].lights;
  return [l1, l2, l3] as const;
}

/** Holo foil, only along the card's edge (DESIGN.md: never on its face). It shifts as you tilt. */
function Foil({ tiltX, tiltY }: { tiltX: SharedValue<number>; tiltY: SharedValue<number> }) {
  const sweep = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(tiltY.value, [-16, 16], [-70, 70]) },
      { translateY: interpolate(tiltX.value, [-12, 12], [60, -60]) },
      { rotate: `${32 + tiltY.value * 2.2}deg` },
    ],
  }));
  return (
    <Animated.View style={[s.foil, sweep]}>
      <Relit
        render={(id) => {
          const [l1, l2, l3] = lights(id);
          return (
            <LinearGradient
              colors={[l1, l2, "#ffffff", l3, l1, "#ffffff", l2, l1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          );
        }}
      />
    </Animated.View>
  );
}

function Banner() {
  return (
    <View style={s.banner}>
      <Relit
        render={(id) => {
          const [l1, l2, l3] = lights(id);
          return (
            <LinearGradient
              colors={[l1, l2, l3]}
              locations={[0, 0.58, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          );
        }}
      />
      <LinearGradient
        colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0)"]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.4, y: 0.9 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

function Front() {
  return (
    <View style={s.face}>
      <Banner />
      <View style={s.pfp}>
        <Text style={s.pfpText} allowFontScaling={false}>
          A
        </Text>
        <View style={s.pfpDot} />
      </View>
      <View style={s.body}>
        <Text style={s.name} allowFontScaling={false}>
          Ama
        </Text>
        <Text style={s.handle} allowFontScaling={false}>
          @ama.plays
        </Text>
        <View style={s.now}>
          <Icon name="SpeakerHigh" size={18} color={roles.presence} />
          <Text style={s.nowText} allowFontScaling={false}>
            In Squad room, Late Night Lobby
          </Text>
        </View>
        <View style={s.section}>
          <Text style={s.sectionHead} allowFontScaling={false}>
            Spaces
          </Text>
          <View style={s.badges}>
            {SPACES.map((b) => (
              <View key={b.initials} style={[s.badge, { backgroundColor: b.colour }]}>
                <Text style={s.badgeText} allowFontScaling={false}>
                  {b.initials}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function Back() {
  return (
    <View style={[s.face, s.backFace]}>
      <Text style={s.sectionHead} allowFontScaling={false}>
        Here now with Ama
      </Text>
      <View style={s.people}>
        {PEOPLE.map((p) => (
          <View key={p.name} style={s.person}>
            <View style={s.ring}>
              <View style={[s.avatar, { backgroundColor: p.colour }]}>
                <Text style={s.avatarText} allowFontScaling={false}>
                  {p.initial}
                </Text>
              </View>
            </View>
            <View>
              <Text style={s.personName} allowFontScaling={false}>
                {p.name}
              </Text>
              <Text style={s.personNow} allowFontScaling={false}>
                {p.now}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <View style={s.section}>
        <Text style={s.sectionHead} allowFontScaling={false}>
          Ama's colour
        </Text>
        <View style={s.swatch}>
          <Relit
            render={(id) => {
              const [l1, l2, l3] = lights(id);
              return (
                <LinearGradient
                  colors={[l1, l2, l3]}
                  locations={[0, 0.58, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              );
            }}
          />
        </View>
      </View>
    </View>
  );
}

/** One side of the card: the dark body, the foil edge, the face, and the Example tag. */
function Side({
  children,
  tiltX,
  tiltY,
}: {
  children: ReactNode;
  tiltX: SharedValue<number>;
  tiltY: SharedValue<number>;
}) {
  return (
    <View style={s.card}>
      <View style={s.foilClip}>
        <Foil tiltX={tiltX} tiltY={tiltY} />
      </View>
      {children}
      <View style={s.tag}>
        <Text style={s.tagText} allowFontScaling={false}>
          Example
        </Text>
      </View>
    </View>
  );
}

/**
 * The example profile card: tilts with the phone, swings as you swipe, and turns over on a tap.
 * Drawn at {@link CARD} size and scaled by `scale`.
 */
export function ProfileCard({
  scale,
  tiltX,
  tiltY,
  drag,
  flip,
}: {
  scale: number;
  tiltX: SharedValue<number>;
  tiltY: SharedValue<number>;
  drag: SharedValue<number>;
  flip: SharedValue<number>;
}) {
  // The resting pose is a card held in the hand, a little turned; the sensors and the swipe add
  // to it, and the flip turns it half a turn.
  const turn = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1100 },
      { scale },
      { translateX: drag.value * 0.22 },
      { rotateZ: `${-1.5 + drag.value * 0.012}deg` },
      { rotateX: `${6 + tiltX.value}deg` },
      { rotateY: `${-10 + tiltY.value + drag.value * 0.09 + flip.value * 180}deg` },
    ],
  }));
  const front = useAnimatedStyle(() => ({ opacity: flip.value < 0.5 ? 1 : 0 }));
  const back = useAnimatedStyle(() => ({ opacity: flip.value < 0.5 ? 0 : 1 }));
  return (
    <Animated.View style={[s.stage, turn]}>
      <Animated.View style={[StyleSheet.absoluteFill, s.side, front]}>
        <Side tiltX={tiltX} tiltY={tiltY}>
          <Front />
        </Side>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, s.side, s.mirrored, back]}>
        <Side tiltX={tiltX} tiltY={tiltY}>
          <Back />
        </Side>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  stage: { width: CARD.w, height: CARD.h },
  side: { backfaceVisibility: "hidden" },
  mirrored: { transform: [{ rotateY: "180deg" }] },
  card: {
    flex: 1,
    borderRadius: 15,
    backgroundColor: "#121217",
    padding: 7,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.55,
    shadowRadius: 30,
    elevation: 18,
  },
  foilClip: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 15,
    overflow: "hidden",
  },
  foil: {
    position: "absolute",
    width: CARD.w * 2.2,
    height: CARD.h * 1.6,
    left: -CARD.w * 0.6,
    top: -CARD.h * 0.3,
    opacity: 0.6,
  },
  face: { flex: 1, borderRadius: 10, overflow: "hidden", backgroundColor: roles.surface },
  backFace: { padding: 18 },
  banner: { height: 128 },
  pfp: {
    position: "absolute",
    top: 84,
    left: 18,
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#ffb547",
    borderWidth: 5,
    borderColor: roles.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  pfpText: { fontFamily: fonts.display, fontSize: 32, color: "#0b0b0e" },
  pfpDot: {
    position: "absolute",
    right: -2,
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: roles.presence,
    borderWidth: 4,
    borderColor: roles.surface,
  },
  body: { paddingHorizontal: 18, paddingTop: 54 },
  name: { fontFamily: fonts.display, fontSize: 28, color: roles.text, letterSpacing: -0.8 },
  handle: { fontFamily: fonts.body, fontSize: 14, color: roles.textSoft, marginTop: 4 },
  now: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  nowText: { flex: 1, fontFamily: fonts.bold, fontSize: 14, lineHeight: 18, color: roles.text },
  section: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: roles.border,
  },
  sectionHead: { fontFamily: fonts.bold, fontSize: 12.5, color: roles.textSoft, marginBottom: 10 },
  badges: { flexDirection: "row", gap: 8 },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: fonts.display, fontSize: 15, color: "#0b0b0e" },
  people: { gap: 14, marginTop: 4 },
  person: { flexDirection: "row", alignItems: "center", gap: 12 },
  ring: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    borderColor: roles.presence,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.display, fontSize: 14, color: "#0b0b0e" },
  personName: { fontFamily: fonts.bold, fontSize: 15, color: roles.text },
  personNow: { fontFamily: fonts.body, fontSize: 13, color: roles.textSoft, marginTop: 2 },
  swatch: { height: 58, borderRadius: 12, overflow: "hidden" },
  tag: {
    position: "absolute",
    top: 15,
    right: 15,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(11,11,14,0.65)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.14)",
  },
  tagText: { fontFamily: fonts.bold, fontSize: 12.5, color: roles.textSoft },
});
