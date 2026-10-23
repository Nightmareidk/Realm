import { usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "./icon";
import type { IconName } from "./icon-paths";
import { RAIL } from "./layout";
import { NowBar } from "./music/now-bar";
import { useSession } from "./session";
import { useSheet } from "./sheet";
import { Avatar } from "./social/avatar";
import { type NativeTheme, useStyles, useTheme } from "./theme";
import { Wordmark } from "./ui";
import { useRequestCount, useUnreadCount } from "./unread";

const TABS: Record<string, { label: string; icon: IconName; on: IconName }> = {
  home: { label: "Home", icon: "House", on: "HouseFill" },
  clips: { label: "Clips", icon: "PlayCircle", on: "PlayCircleFill" },
  explore: { label: "Search", icon: "MagnifyingGlass", on: "MagnifyingGlass" },
  inbox: { label: "Messages", icon: "ChatCircle", on: "ChatCircleFill" },
};

/**
 * The menu down the left on a computer (the tabs, once there's room): Realm's mark, the places,
 * Music, Activity and Create, and you at the bottom. The song playing floats over the page.
 */
export function Rail() {
  const { t } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const sheet = useSheet();
  const { session } = useSession();
  const unread = useUnreadCount() + useRequestCount();
  const path = usePathname();
  const at = (p: string) => path === p || path.startsWith(`${p}/`);

  const row = (
    key: string,
    label: string,
    icon: IconName | null,
    on: boolean,
    press: () => void,
    badge = 0,
  ) => (
    <Pressable
      key={key}
      onPress={press}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={badge ? `${label}, ${badge} new` : label}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        s.row,
        (hovered || pressed) && s.rowHover,
        on && s.rowOn,
      ]}
    >
      <View>
        {icon ? (
          <Icon name={icon} size={25} color={t.colors.text} />
        ) : session.status === "signedIn" ? (
          <Avatar user={session.user} size={26} ring={on ? "self" : undefined} />
        ) : null}
        {badge ? (
          <View style={s.badge}>
            <Text style={s.badgeText}>{badge > 9 ? "9+" : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[s.label, on && s.labelOn]}>{label}</Text>
    </Pressable>
  );

  const create = () =>
    sheet({
      title: "Create",
      actions: (["post", "story", "clip"] as const).map((mode) => ({
        label: mode === "post" ? "Post" : mode === "story" ? "Story" : "Clip",
        icon: (mode === "post"
          ? "GridFour"
          : mode === "story"
            ? "Camera"
            : "PlayCircle") as IconName,
        onPress: () => router.push({ pathname: "/create", params: { mode } }),
      })),
    });

  return (
    <>
      <View style={s.rail} accessibilityRole="tablist">
        <View style={s.mark}>
          <Wordmark />
        </View>
        {(["home", "clips", "explore", "inbox"] as const).map((name) => {
          const tab = TABS[name];
          const on = at(`/${name}`);
          return row(
            name,
            tab?.label ?? name,
            tab ? (on ? tab.on : tab.icon) : "House",
            on,
            () => router.navigate(`/${name}`),
            name === "inbox" ? unread : 0,
          );
        })}
        {row("music", "Music", at("/music") ? "MusicNotesFill" : "MusicNotes", at("/music"), () =>
          router.navigate("/music"),
        )}
        {row("activity", "Activity", at("/activity") ? "HeartFill" : "Heart", at("/activity"), () =>
          router.navigate("/activity"),
        )}
        {row("create", "Create", "PlusSquare", false, create)}
        <View style={s.grow} />
        {row("you", "Profile", null, at("/you"), () => router.navigate("/you"))}
        {row("settings", "Settings", "Gear", at("/settings"), () => router.navigate("/settings"))}
      </View>
      {/* The song playing floats over the page, centred under the content. */}
      <View style={s.now} pointerEvents="box-none">
        <View style={s.nowInner}>
          <NowBar />
        </View>
      </View>
    </>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    rail: {
      width: RAIL,
      height: "100%",
      paddingHorizontal: 12,
      paddingVertical: 22,
      gap: 4,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: t.colors.border,
      backgroundColor: t.colors.bg,
    },
    mark: { paddingHorizontal: 12, paddingBottom: 22 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      minHeight: 50,
      paddingHorizontal: 12,
      borderRadius: 12,
    },
    rowHover: { backgroundColor: t.colors.surface },
    rowOn: { backgroundColor: t.colors.surfaceRaised },
    label: { fontFamily: t.fonts.body, fontSize: 16 * t.textScale, color: t.colors.text },
    labelOn: { fontFamily: t.fonts.bold },
    grow: { flex: 1 },
    badge: {
      position: "absolute",
      top: -6,
      right: -9,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#ff3040",
      borderWidth: 2,
      borderColor: t.colors.bg,
    },
    badgeText: { fontFamily: t.fonts.bold, fontSize: 10.5 * t.textScale, color: "#ffffff" },
    // Fixed to the window (a browser), so it floats over whichever page is open.
    now: {
      position: "fixed" as "absolute",
      left: RAIL,
      right: 0,
      bottom: 18,
      alignItems: "center",
    },
    nowInner: { width: "100%", maxWidth: 560, paddingHorizontal: 16 },
  });
