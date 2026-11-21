"use client";

import { Pause, Play } from "@phosphor-icons/react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cx } from "@/lib/cx";
import { clamp, clock, keepAtMost, renamed } from "@/lib/media-edit";

/** The shortest part you can keep. */
const MIN_MS = 1_000;
const THUMBS = 10;

/**
 * Cuts the chosen part out of a video in the browser without making it again (Mediabunny copies
 * the existing frames, starting on the key frame just before `startMs`, like the app's trimmer).
 * Mediabunny is loaded only when someone trims, so it never slows down the rest of the site.
 */
async function cutVideo(
  file: File,
  startMs: number,
  endMs: number,
  onProgress: (fraction: number) => void,
): Promise<File> {
  const m = await import("mediabunny");
  const input = new m.Input({ formats: m.ALL_FORMATS, source: new m.BlobSource(file) });
  try {
    const webm = file.type === "video/webm";
    const target = new m.BufferTarget();
    const output = new m.Output({
      format: webm ? new m.WebMOutputFormat() : new m.Mp4OutputFormat({ fastStart: "in-memory" }),
      target,
    });
    const conversion = await m.Conversion.init({
      input,
      output,
      trim: { start: startMs / 1000, end: endMs / 1000 },
      copy: {
        mode: "preferred",
        shiftTolerance: Number.POSITIVE_INFINITY,
        boundaryPolicy: "expand",
      },
      showWarnings: false,
    });
    if (!conversion.isValid) throw new Error("This video can't be cut here.");
    conversion.onProgress = (p) => onProgress(p);
    await conversion.execute();
    if (!target.buffer) throw new Error("Nothing came out.");
    const type = webm ? "video/webm" : "video/mp4";
    return new File([target.buffer], renamed(file.name, webm ? "webm" : "mp4"), { type });
  } finally {
    input.dispose();
  }
}

/** How long a video file plays, in ms (undefined when the browser can't tell). */
function lengthOf(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    const finish = (ms?: number) => {
      URL.revokeObjectURL(url);
      resolve(ms);
    };
    v.preload = "metadata";
    v.onloadedmetadata = () =>
      finish(Number.isFinite(v.duration) ? Math.round(v.duration * 1000) : undefined);
    v.onerror = () => finish(undefined);
    v.src = url;
  });
}

/** Small pictures along the trimmer, taken from the video itself. Gives up quietly. */
function useThumbnails(url: string | null, totalMs: number) {
  const [thumbs, setThumbs] = useState<string[]>([]);
  useEffect(() => {
    if (!url || totalMs <= 0) return;
    let live = true;
    const v = document.createElement("video");
    v.muted = true;
    v.preload = "auto";
    v.src = url;
    const c = document.createElement("canvas");
    const seek = (t: number) =>
      new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("slow")), 4_000);
        v.onseeked = () => {
          clearTimeout(timer);
          resolve();
        };
        v.currentTime = t;
      });
    (async () => {
      const made: string[] = [];
      try {
        await new Promise<void>((resolve, reject) => {
          v.onloadeddata = () => resolve();
          v.onerror = () => reject(new Error("no video"));
        });
        const h = 96;
        const w = Math.max(1, Math.round((h * v.videoWidth) / Math.max(1, v.videoHeight)));
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) return;
        for (let i = 0; i < THUMBS && live; i++) {
          await seek(((i + 0.5) / THUMBS) * (totalMs / 1000));
          ctx.drawImage(v, 0, 0, w, h);
          made.push(c.toDataURL("image/jpeg", 0.6));
          if (live) setThumbs([...made]);
        }
      } catch {
        // No pictures: the plain bar still works.
      }
    })();
    return () => {
      live = false;
      v.removeAttribute("src");
      v.load();
    };
  }, [url, totalMs]);
  return thumbs;
}

/**
 * The website's video trimmer, the same as the app's: the video plays the chosen part over and
 * over, and the two handles (or dragging the middle, or the arrow keys) choose what to keep, up to
 * `limitMs` and small enough for `maxBytes`. When `must` is set, the video was too long or too big
 * and Done cuts it even if nothing was moved.
 */
export function VideoTrimmer({
  file,
  limitMs,
  maxBytes,
  note,
  must,
  onDone,
  onCancel,
}: {
  file: File;
  limitMs: number;
  maxBytes: number;
  note?: string;
  must: boolean;
  onDone: (trimmed: File) => void;
  onCancel: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [range, setRange] = useState({ start: 0, end: 0 });
  const [playing, setPlaying] = useState(true);
  const [trackW, setTrackW] = useState(0);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const drag = useRef<{
    what: "start" | "end" | "slide";
    x: number;
    start: number;
    end: number;
  } | null>(null);
  const lastSeek = useRef(0);
  const thumbs = useThumbnails(url, total);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => setTrackW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cap = keepAtMost(total, file.size, limitMs, maxBytes);
  const length = range.end - range.start;

  const loaded = () => {
    const v = video.current;
    if (!v || !Number.isFinite(v.duration)) {
      setError("This video can't be opened here. Trim it on your device first.");
      return;
    }
    const ms = Math.round(v.duration * 1000);
    setTotal(ms);
    setRange({ start: 0, end: keepAtMost(ms, file.size, limitMs, maxBytes) });
  };

  const seek = useCallback((ms: number, now = false) => {
    const v = video.current;
    if (!v) return;
    const t = Date.now();
    if (!now && t - lastSeek.current < 90) return;
    lastSeek.current = t;
    v.currentTime = ms / 1000;
  }, []);

  // Plays only the chosen part, over and over.
  const tick = () => {
    const v = video.current;
    if (!v || drag.current || total === 0) return;
    const ms = v.currentTime * 1000;
    if (ms >= range.end - 40 || ms < range.start - 250) seek(range.start, true);
  };

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const msPerPx = trackW > 0 ? total / trackW : 0;

  const setStart = (ms: number) => {
    const start = clamp(ms, Math.max(0, range.end - cap), range.end - MIN_MS);
    setRange((r) => ({ ...r, start }));
    seek(start);
  };
  const setEnd = (ms: number) => {
    const end = clamp(ms, range.start + MIN_MS, Math.min(total, range.start + cap));
    setRange((r) => ({ ...r, end }));
    seek(end);
  };
  const slide = (startMs: number) => {
    const start = clamp(startMs, 0, total - length);
    setRange({ start, end: start + length });
    seek(start);
  };

  const grab = (what: "start" | "end" | "slide") => (e: PointerEvent<HTMLElement>) => {
    if (progress !== null || total === 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    // Blocking the browser's own mouse-down also blocks focus, so the arrow keys follow the
    // handle that was grabbed only if it's focused by hand.
    e.currentTarget.focus({ preventScroll: true });
    drag.current = { what, x: e.clientX, start: range.start, end: range.end };
    video.current?.pause();
  };
  const pull = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const delta = (e.clientX - d.x) * msPerPx;
    if (d.what === "start") {
      const start = clamp(d.start + delta, Math.max(0, d.end - cap), d.end - MIN_MS);
      setRange({ start, end: d.end });
      seek(start);
    } else if (d.what === "end") {
      const end = clamp(d.end + delta, d.start + MIN_MS, Math.min(total, d.start + cap));
      setRange({ start: d.start, end });
      seek(end);
    } else {
      const len = d.end - d.start;
      const start = clamp(d.start + delta, 0, total - len);
      setRange({ start, end: start + len });
      seek(start);
    }
  };
  const letGo = () => {
    if (!drag.current) return;
    drag.current = null;
    seek(range.start, true);
    if (playing) video.current?.play().catch(() => {});
  };

  const keys = (what: "start" | "end" | "slide") => (e: KeyboardEvent<HTMLElement>) => {
    const step =
      (e.shiftKey ? 1_000 : 100) * (e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0);
    if (!step) return;
    e.preventDefault();
    if (what === "start") setStart(range.start + step);
    else if (what === "end") setEnd(range.end + step);
    else slide(range.start + step);
  };

  // Escape goes back to the post (not out of the whole maker), unless it's busy cutting.
  useEffect(() => {
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      if (progress === null) onCancel();
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [onCancel, progress]);

  const done = async () => {
    if (total === 0 || progress !== null) return;
    const untouched = range.start === 0 && range.end >= total;
    if (untouched && !must) return onCancel();
    setError("");
    setProgress(0);
    video.current?.pause();
    try {
      const cut = await cutVideo(file, range.start, range.end, setProgress);
      if (cut.size > maxBytes) {
        setProgress(null);
        setError("It's still too big. Choose a shorter part.");
        return;
      }
      // The cut starts on the key frame just before the chosen start, so it can come out a little
      // longer than chosen.
      const cutMs = await lengthOf(cut);
      if (cutMs !== undefined && cutMs > limitMs + 500) {
        setProgress(null);
        setError(
          `That part came out ${(cutMs / 1000).toFixed(1)} s long. Choose a slightly shorter part.`,
        );
        return;
      }
      onDone(cut);
    } catch {
      setProgress(null);
      setError(
        "This video can't be trimmed in this browser. Trim it on your device, then pick it again.",
      );
    }
  };

  const px = (ms: number) => (total > 0 ? (ms / total) * trackW : 0);
  const left = px(range.start);
  const width = Math.max(0, px(range.end) - left);

  return (
    <section
      aria-label="Trim video"
      className="absolute inset-0 z-10 flex flex-col bg-[#050507] text-white"
    >
      <header className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onCancel}
          aria-disabled={progress !== null || undefined}
          className="h-9 rounded-full px-3.5 font-bold text-white/80 hover:bg-white/10 hover:text-white aria-disabled:opacity-50"
        >
          Cancel
        </button>
        <h2 className="flex-1 text-center font-bold">Trim video</h2>
        <button
          type="button"
          onClick={done}
          aria-disabled={total === 0 || progress !== null || undefined}
          className="h-9 min-w-20 rounded-full bg-accent px-4 font-bold text-on-accent aria-disabled:opacity-60"
        >
          {progress !== null ? `${Math.round(progress * 100)}%` : "Done"}
        </button>
      </header>

      {note && <p className="px-5 pb-2 text-center text-[0.92rem] text-white/80">{note}</p>}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {url && (
          <video
            ref={video}
            src={url}
            autoPlay
            muted
            playsInline
            onLoadedMetadata={loaded}
            onTimeUpdate={tick}
            onError={() =>
              setError("This video can't be opened here. Trim it on your device first.")
            }
            className="absolute inset-0 size-full object-contain"
          />
        )}
        <button
          type="button"
          onClick={toggle}
          className="absolute bottom-3 left-3 grid size-11 place-items-center rounded-full bg-[rgb(9_9_12/0.78)] text-white hover:bg-[rgb(9_9_12/0.92)]"
        >
          {playing ? (
            <Pause aria-hidden="true" size={20} weight="fill" />
          ) : (
            <Play aria-hidden="true" size={20} weight="fill" />
          )}
          <span className="sr-only">{playing ? "Pause" : "Play"}</span>
        </button>
        {progress !== null && (
          <p
            className="absolute inset-x-0 top-3 text-center text-[0.92rem] font-bold"
            aria-live="polite"
          >
            Cutting… {Math.round(progress * 100)}%
          </p>
        )}
      </div>

      <div className="space-y-2.5 px-4 pt-3 pb-4">
        {error && (
          <p role="alert" className="text-center text-[0.92rem] text-[#ff8a8a]">
            {error}
          </p>
        )}
        <div className="flex items-baseline justify-between text-[0.88rem] tabular-nums text-white/75">
          <span>{clock(range.start)}</span>
          <span className="font-bold text-white">
            {(length / 1000).toFixed(1)} s{" "}
            <span className="font-normal text-white/60">of up to {Math.floor(cap / 1000)} s</span>
          </span>
          <span>{clock(range.end)}</span>
        </div>
        <div
          ref={track}
          className="relative h-16 touch-none overflow-hidden rounded-xl bg-white/10 select-none"
          onPointerMove={pull}
          onPointerUp={letGo}
          onPointerCancel={letGo}
        >
          <div className="absolute inset-0 flex" aria-hidden="true">
            {thumbs.map((src, i) => (
              // biome-ignore lint/performance/noImgElement: pictures made in the browser (data URLs).
              // biome-ignore lint/suspicious/noArrayIndexKey: the pictures are in time order and never move.
              <img key={i} src={src} alt="" className="h-full min-w-0 flex-1 object-cover" />
            ))}
          </div>
          {/* What's left out is dimmed. */}
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 bg-[rgb(5_5_7/0.68)]"
            style={{ width: left }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-y-0 right-0 bg-[rgb(5_5_7/0.68)]"
            style={{ width: Math.max(0, trackW - left - width) }}
          />
          <div
            role="slider"
            tabIndex={0}
            aria-label="Move the chosen part"
            aria-valuemin={0}
            aria-valuemax={Math.max(0, total - length)}
            aria-valuenow={Math.round(range.start)}
            aria-valuetext={`${clock(range.start)} to ${clock(range.end)}`}
            onPointerDown={grab("slide")}
            onKeyDown={keys("slide")}
            className="absolute inset-y-0 cursor-grab rounded-lg border-y-[3px] border-accent outline-none focus-visible:ring-2 focus-visible:ring-white active:cursor-grabbing"
            style={{ left, width }}
          />
          {(["start", "end"] as const).map((what) => (
            <div
              key={what}
              role="slider"
              tabIndex={0}
              aria-label={what === "start" ? "Start" : "End"}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={Math.round(what === "start" ? range.start : range.end)}
              aria-valuetext={clock(what === "start" ? range.start : range.end)}
              onPointerDown={grab(what)}
              onKeyDown={keys(what)}
              className={cx(
                "absolute inset-y-0 grid w-4 cursor-ew-resize place-items-center bg-accent outline-none focus-visible:ring-2 focus-visible:ring-white",
                what === "start" ? "rounded-l-lg" : "rounded-r-lg",
              )}
              style={{ left: what === "start" ? left : left + width - 16 }}
            >
              <span aria-hidden="true" className="h-6 w-[3px] rounded-full bg-on-accent/80" />
            </div>
          ))}
        </div>
        <p className="text-center text-[0.82rem] text-white/60">
          Drag the ends to choose the part to keep, or drag the middle to move it. Arrow keys work
          too.
        </p>
      </div>
    </section>
  );
}
