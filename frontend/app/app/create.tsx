import {
  type Post,
  type Profile,
  type Sound,
  type SpaceDetail,
  STORY_DEFAULT_MS,
} from "@realm/contracts";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { alert } from "@/alert";
import { postsChanged, useApi } from "@/data";
import { Icon } from "@/icon";
import { leave } from "@/leave";
import { chip, MusicPicker, type Picked, toPick } from "@/music/picker";
import { clock, playSound, stopSound, usePlaying } from "@/music/player";
import { loadStories } from "@/music/stories";
import { ApiError, api, upload } from "@/server";
import { useSession } from "@/session";
import { CLIP_MAX_SECONDS, shrinkPhoto } from "@/shrink";
import { AppScreen, TopBar } from "@/social/screen";
import { type NativeTheme, useStyles, useTheme } from "@/theme";
import { Pill } from "@/ui";

type Mode = "post" | "story" | "clip";
const MODES: [Mode, string][] = [
  ["post", "Post"],
  ["story", "Story"],
  ["clip", "Clip"],
];
const TITLE: Record<Mode, string> = { post: "New post", story: "New Story", clip: "New Clip" };
/** The longest part of a song each can use. */
const MUSIC_MAX: Record<Mode, number> = { post: 60_000, story: 60_000, clip: 60_000 };
/** How long a photo Story shows. */
const STORY_LENGTHS = [5_000, 10_000, 15_000, 30_000, 60_000] as const;

/**
 * Make something, three ways, each its own:
 *  - a post: photos (up to 10) or just words, with a caption and music if you like;
 *  - a Story: one photo or video for a day, with music;
 *  - a Clip: one short video for the Clips feed, with music, or with its own sound shared as a
 *    sound others can use.
 * Posts and Clips can go to a Space and choose who sees them; on a private account each one can
 * still be made public.
 */
export default function Create() {
  const { t } = useTheme();
  const s = useStyles(make);
  const router = useRouter();
  const params = useLocalSearchParams<{
    mode?: Mode;
    /** "Use this sound" from the Now Playing bar: start with this song and part. */
    soundId?: string;
    start?: string;
    length?: string;
  }>();
  const { accent } = useTheme();
  const { session } = useSession();
  const me = session.status === "signedIn" ? session.user : null;
  const profile = useApi<Profile>(me ? `/users/${me.username}/profile` : null);
  const spaces = useApi<{ spaces: SpaceDetail[] }>("/users/@me/communities");
  const [mode, setMode] = useState<Mode>(
    params.mode === "clip" || params.mode === "story" ? params.mode : "post",
  );
  const [picked, setPicked] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [caption, setCaption] = useState("");
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [flip, setFlip] = useState(false);
  const [spaceOnly, setSpaceOnly] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [music, setMusic] = useState<Picked | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [shareSound, setShareSound] = useState(false);
  const [soundName, setSoundName] = useState("");
  /** A photo Story's length; follows the song's part until you choose one yourself. */
  const [storyMs, setStoryMs] = useState<number | null>(null);
  const shownFor = storyMs ?? music?.durationMs ?? STORY_DEFAULT_MS;
  const playing = usePlaying();
  const single = mode !== "post";
  // Words alone can't have music.
  const canMusic = mode !== "post" || picked.length > 0;
  useEffect(() => () => stopSound(), []);
  // Arrived with a song ("Use" on the Now Playing bar): it's already chosen.
  useEffect(() => {
    if (!params.soundId || !/^\d{1,20}$/.test(params.soundId)) return;
    api<Sound>(`/sounds/${params.soundId}`)
      .then((sound) =>
        setMusic({
          sound,
          startMs: Math.max(0, Number(params.start) || 0),
          durationMs: Math.min(60_000, Math.max(5_000, Number(params.length) || 15_000)),
        }),
      )
      .catch(() => {});
  }, [params.soundId, params.start, params.length]);

  const isPrivate = profile.data?.isPrivate ?? false;
  const visibility =
    spaceId && spaceOnly
      ? "space"
      : isPrivate
        ? flip
          ? "public"
          : "followers"
        : flip
          ? "followers"
          : "public";
  const ready =
    (single ? picked.length === 1 : picked.length > 0 || caption.trim().length > 0) && !status;
  const what = mode === "story" ? "Story" : "post";

  async function pick(from: "library" | "camera") {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes:
        mode === "clip" ? ["videos"] : mode === "story" ? ["images", "videos"] : ["images"],
      allowsMultipleSelection: mode === "post" && from === "library",
      selectionLimit: 10,
      orderedSelection: true,
      quality: 0.85,
      // Recording on an iPhone: medium quality, a fraction of the size. (Android phones record at
      // their camera's setting; long videos are stopped below instead.)
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
      videoMaxDuration: CLIP_MAX_SECONDS,
    };
    if (from === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        alert(
          "Camera is off for Realm",
          "Allow the camera in your phone's settings to take one here.",
        );
        return;
      }
    }
    const res =
      from === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (res.canceled) return;
    const long = res.assets.find(
      (a) => a.type === "video" && (a.duration ?? 0) > CLIP_MAX_SECONDS * 1000 + 500,
    );
    if (long) {
      alert(
        "That video is too long",
        `Clips can be up to ${CLIP_MAX_SECONDS} seconds. Trim it in your gallery first, then pick it again.`,
      );
      return;
    }
    setPicked(single ? res.assets.slice(0, 1) : [...picked, ...res.assets].slice(0, 10));
  }

  function switchMode(m: Mode) {
    setMode(m);
    setPicked([]);
    // A song's part can be too long for the new kind: keep the song, shorten the part.
    if (music) setMusic({ ...music, durationMs: Math.min(music.durationMs, MUSIC_MAX[m]) });
  }

  async function share() {
    if (!ready) return;
    try {
      const ids: string[] = [];
      for (const [i, a] of picked.entries()) {
        setStatus(picked.length > 1 ? `Uploading ${i + 1} of ${picked.length}` : "Uploading");
        const isVideo = a.type === "video";
        // Photos are made smaller first, so they upload faster and storage lasts longer.
        const file = isVideo
          ? { uri: a.uri, mimeType: a.mimeType ?? "video/mp4" }
          : await shrinkPhoto(a);
        ids.push(
          await upload({
            uri: file.uri,
            kind: isVideo ? "video" : "image",
            mimeType: file.mimeType,
            durationMs: a.duration ?? undefined,
          }),
        );
      }
      setStatus("Sharing");
      const sound = music && (mode !== "post" || ids.length) ? toPick(music) : undefined;
      if (mode === "story") {
        await api("/stories", {
          body: {
            mediaId: ids[0],
            caption: caption.trim() || undefined,
            sound,
            durationMs: shownFor,
            // A private account's Stories go to its followers unless this one is made public.
            visibility: isPrivate ? (flip ? "public" : "followers") : flip ? "followers" : "public",
          },
        });
        loadStories();
        leave(router);
        return;
      }
      await api<Post>("/posts", {
        body: {
          kind: mode === "clip" ? "clip" : ids.length ? "image" : "text",
          caption: caption.trim() || undefined,
          mediaIds: ids,
          ...(sound ? { sound } : {}),
          ...(spaceId ? { spaceId } : {}),
          visibility,
        },
      });
      // The Clip's own sound, shared for others to use. The Clip is already up if this fails.
      if (mode === "clip" && shareSound && !music && ids[0]) {
        await api("/sounds", {
          body: { mediaId: ids[0], title: soundName.trim() || "Original sound" },
        }).catch(() => {});
      }
      postsChanged();
      leave(router);
    } catch (err) {
      setStatus(null);
      alert(
        "Not shared",
        err instanceof ApiError ? err.message : "Something went wrong. Try again.",
      );
    }
  }

  return (
    <AppScreen>
      <TopBar
        title={TITLE[mode]}
        right={
          <Pill
            size="md"
            label="Share"
            pending={Boolean(status)}
            pendingLabel={status ?? "Sharing"}
            onPress={share}
            style={!ready && !status ? s.off : undefined}
          />
        }
      />
      <KeyboardAvoidingView behavior="padding" style={s.fill}>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <View style={s.modes} accessibilityRole="radiogroup">
            {MODES.map(([m, label]) => (
              <Pressable
                key={m}
                onPress={() => switchMode(m)}
                accessibilityRole="radio"
                accessibilityState={{ checked: mode === m }}
                style={[s.mode, mode === m && s.modeOn]}
              >
                <Text style={[s.modeText, mode === m && s.modeTextOn]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.picked}
          >
            {picked.map((a, i) => (
              <View key={a.uri} style={s.thumb}>
                {a.type === "video" ? (
                  <View style={[s.thumbFill, s.video]}>
                    <Icon name="PlayFill" size={26} color="#ffffff" />
                  </View>
                ) : (
                  <Image source={{ uri: a.uri }} style={s.thumbFill} contentFit="cover" />
                )}
                <Pressable
                  onPress={() => setPicked(picked.filter((_, j) => j !== i))}
                  accessibilityRole="button"
                  accessibilityLabel="Remove"
                  style={s.remove}
                >
                  <Icon name="X" size={16} color="#ffffff" />
                </Pressable>
              </View>
            ))}
            {(single ? picked.length === 0 : picked.length < 10) ? (
              <>
                <Pressable
                  onPress={() => pick("library")}
                  accessibilityRole="button"
                  style={[s.thumb, s.add]}
                >
                  <Icon
                    name={mode === "clip" ? "VideoCamera" : "Image"}
                    size={28}
                    color={t.colors.text}
                  />
                  <Text style={s.addText}>
                    {mode === "clip"
                      ? "Pick a video"
                      : mode === "story"
                        ? "Photo or video"
                        : "Pick photos"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => pick("camera")}
                  accessibilityRole="button"
                  style={[s.thumb, s.add]}
                >
                  <Icon name="Camera" size={28} color={t.colors.text} />
                  <Text style={s.addText}>Camera</Text>
                </Pressable>
              </>
            ) : null}
          </ScrollView>

          <Text style={s.label}>Music</Text>
          {music ? (
            <View style={s.music}>
              <Pressable
                onPress={() =>
                  playing === "create"
                    ? stopSound()
                    : playSound(music.sound, music.startMs, music.durationMs, "create")
                }
                accessibilityRole="button"
                accessibilityLabel={playing === "create" ? "Stop" : "Listen"}
                style={s.musicPlay}
              >
                <Icon
                  name={playing === "create" ? "PauseFill" : "PlayFill"}
                  size={18}
                  color={t.colors.onAccent}
                />
              </Pressable>
              <View style={s.fill}>
                <Text style={s.musicTitle} numberOfLines={1}>
                  {music.sound.title}
                </Text>
                <Text style={s.musicLine} numberOfLines={1}>
                  {music.sound.artist} · {clock(music.startMs)} to{" "}
                  {clock(music.startMs + music.durationMs)}
                </Text>
              </View>
              <Pressable
                onPress={() => setChoosing(true)}
                accessibilityRole="button"
                hitSlop={6}
                style={s.musicBtn}
              >
                <Text style={s.musicBtnText}>Change</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  stopSound();
                  setMusic(null);
                }}
                accessibilityRole="button"
                accessibilityLabel="Remove the music"
                hitSlop={6}
                style={s.musicBtn}
              >
                <Icon name="X" size={18} color={t.colors.textSoft} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setChoosing(true)}
              disabled={!canMusic}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canMusic }}
              style={({ pressed }) => [
                s.music,
                s.musicAdd,
                pressed && s.pressed,
                !canMusic && s.off,
              ]}
            >
              <View style={[s.musicPlay, s.musicIcon]}>
                <Icon name="MusicNotesFill" size={18} color={t.colors.text} />
              </View>
              <View style={s.fill}>
                <Text style={s.musicTitle}>Add music</Text>
                <Text style={s.musicLine}>
                  {canMusic
                    ? "Free songs, or sounds people made"
                    : "Add a photo first. Posts of just words don't have music."}
                </Text>
              </View>
              <Icon name="CaretRight" size={18} color={t.colors.textSoft} />
            </Pressable>
          )}

          {mode === "clip" && !music && picked.length ? (
            <View style={s.toggle}>
              <View style={s.fill}>
                <Text style={s.toggleTitle}>Share this video's sound</Text>
                <Text style={s.toggleLine}>
                  Others can use it in their posts, with your name on it.
                </Text>
                {shareSound ? (
                  <TextInput
                    value={soundName}
                    onChangeText={setSoundName}
                    placeholder="Name your sound"
                    placeholderTextColor={t.colors.textMuted}
                    selectionColor={accent}
                    cursorColor={accent}
                    maxLength={60}
                    style={s.soundName}
                    accessibilityLabel="Sound name"
                  />
                ) : null}
              </View>
              <Switch
                value={shareSound}
                onValueChange={setShareSound}
                trackColor={{ true: accent }}
                accessibilityLabel="Share this video's sound"
              />
            </View>
          ) : null}

          {mode === "story" && picked[0]?.type !== "video" ? (
            <>
              <Text style={s.label}>Shows for</Text>
              <View style={s.lengths} accessibilityRole="radiogroup">
                {STORY_LENGTHS.map((ms) => {
                  const on = shownFor === ms;
                  return (
                    <Pressable
                      key={ms}
                      onPress={() => setStoryMs(ms)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={ms === 60_000 ? "1 minute" : `${ms / 1000} seconds`}
                      style={[s.length, on && s.lengthOn]}
                    >
                      <Text style={[s.lengthText, on && s.lengthTextOn]}>
                        {ms === 60_000 ? "1 min" : `${ms / 1000}s`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          <Text style={s.label}>Caption</Text>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder={
              mode === "clip"
                ? "Say what happened"
                : mode === "story"
                  ? "Add a few words (if you like)"
                  : "Write a caption, or post just words"
            }
            placeholderTextColor={t.colors.textMuted}
            selectionColor={accent}
            cursorColor={accent}
            multiline
            maxLength={mode === "story" ? 200 : 2200}
            style={s.caption}
            accessibilityLabel="Caption"
          />
          <Text style={s.count}>
            {caption.length} / {mode === "story" ? 200 : 2200}
          </Text>

          {mode !== "story" && spaces.data?.spaces.length ? (
            <>
              <Text style={s.label}>Also share to a Space</Text>
              <View style={s.chips}>
                {spaces.data.spaces.map((sp) => {
                  const on = spaceId === sp.id;
                  return (
                    <Pressable
                      key={sp.id}
                      onPress={() => {
                        setSpaceId(on ? null : sp.id);
                        if (on) setSpaceOnly(false);
                      }}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      style={[s.chip, on && s.chipOn]}
                    >
                      <Text style={[s.chipText, on && s.chipTextOn]}>{sp.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          <View style={s.toggle}>
            <View style={s.fill}>
              <Text style={s.toggleTitle}>{isPrivate ? "Show publicly" : "Only my followers"}</Text>
              <Text style={s.toggleLine}>
                {isPrivate
                  ? `Your account is private. Turn this on and anyone can see this one ${what}.`
                  : `Your account is public. Turn this on to show this ${what} to your followers only.`}
              </Text>
            </View>
            <Switch
              value={flip}
              onValueChange={setFlip}
              trackColor={{ true: accent }}
              accessibilityLabel={isPrivate ? "Show publicly" : "Only my followers"}
            />
          </View>
          {spaceId && mode !== "story" ? (
            <View style={s.toggle}>
              <View style={s.fill}>
                <Text style={s.toggleTitle}>Only in this Space</Text>
                <Text style={s.toggleLine}>
                  Members see it in the Space; it stays off your followers' Home.
                </Text>
              </View>
              <Switch
                value={spaceOnly}
                onValueChange={setSpaceOnly}
                trackColor={{ true: accent }}
                accessibilityLabel="Only in this Space"
              />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <MusicPicker
        visible={choosing}
        maxMs={MUSIC_MAX[mode]}
        onClose={() => setChoosing(false)}
        onPick={(p) => {
          setMusic(p);
          setChoosing(false);
        }}
      />
    </AppScreen>
  );
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    off: { opacity: 0.45 },
    pressed: { opacity: 0.75 },
    lengths: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    length: {
      minHeight: 40,
      minWidth: 56,
      paddingHorizontal: 14,
      borderRadius: chip(t),
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: t.colors.border,
    },
    lengthOn: { backgroundColor: t.colors.text, borderColor: t.colors.text },
    lengthText: {
      fontFamily: t.fonts.bold,
      fontSize: 14.5 * t.textScale,
      color: t.colors.textSoft,
    },
    lengthTextOn: { color: t.colors.bg },
    music: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: 64,
      paddingHorizontal: 12,
      borderRadius: t.radius.card,
      backgroundColor: t.colors.surface,
      borderWidth: t.panels.border === "none" ? 0 : 1,
      borderColor: t.panels.border === "accent" ? t.colors.accent : t.colors.border,
    },
    musicAdd: { borderStyle: "dashed", borderWidth: 1.5, borderColor: t.colors.borderStrong },
    musicPlay: {
      width: 40,
      height: 40,
      borderRadius: t.buttons.shape === "square" ? 4 : 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.accent,
    },
    musicIcon: { backgroundColor: t.colors.surfaceRaised },
    musicTitle: { fontFamily: t.fonts.bold, fontSize: 15.5 * t.textScale, color: t.colors.text },
    musicLine: {
      fontFamily: t.fonts.body,
      fontSize: 13.5 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 2,
    },
    musicBtn: { minHeight: 44, minWidth: 36, alignItems: "center", justifyContent: "center" },
    musicBtnText: { fontFamily: t.fonts.bold, fontSize: 14.5 * t.textScale, color: t.colors.link },
    soundName: {
      minHeight: 44,
      marginTop: 10,
      borderRadius: t.radius.input,
      borderWidth: 1.5,
      borderColor: t.colors.borderStrong,
      paddingHorizontal: 12,
      fontFamily: t.fonts.body,
      fontSize: 15 * t.textScale,
      color: t.colors.text,
    },
    body: { padding: 16, paddingBottom: 40 },
    modes: { flexDirection: "row", gap: 8, marginBottom: 16 },
    mode: {
      minHeight: 40,
      paddingHorizontal: 18,
      borderRadius: chip(t),
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: t.colors.border,
    },
    modeOn: { backgroundColor: t.colors.surfaceRaised, borderColor: t.colors.text },
    modeText: { fontFamily: t.fonts.bold, fontSize: 15 * t.textScale, color: t.colors.textSoft },
    modeTextOn: { color: t.colors.text },
    picked: { gap: 8, paddingBottom: 4 },
    thumb: {
      width: 120,
      height: 150,
      borderRadius: 14,
      overflow: "hidden",
      backgroundColor: t.colors.surfaceSunken,
    },
    thumbFill: { width: "100%", height: "100%" },
    video: { alignItems: "center", justifyContent: "center", backgroundColor: "#06080c" },
    remove: {
      position: "absolute",
      top: 6,
      right: 6,
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(11,11,14,0.7)",
    },
    add: {
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderWidth: 1.5,
      borderColor: t.colors.borderStrong,
      borderStyle: "dashed",
      backgroundColor: "transparent",
    },
    addText: { fontFamily: t.fonts.bold, fontSize: 13.5 * t.textScale, color: t.colors.text },
    label: {
      fontFamily: t.fonts.bold,
      fontSize: 15 * t.textScale,
      color: t.colors.text,
      marginTop: 22,
      marginBottom: 8,
    },
    caption: {
      minHeight: 110,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: t.colors.borderStrong,
      backgroundColor: "rgba(11,11,14,0.7)",
      padding: 14,
      fontFamily: t.fonts.body,
      fontSize: 16 * t.textScale,
      lineHeight: 23 * t.textScale,
      color: t.colors.text,
      textAlignVertical: "top",
    },
    count: {
      fontFamily: t.fonts.body,
      fontSize: 12.5 * t.textScale,
      color: t.colors.textSoft,
      alignSelf: "flex-end",
      marginTop: 4,
    },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: 999,
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: t.colors.border,
    },
    chipOn: { backgroundColor: t.colors.surfaceRaised, borderColor: t.colors.text },
    chipText: { fontFamily: t.fonts.bold, fontSize: 14.5 * t.textScale, color: t.colors.textSoft },
    chipTextOn: { color: t.colors.text },
    toggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      marginTop: 22,
      paddingTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    toggleTitle: { fontFamily: t.fonts.bold, fontSize: 15.5 * t.textScale, color: t.colors.text },
    toggleLine: {
      fontFamily: t.fonts.body,
      fontSize: 14 * t.textScale,
      lineHeight: 20 * t.textScale,
      color: t.colors.textSoft,
      marginTop: 2,
    },
  });
