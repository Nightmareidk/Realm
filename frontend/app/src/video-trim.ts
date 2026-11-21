import { requireOptionalNativeModule } from "expo";

/** A cut-out part of a video, as a new file on the phone. */
export interface TrimmedVideo {
  uri: string;
  durationMs: number;
  /** Where the part really starts: the key frame at or just before the chosen start. */
  startMs: number;
  /** Its shape as shown (after the phone's rotation note). 0 when it couldn't be read. */
  width: number;
  height: number;
  sizeBytes: number;
}

interface TrimModule {
  trimAsync(uri: string, startMs: number, endMs: number): Promise<TrimmedVideo>;
}

// Realm's own small native module (modules/realm-video-trim). Missing in the browser preview and
// in app builds made before it existed, so everything that uses it checks `canTrim` first.
const native = requireOptionalNativeModule<TrimModule>("RealmVideoTrim");

/** True when this build can cut videos on the phone. */
export const canTrim = native !== null;

/**
 * Keeps only the part of a video between two times, without making the video again (so it's quick
 * and keeps its quality). Throws with a message people can read when it can't.
 */
export async function trimVideo(uri: string, startMs: number, endMs: number) {
  if (!native) throw new Error("Trimming isn't available in this version of Realm.");
  return native.trimAsync(uri, Math.max(0, Math.round(startMs)), Math.round(endMs));
}
