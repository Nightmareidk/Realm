/**
 * The maths behind the website's photo editor and video trimmer, kept apart from the screens so
 * it can be tested. It matches the app's editors (frontend/app/src/create/edit-photo.tsx and
 * trim-video.tsx): the same shapes, the same zoom limits and the same "part that fits" rule.
 */

export interface Size {
  w: number;
  h: number;
}

export const SHAPES = [
  { id: "original", label: "Original", ratio: null },
  { id: "square", label: "Square", ratio: 1 },
  { id: "4:5", label: "4:5", ratio: 4 / 5 },
  { id: "9:16", label: "9:16", ratio: 9 / 16 },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
] as const;
export type ShapeId = (typeof SHAPES)[number]["id"];

export const MAX_ZOOM = 5;
/** The longest side the editor works with; bigger photos are made smaller first, like the app. */
export const MAX_SIDE = 2400;

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function ratioOf(shape: ShapeId, image: Size): number {
  const found = SHAPES.find((s) => s.id === shape);
  return found?.ratio ?? (image.h > 0 ? image.w / image.h : 1);
}

/** The biggest frame of that shape that fits on the stage, with some room around it. */
export function frameSize(stage: Size, ratio: number, pad = 24): Size {
  const w = Math.max(0, Math.min(stage.w - pad * 2, (stage.h - pad * 2) * ratio));
  return { w, h: ratio > 0 ? w / ratio : 0 };
}

/** How much the photo is scaled to just cover the frame (zoom 1). */
export function coverScale(frame: Size, image: Size): number {
  if (image.w <= 0 || image.h <= 0) return 1;
  return Math.max(frame.w / image.w, frame.h / image.h);
}

/** Keeps the photo covering the whole frame: it can't be dragged so far that an edge shows. */
export function clampOffset(
  offset: { x: number; y: number },
  image: Size,
  scale: number,
  frame: Size,
) {
  const mx = Math.max(0, (image.w * scale - frame.w) / 2);
  const my = Math.max(0, (image.h * scale - frame.h) / 2);
  return { x: clamp(offset.x, -mx, mx), y: clamp(offset.y, -my, my) };
}

/**
 * The part of the photo inside the frame, in the photo's own pixels. `offset` is how far the
 * photo's centre is from the frame's centre on screen.
 */
export function cropRect(
  image: Size,
  frame: Size,
  scale: number,
  offset: { x: number; y: number },
) {
  const width = Math.max(1, Math.min(image.w, Math.round(frame.w / scale)));
  const height = Math.max(1, Math.min(image.h, Math.round(frame.h / scale)));
  const left = clamp(Math.round(image.w / 2 - offset.x / scale - width / 2), 0, image.w - width);
  const top = clamp(Math.round(image.h / 2 - offset.y / scale - height / 2), 0, image.h - height);
  return { left, top, width, height };
}

/**
 * The longest part of a video that can be kept: at most `limitMs`, and small enough to stay under
 * `maxBytes` (judged from the video's average size per second, with some room to spare).
 */
export function keepAtMost(totalMs: number, sizeBytes: number, limitMs: number, maxBytes: number) {
  const fits =
    totalMs > 0 && sizeBytes > 0 ? Math.floor((maxBytes * 0.92) / (sizeBytes / totalMs)) : Infinity;
  return Math.max(0, Math.min(limitMs, fits, totalMs > 0 ? totalMs : limitMs));
}

/** "0:07.4", "1:02.0". */
export function clock(ms: number) {
  const s = Math.max(0, ms) / 1000;
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, "0")}`;
}

/** A new name for an edited file, with the right ending: "beach.heic" → "beach.jpg". */
export function renamed(name: string, ending: string) {
  const base = name.replace(/\.[^./\\]+$/, "") || "realm";
  return `${base}.${ending}`;
}
