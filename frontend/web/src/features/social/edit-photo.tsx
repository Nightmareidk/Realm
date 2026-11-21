"use client";

import {
  ArrowClockwise,
  ArrowCounterClockwise,
  FlipHorizontal,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
} from "@phosphor-icons/react";
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
import {
  clamp,
  clampOffset,
  coverScale,
  cropRect,
  frameSize,
  MAX_SIDE,
  MAX_ZOOM,
  ratioOf,
  renamed,
  SHAPES,
  type ShapeId,
  type Size,
} from "@/lib/media-edit";

/** What the edited photo is saved as: see-through PNG and WebP stay see-through. */
function outputType(type: string): { type: string; ending: string } {
  if (type === "image/png") return { type: "image/png", ending: "png" };
  if (type === "image/webp") return { type: "image/webp", ending: "webp" };
  return { type: "image/jpeg", ending: "jpg" };
}

/** GIFs move, so the editor (which keeps one frame) leaves them alone, like the app. */
export const canEditPhoto = (file: File) =>
  file.type.startsWith("image/") && file.type !== "image/gif";

/**
 * The website's photo editor, the same as the app's: a shape (Original, Square, 4:5, 9:16, 16:9),
 * drag and zoom inside the frame (mouse wheel, pinch, double-click, or the keyboard), Turn,
 * Mirror and Reset. It draws on a working copy of at most 2400 px and saves only the part in the
 * frame. Black like the Story editor; the buttons use the theme's accent and fonts.
 */
export function PhotoEditor({
  file,
  onDone,
  onCancel,
}: {
  file: File;
  onDone: (edited: File) => void;
  onCancel: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState<ImageBitmap | null>(null);
  const [image, setImage] = useState<Size>({ w: 0, h: 0 });
  const [stage, setStage] = useState<Size>({ w: 0, h: 0 });
  const [shape, setShape] = useState<ShapeId>("original");
  const [turns, setTurns] = useState(0);
  const [mirrored, setMirrored] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [moving, setMoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number; x: number; y: number } | null>(null);

  // The photo, the right way up (createImageBitmap reads the camera's rotation).
  useEffect(() => {
    let live = true;
    let made: ImageBitmap | null = null;
    createImageBitmap(file)
      .then((bmp) => {
        made = bmp;
        if (live) setSource(bmp);
        else bmp.close();
      })
      .catch(() => live && setError("This photo can't be opened here. Try another one."));
    return () => {
      live = false;
      made?.close();
    };
  }, [file]);

  // The working copy: turned, then mirrored, at most 2400 px on its longest side.
  useLayoutEffect(() => {
    const c = canvas.current;
    if (!c || !source) return;
    const shrink = Math.min(1, MAX_SIDE / Math.max(source.width, source.height));
    const w = Math.round(source.width * shrink);
    const h = Math.round(source.height * shrink);
    const sideways = turns % 2 === 1;
    c.width = sideways ? h : w;
    c.height = sideways ? w : h;
    const ctx = c.getContext("2d");
    if (!ctx) return setError("This browser can't edit photos.");
    ctx.save();
    ctx.translate(c.width / 2, c.height / 2);
    if (mirrored) ctx.scale(-1, 1);
    ctx.rotate((turns * Math.PI) / 2);
    ctx.drawImage(source, -w / 2, -h / 2, w, h);
    ctx.restore();
    setImage({ w: c.width, h: c.height });
  }, [source, turns, mirrored]);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStage({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const frame = frameSize(stage, ratioOf(shape, image));
  const scale = coverScale(frame, image) * zoom;
  const ready = image.w > 0 && frame.w > 0;

  const place = useCallback(
    (nextZoom: number, next: { x: number; y: number }) => {
      const z = clamp(nextZoom, 1, MAX_ZOOM);
      setZoom(z);
      setOffset(clampOffset(next, image, coverScale(frame, image) * z, frame));
    },
    [image, frame],
  );

  // A new shape, turn or mirror starts again from the middle.
  // biome-ignore lint/correctness/useExhaustiveDependencies: these are the changes that recentre.
  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [shape, turns, mirrored]);

  /** Zooms keeping the frame's middle where it is. */
  const zoomBy = (factor: number) => {
    const z = clamp(zoom * factor, 1, MAX_ZOOM);
    place(z, { x: (offset.x * z) / zoom, y: (offset.y * z) / zoom });
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (!ready || busy) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setMoving(true);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      if (a && b) pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom, ...offset };
    }
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const last = pointers.current.get(e.pointerId);
    if (!last) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = pinch.current;
    if (p && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b || p.dist === 0) return;
      const z = clamp((p.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / p.dist, 1, MAX_ZOOM);
      place(z, { x: (p.x * z) / p.zoom, y: (p.y * z) / p.zoom });
      return;
    }
    place(zoom, { x: offset.x + e.clientX - last.x, y: offset.y + e.clientY - last.y });
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) setMoving(false);
  };

  // The mouse wheel zooms; React's wheel listener can't stop the page scrolling, so this one is
  // added by hand (not passive).
  const zoomRef = useRef(zoomBy);
  zoomRef.current = zoomBy;
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomRef.current(Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);

  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 40 : 10;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      place(zoom, { x: offset.x + m[0], y: offset.y + m[1] });
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomBy(1.2);
    } else if (e.key === "-") {
      e.preventDefault();
      zoomBy(1 / 1.2);
    }
  };

  // Escape goes back to the post (not out of the whole maker).
  useEffect(() => {
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [onCancel]);

  const reset = () => {
    setShape("original");
    setTurns(0);
    setMirrored(false);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const done = async () => {
    const c = canvas.current;
    if (!c || !ready || busy) return;
    setBusy(true);
    setError("");
    try {
      const rect = cropRect(image, frame, scale, offset);
      const out = document.createElement("canvas");
      out.width = rect.width;
      out.height = rect.height;
      const ctx = out.getContext("2d");
      if (!ctx) throw new Error("no canvas");
      const kind = outputType(file.type);
      if (kind.type === "image/jpeg") {
        // JPEG has no see-through parts: a white background instead of black.
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, rect.width, rect.height);
      }
      ctx.drawImage(c, rect.left, rect.top, rect.width, rect.height, 0, 0, rect.width, rect.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        out.toBlob(resolve, kind.type, 0.92),
      );
      if (!blob) throw new Error("no blob");
      onDone(new File([blob], renamed(file.name, kind.ending), { type: kind.type }));
    } catch {
      setBusy(false);
      setError("That didn't save. Try again.");
    }
  };

  return (
    <section
      aria-label="Edit photo"
      className="absolute inset-0 z-10 flex flex-col bg-[#050507] text-white"
    >
      <header className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-full px-3.5 font-bold text-white/80 hover:bg-white/10 hover:text-white"
        >
          Cancel
        </button>
        <h2 className="flex-1 text-center font-bold">Edit photo</h2>
        <button
          type="button"
          onClick={done}
          aria-disabled={!ready || busy || undefined}
          className="h-9 rounded-full bg-accent px-4 font-bold text-on-accent aria-disabled:opacity-60"
        >
          {busy ? "Saving…" : "Done"}
        </button>
      </header>

      <div
        ref={stageRef}
        role="application"
        aria-label="Photo. Drag or use the arrow keys to move it; mouse wheel, pinch, or + and - to zoom; double-click to zoom in or out."
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the photo is moved with the arrow keys.
        tabIndex={0}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onDoubleClick={() => (zoom > 1.01 ? place(1, { x: 0, y: 0 }) : zoomBy(2))}
        onKeyDown={keys}
        className={cx(
          "relative min-h-0 flex-1 touch-none overflow-hidden outline-none select-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset",
          moving ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        <canvas
          ref={canvas}
          className={cx(
            "pointer-events-none absolute top-1/2 left-1/2 max-w-none",
            !moving && "motion-safe:transition-[width,height,transform] motion-safe:duration-150",
            !ready && "opacity-0",
          )}
          style={{
            width: image.w * scale,
            height: image.h * scale,
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
          }}
        />
        {ready && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 outline outline-1 outline-white/80"
            style={{
              width: frame.w,
              height: frame.h,
              boxShadow: "0 0 0 100vmax rgb(5 5 7 / 0.62)",
              backgroundImage:
                "linear-gradient(to right, transparent calc(33.33% - 0.5px), rgb(255 255 255 / 0.35) calc(33.33% - 0.5px), rgb(255 255 255 / 0.35) calc(33.33% + 0.5px), transparent calc(33.33% + 0.5px), transparent calc(66.66% - 0.5px), rgb(255 255 255 / 0.35) calc(66.66% - 0.5px), rgb(255 255 255 / 0.35) calc(66.66% + 0.5px), transparent calc(66.66% + 0.5px)), linear-gradient(to bottom, transparent calc(33.33% - 0.5px), rgb(255 255 255 / 0.35) calc(33.33% - 0.5px), rgb(255 255 255 / 0.35) calc(33.33% + 0.5px), transparent calc(33.33% + 0.5px), transparent calc(66.66% - 0.5px), rgb(255 255 255 / 0.35) calc(66.66% - 0.5px), rgb(255 255 255 / 0.35) calc(66.66% + 0.5px), transparent calc(66.66% + 0.5px))",
            }}
          />
        )}
        {!ready && !error && (
          <p className="absolute inset-0 grid place-items-center text-white/70">Opening…</p>
        )}
      </div>

      <div className="space-y-3 px-4 pt-3 pb-4">
        {error && (
          <p role="alert" className="text-center text-[0.92rem] text-[#ff8a8a]">
            {error}
          </p>
        )}
        <fieldset className="m-0 flex min-w-0 gap-1.5 overflow-x-auto border-0 p-0 [scrollbar-width:none]">
          <legend className="sr-only">Shape</legend>
          {SHAPES.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={shape === s.id}
              onClick={() => setShape(s.id)}
              className={cx(
                "h-9 shrink-0 rounded-full px-4 text-[0.9rem] font-bold",
                shape === s.id
                  ? "bg-white text-[#050507]"
                  : "bg-white/10 text-white/80 hover:text-white",
              )}
            >
              {s.label}
            </button>
          ))}
        </fieldset>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {[
            [ArrowClockwise, "Turn", () => setTurns((t) => (t + (mirrored ? 3 : 1)) % 4)],
            [FlipHorizontal, "Mirror", () => setMirrored((m) => !m)],
            [MagnifyingGlassMinus, "Zoom out", () => zoomBy(1 / 1.25)],
            [MagnifyingGlassPlus, "Zoom in", () => zoomBy(1.25)],
            [ArrowCounterClockwise, "Reset", reset],
          ].map(([Icon, label, act]) => {
            const I = Icon as typeof ArrowClockwise;
            return (
              <button
                key={label as string}
                type="button"
                onClick={act as () => void}
                className="flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-[0.9rem] font-bold text-white/90 hover:bg-white/15 hover:text-white"
              >
                <I aria-hidden="true" size={18} />
                {label as string}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
