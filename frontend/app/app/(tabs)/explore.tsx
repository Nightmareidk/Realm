import type { DiscoverSpace, SearchResults, SpaceDetail } from "@realm/contracts";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi } from "@/data";
import { Icon } from "@/icon";
import { SoundsRow } from "@/music/sounds-row";
import { api } from "@/server";
import { PersonRow } from "@/social/person-row";
import { AppScreen, Loading } from "@/social/screen";
import { SpaceBadge } from "@/social/space-badge";
import { compact } from "@/social/time";
import { type NativeTheme, useStyles, useTheme } from "@/theme";

/**
 * Explore: search people and Spaces at the top (the magnifying glass, like Instagram); below it
 * your Spaces, public Spaces to discover, and Boards, which are on the way.
 */
export default function Explore() {
  const { t } = useTheme();
  const s = useStyles(make);
  const insets = useSafeAreaInsets();
  const { accent } = useTheme();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults(null);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        setResults(await api<SearchResults>(`/search?q=${encodeURIComponent(term)}`));
      } catch {
        setResults({ users: [], spaces: [] });
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <AppScreen>
      <View style={[s.head, { paddingTop: insets.top + 10 }]}>
        <Text style={s.title} accessibilityRole="header">
          Search
        </Text>
        <View style={s.search}>
          <Icon name="MagnifyingGlass" size={20} color={t.colors.textSoft} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search people and Spaces"
            placeholderTextColor={t.colors.textMuted}
            selectionColor={accent}
            cursorColor={accent}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={s.input}
            accessibilityLabel="Search people and Spaces"
          />
          {q ? (
            <Pressable
              onPress={() => setQ("")}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={10}
            >
              <Icon name="X" size={18} color={t.colors.textSoft} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {q.trim() ? <Results results={results} searching={searching} /> : <Browse />}
      </ScrollView>
    </AppScreen>
  );
}

function Results({ results, searching }: { results: SearchResults | null; searching: boolean }) {
  const s = useStyles(make);
  if (!results) return searching ? <Loading /> : null;
  if (!results.users.length && !results.spaces.length) {
    return (
      <Text style={s.none}>{searching ? "Searching…" : "No one and nothing by that name."}</Text>
    );
  }
  return (
    <>
      {results.users.length ? <Text style={s.heading}>People</Text> : null}
      {results.users.map((u) => (
        <PersonRow key={u.id} user={u} />
      ))}
      {results.spaces.length ? <Text style={s.heading}>Spaces</Text> : null}
      {results.spaces.map((sp) => (
        <SpaceRow
          key={sp.id}
          id={sp.id}
          name={sp.name}
          accent={sp.accent}
          line={`${compact(sp.memberCount)} members${sp.joined ? " · Joined" : ""}`}
        />
      ))}
    </>
  );
}

function Browse() {
  const { t } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const mine = useApi<{ spaces: SpaceDetail[] }>("/users/@me/communities");
  const discover = useApi<{ spaces: DiscoverSpace[] }>(
    "/discover/communities?sort=active&limit=12",
  );
  const others = discover.data?.spaces.filter((d) => !d.joined) ?? [];
  return (
    <>
      <Pressable
        onPress={() => router.push("/music")}
        accessibilityRole="link"
        accessibilityLabel="Music: play songs, Liked songs and your playlists"
        style={({ pressed }) => [s.music, pressed && { opacity: 0.85 }]}
      >
        <LinearGradient
          colors={[t.colors.accent, t.colors.lights[1] ?? t.colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Icon name="MusicNotesFill" size={30} color={t.colors.onAccent} />
        <View style={s.musicText}>
          <Text style={[s.musicTitle, { color: t.colors.onAccent }]}>Music</Text>
          <Text style={[s.musicLine, { color: t.colors.onAccent }]}>
            Play songs while you use Realm. Liked songs, playlists, moods.
          </Text>
        </View>
        <Icon name="CaretRight" size={20} color={t.colors.onAccent} />
      </Pressable>
      <SoundsRow />
      <Text style={s.heading}>Your Spaces</Text>
      {mine.data?.spaces.length ? (
        mine.data.spaces.map((sp) => (
          <SpaceRow
            key={sp.id}
            id={sp.slug}
            name={sp.name}
            accent={sp.accent}
            line={`${compact(sp.memberCount)} ${sp.memberCount === 1 ? "member" : "members"}`}
          />
        ))
      ) : mine.loading ? (
        <Loading />
      ) : (
        <Text style={s.none}>
          You're not in a Space yet. Open an invite from a friend, or join one below.
        </Text>
      )}

      {others.length ? <Text style={s.heading}>Spaces to discover</Text> : null}
      {others.map((d) => (
        <SpaceRow
          key={d.id}
          id={d.slug}
          name={d.name}
          accent={d.accent}
          line={`${compact(d.memberCount)} members${d.hereNow ? ` · ${d.hereNow} here now` : ""}`}
        />
      ))}

      <View style={s.boards}>
        <View style={s.boardsHead}>
          <Icon name="Article" size={22} color={t.colors.text} />
          <Text style={s.boardsTitle}>Boards</Text>
          <Text style={s.soon}>Coming soon</Text>
        </View>
        <Text style={s.boardsLine}>
          Discussion boards with upvotes and threads, inside Spaces and open to everyone here in
          Explore.
        </Text>
      </View>
    </>
  );
}

function SpaceRow({
  id,
  name,
  accent,
  line,
}: {
  id: string;
  name: string;
  accent: SpaceDetail["accent"];
  line: string;
}) {
  const { t } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/space/[id]", params: { id } })}
      accessibilityRole="link"
      accessibilityLabel={`${name}, ${line}`}
      style={s.spaceRow}
    >
      <SpaceBadge name={name} accent={accent} size={48} />
      <View style={s.fill}>
        <Text style={s.spaceName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={s.spaceLine} numberOfLines={1}>
          {line}
        </Text>
      </View>
      <Icon name="CaretRight" size={18} color={t.colors.textSoft} />
    </Pressable>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    head: {
      paddingHorizontal: 16,
      paddingBottom: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    title: {
      fontFamily: t.fonts.displayBold,
      fontSize: 28 * t.textScale,
      color: t.colors.text,
      letterSpacing: -0.5,
    },
    search: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 12,
      minHeight: 48,
      paddingHorizontal: 16,
      borderRadius: 999,
      backgroundColor: t.colors.surfaceSunken,
    },
    input: {
      flex: 1,
      minHeight: 46,
      fontFamily: t.fonts.body,
      fontSize: 16 * t.textScale,
      color: t.colors.text,
    },
    body: { paddingBottom: 40 },
    music: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      marginHorizontal: 16,
      marginTop: 14,
      padding: 16,
      borderRadius: t.radius.card,
      overflow: "hidden",
    },
    musicText: { flex: 1 },
    musicTitle: { fontFamily: t.fonts.displayBold, fontSize: 19 * t.textScale },
    musicLine: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      marginTop: 2,
      opacity: 0.9,
    },
    heading: {
      fontFamily: t.fonts.bold,
      fontSize: 16 * t.textScale,
      color: t.colors.text,
      paddingHorizontal: 16,
      paddingTop: 22,
      paddingBottom: 6,
    },
    none: {
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      lineHeight: 22 * t.textScale,
      color: t.colors.textSoft,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    spaceRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      minHeight: 64,
    },
    spaceName: { fontFamily: t.fonts.bold, fontSize: 15.5 * t.textScale, color: t.colors.text },
    spaceLine: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 1,
    },
    boards: {
      margin: 16,
      marginTop: 26,
      paddingTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    boardsHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    boardsTitle: {
      flex: 1,
      fontFamily: t.fonts.displayBold,
      fontSize: 19 * t.textScale,
      color: t.colors.text,
    },
    soon: {
      fontFamily: t.fonts.bold,
      fontSize: 12.5 * t.textScale,
      color: t.colors.textSoft,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      overflow: "hidden",
      backgroundColor: "rgba(11,11,14,0.65)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.14)",
    },
    boardsLine: {
      fontFamily: t.fonts.body,
      fontSize: 14.5 * t.textScale,
      lineHeight: 21 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 8,
    },
  });
