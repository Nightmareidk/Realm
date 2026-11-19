import { createVideoPlayer } from "expo-video";
import { Platform } from "react-native";

/** A song file someone chose from their phone or computer. */
export interface PickedSong {
  uri: string;
  name: string;
  mimeType: string;
  size: number | null;
}

/** The audio types Realm takes, by the ending of the file's name. */
const BY_ENDING: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  aac: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  webm: "audio/webm",
};
const TAKEN = new Set(Object.values(BY_ENDING).concat("audio/x-m4a"));

export class SongFileError extends Error {}

/**
 * Lets someone choose a song file. Phones name audio types in many ways, so the type is read
 * from the file's ending first; the server checks the real bytes either way. Returns null when
 * they close the picker without choosing.
 */
export async function pickSongFile(): Promise<PickedSong | null> {
  let picker: typeof import("expo-document-picker");
  try {
    picker = await import("expo-document-picker");
  } catch {
    // An older install of the app, from before it could open the phone's files.
    throw new SongFileError("Update the Realm app to choose a song file from your phone.");
  }
  const result = await picker.getDocumentAsync({
    type: "audio/*",
    copyToCacheDirectory: true,
    multiple: false,
  });
  const file = result.canceled ? null : result.assets[0];
  if (!file) return null;
  const ending = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mimeType =
    BY_ENDING[ending] ?? (file.mimeType && TAKEN.has(file.mimeType) ? file.mimeType : null);
  if (!mimeType) throw new SongFileError("Use an MP3, M4A, WAV or OGG file.");
  return { uri: file.uri, name: file.name, mimeType, size: file.size ?? null };
}

/** A song's name from its file's name: "01 - Night Drive.mp3" becomes "01 - Night Drive". */
export function titleFromFile(name: string): string {
  return name
    .replace(/\.[A-Za-z0-9]{2,4}$/, "")
    .replace(/[_]+/g, " ")
    .trim()
    .slice(0, 80);
}

/** How long a song file plays, in milliseconds (0 when it can't be told in a few seconds). */
export function songLength(uri: string): Promise<number> {
  return new Promise((resolve) => {
    const giveUp = setTimeout(() => finish(0), 8000);
    let finish = (ms: number) => {
      clearTimeout(giveUp);
      resolve(Number.isFinite(ms) && ms > 0 ? Math.round(ms) : 0);
    };
    if (Platform.OS === "web") {
      const audio = new Audio();
      audio.preload = "metadata";
      audio.onloadedmetadata = () => finish(audio.duration * 1000);
      audio.onerror = () => finish(0);
      audio.src = uri;
      return;
    }
    // The phone's own player reads the file's length without playing it.
    const player = createVideoPlayer(uri);
    const done = finish;
    finish = (ms) => {
      loaded.remove();
      failed.remove();
      player.release();
      done(ms);
    };
    const loaded = player.addListener("sourceLoad", (e) => finish(e.duration * 1000));
    const failed = player.addListener("statusChange", (e) => {
      if (e.status === "error") finish(0);
    });
  });
}
