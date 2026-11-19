import { SONG_MAX_BYTES, SONG_MAX_MS, type Sound } from "@realm/contracts";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/icon";
import {
  type PickedSong,
  pickSongFile,
  SongFileError,
  songLength,
  titleFromFile,
} from "@/music/song-file";
import { ApiError, api, upload } from "@/server";
import { useSession } from "@/session";
import { shrinkPhoto } from "@/shrink";
import { AppScreen, TopBar } from "@/social/screen";
import { type NativeTheme, useStyles, useTheme } from "@/theme";
import { Field, Notice, Pill } from "@/ui";

const minutes = (ms: number) => {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

type Cover = { uri: string; width: number; height: number; mimeType?: string | null };

/**
 * Share a song of your own: the file, its name, who it's by and a cover. Until Realm has
 * licensed music, what people make and upload is the music here, so you have to say it's yours
 * to share before it goes up, and anyone can report a song that isn't.
 */
export default function UploadSong() {
  const { t, accent } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const me = session.status === "signedIn" ? session.user : null;
  const [song, setSong] = useState<(PickedSong & { durationMs: number }) | null>(null);
  const [cover, setCover] = useState<Cover | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [mine, setMine] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function chooseSong() {
    setProblem(null);
    try {
      const file = await pickSongFile();
      if (!file) return;
      if (file.size !== null && file.size > SONG_MAX_BYTES) {
        setProblem("That file is too big. Songs can be up to 20 MB.");
        return;
      }
      const durationMs = await songLength(file.uri);
      if (durationMs > SONG_MAX_MS) {
        setProblem("That song is too long. Songs can be up to 15 minutes.");
        return;
      }
      setSong({ ...file, durationMs });
      if (!title.trim()) setTitle(titleFromFile(file.name));
    } catch (err) {
      setProblem(
        err instanceof SongFileError ? err.message : "That file couldn't be opened. Try another.",
      );
    }
  }

  async function chooseCover() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    const picked = res.canceled ? null : res.assets[0];
    if (picked) setCover(picked);
  }

  async function share() {
    if (step) return;
    if (!song) return setProblem("Choose your song file first.");
    if (!title.trim()) return setProblem("Give your song a name.");
    if (!mine) return setProblem("Tick the box to say this song is yours to share.");
    setProblem(null);
    try {
      setStep("Uploading your song");
      const mediaId = await upload({
        uri: song.uri,
        kind: "audio",
        mimeType: song.mimeType,
        purpose: "song",
        ...(song.durationMs ? { durationMs: song.durationMs } : {}),
      });
      let coverMediaId: string | undefined;
      if (cover) {
        setStep("Uploading the cover");
        const small = await shrinkPhoto(cover);
        coverMediaId = await upload({ uri: small.uri, kind: "image", mimeType: small.mimeType });
      }
      setStep("Saving");
      await api<Sound>("/sounds/songs", {
        body: {
          mediaId,
          title: title.trim(),
          ...(artist.trim() ? { artist: artist.trim() } : {}),
          ...(coverMediaId ? { coverMediaId } : {}),
          rights: true,
        },
      });
      if (me) {
        router.replace({ pathname: "/music/by/[username]", params: { username: me.username } });
      } else router.back();
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : "That didn't work. Try again.");
      setStep(null);
    }
  }

  return (
    <AppScreen>
      <TopBar title="Share your music" />
      <KeyboardAvoidingView behavior="padding" style={s.fill}>
        <ScrollView
          contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 28 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.top}>
            <Pressable
              onPress={chooseCover}
              accessibilityRole="button"
              accessibilityLabel={cover ? "Change the cover picture" : "Add a cover picture"}
              style={({ pressed }) => [s.cover, pressed && s.pressed]}
            >
              {cover ? (
                <Image source={{ uri: cover.uri }} style={s.coverImage} contentFit="cover" />
              ) : (
                <>
                  <Icon name="Image" size={26} color={t.colors.textSoft} />
                  <Text style={s.coverText}>Add a cover</Text>
                </>
              )}
            </Pressable>
            <View style={s.fill}>
              <Pressable
                onPress={chooseSong}
                accessibilityRole="button"
                accessibilityLabel={song ? "Choose a different song file" : "Choose a song file"}
                style={({ pressed }) => [s.file, pressed && s.pressed]}
              >
                <Icon name="MusicNotesFill" size={22} color={song ? accent : t.colors.textSoft} />
                <View style={s.fill}>
                  <Text style={s.fileName} numberOfLines={2}>
                    {song ? song.name : "Choose a song file"}
                  </Text>
                  <Text style={s.fileLine}>
                    {song
                      ? song.durationMs
                        ? `${minutes(song.durationMs)} · tap to change`
                        : "Tap to change"
                      : "MP3, M4A, WAV or OGG, up to 20 MB"}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>

          <Field
            label="Song name"
            value={title}
            onChangeText={setTitle}
            maxLength={80}
            placeholder="Night Drive"
            returnKeyType="next"
          />
          <Field
            label="Artist"
            hint="Leave it empty to use your own name."
            value={artist}
            onChangeText={setArtist}
            maxLength={60}
            placeholder={me?.displayName ?? "Your name"}
          />

          <Pressable
            onPress={() => setMine((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: mine }}
            style={s.promise}
          >
            <View style={[s.box, mine && { backgroundColor: accent, borderColor: accent }]}>
              {mine ? <Icon name="CheckBold" size={15} color={t.colors.onAccent} /> : null}
            </View>
            <Text style={s.promiseText}>
              I made this song, or I have the right to share it here.
            </Text>
          </Pressable>
          <Text style={s.small}>
            Songs that aren't yours to share are taken down, and sharing them again can close your
            account. Anyone on Realm can play your song and use it in their posts, with your name on
            it.
          </Text>

          {problem ? <Notice>{problem}</Notice> : null}
          <Pill
            label="Share song"
            onPress={share}
            pending={step !== null}
            pendingLabel={step ?? ""}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    body: { padding: 20, gap: 18 },
    top: { flexDirection: "row", gap: 14, alignItems: "stretch" },
    cover: {
      width: 112,
      height: 112,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      overflow: "hidden",
      backgroundColor: t.colors.surfaceRaised,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.borderStrong,
    },
    coverImage: { width: "100%", height: "100%" },
    coverText: { fontFamily: t.fonts.bold, fontSize: 13 * t.textScale, color: t.colors.textSoft },
    file: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: t.colors.surfaceRaised,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.borderStrong,
    },
    fileName: { fontFamily: t.fonts.bold, fontSize: 15 * t.textScale, color: t.colors.text },
    fileLine: {
      fontFamily: t.fonts.body,
      fontSize: 13 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 2,
    },
    pressed: { opacity: 0.7 },
    promise: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
    box: {
      width: 24,
      height: 24,
      borderRadius: 7,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: t.colors.borderStrong,
    },
    promiseText: {
      flex: 1,
      fontFamily: t.fonts.bold,
      fontSize: 15 * t.textScale,
      lineHeight: 21 * t.textScale,
      color: t.colors.text,
    },
    small: {
      fontFamily: t.fonts.body,
      fontSize: 13 * t.textScale,
      lineHeight: 19 * t.textScale,
      color: t.colors.textSoft,
    },
  });
