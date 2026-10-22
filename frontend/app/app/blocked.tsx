import type { SafetyLists, UserSummary } from "@realm/contracts";
import { FlatList, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { postsChanged, useApi } from "@/data";
import { ApiError, api } from "@/server";
import { useSheet } from "@/sheet";
import { PersonRow } from "@/social/person-row";
import { AppScreen, Empty, Loading, Problem, TopBar } from "@/social/screen";
import { fonts, type NativeTheme, useStyles } from "@/theme";
import { Pill } from "@/ui";

/** The people you've blocked, and the way to unblock them. */
export default function Blocked() {
  const s = useStyles(make);
  const insets = useSafeAreaInsets();
  const sheet = useSheet();
  const lists = useApi<SafetyLists>("/users/@me/safety");
  const blocked = lists.data?.blocked ?? [];

  function unblock(user: UserSummary) {
    sheet({
      title: `Unblock ${user.displayName}?`,
      line: "They'll be able to find your profile, see your public posts and message you again. You won't follow each other again unless you both choose to.",
      actions: [
        {
          label: `Unblock @${user.username}`,
          onPress: async () => {
            try {
              await api(`/users/@me/blocks/${user.id}`, { method: "DELETE" });
              if (lists.data) {
                lists.setData({ ...lists.data, blocked: blocked.filter((b) => b.id !== user.id) });
              }
              postsChanged();
            } catch (err) {
              sheet({
                title: "Still blocked",
                line: err instanceof ApiError ? err.message : "Something went wrong. Try again.",
                actions: [],
              });
            }
          },
        },
      ],
    });
  }

  return (
    <AppScreen>
      <TopBar title="Blocked accounts" />
      {lists.error && !lists.data ? (
        <Problem message={lists.error} onRetry={lists.reload} />
      ) : !lists.data ? (
        <Loading />
      ) : (
        <FlatList
          data={blocked}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListHeaderComponent={
            blocked.length ? (
              <Text style={s.lead}>
                They can't see your profile or message you, and aren't told.
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <PersonRow
              user={item}
              linked={false}
              right={<Pill size="md" kind="ghost" label="Unblock" onPress={() => unblock(item)} />}
            />
          )}
          ListEmptyComponent={
            <Empty
              title="Nobody's blocked"
              line="Block someone from their profile or from the menu on anything they post."
            />
          }
        />
      )}
    </AppScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    lead: {
      fontFamily: fonts.body,
      fontSize: 15,
      lineHeight: 22,
      color: t.colors.textSoft,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 6,
    },
  });
