"use client";

import { MusicNotes, Pause, Play, UploadSimple } from "@phosphor-icons/react";
import {
  type AdminTrack,
  TRACK_LICENCE_LABEL,
  TRACK_MAX_BYTES,
  TRACK_MAX_MS,
  type TrackLicence,
} from "@realm/contracts";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { clock, player, usePlayer } from "@/features/music/player";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";
import { uploadFile } from "@/lib/upload";

const field =
  "h-11 w-full rounded-input border-[1.5px] border-line-strong bg-base/70 px-3.5 text-fg outline-none placeholder:text-fg-muted focus-visible:border-accent";

/** How long a song is, read from the file in the browser before it uploads. */
function lengthOf(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement(file.type.startsWith("video") ? "video" : "audio");
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      Number.isFinite(el.duration) ? resolve(Math.round(el.duration * 1000)) : reject();
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject();
    };
    el.src = url;
  });
}

/**
 * Realm's own music library (admins): add songs everyone can find in Music and put on posts,
 * Stories and Clips. MP3 is best (it plays everywhere); M4A works too, and an MP4 plays its sound.
 * Only add music Realm has the right to play.
 */
export function Tracks({ onDone }: { onDone: (msg: string) => void }) {
  const [items, setItems] = useState<AdminTrack[] | null>(null);
  const [song, setSong] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [licence, setLicence] = useState<TrackLicence>("own");
  const [credit, setCredit] = useState("");
  const [rights, setRights] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const songInput = useRef<HTMLInputElement>(null);
  const { now, playing } = usePlayer();

  const load = useCallback(async () => {
    try {
      setItems((await api<{ items: AdminTrack[] }>("/admin/tracks")).items);
    } catch {
      setItems([]);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const pick = (f: File | null) => {
    setSong(f);
    setError("");
    if (f && !title)
      setTitle(
        f.name
          .replace(/\.[^.]+$/, "")
          .replace(/[_-]+/g, " ")
          .trim(),
      );
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!song) return setError("Choose the song file.");
    if (!title.trim() || !artist.trim()) return setError("Give it a title and an artist.");
    if (!rights) return setError("Confirm Realm may play it.");
    if (song.size > TRACK_MAX_BYTES) return setError("Songs can be up to 40 MB.");
    const kind = song.type.startsWith("video") ? "video" : "audio";
    try {
      setProgress(0);
      const durationMs = await lengthOf(song).catch(() => 0);
      if (!durationMs)
        throw new ApiError(400, "UPLOAD_INVALID", "That file didn't play. Try an MP3.");
      if (durationMs > TRACK_MAX_MS)
        throw new ApiError(400, "UPLOAD_INVALID", "Songs can be up to 20 minutes.");
      const art = cover ? await uploadFile(cover, { kind: "image" }) : null;
      const media = await uploadFile(
        song,
        { kind, filename: song.name, durationMs, purpose: "track" },
        (p) => setProgress(p),
      );
      await api<AdminTrack>("/admin/tracks", {
        body: {
          mediaId: media.id,
          ...(art ? { coverMediaId: art.id } : {}),
          title: title.trim(),
          artist: artist.trim(),
          licence,
          ...(credit.trim() ? { creditUrl: credit.trim() } : {}),
        },
      });
      onDone(`Added "${title.trim()}" to the library.`);
      setSong(null);
      setCover(null);
      setTitle("");
      setArtist("");
      setCredit("");
      setRights(false);
      if (songInput.current) songInput.current.value = "";
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't upload. Try again.");
    } finally {
      setProgress(null);
    }
  };

  const toggle = async (t: AdminTrack) => {
    try {
      await api(`/admin/tracks/${t.sound.id}/hidden`, {
        method: "PUT",
        body: { hidden: !t.hidden },
      });
      onDone(
        t.hidden
          ? `"${t.sound.title}" is back in the library.`
          : `"${t.sound.title}" is out of the library.`,
      );
      await load();
    } catch (err) {
      onDone(err instanceof ApiError ? err.message : "That didn't change. Try again.");
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[24rem_minmax(0,1fr)]">
      <form
        onSubmit={add}
        className="space-y-3.5 rounded-[20px] bg-fg/[0.04] p-5 shadow-[inset_0_0_0_1px_var(--r-border)]"
      >
        <h2 className="font-display text-[1.25rem] font-bold text-fg">Add a song</h2>
        <p className="text-[0.9rem] leading-snug text-fg-soft">
          MP3 is best: it plays on every phone and browser. M4A works too, and an MP4 plays its
          sound. Up to 40 MB and 20 minutes.
        </p>
        <label className="flex cursor-pointer items-center gap-3 rounded-input border-[1.5px] border-dashed border-line-strong px-3.5 py-3 hover:border-fg-soft">
          <UploadSimple aria-hidden="true" size={20} className="text-fg-soft" />
          <span className="min-w-0 flex-1 truncate text-fg">
            {song ? song.name : "Choose the song file"}
          </span>
          <input
            ref={songInput}
            type="file"
            accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/wav,video/mp4"
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="flex cursor-pointer items-center gap-3 rounded-input border-[1.5px] border-dashed border-line-strong px-3.5 py-3 hover:border-fg-soft">
          <MusicNotes aria-hidden="true" size={20} className="text-fg-soft" />
          <span className="min-w-0 flex-1 truncate text-fg-soft">
            {cover ? cover.name : "Cover picture (square works best)"}
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => setCover(e.target.files?.[0] ?? null)}
          />
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Title"
          aria-label="Title"
          className={field}
        />
        <input
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          maxLength={120}
          placeholder="Artist"
          aria-label="Artist"
          className={field}
        />
        <label className="block">
          <span className="mb-1.5 block text-[0.9rem] font-bold text-fg">
            Realm's right to play it
          </span>
          <select
            value={licence}
            onChange={(e) => setLicence(e.target.value as TrackLicence)}
            className={field}
          >
            {(Object.keys(TRACK_LICENCE_LABEL) as TrackLicence[]).map((k) => (
              <option key={k} value={k}>
                {TRACK_LICENCE_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <input
          value={credit}
          onChange={(e) => setCredit(e.target.value)}
          placeholder="Credit link (https://, optional)"
          aria-label="Credit link"
          className={field}
        />
        <label className="flex items-start gap-2.5 text-[0.9rem] text-fg-soft">
          <input
            type="checkbox"
            checked={rights}
            onChange={(e) => setRights(e.target.checked)}
            className="mt-1 size-4 accent-[var(--r-accent)]"
          />
          Realm has the right to let everyone play and use this song.
        </label>
        {error && (
          <p role="alert" className="text-[0.92rem] text-danger">
            {error}
          </p>
        )}
        <button
          type="submit"
          aria-disabled={progress !== null || undefined}
          className="h-11 w-full rounded-full bg-accent font-bold text-on-accent aria-disabled:opacity-70"
        >
          {progress !== null ? `Uploading ${Math.round(progress * 100)}%` : "Add to the library"}
        </button>
      </form>

      <section aria-label="Realm's library">
        <h2 className="mb-3 font-display text-[1.25rem] font-bold text-fg">
          Realm's library {items ? `· ${items.filter((t) => !t.hidden).length}` : ""}
        </h2>
        {!items ? (
          <p role="status" className="text-fg-soft">
            Loading…
          </p>
        ) : items.length === 0 ? (
          <p className="text-fg-soft">
            No songs added yet. They show in Music under "New on Realm".
          </p>
        ) : (
          <ul className="space-y-1">
            {items.map((t) => {
              const on = now?.sound.id === t.sound.id && playing;
              return (
                <li
                  key={t.sound.id}
                  className={cx(
                    "flex items-center gap-3 rounded-xl px-2.5 py-2",
                    t.hidden ? "opacity-55" : "hover:bg-fg/6",
                  )}
                >
                  <button
                    type="button"
                    onClick={() =>
                      on ? player.pause() : player.play(t.sound, { from: "Realm's library" })
                    }
                    className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-surface-raised text-fg"
                  >
                    {t.sound.coverUrl ? (
                      // biome-ignore lint/performance/noImgElement: an uploaded cover behind an access check.
                      <img src={t.sound.coverUrl} alt="" className="size-full object-cover" />
                    ) : on ? (
                      <Pause aria-hidden="true" size={18} weight="fill" />
                    ) : (
                      <Play aria-hidden="true" size={18} weight="fill" />
                    )}
                    <span className="sr-only">{on ? "Pause" : "Play"}</span>
                  </button>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-fg">{t.sound.title}</b>
                    <span className="block truncate text-[0.85rem] text-fg-soft">
                      {t.sound.artist} · {t.sound.licence} · {clock(t.sound.durationMs)} · used{" "}
                      {t.sound.uses}×
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void toggle(t)}
                    className={cx(pillish, t.hidden ? "text-fg" : "text-fg-soft")}
                  >
                    {t.hidden ? "Put back" : "Take out"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

const pillish =
  "h-9 shrink-0 rounded-full px-3.5 text-[0.85rem] font-bold shadow-[inset_0_0_0_1.5px_var(--r-border-strong)] hover:text-fg";
