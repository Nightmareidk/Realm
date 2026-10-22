import type { SessionInfo } from "@realm/contracts";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi } from "@/data";
import { Icon } from "@/icon";
import { ApiError, api } from "@/server";
import { useSheet } from "@/sheet";
import { AppScreen, Loading, Problem, TopBar } from "@/social/screen";
import { agoLong } from "@/social/time";
import { fonts, type NativeTheme, useStyles, useTheme } from "@/theme";
import { Pill } from "@/ui";

const APP_PLATFORMS = new Set(["ios", "android"]);

/**
 * Where you're signed in: every phone and browser with a live session, newest use first. Sign
 * one out (a lost phone, a shared computer), or all of them but this one.
 */
export default function Devices() {
  const { t } = useTheme();
  const s = useStyles(make);
  const insets = useSafeAreaInsets();
  const sheet = useSheet();
  const list = useApi<{ sessions: SessionInfo[] }>("/auth/sessions");
  const sessions = list.data?.sessions ?? [];
  const others = sessions.filter((x) => !x.current);

  const failed = (err: unknown) =>
    sheet({
      title: "That didn't work",
      line: err instanceof ApiError ? err.message : "Something went wrong. Try again.",
      actions: [],
    });

  function signOut(x: SessionInfo) {
    sheet({
      title: `Sign out ${x.deviceName}?`,
      line: "Whoever has it will need your password to get back in.",
      actions: [
        {
          label: "Sign it out",
          icon: "SignOut",
          danger: true,
          onPress: async () => {
            try {
              await api(`/auth/sessions/${x.id}`, { method: "DELETE" });
              list.setData({ sessions: sessions.filter((y) => y.id !== x.id) });
            } catch (err) {
              failed(err);
            }
          },
        },
      ],
    });
  }

  function signOutOthers() {
    sheet({
      title: "Sign out everywhere else?",
      line: `${others.length === 1 ? "1 other device" : `${others.length} other devices`} will need your password to get back in. This phone stays signed in.`,
      actions: [
        {
          label: "Sign them out",
          icon: "SignOut",
          danger: true,
          onPress: async () => {
            try {
              await api("/auth/sessions", { method: "DELETE" });
              list.setData({ sessions: sessions.filter((y) => y.current) });
            } catch (err) {
              failed(err);
            }
          },
        },
      ],
    });
  }

  return (
    <AppScreen>
      <TopBar title="Where you're signed in" />
      {list.error && !list.data ? (
        <Problem message={list.error} onRetry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListHeaderComponent={
            <Text style={s.lead}>Don't recognise one? Sign it out, then change your password.</Text>
          }
          renderItem={({ item }) => (
            <View style={s.row}>
              <View style={s.mark}>
                <Icon
                  name={APP_PLATFORMS.has(item.platform) ? "DeviceMobile" : "Desktop"}
                  size={22}
                  color={t.colors.text}
                />
              </View>
              <View style={s.fill}>
                <Text style={s.name}>{item.deviceName}</Text>
                <Text style={s.line}>
                  {item.current
                    ? "This phone, right now"
                    : `Last used ${agoLong(item.lastActiveAt)}`}
                  {item.country ? ` · ${item.country}` : ""}
                </Text>
              </View>
              {item.current ? null : (
                <Pill size="md" kind="ghost" label="Sign out" onPress={() => signOut(item)} />
              )}
            </View>
          )}
          ListFooterComponent={
            others.length ? (
              <View style={s.foot}>
                <Pill kind="ghost" label="Sign out everywhere else" onPress={signOutOthers} />
              </View>
            ) : (
              <Text style={s.alone}>You're only signed in here.</Text>
            )
          }
        />
      )}
    </AppScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    lead: {
      fontFamily: fonts.body,
      fontSize: 15,
      lineHeight: 22,
      color: t.colors.textSoft,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 8,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      minHeight: 72,
    },
    mark: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.surfaceRaised,
    },
    name: { fontFamily: fonts.bold, fontSize: 15.5, color: t.colors.text },
    line: { fontFamily: fonts.body, fontSize: 13.5, color: t.colors.textSoft, marginTop: 2 },
    foot: { padding: 16, marginTop: 8 },
    alone: {
      fontFamily: fonts.body,
      fontSize: 15,
      color: t.colors.textSoft,
      paddingHorizontal: 16,
      paddingTop: 16,
    },
  });
