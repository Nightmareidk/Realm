import { Image } from "expo-image";
import type * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../icon";
import type { IconName } from "../icon-paths";
import type { Picked } from "../music/picker";
import { clock, playSound, stopSound } from "../music/player";
import { CoverArt } from "../music/ui";
import { useSession } from "../session";
import { Avatar } from "../social/avatar";
import { type NativeTheme, useStyles, useTheme } from "../theme";

const LENGTHS = [5_000, 10_000, 15_000, 30_000, 60_000];

/**
 * Making a Story or a Clip, full screen (Instagram's editor, Look B's Clip screen): the photo or
 * video fills the screen; the tools run down the right (Text, Music, how long it shows); the
 * song sits on it; at the bottom, who sees it and the button to share (or Next, for a Clip).
 */
export function Stage({
  mode,
  asset,
  music,
  caption,
  shownFor,
  everyone,
  isPrivate,
  status,
  onCaption,
  onMusic,
  onClearMusic,
  onLength,
  onAudience,
  onDiscard,
  onShare,
}: {
  mode: "story" | "clip";
  asset: ImagePicker.ImagePickerAsset;
  music: Picked | null;
  caption: string;
  shownFor: number;
  /** Shown to everyone (else to followers only). */
  everyone: boolean;
  isPrivate: boolean;
  status: string | null;
  onCaption: (v: string) => void;
  onMusic: () => void;
  onClearMusic: () => void;
  onLength: (ms: number) => void;
  onAudience: (everyone: boolean) => void;
  onDiscard: () => void;
  onShare: () => void;
}) {
  const { accent, onAccent } = useTheme();
  const s = useStyles(make);
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const me = session.status === "signedIn" ? session.user : null;
  const [writing, setWriting] = useState(false);
  const input = useRef<TextInput>(null);
  const isVideo = asset.type === "video";
  const player = useVideoPlayer(isVideo ? { uri: asset.uri } : null, (p) => {
    p.loop = true;
    p.muted = Boolean(music);
    p.play();
  });
  useEffect(() => {
    if (isVideo) player.muted = Boolean(music);
  }, [music, isVideo, player]);
  // Hear the song as it'll play, looping its part.
  useEffect(() => {
    if (!music) return;
    playSound(music.sound, music.startMs, music.durationMs, "create");
    return () => stopSound();
  }, [music]);

  const tool = (icon: IconName, label: string, onPress: () => void, on = false, badge?: string) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.tool, pressed && s.pressed]}
    >
      <View style={[s.toolIcon, on && { backgroundColor: accent }]}>
        {badge ? (
          <Text style={[s.toolBadge, on && { color: onAccent }]}>{badge}</Text>
        ) : (
          <Icon name={icon} size={22} color={on ? onAccent : "#ffffff"} />
        )}
      </View>
      <Text style={s.toolLabel}>{label}</Text>
    </Pressable>
  );

  const nextLength = () => {
    const at = LENGTHS.indexOf(shownFor);
    onLength(LENGTHS[(at + 1) % LENGTHS.length] ?? 10_000);
  };
  const lengthLabel = shownFor >= 60_000 ? "1m" : `${shownFor / 1000}s`;

  return (
    <View style={s.root}>
      {isVideo ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
        />
      ) : (
        <Image source={{ uri: asset.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      )}
      <LinearGradient
        colors={["rgba(0,0,0,0.45)", "transparent"]}
        style={[s.shade, { height: insets.top + 110 }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.65)"]}
        style={[s.shadeBottom, { height: insets.bottom + 220 }]}
        pointerEvents="none"
      />

      {/* Top: close, and what you're making */}
      <View style={[s.top, { paddingTop: insets.top + 6 }]}>
        <Pressable
          onPress={onDiscard}
          accessibilityRole="button"
          accessibilityLabel="Back: choose another"
          style={s.round}
        >
          <Icon name="X" size={24} color="#ffffff" />
        </Pressable>
        <Text style={s.kind}>{mode === "story" ? "New Story" : "New Clip"}</Text>
        <View style={s.spacer} />
      </View>

      {/* Tools down the right */}
      <View style={[s.rail, { top: insets.top + 70 }]}>
        {tool(
          "TextAa",
          "Text",
          () => {
            setWriting(true);
            setTimeout(() => input.current?.focus(), 50);
          },
          Boolean(caption),
        )}
        {tool("MusicNotesFill", music ? "Change" : "Music", onMusic, Boolean(music))}
        {mode === "story" && !isVideo
          ? tool("Sparkle", "Length", nextLength, true, lengthLabel)
          : null}
      </View>

      {/* The words, big over the picture (tap to change) */}
      {writing ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={s.writeWrap}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setWriting(false)}
            accessibilityLabel="Done writing"
          />
          <TextInput
            ref={input}
            value={caption}
            onChangeText={onCaption}
            placeholder="Say something…"
            placeholderTextColor="rgba(255,255,255,0.6)"
            selectionColor={accent}
            cursorColor={accent}
            multiline
            maxLength={mode === "story" ? 200 : 2200}
            style={s.writeInput}
            accessibilityLabel={mode === "story" ? "Words on your Story" : "Caption"}
            onBlur={() => setWriting(false)}
          />
        </KeyboardAvoidingView>
      ) : caption ? (
        <Pressable
          onPress={() => setWriting(true)}
          style={s.words}
          accessibilityRole="button"
          accessibilityLabel={`Words: ${caption}. Tap to change`}
        >
          <Text style={s.wordsText}>{caption}</Text>
        </Pressable>
      ) : null}

      {/* Bottom: the song, who sees it, and share */}
      <View style={[s.bottom, { paddingBottom: insets.bottom + 14 }]}>
        {music ? (
          <View style={s.song}>
            <CoverArt urls={[music.sound.coverUrl]} size={40} seed={music.sound.id} radius={8} />
            <View style={s.fill}>
              <Text style={s.songTitle} numberOfLines={1}>
                {music.sound.title}
              </Text>
              <Text style={s.songLine} numberOfLines={1}>
                {music.sound.artist} · {clock(music.startMs)} to{" "}
                {clock(music.startMs + music.durationMs)}
                {music.sound.licence ? ` · ${music.sound.licence}` : ""}
              </Text>
            </View>
            <Pressable onPress={onMusic} accessibilityRole="button" style={s.songBtn}>
              <Text style={s.songBtnText}>Change</Text>
            </Pressable>
            <Pressable
              onPress={onClearMusic}
              accessibilityRole="button"
              accessibilityLabel="Remove the song"
              hitSlop={8}
            >
              <Icon name="X" size={18} color="#ffffff" />
            </Pressable>
          </View>
        ) : null}
        <View style={s.actions}>
          <Pressable
            onPress={() => onAudience(!everyone)}
            accessibilityRole="switch"
            accessibilityState={{ checked: everyone }}
            accessibilityLabel={
              everyone
                ? "Everyone can see it. Tap for followers only"
                : "Followers only. Tap for everyone"
            }
            style={s.audience}
          >
            {me ? <Avatar user={me} size={28} /> : null}
            <View>
              <Text style={s.audienceTitle}>{mode === "story" ? "Your story" : "Your Clip"}</Text>
              <Text style={s.audienceLine}>
                {everyone ? "Everyone" : isPrivate ? "Your followers" : "Followers only"}
              </Text>
            </View>
            <Icon name="CaretDown" size={14} color="#ffffff" />
          </Pressable>
          <Pressable
            onPress={onShare}
            disabled={Boolean(status)}
            accessibilityRole="button"
            accessibilityLabel={mode === "story" ? "Share to your Story" : "Next"}
            style={[s.share, { backgroundColor: accent }, status && s.busy]}
          >
            {status ? (
              <Text style={[s.shareText, { color: onAccent }]}>{status}</Text>
            ) : mode === "story" ? (
              <>
                <Text style={[s.shareText, { color: onAccent }]}>Share</Text>
                <Icon name="ArrowUpBold" size={18} color={onAccent} />
              </>
            ) : (
              <>
                <Text style={[s.shareText, { color: onAccent }]}>Next</Text>
                <Icon name="CaretRight" size={18} color={onAccent} />
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const shadow = {
  textShadowColor: "rgba(0,0,0,0.6)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
};

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    pressed: { opacity: 0.7 },
    busy: { opacity: 0.8 },
    root: { flex: 1, backgroundColor: "#000000" },
    shade: { position: "absolute", top: 0, left: 0, right: 0 },
    shadeBottom: { position: "absolute", bottom: 0, left: 0, right: 0 },
    top: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 10,
    },
    round: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.3)",
    },
    spacer: { width: 44 },
    kind: { fontFamily: t.fonts.bold, fontSize: 16 * t.textScale, color: "#ffffff", ...shadow },
    rail: { position: "absolute", right: 10, gap: 14, alignItems: "center" },
    tool: { alignItems: "center", gap: 4, width: 64 },
    toolIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.42)",
    },
    toolBadge: { fontFamily: t.fonts.bold, fontSize: 14 * t.textScale, color: "#ffffff" },
    toolLabel: {
      fontFamily: t.fonts.bold,
      fontSize: 11.5 * t.textScale,
      color: "#ffffff",
      ...shadow,
    },
    writeWrap: {
      ...StyleSheet.absoluteFill,
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.45)",
      paddingHorizontal: 28,
    },
    writeInput: {
      fontFamily: t.fonts.display,
      fontSize: 28 * t.textScale,
      lineHeight: 36 * t.textScale,
      color: "#ffffff",
      textAlign: "center",
      ...shadow,
    },
    words: { position: "absolute", left: 24, right: 84, top: "42%" },
    wordsText: {
      fontFamily: t.fonts.display,
      fontSize: 26 * t.textScale,
      lineHeight: 34 * t.textScale,
      color: "#ffffff",
      textAlign: "center",
      ...shadow,
    },
    bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 14, gap: 12 },
    song: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 8,
      borderRadius: 14,
      backgroundColor: "rgba(10,10,14,0.6)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.15)",
    },
    songTitle: { fontFamily: t.fonts.bold, fontSize: 14.5 * t.textScale, color: "#ffffff" },
    songLine: {
      fontFamily: t.fonts.body,
      fontSize: 12 * t.textScale,
      color: "rgba(255,255,255,0.75)",
      marginTop: 1,
    },
    songBtn: {
      paddingHorizontal: 12,
      minHeight: 32,
      borderRadius: 16,
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.16)",
    },
    songBtnText: { fontFamily: t.fonts.bold, fontSize: 13 * t.textScale, color: "#ffffff" },
    actions: { flexDirection: "row", alignItems: "center", gap: 10 },
    audience: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      minHeight: 52,
      paddingHorizontal: 12,
      borderRadius: 26,
      backgroundColor: "rgba(255,255,255,0.14)",
    },
    audienceTitle: { fontFamily: t.fonts.bold, fontSize: 14 * t.textScale, color: "#ffffff" },
    audienceLine: {
      fontFamily: t.fonts.body,
      fontSize: 12 * t.textScale,
      color: "rgba(255,255,255,0.75)",
    },
    share: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minHeight: 52,
      paddingHorizontal: 22,
      borderRadius: 26,
    },
    shareText: { fontFamily: t.fonts.bold, fontSize: 16 * t.textScale },
  });
