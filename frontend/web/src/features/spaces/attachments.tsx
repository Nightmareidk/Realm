"use client";

import {
  ArrowSquareOut,
  DownloadSimple,
  FileText,
  MapPin,
  Pause,
  Play,
} from "@phosphor-icons/react";
import type { MediaRef, Place } from "@realm/contracts";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/dialog";
import { cx } from "@/lib/cx";
import { GOOGLE_MAP_ID, GOOGLE_MAPS_KEY, MAP_PROVIDER, MAPBOX_TOKEN } from "@/lib/public-config";
import { sizeLabel } from "@/lib/upload";

const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const ring = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export const isVisual = (f: MediaRef) => f.kind === "image" || f.kind === "video";

/**
 * Photos and videos stand on their own beside the bubble (no coloured mat around them): a grid
 * for photos, tap one to see it larger; videos with their own controls.
 */
export function MediaGrid({ files }: { files: MediaRef[] }) {
  const [open, setOpen] = useState<MediaRef | null>(null);
  const images = files.filter((f) => f.kind === "image");
  const videos = files.filter((f) => f.kind === "video");
  return (
    <div className="flex w-[min(24rem,78vw)] flex-col gap-1">
      {images.length > 0 && (
        <div className={cx("grid gap-1", images.length > 1 && "grid-cols-2")}>
          {images.slice(0, 4).map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setOpen(img)}
              className={cx(
                "overflow-hidden rounded-[1.1rem] bg-surface-sunken shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]",
                ring,
              )}
              style={{
                aspectRatio: img.width && img.height ? `${img.width} / ${img.height}` : "4 / 3",
                maxHeight: images.length > 1 ? 180 : 340,
              }}
            >
              {/* biome-ignore lint/performance/noImgElement: uploads are served through an access check, not Next's optimiser. */}
              <img
                src={img.url}
                alt=""
                loading="lazy"
                decoding="async"
                className="size-full object-cover"
              />
              <span className="sr-only">Open the photo</span>
            </button>
          ))}
        </div>
      )}
      {videos.map((v) => (
        // biome-ignore lint/a11y/useMediaCaption: people's own clips; captions come with the media pipeline.
        <video
          key={v.id}
          src={v.url}
          controls
          preload="metadata"
          playsInline
          className="max-h-[22rem] w-full rounded-[1.1rem] bg-black"
        />
      ))}
      <Dialog
        open={open !== null}
        onClose={() => setOpen(null)}
        title="Photo"
        className="w-[min(60rem,calc(100vw-1.5rem))]"
      >
        {open && (
          <div>
            {/* biome-ignore lint/performance/noImgElement: see above. */}
            <img
              src={open.url}
              alt=""
              className="max-h-[70vh] w-full rounded-card object-contain"
            />
            <a
              href={open.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 font-bold text-fg underline underline-offset-[0.22em]"
            >
              Open the original
              <ArrowSquareOut aria-hidden="true" size={16} />
            </a>
          </div>
        )}
      </Dialog>
    </div>
  );
}

/** Voice messages and files, as the bubble's own content (the bubble is the card). */
export function FileList({ files, mine }: { files: MediaRef[]; mine: boolean }) {
  return (
    <span className="flex flex-col gap-2">
      {files.map((f) =>
        f.kind === "audio" ? (
          <VoiceNote key={f.id} file={f} mine={mine} />
        ) : (
          <a
            key={f.id}
            href={f.url}
            download={f.filename ?? "file"}
            className={cx("-mx-1 flex items-center gap-3 rounded-[0.8rem] px-1 py-0.5", ring)}
          >
            <FileText aria-hidden="true" size={28} className="shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold underline-offset-[0.22em] hover:underline">
                {f.filename ?? "File"}
              </span>
              <span className={cx("block text-[0.82rem]", mine ? "opacity-75" : "text-fg-soft")}>
                {sizeLabel(f.sizeBytes)}
              </span>
            </span>
            <DownloadSimple aria-hidden="true" size={20} className="shrink-0" />
            <span className="sr-only">Download</span>
          </a>
        ),
      )}
    </span>
  );
}

/** A voice message: play, scrub (arrow keys move a second at a time), and how long it is. */
function VoiceNote({ file, mine }: { file: MediaRef; mine: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [length, setLength] = useState(file.durationMs ?? 0);

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const tick = () => setAt(a.currentTime * 1000);
    const meta = () => Number.isFinite(a.duration) && setLength(a.duration * 1000);
    const end = () => setPlaying(false);
    a.addEventListener("timeupdate", tick);
    a.addEventListener("loadedmetadata", meta);
    a.addEventListener("ended", end);
    return () => {
      a.removeEventListener("timeupdate", tick);
      a.removeEventListener("loadedmetadata", meta);
      a.removeEventListener("ended", end);
    };
  }, []);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused)
      void a
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    else {
      a.pause();
      setPlaying(false);
    }
  };

  const seconds = Math.max(1, Math.round(length / 1000));
  const done = length > 0 ? Math.min(1, at / length) : 0;

  return (
    <span className="flex min-w-[15rem] items-center gap-2.5">
      {/* biome-ignore lint/a11y/useMediaCaption: a spoken voice message; transcripts come later. */}
      <audio ref={audio} src={file.url} preload="metadata" />
      <button
        type="button"
        onClick={toggle}
        className={cx(
          "inline-flex size-10 shrink-0 items-center justify-center rounded-full",
          mine ? "bg-[rgb(0_0_0/0.16)]" : "bg-fg/10",
          ring,
        )}
      >
        {playing ? (
          <Pause aria-hidden="true" size={18} weight="fill" />
        ) : (
          <Play aria-hidden="true" size={18} weight="fill" />
        )}
        <span className="sr-only">{playing ? "Pause" : "Play"} voice message</span>
      </button>
      {/* A drawn track (visible on any bubble) under an invisible range that does the work. */}
      <span className="relative flex h-6 min-w-0 flex-1 items-center rounded-full has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus">
        <span aria-hidden="true" className="h-1 w-full rounded-full bg-current opacity-30" />
        <span
          aria-hidden="true"
          className="absolute left-0 h-1 rounded-full bg-current"
          style={{ width: `${done * 100}%` }}
        />
        <span
          aria-hidden="true"
          className="absolute size-3 -translate-x-1/2 rounded-full bg-current"
          style={{ left: `${done * 100}%` }}
        />
        <input
          type="range"
          min={0}
          max={seconds}
          step={1}
          value={Math.min(Math.round(at / 1000), seconds)}
          onChange={(e) => {
            const a = audio.current;
            if (a) a.currentTime = Number(e.target.value);
          }}
          aria-label="Position in the voice message"
          aria-valuetext={`${clock(at)} of ${clock(length)}`}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </span>
      <span
        className={cx(
          "w-10 shrink-0 text-right text-[0.82rem] tabular-nums",
          mine ? "opacity-75" : "text-fg-soft",
        )}
      >
        {clock(playing || at > 0 ? at : length)}
      </span>
    </span>
  );
}

/** The small map for a shared place (Mapbox), or none when maps aren't set up. */
export function staticMap(place: Place, width = 560, height = 260) {
  if (MAP_PROVIDER === "google") {
    const at = `${place.lat},${place.lng}`;
    const params = new URLSearchParams({
      center: at,
      zoom: "15",
      size: `${width}x${height}`,
      scale: "2",
      markers: `color:0xf5f4f2|${at}`,
      key: GOOGLE_MAPS_KEY,
    });
    if (GOOGLE_MAP_ID) params.set("map_id", GOOGLE_MAP_ID);
    // Without a styled Map ID, a plain dark look that sits in Realm's night.
    const dark = GOOGLE_MAP_ID
      ? []
      : [
          "element:geometry|color:0x1b1b22",
          "element:labels.text.fill|color:0x9d9aa8",
          "element:labels.text.stroke|color:0x0b0b0e",
          "feature:road|element:geometry|color:0x2e2e38",
          "feature:water|element:geometry|color:0x101018",
          "feature:poi|visibility:off",
        ];
    const style = dark.map((s) => `&style=${encodeURIComponent(s)}`).join("");
    return `https://maps.googleapis.com/maps/api/staticmap?${params}${style}`;
  }
  if (!MAPBOX_TOKEN) return null;
  const at = `${place.lng},${place.lat}`;
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-l+f5f4f2(${at})/${at},14.5,0/${width}x${height}@2x?access_token=${MAPBOX_TOKEN}`;
}

/** A place someone shared once: a small map, its name, and a way to open it in a full map. */
export function PlaceCard({ place, mine }: { place: Place; mine: boolean }) {
  const img = staticMap(place);
  const osm = `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=16/${place.lat}/${place.lng}`;
  return (
    <span className="flex w-[min(20rem,70vw)] flex-col gap-2">
      {img && (
        // biome-ignore lint/performance/noImgElement: a remote static map image.
        <img
          src={img}
          alt=""
          loading="lazy"
          className="aspect-[56/26] w-full rounded-[0.8rem] object-cover"
        />
      )}
      <span className="flex items-start gap-2.5">
        <MapPin aria-hidden="true" size={20} weight="fill" className="mt-0.5 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block font-bold">{place.name}</span>
          {place.address && (
            <span className={cx("block text-[0.86rem]", mine ? "opacity-75" : "text-fg-soft")}>
              {place.address}
            </span>
          )}
          <a
            href={osm}
            target="_blank"
            rel="noopener noreferrer"
            className={cx(
              "mt-1 inline-flex items-center gap-1 rounded text-[0.86rem] font-bold underline underline-offset-[0.22em]",
              ring,
            )}
          >
            Open map
            <ArrowSquareOut aria-hidden="true" size={14} />
          </a>
        </span>
      </span>
    </span>
  );
}
