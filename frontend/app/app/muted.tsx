import type { UserSummary } from "@realm/contracts";
import { FlatList, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { alert } from "@/alert";
import { postsChanged, useApi } from "@/data";
import { ApiError, api } from "@/server";
import { PersonRow } from "@/social/person-row";
import { AppScreen, Empty, Loading, Problem, TopBar } from "@/social/screen";
import { type NativeTheme, useStyles } from "@/theme";
import { Pill } from "@/ui";

type Muted = { user: UserSummary; posts: boolean; stories: boolean };

/** People whose posts or Stories you've muted. They're never told; you still follow them. */
export default function MutedAccounts() {
  const s = useStyles(make);
  const insets = useSafeAreaInsets();
  const list = useApi<{ items: Muted[] }>("/users/@me/muted");

  async function unmute(m: Muted) {
    try {
      await api(`/users/${m.user.username}/mute`, {
        method: "PUT",
        body: { posts: false, stories: false },
      });
      list.reload();
      postsChanged();
    } catch (err) {
      alert("Still muted", err instanceof ApiError ? err.message : "Try again.");
    }
  }

  return (
    <AppScreen>
      <TopBar title="Muted accounts" />
      {list.error && !list.data ? (
        <Problem message={list.error} onRetry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : (
        <FlatList
          data={list.data.items}
          keyExtractor={(m) => m.user.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListHeaderComponent={
            list.data.items.length ? (
              <Text style={s.lead}>
                You still follow them. Their posts or Stories just stay out of your feed.
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <PersonRow
              user={item.user}
              line={
                item.posts && item.stories ? "Posts and Stories" : item.posts ? "Posts" : "Stories"
              }
              right={
                <Pill size="sm" kind="ghost" label="Unmute" onPress={() => void unmute(item)} />
              }
            />
          )}
          ListEmptyComponent={
            <Empty
              title="Nobody's muted"
              line="Mute someone from the menu on their profile. They won't know."
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
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      lineHeight: 22 * t.textScale,
      color: t.colors.textSoft,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 6,
    },
  });
