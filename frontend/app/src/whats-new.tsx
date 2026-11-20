import { type ChangelogEntry, changelogAnchor, changesSince } from "@realm/contracts";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";
import { Icon } from "./icon";
import { remember } from "./remember";
import { webOrigin } from "./server";
import { useSession } from "./session";
import { motion, type NativeTheme, useStyles, useTheme } from "./theme";
import { tourDone, useTour } from "./tour";
import { Pill } from "./ui";

/** This build's version, from app.json ("0.2.0"). */
export const APP_VERSION = Constants.expoConfig?.version ?? "0.0.0";

/** The last version whose news this phone has shown (or skipped, on a first install). */
const SEEN_KEY = "realm.seen-version";

/** The website's changelog, at one version's part of it. */
export function changelogUrl(version?: string) {
  const web = webOrigin() ?? "https://tomyrealm.com";
  return `${web}/changelog${version ? `#${changelogAnchor(version)}` : ""}`;
}

// Checked once each time the app starts, not every time Home comes back into view.
let checked = false;

/**
 * Put on Home. The first time someone reaches it on this phone: the tour. After that, once per
 * update: what changed since the version they last opened. A brand-new install gets the tour,
 * never a list of changes it never saw.
 */
export function FirstRun() {
  const { session } = useSession();
  const tour = useTour();
  const [news, setNews] = useState<ChangelogEntry[]>([]);
  const userId = session.status === "signedIn" ? session.user.id : null;

  useFocusEffect(
    useCallback(() => {
      if (!userId || checked) return;
      checked = true;
      let gone = false;
      let ran = false;
      const timer = setTimeout(async () => {
        ran = true;
        const seen = await remember.get(SEEN_KEY);
        await remember.set(SEEN_KEY, APP_VERSION);
        if (gone) return;
        if (!(await tourDone(userId))) {
          if (!gone) tour.start();
          return;
        }
        // Shown once: the version is already marked as seen above.
        if (seen) setNews(changesSince(seen, APP_VERSION));
      }, 700);
      return () => {
        gone = true;
        clearTimeout(timer);
        // Left Home before the check ran: try again next time.
        if (!ran) checked = false;
      };
    }, [userId, tour]),
  );

  if (!news.length) return null;
  return <WhatsNewCard entries={news} onClose={() => setNews([])} />;
}

/** "What's new": the newest update's highlights, a way to read everything, and Got it. */
export function WhatsNewCard({
  entries,
  onClose,
}: {
  entries: ChangelogEntry[];
  onClose: () => void;
}) {
  const { t, accent } = useTheme();
  const s = useStyles(make);
  const newest = entries[0];
  if (!newest) return null;
  // Missed a few updates: their highlights together, newest first, at most eight lines.
  const lines = entries.flatMap((e) => e.highlights).slice(0, 8);
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.shade}>
        <Animated.View
          entering={FadeIn.duration(motion.slow).reduceMotion(ReduceMotion.System)}
          style={s.card}
          accessibilityViewIsModal
        >
          <View style={s.cardFill} pointerEvents="none" />
          <View style={s.badgeRow}>
            <View style={[s.badge, { backgroundColor: accent }]}>
              <Icon name="SparkleFill" size={14} color={t.colors.onAccent} />
              <Text style={[s.badgeText, { color: t.colors.onAccent }]}>What's new</Text>
            </View>
            <Text style={s.version}>Version {newest.version}</Text>
          </View>
          <Text style={s.title} accessibilityRole="header">
            {newest.title}
          </Text>
          <ScrollView style={s.list} contentContainerStyle={s.listInner}>
            {lines.map((line) => (
              <View key={line} style={s.item}>
                <View style={[s.bullet, { backgroundColor: accent }]} />
                <Text style={s.itemText}>{line}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={s.actions}>
            <Pill
              size="md"
              kind="ghost"
              label="See all the details"
              onPress={() => void Linking.openURL(changelogUrl(newest.version)).catch(() => {})}
            />
            <Pill size="md" label="Got it" onPress={onClose} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    shade: {
      flex: 1,
      backgroundColor: "rgba(3,3,6,0.72)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    card: {
      width: "100%",
      maxWidth: 420,
      maxHeight: "86%",
      borderRadius: 24,
      padding: 20,
      gap: 10,
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
      borderRadius: 23,
      backgroundColor: t.colors.surfaceRaised,
    },
    badgeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    badgeText: { fontFamily: t.fonts.bold, fontSize: 13 * t.textScale },
    version: { fontFamily: t.fonts.bold, fontSize: 13 * t.textScale, color: t.colors.textSoft },
    title: {
      fontFamily: t.fonts.displayBold,
      fontSize: 24 * t.textScale,
      lineHeight: 29 * t.textScale,
      color: t.colors.text,
      marginTop: 4,
    },
    list: { flexGrow: 0 },
    listInner: { gap: 12, paddingVertical: 6 },
    item: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
    bullet: { width: 7, height: 7, borderRadius: 4, marginTop: 8 * t.textScale },
    itemText: {
      flex: 1,
      fontFamily: t.fonts.body,
      fontSize: 15.5 * t.textScale,
      lineHeight: 22 * t.textScale,
      color: t.colors.text,
    },
    actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 6 },
  });
