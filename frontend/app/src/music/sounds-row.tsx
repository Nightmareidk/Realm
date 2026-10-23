import type { Sound } from "@realm/contracts";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useApi } from "../data";
import { Icon } from "../icon";
import { mediaSource, resolveUrl } from "../server";
import { type NativeTheme, useStyles, useTheme } from "../theme";
import { pauseSound, playList, resumeSound, useNowPlaying } from "./player";

/**
 * Sounds people use (Search, as in Look B): covers in a row. Tap one to listen to it whole, then
 * the next, while you carry on using the app; the Now Playing bar has next, previous and pause.
 * Hold one to make a post with it.
 */
export function SoundsRow() {
  const s = useStyles(make);
  const list = useApi<{ items: Sound[] }>("/sounds/trending");
  const items = list.data?.items ?? [];
  if (!items.length) return null;
  return (
    <View>
      <Text style={s.heading} accessibilityRole="header">
        Sounds people use
      </Text>
      <FlatList
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(x) => x.id}
        contentContainerStyle={s.row}
        renderItem={({ item, index }) => (
          <Tile sound={item} onPlay={() => playList(items, index, "Sounds people use")} />
        )}
      />
    </View>
  );
}

function Tile({ sound, onPlay }: { sound: Sound; onPlay: () => void }) {
  const { t } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const now = useNowPlaying();
  const mine = now?.sound.id === sound.id && now.key.startsWith("bar:list:");
  const playing = mine && !now?.paused;
  const [broken, setBroken] = useState(false);
  const cover = broken ? null : sound.coverUrl;
  return (
    <Pressable
      onPress={() => (mine ? (playing ? pauseSound() : resumeSound()) : onPlay())}
      onLongPress={() =>
        router.push({
          pathname: "/create",
          params: { soundId: sound.id, start: "0", length: "15000" },
        })
      }
      accessibilityRole="button"
      accessibilityLabel={`${playing ? "Pause" : "Play"} ${sound.title} by ${sound.artist}`}
      accessibilityHint="Hold to make a post with it"
      style={({ pressed }) => [s.tile, pressed && s.pressed]}
    >
      <View style={s.cover}>
        {cover ? (
          <Image
            source={cover.startsWith("/") ? mediaSource(cover) : { uri: resolveUrl(cover) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            recyclingKey={cover}
            onError={() => setBroken(true)}
          />
        ) : (
          <Icon name="Waveform" size={36} color={t.colors.textSoft} />
        )}
        <View style={[s.play, playing && s.playOn]}>
          <Icon
            name={playing ? "PauseFill" : "PlayFill"}
            size={16}
            color={playing ? t.colors.onAccent : "#ffffff"}
          />
        </View>
      </View>
      <Text style={s.title} numberOfLines={1}>
        {sound.title}
      </Text>
      <Text style={s.artist} numberOfLines={1}>
        {sound.artist}
      </Text>
    </Pressable>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    heading: {
      fontFamily: t.fonts.displayBold,
      fontSize: 18 * t.textScale,
      color: t.colors.heading,
      paddingHorizontal: 16,
      marginTop: 22,
      marginBottom: 10,
    },
    row: { paddingHorizontal: 16, gap: 12 },
    tile: { width: 116 },
    pressed: { opacity: 0.8 },
    cover: {
      width: 116,
      height: 116,
      borderRadius: Math.min(16, t.radius.card),
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.surfaceRaised,
    },
    play: {
      position: "absolute",
      right: 8,
      bottom: 8,
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.55)",
    },
    playOn: { backgroundColor: t.colors.accent },
    title: {
      fontFamily: t.fonts.bold,
      fontSize: 14 * t.textScale,
      color: t.colors.text,
      marginTop: 8,
    },
    artist: {
      fontFamily: t.fonts.body,
      fontSize: 12.5 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 1,
    },
  });
