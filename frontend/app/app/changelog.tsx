import { CHANGELOG } from "@realm/contracts";
import * as Linking from "expo-linking";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/icon";
import { AppScreen, TopBar } from "@/social/screen";
import { type NativeTheme, useStyles, useTheme } from "@/theme";
import { APP_VERSION, changelogUrl } from "@/whats-new";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-11-20" as "20 November 2026", the same on every phone. */
function longDate(iso: string) {
  const [y, m, d] = iso.split("-").map((n) => Number.parseInt(n, 10));
  return `${d} ${MONTHS[(m ?? 1) - 1] ?? ""} ${y}`;
}

/** Settings › What's new: every version's highlights, newest first, and the full story online. */
export default function Changelog() {
  const { t, accent } = useTheme();
  const s = useStyles(make);
  const insets = useSafeAreaInsets();
  return (
    <AppScreen>
      <TopBar title="What's new" />
      <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 40 }]}>
        <Text style={s.lead}>
          You have Realm {APP_VERSION}. Here's what changed in each update. The website has the full
          details.
        </Text>
        {CHANGELOG.map((e, i) => (
          <View key={e.version} style={s.entry}>
            <View style={s.rail}>
              <View style={[s.node, i === 0 ? { backgroundColor: accent } : s.nodeOld]} />
              {i < CHANGELOG.length - 1 ? <View style={s.line} /> : null}
            </View>
            <View style={s.fill}>
              <View style={s.meta}>
                <Text style={[s.version, i === 0 && { color: accent }]}>Version {e.version}</Text>
                {e.version === APP_VERSION ? (
                  <View style={[s.now, { borderColor: accent }]}>
                    <Text style={[s.nowText, { color: accent }]}>You have this</Text>
                  </View>
                ) : null}
              </View>
              <Text style={s.date}>{longDate(e.date)}</Text>
              <Text style={s.title} accessibilityRole="header">
                {e.title}
              </Text>
              <View style={s.items}>
                {e.highlights.map((h) => (
                  <View key={h} style={s.item}>
                    <View style={s.bullet} />
                    <Text style={s.itemText}>{h}</Text>
                  </View>
                ))}
              </View>
              <Pressable
                onPress={() => void Linking.openURL(changelogUrl(e.version)).catch(() => {})}
                accessibilityRole="link"
                accessibilityLabel={`All the details of version ${e.version}, on the website`}
                hitSlop={6}
                style={({ pressed }) => [s.more, pressed && s.pressed]}
              >
                <Text style={s.moreText}>All the details</Text>
                <Icon name="ArrowSquareOut" size={15} color={t.colors.text} />
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </AppScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    body: { padding: 16 },
    lead: {
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      lineHeight: 22 * t.textScale,
      color: t.colors.textSoft,
      marginBottom: 22,
    },
    entry: { flexDirection: "row", gap: 14 },
    rail: { width: 14, alignItems: "center" },
    node: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
    nodeOld: { borderWidth: 2, borderColor: t.colors.borderStrong },
    line: { flex: 1, width: 2, marginVertical: 6, backgroundColor: t.colors.border },
    fill: { flex: 1, paddingBottom: 28 },
    meta: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    version: { fontFamily: t.fonts.bold, fontSize: 14 * t.textScale, color: t.colors.text },
    now: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
    nowText: { fontFamily: t.fonts.bold, fontSize: 12 * t.textScale },
    date: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 2,
    },
    title: {
      fontFamily: t.fonts.displayBold,
      fontSize: 21 * t.textScale,
      lineHeight: 26 * t.textScale,
      color: t.colors.text,
      marginTop: 8,
    },
    items: { gap: 10, marginTop: 12 },
    item: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
    bullet: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginTop: 8 * t.textScale,
      backgroundColor: t.colors.textSoft,
    },
    itemText: {
      flex: 1,
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      lineHeight: 22 * t.textScale,
      color: t.colors.text,
    },
    more: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      minHeight: 44,
      marginTop: 6,
    },
    pressed: { opacity: 0.6 },
    moreText: {
      fontFamily: t.fonts.bold,
      fontSize: 15 * t.textScale,
      color: t.colors.text,
      textDecorationLine: "underline",
    },
  });
