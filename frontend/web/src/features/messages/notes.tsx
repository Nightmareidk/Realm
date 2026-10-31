"use client";

import { MusicNotes, PaperPlaneRight, Plus, Star, X } from "@phosphor-icons/react";
import { Limits, type Note, type NoteList, type Sound } from "@realm/contracts";
import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Dialog } from "@/components/dialog";
import { player } from "@/features/music/player";
import { openConversation, send } from "@/features/realtime/actions";
import { useRealm } from "@/features/realtime/store";
import { Avatar } from "@/features/spaces/person";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";

/** Plays a Note's song from where its author chose. */
async function playNote(n: Note) {
  if (!n.sound) return;
  try {
    const s = await api<Sound>(`/sounds/${n.sound.id}`);
    player.play(s, {
      from: `${n.author.displayName}'s note`,
      startMs: n.sound.startMs,
      key: `note:${n.author.id}`,
    });
  } catch {}
}

/** The thought bubble above a face. */
function Bubble({ note, empty }: { note: Note | null; empty?: string }) {
  return (
    <span
      className={cx(
        "absolute -top-2 left-1/2 z-10 max-w-[5.6rem] -translate-x-1/2 rounded-2xl px-2.5 py-1.5 text-[0.72rem] leading-tight shadow-[0_6px_18px_-8px_rgb(0_0_0/0.6)]",
        note?.audience === "close_friends"
          ? "bg-[#14532d] text-white"
          : "bg-surface-raised text-fg",
      )}
    >
      {note ? (
        <>
          {note.sound && (
            <span className="flex items-center gap-1 truncate font-bold">
              <MusicNotes aria-hidden="true" size={11} weight="bold" className="shrink-0" />
              <span className="truncate">{note.sound.title}</span>
            </span>
          )}
          {note.text && <span className="line-clamp-2 break-words">{note.text}</span>}
        </>
      ) : (
        <span className="text-fg-soft">{empty}</span>
      )}
    </span>
  );
}

/**
 * Notes, Instagram's way with Realm's music: a short line (and a song if you like) above your
 * face for a day. People who follow each other see each other's; Close Friends notes go only to
 * that list (in green). Tapping someone's note plays its song and lets you answer in a chat.
 */
export function NotesRow() {
  const router = useRouter();
  const me = useRealm((s) => s.me);
  const [list, setList] = useState<NoteList | null>(null);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState<Note | null>(null);

  const load = useCallback(
    () =>
      api<NoteList>("/notes")
        .then(setList)
        .catch(() => {}),
    [],
  );
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (!me || !list) return null;
  return (
    <section aria-label="Notes" className="px-2 pt-1 md:px-3">
      <ul className="flex gap-3 overflow-x-auto px-2 pt-6 pb-2 [scrollbar-width:none]">
        <li className="w-[4.6rem] shrink-0 text-center">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="relative mx-auto block rounded-full"
          >
            <Bubble note={list.mine} empty="Share a note" />
            <Avatar user={me} size={64} />
            {!list.mine && (
              <span className="absolute right-0 bottom-0 grid size-6 place-items-center rounded-full bg-accent text-on-accent shadow-[0_0_0_3px_var(--r-surface)]">
                <Plus aria-hidden="true" size={13} weight="bold" />
              </span>
            )}
            <span className="sr-only">{list.mine ? "Change your note" : "Share a note"}</span>
          </button>
          <span className="mt-1 block truncate text-[0.75rem] text-fg-soft">Your note</span>
        </li>
        {list.items.map((n) => (
          <li key={n.author.id} className="w-[4.6rem] shrink-0 text-center">
            <button
              type="button"
              onClick={() => {
                setOpen(n);
                void playNote(n);
              }}
              className="relative mx-auto block rounded-full"
            >
              <Bubble note={n} />
              <Avatar user={n.author} size={64} />
              <span className="sr-only">
                {n.author.displayName}'s note: {n.text}
                {n.sound ? `, with ${n.sound.title}` : ""}
              </span>
            </button>
            <span className="mt-1 block truncate text-[0.75rem] text-fg-soft">
              {n.author.displayName.split(" ")[0]}
            </span>
          </li>
        ))}
      </ul>
      <NoteEditor
        open={editing}
        mine={list.mine}
        onClose={() => setEditing(false)}
        onDone={() => {
          setEditing(false);
          void load();
        }}
      />
      <NoteReply
        note={open}
        onClose={() => setOpen(null)}
        onSent={(channelId) => {
          setOpen(null);
          router.push(`/messages/${channelId}`);
        }}
      />
    </section>
  );
}

function NoteEditor({
  open,
  mine,
  onClose,
  onDone,
}: {
  open: boolean;
  mine: Note | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [close, setClose] = useState(false);
  const [song, setSong] = useState<Sound | null>(null);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Sound[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setText(mine?.text ?? "");
    setClose(mine?.audience === "close_friends");
    setSong(null);
    setQuery("");
    setError("");
  }, [open, mine]);

  useEffect(() => {
    if (!open || !query.trim()) return setFound([]);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api<{ items: Sound[] }>(`/sounds?q=${encodeURIComponent(query.trim())}`, {
        signal: ctrl.signal,
      })
        .then((r) => setFound(r.items.slice(0, 5)))
        .catch(() => {});
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, open]);

  const share = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!text.trim() && !song && !mine?.sound) {
      setError("Write something or pick a song.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const soundId = song?.id ?? (mine?.sound && !song ? mine.sound.id : undefined);
      await api("/notes/@me", {
        method: "PUT",
        body: {
          text: text.trim(),
          audience: close ? "close_friends" : "followers",
          ...(soundId ? { soundId } : {}),
        },
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Not shared. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    await api("/notes/@me", { method: "DELETE" }).catch(() => {});
    onDone();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mine ? "Your note" : "Share a note"}
      lead="A thought or a song for a day. People who follow each other see it above your picture in Messages."
    >
      <form onSubmit={share} className="space-y-4">
        <div className="relative">
          <input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, Limits.note.max))}
            placeholder="Share a thought…"
            aria-label="Your note"
            className="h-12 w-full rounded-full bg-surface-raised px-4 pr-14 text-fg outline-none placeholder:text-fg-muted focus-visible:ring-2 focus-visible:ring-accent"
          />
          <span className="absolute top-1/2 right-4 -translate-y-1/2 text-[0.8rem] text-fg-soft tabular-nums">
            {Limits.note.max - text.length}
          </span>
        </div>
        <div>
          <p className="mb-1.5 font-bold text-fg">Add a song</p>
          {(song || (mine?.sound && song === null && !query)) && (
            <p className="mb-2 flex items-center gap-2 text-[0.9rem] text-fg">
              <MusicNotes aria-hidden="true" size={16} />
              <b className="truncate">{song?.title ?? mine?.sound?.title}</b>
              <span className="truncate text-fg-soft">{song?.artist ?? mine?.sound?.artist}</span>
              {song && (
                <button
                  type="button"
                  onClick={() => setSong(null)}
                  className="ml-auto grid size-7 place-items-center rounded-full hover:bg-fg/8"
                >
                  <X aria-hidden="true" size={14} />
                  <span className="sr-only">Remove the song</span>
                </button>
              )}
            </p>
          )}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search songs"
            aria-label="Search songs"
            className="h-10 w-full rounded-full bg-surface-raised px-4 text-fg outline-none placeholder:text-fg-muted focus-visible:ring-2 focus-visible:ring-accent"
          />
          <ul className="mt-1.5 space-y-0.5">
            {found.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSong(s);
                    setQuery("");
                    player.play(s, { from: "the note maker" });
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-fg/6"
                >
                  {s.coverUrl ? (
                    // biome-ignore lint/performance/noImgElement: a song cover.
                    <img src={s.coverUrl} alt="" className="size-9 rounded-lg object-cover" />
                  ) : (
                    <span className="grid size-9 place-items-center rounded-lg bg-surface-raised">
                      <MusicNotes aria-hidden="true" size={16} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-fg">{s.title}</span>
                    <span className="block truncate text-[0.8rem] text-fg-soft">{s.artist}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          aria-pressed={close}
          onClick={() => setClose(!close)}
          className={cx(
            "flex h-10 items-center gap-2 rounded-full px-4 text-[0.9rem] font-bold",
            close ? "bg-[#22c55e] text-[#04150a]" : "bg-fg/8 text-fg-soft hover:text-fg",
          )}
        >
          <Star aria-hidden="true" size={16} weight={close ? "fill" : "regular"} />
          {close ? "Close Friends only" : "Followers you follow back"}
        </button>
        {error && <p className="text-[0.9rem] text-danger">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            aria-disabled={busy || undefined}
            className="h-11 flex-1 rounded-full bg-accent font-bold text-on-accent"
          >
            Share
          </button>
          {mine && (
            <button
              type="button"
              onClick={() => void remove()}
              className="h-11 rounded-full px-5 font-bold text-danger hover:bg-fg/6"
            >
              Delete note
            </button>
          )}
        </div>
      </form>
    </Dialog>
  );
}

/** Someone's note, big, with a box to answer it in your chat with them. */
function NoteReply({
  note,
  onClose,
  onSent,
}: {
  note: Note | null;
  onClose: () => void;
  onSent: (channelId: string) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  // A fresh box for each note opened.
  const [forNote, setForNote] = useState(note);
  if (forNote !== note) {
    setForNote(note);
    setText("");
    setError("");
  }
  const reply = async (e: FormEvent) => {
    e.preventDefault();
    if (!note || !text.trim()) return;
    try {
      const c = await openConversation([note.author.id]);
      const quoted = note.text || note.sound?.title || "your note";
      send(c.id, `Replying to your note "${quoted}": ${text.trim()}`);
      onSent(c.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Not sent. Try again.");
    }
  };
  return (
    <Dialog
      open={note !== null}
      onClose={onClose}
      title={note ? `${note.author.displayName}'s note` : "Note"}
    >
      {note && (
        <form onSubmit={reply} className="space-y-4">
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <Avatar user={note.author} size={84} />
            {note.text && <p className="text-[1.15rem] font-bold text-fg">{note.text}</p>}
            {note.sound && (
              <button
                type="button"
                onClick={() => void playNote(note)}
                className="flex h-10 items-center gap-2 rounded-full bg-fg/8 pr-4 pl-1.5 text-[0.88rem] text-fg"
              >
                {note.sound.coverUrl ? (
                  // biome-ignore lint/performance/noImgElement: a song cover.
                  <img
                    src={note.sound.coverUrl}
                    alt=""
                    className="size-7 rounded-full object-cover"
                  />
                ) : (
                  <MusicNotes aria-hidden="true" size={16} className="ml-2" />
                )}
                <b>{note.sound.title}</b>
                <span className="text-fg-soft">{note.sound.artist}</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 rounded-full bg-surface-raised py-1 pr-1 pl-4">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              placeholder={`Reply to ${note.author.displayName.split(" ")[0]}…`}
              aria-label="Your reply"
              className="h-10 min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-fg-muted"
            />
            <button
              type="submit"
              aria-disabled={!text.trim() || undefined}
              className="grid size-9 place-items-center rounded-full bg-accent text-on-accent aria-disabled:opacity-40"
            >
              <PaperPlaneRight aria-hidden="true" size={16} weight="fill" />
              <span className="sr-only">Send</span>
            </button>
          </div>
          {error && <p className="text-[0.9rem] text-danger">{error}</p>}
        </form>
      )}
    </Dialog>
  );
}
