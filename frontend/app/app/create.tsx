import {
  MEDIA_RULES,
  POLL_HOURS,
  POLL_OPTION_MAX,
  type Post,
  type Profile,
  type Sound,
  type SpaceDetail,
  STORY_DEFAULT_MS,
} from "@realm/contracts";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
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
import { PhotoEditor } from "@/create/edit-photo";
import { Stage } from "@/create/stage";
import { VideoTrimmer } from "@/create/trim-video";
import { postsChanged, useApi } from "@/data";
import { Icon } from "@/icon";
import { leave } from "@/leave";
import { chip, MusicPicker, type Picked, toPick } from "@/music/picker";
import { clock, playSound, stopSound, usePlaying } from "@/music/player";
import { loadStories } from "@/music/stories";
import { HScroll } from "@/scroll-row";
import { ApiError, api, upload } from "@/server";
import { useSession } from "@/session";
import { CLIP_MAX_SECONDS, shrinkPhoto } from "@/shrink";
import { opensOn } from "@/social/capsule";
import { asQuoted, QuotedCard } from "@/social/quoted";
import { AppScreen, TopBar } from "@/social/screen";
import { type NativeTheme, useStyles, useTheme } from "@/theme";
import { Pill } from "@/ui";
import { canTrim } from "@/video-trim";

type Mode = "post" | "story" | "clip";
const MODES: [Mode, string][] = [
  ["post", "Post"],
  ["story", "Story"],
  ["clip", "Clip"],
];
const TITLE: Record<Mode, string> = { post: "New post", story: "New Story", clip: "New Clip" };
/** The longest part of a song each can use. */
const MUSIC_MAX: Record<Mode, number> = { post: 60_000, story: 60_000, clip: 60_000 };
/** How long a poll stays open, as people say it. */
const POLL_LENGTH: Record<(typeof POLL_HOURS)[number], string> = {
  1: "1 hour",
  6: "6 hours",
  24: "1 day",
  72: "3 days",
  168: "1 week",
};
/** When a time capsule can open, as people say it. */
const CAPSULE_WHEN = [
  ["tomorrow", "Tomorrow"],
  ["week", "In a week"],
  ["month", "In a month"],
  ["half", "In 6 months"],
  ["year", "In a year"],
  ["newyear", "New Year's Day"],
] as const;
type CapsuleWhen = (typeof CAPSULE_WHEN)[number][0];

/** The moment a capsule opens: on the hour, so it reads "at 9:00 PM", never "at 9:47". */
function capsuleDate(when: CapsuleWhen, now = new Date()): Date {
  if (when === "newyear") {
    const next = new Date(now.getFullYear() + 1, 0, 1);
    // Too close to midnight on 31 December: the New Year after that.
    return next.getTime() - now.getTime() < 2 * 3_600_000
      ? new Date(now.getFullYear() + 2, 0, 1)
      : next;
  }
  const d = new Date(now);
  if (when === "tomorrow") d.setDate(d.getDate() + 1);
  if (when === "week") d.setDate(d.getDate() + 7);
  if (when === "month") d.setMonth(d.getMonth() + 1);
  if (when === "half") d.setMonth(d.getMonth() + 6);
  if (when === "year") d.setFullYear(d.getFullYear() + 1);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

const VIDEO_MAX_BYTES = MEDIA_RULES.video.maxBytes;

/**
 * The longest part of a video that can be kept: the Clip limit, and short enough to fit under the
 * upload size (judged from the whole file's size per second, with a little room to spare).
 */
/** A video over the length or size Realm takes. */
function overLimit(a: ImagePicker.ImagePickerAsset) {
  return (
    a.type === "video" &&
    ((a.duration ?? 0) > CLIP_MAX_SECONDS * 1000 + 500 || (a.fileSize ?? 0) > VIDEO_MAX_BYTES)
  );
}

/** Taller than wide (or not known): fills the 4:5 frame. Anything else shows whole, on black. */
function tall(a: ImagePicker.ImagePickerAsset | undefined) {
  return !a?.width || !a.height || a.height > a.width;
}

/** A picked video in the big preview: plays muted on a loop, as it will in the feed. */
function PreviewVideo({ asset }: { asset: ImagePicker.ImagePickerAsset }) {
  const s = useStyles(make);
  const player = useVideoPlayer({ uri: asset.uri }, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <View style={[s.bigPhoto, { backgroundColor: "#000" }]}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit={tall(asset) ? "cover" : "contain"}
        nativeControls={false}
        // Android: a texture view clips to the rounded frame, and the player's own black cover lifts
        // at the first frame. Without it, the video shown just as the trimmer closes stayed hidden
        // for good (the player played, the picture stayed black).
        surfaceType="textureView"
        useExoShutter
        accessibilityLabel="Your video"
      />
    </View>
  );
}

function keepAtMost(video: ImagePicker.ImagePickerAsset): number {
  const ms = video.duration ?? 0;
  const bytes = video.fileSize ?? 0;
  const fits = ms > 0 && bytes > 0 ? Math.floor((VIDEO_MAX_BYTES * 0.92) / (bytes / ms)) : Infinity;
  return Math.min(CLIP_MAX_SECONDS * 1000, fits);
}

/** A photo that can be edited here (a GIF would lose its movement). */
function editable(a: ImagePicker.ImagePickerAsset | undefined) {
  return Boolean(a && a.type !== "video" && a.mimeType !== "image/gif");
}

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
    /** A quote post: the public post it's about. */
    quote?: string;
  }>();
  const { accent } = useTheme();
  const { session } = useSession();
  const me = session.status === "signedIn" ? session.user : null;
  const profile = useApi<Profile>(me ? `/users/${me.username}/profile` : null);
  const spaces = useApi<{ spaces: SpaceDetail[] }>("/users/@me/communities");
  const quoteId = params.quote && /^\d{1,20}$/.test(params.quote) ? params.quote : null;
  const quoting = useApi<Post>(quoteId ? `/posts/${quoteId}` : null);
  const [mode, setMode] = useState<Mode>(
    !quoteId && (params.mode === "clip" || params.mode === "story") ? params.mode : "post",
  );
  /** A poll on a post of just words: its choices, and how long it stays open. */
  const [poll, setPoll] = useState<{
    options: string[];
    hours: (typeof POLL_HOURS)[number];
  } | null>(null);
  /** Seal the post as a time capsule: when it opens. */
  const [capsule, setCapsule] = useState<CapsuleWhen | null>(null);
  const choices = (poll?.options ?? []).map((o) => o.trim()).filter(Boolean);
  const pollReady =
    !poll ||
    (choices.length >= 2 && new Set(choices.map((c) => c.toLowerCase())).size === choices.length);
  const [picked, setPicked] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [caption, setCaption] = useState("");
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [flip, setFlip] = useState(false);
  const [spaceOnly, setSpaceOnly] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [music, setMusic] = useState<Picked | null>(null);
  const [choosing, setChoosing] = useState(false);
  /** A Clip's second step: caption, sound sharing, who sees it. */
  const [details, setDetails] = useState(false);
  /** Which picked photo the big preview shows. */
  const [selected, setSelected] = useState(0);
  /** The picked photo open in the editor. */
  const [editing, setEditing] = useState<number | null>(null);
  /** The picked video open in the trimmer; "must" when it's too long or too big as it is. */
  const [trimming, setTrimming] = useState<{
    index: number;
    note?: string;
    must: boolean;
  } | null>(null);
  const [shareSound, setShareSound] = useState(false);
  const [soundName, setSoundName] = useState("");
  // Instagram's "advanced settings", in plain sight: tags, hidden likes, comments.
  const [tags, setTags] = useState("");
  const [hideLikes, setHideLikes] = useState(false);
  const [commentsOff, setCommentsOff] = useState(false);
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
  // A time capsule is a post on your profile: never a poll, a quote, a Story or a Clip.
  const sealing = capsule !== null && mode === "post" && !quoteId && !poll;
  const ready =
    (single ? picked.length === 1 : picked.length > 0 || caption.trim().length > 0) &&
    // A poll needs its question, and two different choices.
    (!poll || (caption.trim().length > 0 && pollReady)) &&
    !status;
  const what = mode === "story" ? "Story" : "post";

  async function pick(from: "library" | "camera") {
    if (poll) {
      alert("A poll is words only", "Remove the poll first if you'd rather share photos.");
      return;
    }
    const options: ImagePicker.ImagePickerOptions = {
      // A post takes photos and videos, mixed; a Clip is one video.
      mediaTypes: mode === "clip" ? ["videos"] : ["images", "videos"],
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
    const list = single ? res.assets.slice(0, 1) : [...picked, ...res.assets].slice(0, 10);
    setPicked(fitOrTrim(list));
  }

  /**
   * The first video that's too long or too big opens in the trimmer, with the part that fits
   * already chosen; the next one opens after it. Where this build can't cut, it's taken out and
   * the person is told how to fix it.
   */
  function fitOrTrim(list: ImagePicker.ImagePickerAsset[]): ImagePicker.ImagePickerAsset[] {
    const index = list.findIndex(overLimit);
    const video = list[index];
    if (!video) return list;
    const long = (video.duration ?? 0) > CLIP_MAX_SECONDS * 1000 + 500;
    const mb = Math.round(VIDEO_MAX_BYTES / 1024 / 1024);
    // This build can cut it here: open the trimmer with the part that fits already chosen.
    if (canTrim && video.duration && keepAtMost(video) >= 1000) {
      setTrimming({
        index,
        must: true,
        note: long
          ? `Videos can be up to ${CLIP_MAX_SECONDS} seconds. Choose the part to keep.`
          : `This video is over ${mb} MB, the most Realm takes. Choose a shorter part to keep.`,
      });
      return list;
    }
    alert(
      long ? "That video is too long" : "That video is too big",
      long
        ? `Videos can be up to ${CLIP_MAX_SECONDS} seconds. Trim it in your gallery first, then pick it again.`
        : `Videos can be up to ${mb} MB. Trim it shorter in your gallery, or record at a lower quality.`,
    );
    return fitOrTrim(list.filter((_, i) => i !== index));
  }

  function switchMode(m: Mode) {
    setMode(m);
    setPoll(null);
    setCapsule(null);
    setPicked([]);
    setDetails(false);
    // A song's part can be too long for the new kind: keep the song, shorten the part.
    if (music) setMusic({ ...music, durationMs: Math.min(music.durationMs, MUSIC_MAX[m]) });
  }

  async function share(closeOnly = false) {
    if (!ready) return;
    try {
      const ids: string[] = [];
      for (const [i, a] of picked.entries()) {
        const which = picked.length > 1 ? `${i + 1} of ${picked.length}` : "";
        setStatus(`Uploading ${which}`.trim());
        const isVideo = a.type === "video";
        // Photos are made smaller first, so they upload faster and storage lasts longer.
        const file = isVideo
          ? { uri: a.uri, mimeType: a.mimeType ?? "video/mp4" }
          : await shrinkPhoto(a);
        ids.push(
          await upload(
            {
              uri: file.uri,
              kind: isVideo ? "video" : "image",
              mimeType: file.mimeType,
              durationMs: a.duration ?? undefined,
              ...(isVideo && a.width && a.height ? { width: a.width, height: a.height } : {}),
            },
            (p) => setStatus(`Uploading ${which} ${Math.round(p * 100)}%`.replace("  ", " ")),
          ),
        );
      }
      setStatus("Sharing");
      const sound = music && (mode !== "post" || ids.length) ? toPick(music) : undefined;
      const opensAt = sealing && capsule ? capsuleDate(capsule).toISOString() : null;
      if (mode === "story") {
        await api("/stories", {
          body: {
            mediaId: ids[0],
            caption: caption.trim() || undefined,
            sound,
            durationMs: shownFor,
            // A private account's Stories go to its followers unless this one is made public.
            visibility: closeOnly
              ? "close_friends"
              : isPrivate
                ? flip
                  ? "public"
                  : "followers"
                : flip
                  ? "followers"
                  : "public",
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
          ...(spaceId && !sealing ? { spaceId } : {}),
          visibility: sealing && visibility === "space" ? "public" : visibility,
          ...(tagList(tags).length && !sealing ? { tags: tagList(tags) } : {}),
          ...(hideLikes ? { hideLikes } : {}),
          ...(commentsOff ? { commentsOff } : {}),
          ...(poll && mode === "post" && !ids.length
            ? { poll: { options: choices, hours: poll.hours } }
            : {}),
          ...(quoteId ? { quoteOf: quoteId } : {}),
          ...(opensAt ? { opensAt } : {}),
        },
      });
      // The Clip's own sound, shared for others to use. The Clip is already up if this fails.
      if (mode === "clip" && shareSound && !music && ids[0]) {
        await api("/sounds", {
          body: { mediaId: ids[0], title: soundName.trim() || "Original sound" },
        }).catch(() => {});
      }
      postsChanged();
      if (opensAt) {
        alert(
          "Time capsule sealed",
          `It opens ${opensOn(opensAt)}. Until then it waits on your profile with a countdown, and only you can see what's inside.`,
        );
      }
      leave(router);
    } catch (err) {
      setStatus(null);
      alert(
        "Not shared",
        err instanceof ApiError ? err.message : "Something went wrong. Try again.",
      );
    }
  }

  // A Story, or a Clip before its details: the full-screen editor.
  const everyone = isPrivate ? flip : !flip;
  const asset = picked[0];
  const shown = picked[Math.min(selected, picked.length - 1)];
  const picker = (
    <MusicPicker
      visible={choosing}
      maxMs={MUSIC_MAX[mode]}
      onClose={() => setChoosing(false)}
      onPick={(p) => {
        setMusic(p);
        setChoosing(false);
      }}
    />
  );
  // Editing a photo, or trimming a video: full screen, over everything else.
  const editingAsset = editing !== null ? picked[editing] : undefined;
  if (editing !== null && editingAsset) {
    return (
      <PhotoEditor
        photo={editingAsset}
        onCancel={() => setEditing(null)}
        onDone={(edited) => {
          setPicked((all) =>
            all.map((a, i) =>
              i === editing ? { ...a, ...edited, fileSize: undefined, fileName: undefined } : a,
            ),
          );
          setEditing(null);
        }}
      />
    );
  }
  const trimAsset = trimming ? picked[trimming.index] : undefined;
  if (trimming && trimAsset?.type === "video") {
    const at = trimming.index;
    return (
      <VideoTrimmer
        video={{
          uri: trimAsset.uri,
          durationMs: trimAsset.duration ?? 0,
          sizeBytes: trimAsset.fileSize ?? undefined,
        }}
        limitMs={CLIP_MAX_SECONDS * 1000}
        maxBytes={VIDEO_MAX_BYTES}
        note={trimming.note}
        must={trimming.must}
        onCancel={() => {
          setTrimming(null);
          // Too long or too big to share as it is: it's taken out, and the next one opens.
          if (trimming.must) {
            setSelected(0);
            setPicked(fitOrTrim(picked.filter((_, i) => i !== at)));
          }
        }}
        onDone={(cut) => {
          setTrimming(null);
          const next = picked.map((a, i) =>
            i === at
              ? {
                  ...a,
                  uri: cut.uri,
                  duration: cut.durationMs,
                  width: cut.width || a.width,
                  height: cut.height || a.height,
                  fileSize: cut.sizeBytes || undefined,
                  mimeType: "video/mp4",
                  fileName: undefined,
                }
              : a,
          );
          setPicked(fitOrTrim(next));
        }}
      />
    );
  }

  if ((mode === "story" || (mode === "clip" && !details)) && picked.length === 1 && asset) {
    return (
      <>
        <Stage
          mode={mode}
          asset={asset}
          music={music}
          caption={caption}
          shownFor={shownFor}
          everyone={everyone}
          isPrivate={isPrivate}
          status={status}
          onCaption={setCaption}
          onMusic={() => setChoosing(true)}
          onClearMusic={() => {
            stopSound();
            setMusic(null);
          }}
          onLength={setStoryMs}
          onAudience={(all) => setFlip(isPrivate ? all : !all)}
          onDiscard={() => {
            stopSound();
            setPicked([]);
          }}
          onShare={mode === "story" ? () => void share() : () => setDetails(true)}
          onShareClose={mode === "story" ? () => void share(true) : undefined}
          onEdit={editable(asset) ? () => setEditing(0) : undefined}
          onTrim={
            canTrim && asset.duration ? () => setTrimming({ index: 0, must: false }) : undefined
          }
        />
        {picker}
      </>
    );
  }

  // The words: a caption, a poll's question, or what you say about a quoted post.
  const captionField = (
    <>
      <Text style={s.label}>{poll ? "Your question" : quoteId ? "Your words" : "Caption"}</Text>
      <TextInput
        value={caption}
        onChangeText={setCaption}
        placeholder={
          poll
            ? "Ask something"
            : quoteId
              ? "Add what you think"
              : mode === "clip"
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
    </>
  );

  return (
    <AppScreen>
      <TopBar
        title={quoteId ? "Quote" : TITLE[mode]}
        right={
          <Pill
            size="md"
            label={sealing ? "Seal" : "Share"}
            pending={Boolean(status)}
            pendingLabel={status ?? "Sharing"}
            onPress={() => void share()}
            style={!ready && !status ? s.off : undefined}
          />
        }
      />
      <KeyboardAvoidingView behavior="padding" style={s.fill}>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          {quoteId ? (
            // A quote is a post: your words (and photos if you like) above someone's post.
            <>
              {captionField}
              <Text style={s.label}>You're quoting</Text>
              {quoting.data ? (
                <View style={s.quoting}>
                  <QuotedCard quoted={asQuoted(quoting.data)} still />
                </View>
              ) : (
                <Text style={s.toggleLine}>
                  {quoting.error ? "That post can't be quoted any more." : "Loading the post"}
                </Text>
              )}
            </>
          ) : (
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
          )}

          {mode === "post" && picked.length ? (
            // The photos and videos big, as they'll look in the feed (4:5), before the details.
            <View style={s.big}>
              {shown?.type === "video" ? (
                <PreviewVideo key={shown.uri} asset={shown} />
              ) : (
                <Image
                  source={{ uri: shown?.uri }}
                  style={s.bigPhoto}
                  contentFit={tall(shown) ? "cover" : "contain"}
                />
              )}
              {picked.length > 1 ? (
                <Text style={s.bigCount}>
                  {Math.min(selected, picked.length - 1) + 1}/{picked.length}
                </Text>
              ) : null}
              {shown?.type === "video" && canTrim && shown.duration ? (
                <Pressable
                  onPress={() =>
                    setTrimming({ index: Math.min(selected, picked.length - 1), must: false })
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Trim this video"
                  style={({ pressed }) => [s.bigEdit, pressed && s.pressed]}
                >
                  <Icon name="Scissors" size={16} color="#ffffff" />
                  <Text style={s.bigEditText}>Trim</Text>
                </Pressable>
              ) : null}
              {editable(picked[Math.min(selected, picked.length - 1)]) ? (
                <Pressable
                  onPress={() => setEditing(Math.min(selected, picked.length - 1))}
                  accessibilityRole="button"
                  accessibilityLabel="Edit this photo: crop, turn or mirror"
                  style={({ pressed }) => [s.bigEdit, pressed && s.pressed]}
                >
                  <Icon name="Crop" size={16} color="#ffffff" />
                  <Text style={s.bigEditText}>Edit</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <HScroll showsHorizontalScrollIndicator={false} contentContainerStyle={s.picked}>
            {picked.map((a, i) => (
              <View key={a.uri} style={s.thumb}>
                {/* Choosing the photo and removing it are side by side, never nested. */}
                <Pressable
                  onPress={() => setSelected(i)}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${a.type === "video" ? "video" : "photo"} ${i + 1}`}
                  style={s.thumbFill}
                >
                  {a.type === "video" ? (
                    <View style={[s.thumbFill, s.video]}>
                      <Icon name="PlayFill" size={26} color="#ffffff" />
                    </View>
                  ) : (
                    <Image source={{ uri: a.uri }} style={s.thumbFill} contentFit="cover" />
                  )}
                </Pressable>
                {/* The ring is its own layer: adding and taking a border off the tile itself made
                    Android stop drawing what was inside it. */}
                {mode === "post" && i === selected ? (
                  <View style={[s.thumbRing, { borderColor: accent }]} pointerEvents="none" />
                ) : null}
                <Pressable
                  onPress={() => {
                    setPicked(picked.filter((_, j) => j !== i));
                    setSelected(0);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${a.type === "video" ? "video" : "photo"} ${i + 1}`}
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
                        : "Photos or videos"}
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
          </HScroll>

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

          {quoteId ? null : captionField}

          {mode === "post" && !quoteId && picked.length === 0 && !sealing ? (
            poll ? (
              <View style={s.pollBox}>
                <View style={s.pollHead}>
                  <Text style={s.toggleTitle}>Poll</Text>
                  <Pressable
                    onPress={() => setPoll(null)}
                    accessibilityRole="button"
                    hitSlop={8}
                    style={s.musicBtn}
                  >
                    <Text style={s.musicBtnText}>Remove</Text>
                  </Pressable>
                </View>
                {poll.options.map((value, i) => (
                  <View
                    // biome-ignore lint/suspicious/noArrayIndexKey: the choices are edited in place.
                    key={i}
                    style={s.pollRow}
                  >
                    <TextInput
                      value={value}
                      onChangeText={(text) =>
                        setPoll({
                          ...poll,
                          options: poll.options.map((o, j) => (j === i ? text : o)),
                        })
                      }
                      placeholder={`Choice ${i + 1}`}
                      placeholderTextColor={t.colors.textMuted}
                      selectionColor={accent}
                      cursorColor={accent}
                      maxLength={POLL_OPTION_MAX}
                      style={[s.tagInput, s.fill]}
                      accessibilityLabel={`Choice ${i + 1}`}
                    />
                    {poll.options.length > 2 ? (
                      <Pressable
                        onPress={() =>
                          setPoll({ ...poll, options: poll.options.filter((_, j) => j !== i) })
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`Remove choice ${i + 1}`}
                        hitSlop={6}
                        style={s.pollX}
                      >
                        <Icon name="X" size={18} color={t.colors.textSoft} />
                      </Pressable>
                    ) : null}
                  </View>
                ))}
                {poll.options.length < 4 ? (
                  <Pressable
                    onPress={() => setPoll({ ...poll, options: [...poll.options, ""] })}
                    accessibilityRole="button"
                    style={({ pressed }) => [s.pollAdd, pressed && s.pressed]}
                  >
                    <Icon name="Plus" size={16} color={t.colors.text} />
                    <Text style={s.musicBtnText}>Add a choice</Text>
                  </Pressable>
                ) : null}
                {!pollReady && choices.length >= 2 ? (
                  <Text style={s.pollWarn}>Two choices are the same.</Text>
                ) : null}
                <Text style={s.label}>Open for</Text>
                <View style={s.lengths} accessibilityRole="radiogroup">
                  {POLL_HOURS.map((h) => {
                    const on = poll.hours === h;
                    return (
                      <Pressable
                        key={h}
                        onPress={() => setPoll({ ...poll, hours: h })}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}
                        style={[s.length, on && s.lengthOn]}
                      >
                        <Text style={[s.lengthText, on && s.lengthTextOn]}>{POLL_LENGTH[h]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={s.toggleLine}>
                  People see the numbers after they vote. Nobody sees who chose what.
                </Text>
              </View>
            ) : (
              <Pressable
                onPress={() => setPoll({ options: ["", ""], hours: 24 })}
                accessibilityRole="button"
                style={({ pressed }) => [s.music, s.musicAdd, pressed && s.pressed]}
              >
                <View style={[s.musicPlay, s.musicIcon]}>
                  <Icon name="ChartBarHorizontal" size={18} color={t.colors.text} />
                </View>
                <View style={s.fill}>
                  <Text style={s.musicTitle}>Add a poll</Text>
                  <Text style={s.musicLine}>Ask a question with 2 to 4 choices</Text>
                </View>
                <Icon name="CaretRight" size={18} color={t.colors.textSoft} />
              </Pressable>
            )
          ) : null}

          {mode === "post" && !quoteId && !poll ? (
            sealing && capsule ? (
              <View style={s.pollBox}>
                <View style={s.pollHead}>
                  <Text style={s.toggleTitle}>Time capsule</Text>
                  <Pressable
                    onPress={() => setCapsule(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Don't seal it"
                    hitSlop={8}
                    style={s.musicBtn}
                  >
                    <Text style={s.musicBtnText}>Remove</Text>
                  </Pressable>
                </View>
                <Text style={s.label}>Opens</Text>
                <View style={s.lengths} accessibilityRole="radiogroup">
                  {CAPSULE_WHEN.map(([key, label]) => {
                    const on = capsule === key;
                    return (
                      <Pressable
                        key={key}
                        onPress={() => setCapsule(key)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}
                        style={[s.length, on && s.lengthOn]}
                      >
                        <Text style={[s.lengthText, on && s.lengthTextOn]}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={s.capsuleWhen}>{opensOn(capsuleDate(capsule).toISOString())}</Text>
                <Text style={s.toggleLine}>
                  Until then, people see a sealed capsule with a countdown, never what's inside.
                  Likes and comments open with it, and you get told when it opens.
                </Text>
              </View>
            ) : (
              <Pressable
                onPress={() => setCapsule("month")}
                accessibilityRole="button"
                style={({ pressed }) => [s.music, s.musicAdd, pressed && s.pressed]}
              >
                <View style={[s.musicPlay, s.musicIcon]}>
                  <Icon name="HourglassMedium" size={18} color={t.colors.text} />
                </View>
                <View style={s.fill}>
                  <Text style={s.musicTitle}>Seal as a time capsule</Text>
                  <Text style={s.musicLine}>It stays sealed until the day you pick</Text>
                </View>
                <Icon name="CaretRight" size={18} color={t.colors.textSoft} />
              </Pressable>
            )
          ) : null}

          {mode !== "story" && !sealing && spaces.data?.spaces.length ? (
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
          {mode !== "story" ? (
            <>
              {sealing ? null : (
                <>
                  <Text style={s.label}>Tag people</Text>
                  <TextInput
                    value={tags}
                    onChangeText={setTags}
                    placeholder="@username, @another"
                    placeholderTextColor={t.colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    selectionColor={accent}
                    style={s.tagInput}
                    accessibilityLabel="People to tag, by username"
                  />
                </>
              )}
              {(
                [
                  [
                    hideLikes,
                    setHideLikes,
                    "Hide like count",
                    "Only you see how many likes it has.",
                  ],
                  [commentsOff, setCommentsOff, "Turn off comments", "Nobody can comment on it."],
                ] as const
              ).map(([on, setOn, title, line]) => (
                <View key={title} style={s.toggle}>
                  <View style={s.fill}>
                    <Text style={s.toggleTitle}>{title}</Text>
                    <Text style={s.toggleLine}>{line}</Text>
                  </View>
                  <Switch
                    value={on}
                    onValueChange={setOn}
                    trackColor={{ true: accent }}
                    accessibilityLabel={title}
                  />
                </View>
              ))}
            </>
          ) : null}
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

/** "@noor, kenji" → ["noor", "kenji"]: real-looking usernames only, at most 20. */
function tagList(text: string) {
  return [
    ...new Set(
      text
        .split(/[\s,]+/)
        .map((x) => x.replace(/^@/, "").toLowerCase())
        .filter((x) => /^[a-z0-9_.]{1,30}$/.test(x)),
    ),
  ].slice(0, 20);
}

const make = (t: NativeTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    off: { opacity: 0.45 },
    tagInput: {
      minHeight: 46,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: t.colors.surfaceRaised,
      fontFamily: t.fonts.body,
      fontSize: 16 * t.textScale,
      color: t.colors.text,
    },
    pressed: { opacity: 0.75 },
    quoting: { marginHorizontal: -14, marginBottom: 10 },
    pollBox: {
      gap: 10,
      marginTop: 12,
      padding: 14,
      borderRadius: t.radius.box,
      borderWidth: 1.5,
      borderColor: t.colors.border,
    },
    pollHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    pollRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    pollX: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    pollAdd: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 8,
      minHeight: 44,
      paddingHorizontal: 4,
    },
    capsuleWhen: {
      fontFamily: t.fonts.bold,
      fontSize: 15.5 * t.textScale,
      color: t.colors.text,
    },
    pollWarn: {
      fontFamily: t.fonts.body,
      fontSize: 14 * t.textScale,
      color: t.colors.danger,
    },
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
    big: {
      marginBottom: 12,
      borderRadius: t.radius.media,
      overflow: "hidden",
      backgroundColor: t.colors.surfaceSunken,
    },
    bigPhoto: { width: "100%", aspectRatio: 4 / 5, backgroundColor: "#000" },
    bigEdit: {
      position: "absolute",
      left: 10,
      bottom: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: 20,
      backgroundColor: "rgba(0,0,0,0.6)",
    },
    bigEditText: { fontFamily: t.fonts.bold, fontSize: 13.5 * t.textScale, color: "#ffffff" },
    bigCount: {
      position: "absolute",
      top: 10,
      right: 10,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: "rgba(0,0,0,0.55)",
      color: "#ffffff",
      fontFamily: t.fonts.bold,
      fontSize: 12.5 * t.textScale,
    },
    thumb: {
      width: 120,
      height: 150,
      borderRadius: 14,
      overflow: "hidden",
      backgroundColor: t.colors.surfaceSunken,
    },
    thumbFill: { width: "100%", height: "100%" },
    thumbRing: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 14,
      borderWidth: 2.5,
    },
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
