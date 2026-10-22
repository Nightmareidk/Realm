import type { Sound, SoundList, SoundPick } from "@realm/contracts";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  type GestureResponderEvent,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../icon";
import { ApiError, api, mediaSource, resolveUrl, upload } from "../server";
import { CLIP_MAX_SECONDS } from "../shrink";
import { type NativeTheme, useStyles, useTheme } from "../theme";
import { Pill } from "../ui";
import { clock, credit, playSound, stopSound, usePlaying } from "./player";

/** A picked sound and the part of it that plays. */
export interface Picked {
  sound: Sound;
  startMs: number;
  durationMs: number;
}
export const toPick = (p: Picked): SoundPick => ({
  soundId: p.sound.id,
  startMs: p.startMs,
  durationMs: p.durationMs,
});

type Tab = "popular" | "mine";
const LENGTHS = [15_000, 30_000, 60_000] as const;

/**
 * Add music: search the free library (Creative Commons music from Jamendo) or pick from your
 * own sounds, listen, then choose the part that plays. It opens over whatever you're making.
 */
export function MusicPicker({
  visible,
  onClose,
  onPick,
  maxMs = 30_000,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (p: Picked) => void;
  /** The longest part this can use (a Story plays up to 15 seconds of a song). */
  maxMs?: number;
}) {
  const s = useStyles(make);
  const insets = useSafeAreaInsets();
  const [chosen, setChosen] = useState<Sound | null>(null);

  const close = useCallback(() => {
    stopSound();
    setChosen(null);
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => (chosen ? setChosen(null) : close())}
      statusBarTranslucent
    >
      <View style={[s.root, { paddingTop: insets.top + 4, paddingBottom: insets.bottom }]}>
        {chosen ? (
          <PartChooser
            sound={chosen}
            maxMs={maxMs}
            onBack={() => {
              stopSound();
              setChosen(null);
            }}
            onUse={(p) => {
              stopSound();
              setChosen(null);
              onPick(p);
            }}
          />
        ) : (
          <Browse onClose={close} onChoose={setChosen} />
        )}
      </View>
    </Modal>
  );
}

function Browse({ onClose, onChoose }: { onClose: () => void; onChoose: (s: Sound) => void }) {
  const { t, accent } = useTheme();
  const s = useStyles(make);
  const [tab, setTab] = useState<Tab>("popular");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Sound[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [reload, setReload] = useState(0);
  const query = q.trim();

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reload` is how "Try again" loads it again.
  useEffect(() => {
    let live = true;
    const path =
      tab === "mine"
        ? "/sounds/mine"
        : query
          ? `/sounds?q=${encodeURIComponent(query.slice(0, 60))}`
          : "/sounds/trending";
    setLoading(true);
    setSearching(false);
    let wait: ReturnType<typeof setTimeout>;
    // A new search can take the library a few seconds: it answers with what it has and says it's
    // still looking, so ask again (a few times) until the rest is there.
    const ask = (tries: number) =>
      api<SoundList>(path)
        .then((r) => {
          if (!live) return;
          setItems(r.items);
          setError(null);
          const more = Boolean(r.searching) && tries < 4;
          setSearching(more);
          if (more) wait = setTimeout(() => ask(tries + 1), 2500);
        })
        .catch((err) => {
          if (!live) return;
          setSearching(false);
          setError(err instanceof ApiError ? err.message : "Music didn't load. Try again.");
        })
        .finally(() => live && setLoading(false));
    // Typing waits a moment before searching, so each key isn't a search.
    wait = setTimeout(() => ask(0), tab === "popular" && query ? 350 : 0);
    return () => {
      live = false;
      clearTimeout(wait);
    };
  }, [tab, query, reload]);

  return (
    <>
      <View style={s.head}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          style={s.headBtn}
        >
          <Icon name="X" size={24} color={t.colors.text} />
        </Pressable>
        <Text style={s.headTitle} accessibilityRole="header">
          Add music
        </Text>
        <View style={s.headBtn} />
      </View>

      <View style={s.search}>
        <Icon name="MagnifyingGlass" size={20} color={t.colors.textSoft} />
        <TextInput
          value={q}
          onChangeText={(v) => {
            setQ(v);
            if (tab !== "popular") setTab("popular");
          }}
          placeholder="Search songs, artists, moods"
          placeholderTextColor={t.colors.textMuted}
          selectionColor={accent}
          cursorColor={accent}
          returnKeyType="search"
          autoCorrect={false}
          maxLength={60}
          style={s.searchInput}
          accessibilityLabel="Search music"
        />
        {q ? (
          <Pressable
            onPress={() => setQ("")}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={8}
          >
            <Icon name="X" size={18} color={t.colors.textSoft} />
          </Pressable>
        ) : null}
      </View>

      <View style={s.tabs} accessibilityRole="tablist">
        {(
          [
            ["popular", query ? "Results" : "Popular"],
            ["mine", "Your sounds"],
          ] as const
        ).map(([id, label]) => (
          <Pressable
            key={id}
            onPress={() => setTab(id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === id }}
            style={[s.tab, tab === id && s.tabOn]}
          >
            <Text style={[s.tabText, tab === id && s.tabTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.list} keyboardShouldPersistTaps="handled">
        {tab === "mine" ? <MakeSound onMade={() => setReload((n) => n + 1)} /> : null}
        {error ? (
          <View style={s.note}>
            <Text style={s.noteText}>{error}</Text>
            <Pill
              size="md"
              kind="ghost"
              label="Try again"
              onPress={() => setReload((n) => n + 1)}
            />
          </View>
        ) : items === null || ((loading || searching) && !items.length) ? (
          <View style={s.looking}>
            <ActivityIndicator color={t.colors.text} />
            {searching ? (
              <Text style={s.lookingText}>Looking through the free library…</Text>
            ) : null}
          </View>
        ) : items.length === 0 ? (
          <Text style={s.noteText}>
            {tab === "mine"
              ? "Sounds you make show up here. Anyone can use them, with your name on them."
              : `Nothing for "${query}". Try a mood, like "chill" or "happy".`}
          </Text>
        ) : (
          <>
            {items.map((it) => (
              <SoundRow key={it.id} sound={it} onChoose={() => onChoose(it)} />
            ))}
            {searching ? (
              <View style={s.lookingRow}>
                <ActivityIndicator color={t.colors.textSoft} size="small" />
                <Text style={s.lookingText}>Finding more songs…</Text>
              </View>
            ) : null}
          </>
        )}
        {tab === "popular" ? (
          <Text style={s.small}>
            Free music from Jamendo, shared under Creative Commons. Each song keeps its artist's
            credit on your post.
          </Text>
        ) : null}
      </ScrollView>
    </>
  );
}

function SoundRow({ sound, onChoose }: { sound: Sound; onChoose: () => void }) {
  const { t } = useTheme();
  const s = useStyles(make);
  const now = usePlaying();
  const key = `preview:${sound.id}`;
  const on = now === key;
  return (
    <View style={s.row}>
      <Pressable
        onPress={() => (on ? stopSound() : playSound(sound, 0, 30_000, key))}
        accessibilityRole="button"
        accessibilityLabel={on ? `Stop ${sound.title}` : `Listen to ${sound.title}`}
        style={s.cover}
      >
        <Cover sound={sound} size={54} />
        <View style={s.coverShade}>
          <Icon name={on ? "PauseFill" : "PlayFill"} size={20} color="#ffffff" />
        </View>
      </Pressable>
      <Pressable
        onPress={onChoose}
        accessibilityRole="button"
        accessibilityLabel={`Use ${sound.title} by ${sound.artist}`}
        style={({ pressed }) => [s.rowMain, pressed && s.pressed]}
      >
        <Text style={s.rowTitle} numberOfLines={1}>
          {sound.title}
        </Text>
        <Text style={s.rowLine} numberOfLines={1}>
          {sound.artist}
          {" · "}
          {clock(sound.durationMs)}
          {sound.kind === "original" ? " · Original sound" : ""}
          {sound.uses ? ` · ${sound.uses} ${sound.uses === 1 ? "use" : "uses"}` : ""}
        </Text>
      </Pressable>
      <Pressable
        onPress={onChoose}
        accessibilityRole="button"
        accessibilityLabel={`Choose ${sound.title}`}
        hitSlop={6}
        style={s.use}
      >
        <Icon name="CaretRight" size={20} color={t.colors.textSoft} />
      </Pressable>
    </View>
  );
}

/**
 * A song's cover. Many free tracks have none (or one that won't load): those get a tile lit in
 * the theme's own light colours, so a list of them still looks made, not missing.
 */
function Cover({ sound, size }: { sound: Sound; size: number }) {
  const { t } = useTheme();
  const s = useStyles(make);
  const url = sound.coverUrl;
  const [broken, setBroken] = useState(false);
  // Each song gets its own turn of the theme's lights, from its id.
  const turn = sound.id.charCodeAt(sound.id.length - 1) % 3;
  const lights = [...t.colors.lights.slice(turn), ...t.colors.lights.slice(0, turn)];
  return (
    <View style={[s.coverBox, { width: size, height: size }]}>
      <LinearGradient
        colors={[
          lights[0] ?? t.colors.accent,
          lights[1] ?? t.colors.accent,
          t.colors.surfaceRaised,
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, s.coverLit]}
      />
      <Icon name="Waveform" size={size * 0.42} color="rgba(255,255,255,0.85)" />
      {url && !broken ? (
        <Image
          source={url.startsWith("/") ? mediaSource(url) : { uri: resolveUrl(url) }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          recyclingKey={url}
          onError={() => setBroken(true)}
        />
      ) : null}
    </View>
  );
}

/** Make your own sound from a video's audio. Anyone can then use it, credited to you. */
function MakeSound({ onMade }: { onMade: () => void }) {
  const { t, accent } = useTheme();
  const s = useStyles(make);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pickVideo() {
    const title = name.trim();
    if (!title) {
      setError("Give your sound a name first.");
      return;
    }
    setError(null);
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      videoMaxDuration: CLIP_MAX_SECONDS,
    });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    if ((a.duration ?? 0) > CLIP_MAX_SECONDS * 1000 + 500) {
      setError(`Use a video up to ${CLIP_MAX_SECONDS} seconds long.`);
      return;
    }
    try {
      setStatus("Uploading");
      const mediaId = await upload({
        uri: a.uri,
        kind: "video",
        mimeType: a.mimeType ?? "video/mp4",
        durationMs: a.duration ?? undefined,
      });
      setStatus("Saving");
      await api<Sound>("/sounds", { body: { mediaId, title } });
      setName("");
      onMade();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't work. Try again.");
    } finally {
      setStatus(null);
    }
  }

  return (
    <View style={s.make}>
      <Text style={s.makeTitle}>Make your own sound</Text>
      <Text style={s.makeLine}>
        Pick a video and its sound becomes yours to use, with your name on it. Others can use it
        too.
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Name it, like “rainy window”"
        placeholderTextColor={t.colors.textMuted}
        selectionColor={accent}
        cursorColor={accent}
        maxLength={60}
        style={s.makeInput}
        accessibilityLabel="Sound name"
      />
      {error ? <Text style={s.error}>{error}</Text> : null}
      <Pill
        size="md"
        label="Pick a video"
        pending={Boolean(status)}
        pendingLabel={status ?? "Saving"}
        onPress={pickVideo}
      />
    </View>
  );
}

/** Bars for the part chooser: made from the sound's id, so a song always looks the same. */
function useShape(id: string, n: number) {
  return useMemo(() => {
    let h = 2166136261;
    for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
      const wave = 0.55 + 0.35 * Math.sin(i / 4.3) * Math.sin(i / 11.7);
      out.push(Math.max(0.16, Math.min(1, wave * (0.55 + (h % 1000) / 1600))));
    }
    return out;
  }, [id, n]);
}

const BAR_COUNT = 64;

/** Choose the part of the song: drag along it, pick how long, listen, use. */
function PartChooser({
  sound,
  maxMs,
  onBack,
  onUse,
}: {
  sound: Sound;
  maxMs: number;
  onBack: () => void;
  onUse: (p: Picked) => void;
}) {
  const { t } = useTheme();
  const s = useStyles(make);
  const total = Math.max(5_000, sound.durationMs || 30_000);
  const lengths = LENGTHS.filter((l) => l <= maxMs && l <= total);
  const [length, setLength] = useState<number>(lengths[0] ?? Math.min(total, maxMs));
  const [start, setStart] = useState(0);
  const [width, setWidth] = useState(1);
  const shape = useShape(sound.id, BAR_COUNT);
  const now = usePlaying();
  const key = `part:${sound.id}`;
  const on = now === key;
  const maxStart = Math.max(0, total - length);
  const startRef = useRef(start);
  startRef.current = start;

  // Moving the part plays it from its new start, once your finger lifts.
  const listen = useCallback(
    (at: number, len: number) => playSound(sound, at, len, key),
    [sound, key],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: it plays once, on opening.
  useEffect(() => {
    listen(0, length);
    return () => stopSound();
  }, []);

  const place = (e: GestureResponderEvent) => {
    const x = e.nativeEvent.locationX;
    const windowW = (length / total) * width;
    const at = ((x - windowW / 2) / width) * total;
    const snapped = Math.round(Math.max(0, Math.min(maxStart, at)) / 1000) * 1000;
    setStart(snapped);
  };

  const from = start / total;
  const span = length / total;
  const credited = credit(sound);

  return (
    <>
      <View style={s.head}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to music"
          hitSlop={8}
          style={s.headBtn}
        >
          <Icon name="CaretLeft" size={24} color={t.colors.text} />
        </Pressable>
        <Text style={s.headTitle} accessibilityRole="header">
          Choose the part
        </Text>
        <View style={s.headBtn} />
      </View>
      <ScrollView contentContainerStyle={s.part}>
        <Cover sound={sound} size={168} />
        <Text style={s.partTitle} numberOfLines={2}>
          {sound.title}
        </Text>
        <Text style={s.partArtist} numberOfLines={1}>
          {sound.artist}
        </Text>

        <View
          style={s.strip}
          onLayout={(e) => setWidth(Math.max(1, e.nativeEvent.layout.width))}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={place}
          onResponderMove={place}
          onResponderRelease={() => listen(startRef.current, length)}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Where the music starts"
          accessibilityValue={{ text: `From ${clock(start)} to ${clock(start + length)}` }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(e) => {
            const next = Math.max(
              0,
              Math.min(maxStart, start + (e.nativeEvent.actionName === "increment" ? 5000 : -5000)),
            );
            setStart(next);
            listen(next, length);
          }}
        >
          {/* The bars don't take touches, so a drag is measured along the whole strip. */}
          <View pointerEvents="none" style={s.bars}>
            {shape.map((v, i) => {
              const at = i / BAR_COUNT;
              const inside = at >= from && at < from + span;
              return (
                <View
                  // biome-ignore lint/suspicious/noArrayIndexKey: a fixed strip that never reorders
                  key={i}
                  style={[
                    s.bar,
                    { height: `${Math.round(v * 100)}%` },
                    inside ? s.barOn : s.barOff,
                  ]}
                />
              );
            })}
          </View>
          <View
            pointerEvents="none"
            style={[s.window, { left: `${from * 100}%`, width: `${span * 100}%` }]}
          />
        </View>
        <View style={s.times}>
          <Text style={s.time}>{clock(start)}</Text>
          <Text style={s.timeSoft}>Drag to choose</Text>
          <Text style={s.time}>{clock(start + length)}</Text>
        </View>

        {lengths.length > 1 ? (
          <View style={s.lengths} accessibilityRole="radiogroup">
            {lengths.map((l) => (
              <Pressable
                key={l}
                onPress={() => {
                  setLength(l);
                  const at = Math.min(start, Math.max(0, total - l));
                  setStart(at);
                  listen(at, l);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: length === l }}
                style={[s.length, length === l && s.lengthOn]}
              >
                <Text style={[s.lengthText, length === l && s.lengthTextOn]}>
                  {l / 1000} seconds
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={s.partActions}>
          <Pill
            size="md"
            kind="ghost"
            label={on ? "Stop" : "Listen"}
            onPress={() => (on ? stopSound() : listen(start, length))}
          />
          <Pill
            size="md"
            label="Use this part"
            onPress={() => onUse({ sound, startMs: start, durationMs: length })}
          />
        </View>

        {credited ? (
          <Pressable
            onPress={() => sound.sourceUrl && Linking.openURL(sound.sourceUrl).catch(() => {})}
            accessibilityRole="link"
            disabled={!sound.sourceUrl}
          >
            <Text style={s.small}>{credited}, from Jamendo. The credit shows with your post.</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </>
  );
}

/** Choice chips take the theme's button shape, like its buttons. */
export const chip = (t: NativeTheme) =>
  t.buttons.shape === "square" ? 6 : t.buttons.shape === "rounded" ? 14 : 999;

const make = (t: NativeTheme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.bg },
    pressed: { opacity: 0.7 },
    head: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 8,
      minHeight: 52,
    },
    headBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    headTitle: {
      fontFamily: t.fonts.displayBold,
      fontSize: 19 * t.textScale,
      color: t.colors.heading,
    },
    search: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginHorizontal: 16,
      marginTop: 4,
      paddingHorizontal: 14,
      minHeight: 48,
      borderRadius: t.radius.input,
      backgroundColor: t.colors.surfaceRaised,
      borderWidth: t.panels.border === "none" ? 0 : 1,
      borderColor: t.panels.border === "accent" ? t.colors.accent : t.colors.border,
    },
    searchInput: {
      flex: 1,
      fontFamily: t.fonts.body,
      fontSize: 16 * t.textScale,
      color: t.colors.text,
      paddingVertical: 10,
    },
    tabs: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginTop: 14, marginBottom: 6 },
    tab: {
      minHeight: 38,
      paddingHorizontal: 16,
      borderRadius: chip(t),
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: t.colors.border,
    },
    tabOn: { backgroundColor: t.colors.text, borderColor: t.colors.text },
    tabText: { fontFamily: t.fonts.bold, fontSize: 14.5 * t.textScale, color: t.colors.textSoft },
    tabTextOn: { color: t.colors.bg },
    list: { paddingHorizontal: 12, paddingBottom: 40, gap: 2 },
    looking: { alignItems: "center", gap: 12, marginTop: 40 },
    lookingRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10 },
    lookingText: { fontFamily: t.fonts.body, fontSize: 14 * t.textScale, color: t.colors.textSoft },
    note: { alignItems: "flex-start", gap: 12, padding: 8 },
    noteText: {
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      lineHeight: 22 * t.textScale,
      color: t.colors.textSoft,
      padding: 8,
    },
    small: {
      fontFamily: t.fonts.body,
      fontSize: 12.5 * t.textScale,
      lineHeight: 18 * t.textScale,
      color: t.colors.textSoft,
      padding: 8,
      marginTop: 12,
    },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
    cover: { borderRadius: t.radius.box, overflow: "hidden" },
    coverBox: {
      borderRadius: t.radius.box,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.surfaceRaised,
    },
    coverLit: { opacity: 0.55 },
    coverShade: {
      ...StyleSheet.absoluteFill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.32)",
    },
    rowMain: { flex: 1, minHeight: 54, justifyContent: "center" },
    rowTitle: { fontFamily: t.fonts.bold, fontSize: 16 * t.textScale, color: t.colors.text },
    rowLine: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 2,
    },
    use: { width: 40, height: 54, alignItems: "center", justifyContent: "center" },
    make: {
      gap: 10,
      padding: 14,
      marginTop: 6,
      marginBottom: 10,
      borderRadius: t.radius.card,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    makeTitle: {
      fontFamily: t.fonts.displayBold,
      fontSize: 17 * t.textScale,
      color: t.colors.heading,
    },
    makeLine: {
      fontFamily: t.fonts.body,
      fontSize: 14 * t.textScale,
      lineHeight: 20 * t.textScale,
      color: t.colors.textSoft,
    },
    makeInput: {
      minHeight: 46,
      borderRadius: t.radius.input,
      borderWidth: 1.5,
      borderColor: t.colors.borderStrong,
      paddingHorizontal: 12,
      fontFamily: t.fonts.body,
      fontSize: 15.5 * t.textScale,
      color: t.colors.text,
    },
    error: { fontFamily: t.fonts.bold, fontSize: 14 * t.textScale, color: t.colors.danger },
    part: { alignItems: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
    partTitle: {
      fontFamily: t.fonts.display,
      fontSize: 24 * t.textScale,
      color: t.colors.heading,
      textAlign: "center",
      marginTop: 18,
    },
    partArtist: {
      fontFamily: t.fonts.body,
      fontSize: 15.5 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 4,
    },
    strip: { alignSelf: "stretch", height: 72, marginTop: 28 },
    bars: { flex: 1, flexDirection: "row", alignItems: "center", gap: 2 },
    // The strip in the look's own hand: square-cut bars on a dashed stub (Wristband), fine
    // lines (Plain and clear), rounded lit bars (Now Playing).
    bar: {
      flex: 1,
      borderRadius: t.style.posts === "ticket" ? 0 : 2,
      marginHorizontal: t.style.posts === "thread" ? 0.5 : 0,
    },
    barOn: { backgroundColor: t.colors.accent },
    barOff: { backgroundColor: t.colors.borderStrong },
    window: {
      position: "absolute",
      top: -6,
      bottom: -6,
      borderRadius: t.style.posts === "ticket" ? 0 : t.radius.box,
      borderWidth: t.style.posts === "thread" ? 1.5 : 2,
      borderStyle: t.style.posts === "ticket" ? "dashed" : "solid",
      borderColor: t.colors.text,
    },
    times: {
      alignSelf: "stretch",
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 12,
    },
    time: { fontFamily: t.fonts.bold, fontSize: 14 * t.textScale, color: t.colors.text },
    timeSoft: { fontFamily: t.fonts.body, fontSize: 13.5 * t.textScale, color: t.colors.textSoft },
    lengths: { flexDirection: "row", gap: 8, marginTop: 22 },
    length: {
      minHeight: 40,
      paddingHorizontal: 16,
      borderRadius: chip(t),
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: t.colors.border,
    },
    lengthOn: { backgroundColor: t.colors.surfaceRaised, borderColor: t.colors.text },
    lengthText: {
      fontFamily: t.fonts.bold,
      fontSize: 14.5 * t.textScale,
      color: t.colors.textSoft,
    },
    lengthTextOn: { color: t.colors.text },
    partActions: { flexDirection: "row", gap: 10, marginTop: 26 },
  });
