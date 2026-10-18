import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Platform } from "react-native";

/**
 * Photos are saved at most this many pixels on their long side: sharp on any phone screen, and a
 * fraction of a camera photo's size. Realm's storage is free up to 10 GB, so this makes it last.
 */
const MAX_SIDE = 1600;

/** The longest a Clip can be, in seconds. Shorter videos are smaller, and get watched to the end. */
export const CLIP_MAX_SECONDS = 60;

/**
 * Makes a picked photo smaller before it uploads: shrinks it to fit MAX_SIDE and saves it again at
 * good quality. GIFs keep their animation, and pictures with see-through parts stay see-through
 * (WebP on Android, PNG on iPhone). If anything goes wrong, the original is used: shrinking must
 * never stop someone sharing.
 */
export async function shrinkPhoto(photo: {
  uri: string;
  width: number;
  height: number;
  mimeType?: string | null;
}): Promise<{ uri: string; mimeType: string }> {
  const original = { uri: photo.uri, mimeType: photo.mimeType ?? "image/jpeg" };
  if (original.mimeType === "image/gif") return original;
  const clear = original.mimeType === "image/png" || original.mimeType === "image/webp";
  const format = !clear
    ? SaveFormat.JPEG
    : Platform.OS === "android"
      ? SaveFormat.WEBP
      : SaveFormat.PNG;
  try {
    const context = ImageManipulator.manipulate(photo.uri);
    if (Math.max(photo.width, photo.height) > MAX_SIDE) {
      context.resize(photo.width >= photo.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
    }
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ compress: 0.82, format });
    const mimeType =
      format === SaveFormat.JPEG
        ? "image/jpeg"
        : format === SaveFormat.WEBP
          ? "image/webp"
          : "image/png";
    return { uri: saved.uri, mimeType };
  } catch {
    return original;
  }
}
