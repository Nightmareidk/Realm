import * as Haptics from "expo-haptics";
import type { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "./icon";
import type { IconName } from "./icon-paths";
import { useSession } from "./session";
import { Avatar } from "./social/avatar";
import { fonts, roles } from "./theme";

type BarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const TABS: Record<string, { label: string; icon: IconName; on: IconName }> = {
  home: { label: "Home", icon: "House", on: "HouseFill" },
  clips: { label: "Clips", icon: "PlayCircle", on: "PlayCircleFill" },
  explore: { label: "Explore", icon: "Compass", on: "CompassFill" },
  inbox: { label: "Inbox", icon: "ChatCircle", on: "ChatCircleFill" },
};

/**
 * The bottom bar (DESIGN.md Navigation): five labelled destinations, the current one on a raised
 * pill, You as your own picture. Labels always show; nothing is icon-only.
 */
export function TabBar({ state, navigation }: BarProps) {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  return (
    <View
      style={[s.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}
      accessibilityRole="tablist"
    >
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
            accessibilityLabel={tab?.label ?? "You"}
            style={s.item}
          >
            <View style={[s.pill, on && s.pillOn]}>
              {tab ? (
                <Icon
                  name={on ? tab.on : tab.icon}
                  size={24}
                  color={on ? roles.text : roles.textSoft}
                />
              ) : session.status === "signedIn" ? (
                <Avatar user={session.user} size={26} ring={on ? "self" : undefined} />
              ) : null}
            </View>
            <Text style={[s.label, on && s.labelOn]} allowFontScaling={false}>
              {tab?.label ?? "You"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: roles.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: roles.border,
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
  pillOn: { backgroundColor: roles.surfaceRaised },
  label: { fontFamily: fonts.bold, fontSize: 11.5, color: roles.textSoft },
  labelOn: { color: roles.text },
});
