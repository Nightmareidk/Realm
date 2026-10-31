import { Limits, type NoteList, type Sound } from "@realm/contracts";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { alert } from "@/alert";
import { useApi } from "@/data";
import { Icon } from "@/icon";
import { leave } from "@/leave";
import { playSound } from "@/music/player";
import { ApiError, api } from "@/server";
import { AppScreen, TopBar } from "@/social/screen";
import { type NativeTheme, useStyles, useTheme } from "@/theme";
import { Pill } from "@/ui";

/**
 * Write your note: up to 60 characters and a song if you like, for followers you follow back
 * or only Close Friends. It's gone after a day.
 */
export default function NoteEditor() {
  const { t, accent } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const list = useApi<NoteList>("/notes");
  const mine = list.data?.mine ?? null;
  const [text, setText] = useState("");
  const [close, setClose] = useState(false);
  const [song, setSong] = useState<Sound | null>(null);
  const [keepSong, setKeepSong] = useState(true);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Sound[]>([]);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!mine) return;
    setText(mine.text);
    setClose(mine.audience === "close_friends");
  }, [mine]);

  useEffect(() => {
    const q = query.trim();
    if (!q) return setFound([]);
    let live = true;
    const timer = setTimeout(() => {
      api<{ items: Sound[] }>(`/sounds?q=${encodeURIComponent(q)}`)
        .then((r) => live && setFound(r.items.slice(0, 5)))
        .catch(() => {});
    }, 350);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);

  const soundId = song?.id ?? (keepSong ? mine?.sound?.id : undefined);

  async function share() {
    if (pending) return;
    if (!text.trim() && !soundId) {
      alert("Nothing to share", "Write something or pick a song.");
      return;
    }
    setPending(true);
    try {
      await api("/notes/@me", {
        method: "PUT",
        body: {
          text: text.trim(),
          audience: close ? "close_friends" : "followers",
          ...(soundId ? { soundId } : {}),
        },
      });
      leave(router);
    } catch (err) {
      setPending(false);
      alert("Not shared", err instanceof ApiError ? err.message : "Try again.");
    }
  }

  async function remove() {
    await api("/notes/@me", { method: "DELETE" }).catch(() => {});
    leave(router);
  }

  const shownSong = song ?? (keepSong ? mine?.sound : null);

  return (
    <AppScreen>
      <TopBar
        title={mine ? "Your note" : "New note"}
        right={
          <Pill size="md" label="Share" pending={pending} pendingLabel="Sharing" onPress={share} />
        }
      />
      <KeyboardAvoidingView behavior="padding" style={s.fill}>
        <ScrollView
          contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.lead}>A thought or a song above your picture in Messages, for a day.</Text>
          <View style={s.inputWrap}>
            <TextInput
              value={text}
              onChangeText={(v) => setText(v.slice(0, Limits.note.max))}
              placeholder="Share a thought…"
              placeholderTextColor={t.colors.textMuted}
              selectionColor={accent}
              style={s.input}
              accessibilityLabel="Your note"
            />
            <Text style={s.count}>{Limits.note.max - text.length}</Text>
          </View>

          <Text style={s.label}>Song</Text>
          {shownSong ? (
            <View style={s.song}>
              <Icon name="MusicNotesFill" size={18} color={t.colors.text} />
              <Text style={s.songText} numberOfLines={1}>
                {shownSong.title} · {shownSong.artist}
              </Text>
              <Pressable
                onPress={() => {
                  setSong(null);
                  setKeepSong(false);
                }}
                accessibilityRole="button"
                accessibilityLabel="Remove the song"
                hitSlop={8}
              >
                <Icon name="X" size={18} color={t.colors.textSoft} />
              </Pressable>
            </View>
          ) : null}
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search songs"
            placeholderTextColor={t.colors.textMuted}
            selectionColor={accent}
            style={s.search}
            accessibilityLabel="Search songs"
          />
          {found.map((x) => (
            <Pressable
              key={x.id}
              onPress={() => {
                setSong(x);
                setQuery("");
                void playSound(x, 0, 15_000, `note-pick:${x.id}`, "the note maker");
              }}
              accessibilityRole="button"
              style={({ pressed }) => [s.result, pressed && { opacity: 0.7 }]}
            >
              <Text style={s.songText} numberOfLines={1}>
                {x.title}
              </Text>
              <Text style={s.artist} numberOfLines={1}>
                {x.artist}
              </Text>
            </Pressable>
          ))}

          <Pressable
            onPress={() => setClose(!close)}
            accessibilityRole="switch"
            accessibilityState={{ checked: close }}
            style={[s.audience, close && s.audienceClose]}
          >
            <Icon
              name={close ? "StarFill" : "Star"}
              size={18}
              color={close ? "#04150a" : t.colors.text}
            />
            <Text style={[s.audienceText, close && { color: "#04150a" }]}>
              {close ? "Close Friends only" : "Followers you follow back"}
            </Text>
          </Pressable>

          {mine ? <Pill kind="quiet" label="Delete note" onPress={remove} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    body: { padding: 20, gap: 14 },
    lead: {
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      lineHeight: 22 * t.textScale,
      color: t.colors.textSoft,
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 52,
      paddingHorizontal: 16,
      borderRadius: 26,
      backgroundColor: t.colors.surfaceRaised,
    },
    input: {
      flex: 1,
      fontFamily: t.fonts.body,
      fontSize: 17 * t.textScale,
      color: t.colors.text,
    },
    count: { fontFamily: t.fonts.body, fontSize: 13 * t.textScale, color: t.colors.textSoft },
    label: {
      fontFamily: t.fonts.bold,
      fontSize: 15 * t.textScale,
      color: t.colors.text,
      marginTop: 6,
    },
    song: { flexDirection: "row", alignItems: "center", gap: 8 },
    songText: {
      flex: 1,
      fontFamily: t.fonts.bold,
      fontSize: 15 * t.textScale,
      color: t.colors.text,
    },
    artist: { fontFamily: t.fonts.body, fontSize: 13 * t.textScale, color: t.colors.textSoft },
    search: {
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: 22,
      backgroundColor: t.colors.surfaceRaised,
      fontFamily: t.fonts.body,
      fontSize: 16 * t.textScale,
      color: t.colors.text,
    },
    result: { paddingVertical: 8, paddingHorizontal: 4 },
    audience: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 8,
      minHeight: 44,
      paddingHorizontal: 16,
      borderRadius: 22,
      backgroundColor: t.colors.surfaceRaised,
      marginTop: 8,
    },
    audienceClose: { backgroundColor: "#22c55e" },
    audienceText: { fontFamily: t.fonts.bold, fontSize: 15 * t.textScale, color: t.colors.text },
  });
