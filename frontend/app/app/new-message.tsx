import type { Channel, SearchResults, UserSummary } from "@realm/contracts";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Icon } from "@/icon";
import { ApiError, api } from "@/server";
import { useSession } from "@/session";
import { Avatar } from "@/social/avatar";
import { AppScreen, Empty, TopBar } from "@/social/screen";
import { fonts, type NativeTheme, useStyles, useTheme } from "@/theme";

/**
 * Start a conversation: search people by name or @username, tap one, and the chat opens (the one
 * you already have, if there is one). Their message settings and blocks still apply, and if they
 * say no, it says why.
 */
export default function NewMessage() {
  const { t } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const { accent } = useTheme();
  const { session } = useSession();
  const meId = session.status === "signedIn" ? session.user.id : null;
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<UserSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const latest = useRef("");

  // Search as you type, a moment after you stop.
  useEffect(() => {
    const term = q.trim();
    latest.current = term;
    if (!term) {
      setPeople([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const found = await api<SearchResults>(`/search?q=${encodeURIComponent(term)}`);
        if (latest.current !== term) return;
        setPeople(found.users.filter((u) => u.id !== meId));
        setProblem(null);
      } catch (err) {
        if (latest.current === term) {
          setProblem(err instanceof ApiError ? err.message : "Search didn't work. Try again.");
        }
      } finally {
        if (latest.current === term) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, meId]);

  async function open(u: UserSummary) {
    if (opening) return;
    setOpening(u.id);
    setProblem(null);
    try {
      const dm = await api<Channel>("/users/@me/channels", { body: { recipientIds: [u.id] } });
      router.replace({
        pathname: "/chat/[id]",
        params: { id: dm.id, title: u.displayName, kind: "dm" },
      });
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : "Couldn't start that chat. Try again.");
    } finally {
      setOpening(null);
    }
  }

  return (
    <AppScreen>
      <TopBar title="New message" />
      <View style={s.searchWrap}>
        <Icon name="MagnifyingGlass" size={20} color={t.colors.textSoft} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search people"
          placeholderTextColor={t.colors.textMuted}
          selectionColor={accent}
          cursorColor={accent}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={s.search}
          accessibilityLabel="Search people"
        />
        {searching ? <ActivityIndicator color={t.colors.textSoft} /> : null}
      </View>
      {problem ? (
        <Text style={s.problem} accessibilityLiveRegion="polite">
          {problem}
        </Text>
      ) : null}
      <FlatList
        data={people}
        keyExtractor={(u) => u.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable
            onPress={() => open(item)}
            disabled={Boolean(opening)}
            accessibilityRole="button"
            accessibilityLabel={`Message ${item.displayName}, @${item.username}`}
            style={({ pressed }) => [s.row, pressed && { backgroundColor: t.colors.surface }]}
          >
            <Avatar user={item} size={46} />
            <View style={s.fill}>
              <Text style={s.name} numberOfLines={1}>
                {item.displayName}
              </Text>
              <Text style={s.handle} numberOfLines={1}>
                @{item.username}
              </Text>
            </View>
            {opening === item.id ? (
              <ActivityIndicator color={t.colors.textSoft} />
            ) : (
              <Icon name="ChatCircle" size={22} color={t.colors.textSoft} />
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          q.trim() && !searching ? (
            <Empty title="Nobody found" line="Check the spelling, or try their @username." />
          ) : !q.trim() ? (
            <Text style={s.hint}>Type a name or @username to find someone.</Text>
          ) : null
        }
      />
    </AppScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      margin: 12,
      paddingHorizontal: 14,
      minHeight: 50,
      borderRadius: 25,
      borderWidth: 1.5,
      borderColor: t.colors.borderStrong,
      backgroundColor: t.colors.surfaceSunken,
    },
    search: { flex: 1, minHeight: 46, fontFamily: fonts.body, fontSize: 16, color: t.colors.text },
    problem: {
      fontFamily: fonts.body,
      fontSize: 14.5,
      lineHeight: 21,
      color: t.colors.danger,
      paddingHorizontal: 18,
      paddingBottom: 6,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      minHeight: 64,
    },
    name: { fontFamily: fonts.bold, fontSize: 15.5, color: t.colors.text },
    handle: { fontFamily: fonts.body, fontSize: 14, color: t.colors.textSoft, marginTop: 1 },
    hint: {
      fontFamily: fonts.body,
      fontSize: 15,
      color: t.colors.textSoft,
      paddingHorizontal: 18,
      paddingTop: 12,
    },
  });
