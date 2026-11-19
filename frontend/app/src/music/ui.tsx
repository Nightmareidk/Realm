import type { Playlist, Sound } from "@realm/contracts";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import type { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { alert } from "../alert";
import { Icon } from "../icon";
import { ApiError, api, mediaSource, resolveUrl } from "../server";
import type { useSheet } from "../sheet";
import { type NativeTheme, useStyles, useTheme } from "../theme";
import { Bars } from "./chip";
import { clock, like, useLiked, useNowPlaying } from "./player";

type Router = ReturnType<typeof useRouter>;
type Sheet = ReturnType<typeof useSheet>;

export const coverSource = (url: string) =>
  url.startsWith("/") ? mediaSource(url) : { uri: resolveUrl(url) };

/**
 * A song's or playlist's art: one cover, or four in a square (a playlist). Without any, a tile
 * lit in the theme's own colours with a waveform, so it never looks missing.
 */
export function CoverArt({
  urls,
  size,
  radius,
  seed = "",
}: {
  urls: (string | null | undefined)[];
  size: number;
  radius?: number;
  seed?: string;
}) {
  const { t } = useTheme();
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const list = urls.filter((u): u is string => Boolean(u) && !broken.has(u as string));
  const r = radius ?? Math.min(12, t.radius.box);
  const turn = (seed.charCodeAt(seed.length - 1) || 0) % 3;
  const lights = [...t.colors.lights.slice(turn), ...t.colors.lights.slice(0, turn)];
  const drop = (u: string) => setBroken((b) => new Set(b).add(u));
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: r,
        overflow: "hidden",
        backgroundColor: t.colors.surfaceRaised,
      }}
    >
      {list.length >= 4 ? (
        <View style={styles.mosaic}>
          {list.slice(0, 4).map((u) => (
            <Image
              key={u}
              source={coverSource(u)}
              style={styles.quarter}
              contentFit="cover"
              onError={() => drop(u)}
            />
          ))}
        </View>
      ) : list[0] ? (
        <Image
          source={coverSource(list[0])}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          onError={() => drop(list[0] as string)}
        />
      ) : (
        <>
          <LinearGradient
            colors={[
              lights[0] ?? t.colors.accent,
              lights[1] ?? t.colors.accent,
              t.colors.surfaceRaised,
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { opacity: 0.6 }]}
          />
          <View style={styles.center}>
            <Icon name="Waveform" size={size * 0.4} color="rgba(255,255,255,0.85)" />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mosaic: { flex: 1, flexDirection: "row", flexWrap: "wrap" },
  quarter: { width: "50%", height: "50%" },
  center: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
});

/** One song in a list: cover, title, artist and length; the one playing is lit, with moving bars. */
export function SongRow({
  sound,
  onPress,
  onMore,
}: {
  sound: Sound;
  onPress: () => void;
  onMore: () => void;
}) {
  const { t } = useTheme();
  const s = useStyles(make);
  const now = useNowPlaying();
  const mine = now?.sound.id === sound.id && now.key.startsWith("bar:list:");
  const liked = useLiked(sound);
  return (
    // The row and its "more" button sit side by side, never one inside the other.
    <View style={s.rowWrap}>
      <Pressable
        onPress={onPress}
        onLongPress={onMore}
        accessibilityRole="button"
        accessibilityLabel={`${sound.title} by ${sound.artist}${mine ? ", playing" : ""}`}
        style={({ pressed }) => [s.row, pressed && s.pressed]}
      >
        <CoverArt urls={[sound.coverUrl]} size={50} seed={sound.id} />
        <View style={s.fill}>
          <Text style={[s.title, mine && { color: t.colors.accent }]} numberOfLines={1}>
            {sound.title}
          </Text>
          <View style={s.lineRow}>
            {liked ? <Icon name="HeartFill" size={12} color={t.colors.accent} /> : null}
            {sound.kind === "original" ? <Text style={s.tag}>Original</Text> : null}
            <Text style={s.line} numberOfLines={1}>
              {sound.artist} · {clock(sound.durationMs)}
            </Text>
          </View>
        </View>
        {mine && !now?.paused ? <Bars color={t.colors.accent} /> : null}
      </Pressable>
      <Pressable
        onPress={onMore}
        accessibilityRole="button"
        accessibilityLabel={`More for ${sound.title}`}
        hitSlop={8}
        style={s.more}
      >
        <Icon name="DotsThreeBold" size={20} color={t.colors.textSoft} />
      </Pressable>
    </View>
  );
}

/** A song's menu: like, add to a playlist, make a post with it, and (in your playlist) remove. */
/** Report a song someone shared: say what's wrong, and Realm looks at it. */
function reportSong(sheet: Sheet, sound: Sound) {
  const send = async (why: "not_theirs" | "harmful" | "other") => {
    try {
      await api(`/sounds/${sound.id}/report`, { body: { why } });
      sheet({
        title: "Report sent",
        line: "Thanks for telling us. Realm will look at it, and a song that several people report is taken down until then. Who reported it stays private.",
        actions: [],
      });
    } catch (err) {
      alert("Not sent", err instanceof ApiError ? err.message : "Try again.");
    }
  };
  sheet({
    title: "Report this song",
    line: `"${sound.title}" by ${sound.artist}. What's wrong with it?`,
    actions: [
      {
        label: "It isn't theirs to share",
        icon: "Flag",
        onPress: () => send("not_theirs"),
      },
      {
        label: "It's hateful, sexual or violent",
        icon: "Flag",
        onPress: () => send("harmful"),
      },
      { label: "Something else", icon: "Flag", onPress: () => send("other") },
    ],
  });
}

export function songMenu(
  sheet: Sheet,
  router: Router,
  sound: Sound,
  opts: {
    liked: boolean;
    removeFrom?: { id: string; done: () => void };
    /** Who's looking: their own songs can be taken down, other people's reported. */
    meId?: string | null;
    /** Called after a song is taken down, so the list it was in can load again. */
    changed?: () => void;
  } = { liked: false },
) {
  // A song someone shared themselves (not a library track) belongs to its uploader.
  const shared = sound.kind === "original" && sound.creator ? sound.creator : null;
  const mine = shared !== null && shared.id === opts.meId;
  sheet({
    title: sound.title,
    line: `${sound.artist}${sound.licence ? ` · ${sound.licence}` : sound.kind === "original" ? " · Original sound" : ""}`,
    actions: [
      {
        label: opts.liked ? "Remove from Liked songs" : "Add to Liked songs",
        icon: opts.liked ? "HeartFill" : "Heart",
        onPress: () => like(sound, !opts.liked),
      },
      {
        label: "Add to a playlist",
        icon: "Plus",
        onPress: () => addToPlaylist(sheet, router, sound),
      },
      {
        label: "Make a post with it",
        icon: "PlusSquare",
        onPress: () =>
          router.push({
            pathname: "/create",
            params: { soundId: sound.id, start: "0", length: "15000" },
          }),
      },
      ...(shared && !mine
        ? [
            {
              label: `More from @${shared.username}`,
              icon: "MusicNotesFill" as const,
              onPress: () =>
                router.push({
                  pathname: "/music/by/[username]",
                  params: { username: shared.username },
                }),
            },
          ]
        : []),
      ...(mine
        ? [
            {
              label: "Take this song down",
              icon: "Trash" as const,
              danger: true,
              onPress: () =>
                sheet({
                  title: "Take this song down?",
                  line: "It leaves Realm's music: nobody will find or play it any more. Posts that already use it keep their sound.",
                  actions: [
                    {
                      label: "Take it down",
                      icon: "Trash",
                      danger: true,
                      onPress: async () => {
                        try {
                          await api(`/sounds/${sound.id}`, { method: "DELETE" });
                          opts.changed?.();
                        } catch (err) {
                          alert(
                            "Not taken down",
                            err instanceof ApiError ? err.message : "Try again.",
                          );
                        }
                      },
                    },
                  ],
                }),
            },
          ]
        : shared && opts.meId
          ? [
              {
                label: "Report this song",
                icon: "Flag" as const,
                danger: true,
                onPress: () => reportSong(sheet, sound),
              },
            ]
          : []),
      ...(opts.removeFrom
        ? [
            {
              label: "Remove from this playlist",
              icon: "Trash" as const,
              danger: true,
              onPress: async () => {
                try {
                  await api(`/music/playlists/${opts.removeFrom?.id}/items/${sound.id}`, {
                    method: "DELETE",
                  });
                  opts.removeFrom?.done();
                } catch (err) {
                  alert("Not removed", err instanceof ApiError ? err.message : "Try again.");
                }
              },
            },
          ]
        : []),
    ],
  });
}

/** Choose a playlist to add a song to, or start a new one with it. */
export async function addToPlaylist(sheet: Sheet, router: Router, sound: Sound) {
  let lists: Playlist[] = [];
  try {
    lists = (await api<{ items: Playlist[] }>("/music/playlists")).items;
  } catch {
    // Offer a new one anyway.
  }
  sheet({
    title: "Add to a playlist",
    actions: [
      {
        label: "New playlist",
        icon: "Plus",
        onPress: () => router.push({ pathname: "/music/new", params: { add: sound.id } }),
      },
      ...lists.slice(0, 8).map((l) => ({
        label: `${l.name} · ${l.count} ${l.count === 1 ? "song" : "songs"}`,
        icon: "MusicNotes" as const,
        onPress: async () => {
          try {
            await api(`/music/playlists/${l.id}/items/${sound.id}`, { method: "PUT" });
            alert(`Added to ${l.name}`);
          } catch (err) {
            alert("Not added", err instanceof ApiError ? err.message : "Try again.");
          }
        },
      })),
    ],
  });
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    rowWrap: { flexDirection: "row", alignItems: "center", paddingRight: 8 },
    row: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingLeft: 16,
      paddingRight: 4,
      paddingVertical: 7,
    },
    pressed: { backgroundColor: t.colors.surface },
    title: { fontFamily: t.fonts.bold, fontSize: 15.5 * t.textScale, color: t.colors.text },
    lineRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
    line: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      color: t.colors.textSoft,
      flexShrink: 1,
    },
    tag: {
      fontFamily: t.fonts.bold,
      fontSize: 10.5 * t.textScale,
      color: t.colors.textSoft,
      borderWidth: 1,
      borderColor: t.colors.borderStrong,
      borderRadius: 4,
      paddingHorizontal: 4,
    },
    more: { width: 36, height: 44, alignItems: "center", justifyContent: "center" },
  });
