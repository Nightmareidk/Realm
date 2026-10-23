import * as Haptics from "expo-haptics";
import type { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "./icon";
import type { IconName } from "./icon-paths";
import { useWide } from "./layout";
import { NowBar } from "./music/now-bar";
import { useSession } from "./session";
import { Avatar } from "./social/avatar";
import { type NativeTheme, useStyles, useTheme } from "./theme";
import { useUnreadCount } from "./unread";

type BarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const TABS: Record<string, { label: string; icon: IconName; on: IconName }> = {
  home: { label: "Home", icon: "House", on: "HouseFill" },
  clips: { label: "Clips", icon: "PlayCircle", on: "PlayCircleFill" },
  explore: { label: "Search", icon: "MagnifyingGlass", on: "MagnifyingGlass" },
  inbox: { label: "Inbox", icon: "ChatCircle", on: "ChatCircleFill" },
};

/**
 * The bottom bar (DESIGN.md Navigation): five labelled destinations, the current one on a raised
 * pill, You as your own picture. Labels always show; nothing is icon-only.
 */
export function TabBar({ state, navigation }: BarProps) {
  const { t } = useTheme();
  const s = useStyles(make);
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const unread = useUnreadCount();
  const floating = t.style.tabBar === "floating";
  const wide = useWide();
  // On a computer the menu down the left (in the app's frame) stands in for the tabs.
  if (wide) return null;
  return (
    <View
      style={
        floating
          ? [s.floatWrap, { paddingBottom: Math.max(insets.bottom, 10) }]
          : [s.bar, { paddingBottom: Math.max(insets.bottom, 8) }]
      }
    >
      <NowBar />
      <View style={floating ? s.float : s.row} accessibilityRole="tablist">
        {state.routes.map((route, i) => {
          const on = state.index === i;
          const tab = TABS[route.name];
          const press = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!on && !event.defaultPrevented) {
              Haptics.selectionAsync();
              navigation.navigate(route.name);
            }
          };
          return (
            <Pressable
              key={route.key}
              onPress={press}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={
                route.name === "inbox" && unread ? `Inbox, ${unread} unread` : (tab?.label ?? "You")
              }
              style={s.item}
            >
              <View style={[s.pill, on && s.pillOn]}>
                {tab ? (
                  <Icon
                    name={on ? tab.on : tab.icon}
                    size={24}
                    color={on ? t.colors.text : t.colors.textSoft}
                  />
                ) : session.status === "signedIn" ? (
                  <Avatar user={session.user} size={26} ring={on ? "self" : undefined} />
                ) : null}
                {route.name === "inbox" && unread ? (
                  <View style={[s.badge, { backgroundColor: BADGE_RED }]} pointerEvents="none">
                    <Text style={[s.badgeText, { color: "#ffffff" }]} allowFontScaling={false}>
                      {unread > 9 ? "9+" : unread}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={[s.label, on && s.labelOn]} allowFontScaling={false}>
                {tab?.label ?? "You"}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Unread is red everywhere people expect it (Instagram, WhatsApp), whatever the theme. */
const BADGE_RED = "#ff3040";

const make = (t: NativeTheme) =>
  StyleSheet.create({
    row: { flexDirection: "row", flex: 1 },
    // Now Playing: the bar floats as a rounded pill above the ground.
    floatWrap: { backgroundColor: t.colors.bg, paddingHorizontal: 14, paddingTop: 6 },
    float: {
      flexDirection: "row",
      borderRadius: 30,
      paddingVertical: 6,
      backgroundColor: t.colors.surfaceRaised,
      shadowColor: "#000000",
      shadowOpacity: 0.35,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
    },
    bar: {
      backgroundColor: t.colors.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
      paddingTop: 6,
    },
    item: { flex: 1, alignItems: "center", gap: 3, minHeight: 52 },
    pill: {
      width: 58,
      height: 32,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
    },
    pillOn: { backgroundColor: t.colors.surfaceRaised },
    badge: {
      position: "absolute",
      top: -2,
      right: 8,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: t.colors.bg,
    },
    badgeText: { fontFamily: t.fonts.bold, fontSize: 10.5 * t.textScale },
    label: { fontFamily: t.fonts.bold, fontSize: 11.5 * t.textScale, color: t.colors.textSoft },
    labelOn: { color: t.colors.text },
  });
