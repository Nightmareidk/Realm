import { MOODS, type MusicHome, type Sound, type SoundList } from "@realm/contracts";
import { useRouter } from "expo-router";
import { type ReactNode, useEffect, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useApi } from "@/data";
import { Icon } from "@/icon";
import { NowBar } from "@/music/now-bar";
import { playList, useNowPlaying } from "@/music/player";
import { CoverArt, SongRow, songMenu } from "@/music/ui";
import { api } from "@/server";
import { useSheet } from "@/sheet";
import { AppScreen, Loading, Problem, TopBar } from "@/social/screen";
import { type NativeTheme, useStyles, useTheme } from "@/theme";

/** Mood tiles, each in its own colour, as music apps show genres. */
const MOOD_COLOURS = [
  "#ff6b8b",
  "#7c5cff",
  "#ff9f43",
  "#2ec4b6",
  "#e84393",
  "#3b9cff",
  "#f7b801",
  "#6ab04c",
  "#a29bfe",
  "#ff7675",
];

/**
 * Music: play songs in Realm like a music app, and keep using everything else while they play.
 * Search the free library, your Liked songs and playlists, what you played lately, moods to
 * browse, and what's popular. Songs keep playing in the Now Playing bar; tap it for the player.
 */
export default function Music() {
  const { t, accent } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const sheet = useSheet();
  const home = useApi<MusicHome>("/music/home");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Sound[] | null>(null);
  const [searching, setSearching] = useState(false);
  const query = q.trim();

  useEffect(() => {
    if (!query) {
      setFound(null);
      return;
    }
    let live = true;
    setSearching(true);
    const wait = setTimeout(() => {
      api<SoundList>(`/sounds?q=${encodeURIComponent(query.slice(0, 60))}`)
        .then((r) => live && setFound(r.items))
        .catch(() => live && setFound([]))
        .finally(() => live && setSearching(false));
    }, 350);
    return () => {
      live = false;
      clearTimeout(wait);
    };
  }, [query]);

  const more = (sound: Sound) => songMenu(sheet, router, sound, { liked: sound.liked ?? false });

  return (
    <AppScreen>
      <TopBar
        title="Music"
        right={
          <Pressable
            onPress={() => router.push("/music/new")}
            accessibilityRole="button"
            accessibilityLabel="New playlist"
            style={s.headBtn}
          >
            <Icon name="Plus" size={24} color={t.colors.text} />
          </Pressable>
        }
      />
      <View style={s.search}>
        <Icon name="MagnifyingGlass" size={20} color={t.colors.textSoft} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Songs, artists, moods"
          placeholderTextColor={t.colors.textMuted}
          selectionColor={accent}
          cursorColor={accent}
          returnKeyType="search"
          style={s.searchInput}
          accessibilityLabel="Search music"
        />
        {q ? (
          <Pressable
            onPress={() => setQ("")}
            accessibilityRole="button"
            accessibilityLabel="Clear"
            hitSlop={8}
          >
            <Icon name="X" size={18} color={t.colors.textSoft} />
          </Pressable>
        ) : null}
      </View>

      {found !== null || searching ? (
        <FlatList
          data={found ?? []}
          keyExtractor={(x) => x.id}
          renderItem={({ item, index }) => (
            <SongRow
              sound={item}
              onPress={() => playList(found ?? [], index, `"${query}"`)}
              onMore={() => more(item)}
            />
          )}
          ListEmptyComponent={
            <Text style={s.note}>
              {searching ? "Looking…" : `Nothing for "${query}". Try a mood, like "chill".`}
            </Text>
          }
          contentContainerStyle={s.listPad}
        />
      ) : home.error && !home.data ? (
        <Problem message={home.error} onRetry={home.reload} />
      ) : !home.data ? (
        <Loading />
      ) : (
        <ScrollView contentContainerStyle={s.listPad}>
          {/* Your library: Liked songs and playlists, as tiles */}
          <View style={s.grid}>
            <Tile
              title="Liked songs"
              line={`${home.data.liked.count} ${home.data.liked.count === 1 ? "song" : "songs"}`}
              art={
                <View style={[s.likedArt, { backgroundColor: accent }]}>
                  <Icon name="HeartFill" size={22} color={t.colors.onAccent} />
                </View>
              }
              onPress={() => router.push("/music/liked")}
            />
            {home.data.playlists.slice(0, 5).map((p) => (
              <Tile
                key={p.id}
                title={p.name}
                line={`${p.count} ${p.count === 1 ? "song" : "songs"}`}
                art={<CoverArt urls={p.covers} size={52} seed={p.id} radius={8} />}
                onPress={() =>
                  router.push({ pathname: "/music/playlist/[id]", params: { id: p.id } })
                }
              />
            ))}
          </View>

          {home.data.recent.length ? (
            <Section title="Recently played">
              <Shelf songs={home.data.recent} from="Recently played" />
            </Section>
          ) : null}

          <Section title="Moods">
            <View style={s.moods}>
              {MOODS.map((m, i) => (
                <Pressable
                  key={m.id}
                  onPress={() =>
                    router.push({ pathname: "/music/mood/[id]", params: { id: m.id } })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`${m.label} music`}
                  style={({ pressed }) => [
                    s.mood,
                    { backgroundColor: MOOD_COLOURS[i % MOOD_COLOURS.length] },
                    pressed && s.pressed,
                  ]}
                >
                  <Text style={s.moodText}>{m.label}</Text>
                  <View style={s.moodNote}>
                    <Icon name="MusicNotesFill" size={30} color="rgba(255,255,255,0.35)" />
                  </View>
                </Pressable>
              ))}
            </View>
          </Section>

          {home.data.popular.length ? (
            <Section title="Popular on Realm">
              {home.data.popular.slice(0, 10).map((x, i) => (
                <SongRow
                  key={x.id}
                  sound={x}
                  onPress={() => playList(home.data?.popular ?? [], i, "Popular on Realm")}
                  onMore={() => more(x)}
                />
              ))}
            </Section>
          ) : null}
          <Text style={s.small}>
            Free music from Jamendo under Creative Commons, and sounds people on Realm made. Each
            song keeps its artist's credit.
          </Text>
        </ScrollView>
      )}
      <NowBar floating />
    </AppScreen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const s = useStyles(make);
  return (
    <View style={s.section}>
      <Text style={s.heading} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Tile({
  title,
  line,
  art,
  onPress,
}: {
  title: string;
  line: string;
  art: ReactNode;
  onPress: () => void;
}) {
  const s = useStyles(make);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${title}, ${line}`}
      style={({ pressed }) => [s.tile, pressed && s.pressed]}
    >
      {art}
      <View style={s.fill}>
        <Text style={s.tileTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={s.tileLine} numberOfLines={1}>
          {line}
        </Text>
      </View>
    </Pressable>
  );
}

/** Songs as big covers in a row; tap one to play it, then the rest. */
function Shelf({ songs, from }: { songs: Sound[]; from: string }) {
  const s = useStyles(make);
  const now = useNowPlaying();
  return (
    <FlatList
      data={songs}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(x) => x.id}
      contentContainerStyle={s.shelf}
      renderItem={({ item, index }) => (
        <Pressable
          onPress={() => playList(songs, index, from)}
          accessibilityRole="button"
          accessibilityLabel={`Play ${item.title} by ${item.artist}`}
          style={({ pressed }) => [s.shelfItem, pressed && s.pressed]}
        >
          <CoverArt urls={[item.coverUrl]} size={132} seed={item.id} />
          <Text
            style={[s.shelfTitle, now?.sound.id === item.id && s.playingText]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text style={s.tileLine} numberOfLines={1}>
            {item.artist}
          </Text>
        </Pressable>
      )}
    />
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    pressed: { opacity: 0.8 },
    headBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    search: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginHorizontal: 16,
      marginBottom: 6,
      paddingHorizontal: 14,
      minHeight: 46,
      borderRadius: t.radius.input,
      backgroundColor: t.colors.surfaceRaised,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      fontFamily: t.fonts.body,
      fontSize: 16 * t.textScale,
      color: t.colors.text,
      paddingVertical: 10,
    },
    listPad: { paddingBottom: 120 },
    note: {
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      color: t.colors.textSoft,
      padding: 20,
    },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingTop: 10 },
    tile: {
      width: "48.5%",
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingRight: 10,
      borderRadius: 10,
      overflow: "hidden",
      backgroundColor: t.colors.surfaceRaised,
    },
    likedArt: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
    tileTitle: { fontFamily: t.fonts.bold, fontSize: 14 * t.textScale, color: t.colors.text },
    tileLine: {
      fontFamily: t.fonts.body,
      fontSize: 12.5 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 1,
    },
    section: { marginTop: 24 },
    heading: {
      fontFamily: t.fonts.displayBold,
      fontSize: 20 * t.textScale,
      color: t.colors.heading,
      paddingHorizontal: 16,
      marginBottom: 10,
    },
    shelf: { paddingHorizontal: 16, gap: 14 },
    shelfItem: { width: 132 },
    shelfTitle: {
      fontFamily: t.fonts.bold,
      fontSize: 14 * t.textScale,
      color: t.colors.text,
      marginTop: 8,
    },
    playingText: { color: t.colors.accent },
    moods: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 16 },
    mood: { width: "48%", height: 72, borderRadius: 12, padding: 12, overflow: "hidden" },
    moodText: { fontFamily: t.fonts.displayBold, fontSize: 17 * t.textScale, color: "#ffffff" },
    moodNote: { position: "absolute", right: 8, bottom: 6, transform: [{ rotate: "18deg" }] },
    small: {
      fontFamily: t.fonts.body,
      fontSize: 12.5 * t.textScale,
      color: t.colors.textSoft,
      padding: 16,
      marginTop: 16,
      lineHeight: 18 * t.textScale,
    },
  });
