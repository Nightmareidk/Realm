import type { SearchResults, UserSummary } from "@realm/contracts";
import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { alert } from "@/alert";
import { useApi } from "@/data";
import { Icon } from "@/icon";
import { ApiError, api } from "@/server";
import { PersonRow } from "@/social/person-row";
import { AppScreen, Empty, Loading, Problem, TopBar } from "@/social/screen";
import { type NativeTheme, useStyles, useTheme } from "@/theme";
import { Pill } from "@/ui";

export const CLOSE_GREEN = "#22c55e";

/**
 * Close Friends: who sees the Stories and Notes you share to them (with a green ring). Nobody is
 * told when you add or remove them.
 */
export default function CloseFriends() {
  const { t } = useTheme();
  const s = useStyles(make);
  const insets = useSafeAreaInsets();
  const list = useApi<{ items: UserSummary[] }>("/users/@me/close-friends");
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<UserSummary[]>([]);
  const items = list.data?.items ?? [];

  useEffect(() => {
    const q = query.trim();
    if (!q) return setFound([]);
    let live = true;
    const timer = setTimeout(() => {
      api<SearchResults>(`/search?q=${encodeURIComponent(q)}`)
        .then((r) => live && setFound(r.users.slice(0, 6)))
        .catch(() => {});
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);

  async function set(u: UserSummary, on: boolean) {
    try {
      await api(`/users/@me/close-friends/${u.username}`, { method: on ? "PUT" : "DELETE" });
      if (on) setQuery("");
      list.reload();
    } catch (err) {
      alert("Not changed", err instanceof ApiError ? err.message : "Try again.");
    }
  }

  return (
    <AppScreen>
      <TopBar title="Close Friends" />
      {list.error && !list.data ? (
        <Problem message={list.error} onRetry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : (
        <FlatList
          data={query.trim() ? found : items}
          keyExtractor={(u) => u.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListHeaderComponent={
            <View style={s.head}>
              <Text style={s.lead}>
                Share a Story or a Note to Close Friends and only these people see it, with a green
                ring.
              </Text>
              <View style={s.search}>
                <Icon name="MagnifyingGlass" size={18} color={t.colors.textSoft} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Add someone"
                  placeholderTextColor={t.colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Search people to add to Close Friends"
                  style={s.input}
                />
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const on = items.some((x) => x.id === item.id);
            return (
              <PersonRow
                user={item}
                line={`@${item.username}`}
                right={
                  <Pill
                    size="sm"
                    kind={on ? "ghost" : "action"}
                    label={on ? "Remove" : "Add"}
                    onPress={() => void set(item, !on)}
                  />
                }
              />
            );
          }}
          ListEmptyComponent={
            query.trim() ? null : (
              <Empty title="Nobody yet" line="Search for someone above to add them." />
            )
          }
        />
      )}
    </AppScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    head: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, gap: 12 },
    lead: {
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      lineHeight: 22 * t.textScale,
      color: t.colors.textSoft,
    },
    search: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      height: 44,
      paddingHorizontal: 14,
      borderRadius: 22,
      backgroundColor: t.colors.surfaceRaised,
    },
    input: {
      flex: 1,
      fontFamily: t.fonts.body,
      fontSize: 16 * t.textScale,
      color: t.colors.text,
    },
  });
