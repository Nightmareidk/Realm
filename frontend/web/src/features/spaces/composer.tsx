"use client";

import {
  ArrowBendUpLeft,
  ArrowUp,
  File as FileIcon,
  Image as ImageIcon,
  MapPin,
  Microphone,
  Paperclip,
  Smiley,
  Stop,
  Trash,
  X,
} from "@phosphor-icons/react";
import {
  type Channel,
  Limits,
  type MediaInfo,
  type MediaKind,
  type Message,
  type Place,
  VOICE_MESSAGE_MAX_MS,
} from "@realm/contracts";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/dialog";
import { Popover, row } from "@/features/app/menus";
import { EmojiPicker } from "@/features/chat/emoji-picker";
import type { ChatScope } from "@/features/chat/scope";
import { send, typing } from "@/features/realtime/actions";
import { ApiError } from "@/lib/api";
import { cx } from "@/lib/cx";
import { newId } from "@/lib/id";
import { kindOf, sizeLabel, uploadFile } from "@/lib/upload";
import { staticMap } from "./attachments";

// The map is big; it loads only when someone opens the place picker.
const PlacePicker = dynamic(
  () => import("@/features/maps/place-picker").then((m) => m.PlacePicker),
  {
    ssr: false,
    loading: () => <p className="py-16 text-center text-fg-soft">Loading the map…</p>,
  },
);

interface Pending {
  key: string;
  name: string;
  kind: MediaKind;
  size: number;
  progress: number;
  preview: string | null;
  durationMs?: number;
  media?: MediaInfo;
  error?: string;
  abort: AbortController;
}

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * The floating composer: text, plus photos, videos, files, a voice message or a place. Files
 * upload the moment they're picked, so Send is instant; each shows its progress and can be
 * taken back.
 */
export function Composer({
  scope,
  room,
  inputRef,
  replyTo,
  replyName,
  onCancelReply,
  onSent,
  onEditLast,
}: {
  scope: ChatScope;
  room: Channel;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  replyTo: Message | null;
  replyName: string;
  onCancelReply: () => void;
  onSent: () => void;
  onEditLast: () => void;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Pending[]>([]);
  const [place, setPlace] = useState<Place | null>(null);
  const [picking, setPicking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [notice, setNotice] = useState("");
  // Spoken updates for the recorder (it changes the composer under the keyboard's feet).
  const [said, setSaid] = useState("");
  const pickMedia = useRef<HTMLInputElement>(null);
  const pickFile = useRef<HTMLInputElement>(null);
  const { canAttach, canPlace } = scope;
  const left = Limits.message.max - text.length;
  const uploading = files.some((f) => !f.media && !f.error);
  const ready = files.filter((f) => f.media).map((f) => f.media as MediaInfo);
  const sendable = !uploading && (text.trim().length > 0 || ready.length > 0 || place !== null);

  // Drafts are per room: switching rooms starts fresh.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when the room changes.
  useEffect(() => {
    setText("");
    setFiles([]);
    setPlace(null);
  }, [room.id]);

  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const patch = (key: string, p: Partial<Pending>) =>
    setFiles((list) => list.map((f) => (f.key === key ? { ...f, ...p } : f)));

  const add = (blob: Blob, opts: { name: string; kind?: MediaKind; durationMs?: number }) => {
    if (files.length >= Limits.messageAttachments.max) {
      setNotice(`Up to ${Limits.messageAttachments.max} files in one message.`);
      return;
    }
    const kind = opts.kind ?? (blob instanceof File ? kindOf(blob) : "file");
    const key = newId();
    const abort = new AbortController();
    const item: Pending = {
      key,
      name: opts.name,
      kind,
      size: blob.size,
      progress: 0,
      preview: kind === "image" ? URL.createObjectURL(blob) : null,
      durationMs: opts.durationMs,
      abort,
    };
    setFiles((list) => [...list, item]);
    setNotice("");
    uploadFile(
      blob,
      {
        kind,
        filename: kind === "file" ? opts.name : undefined,
        durationMs: opts.durationMs,
        signal: abort.signal,
      },
      (progress) => patch(key, { progress }),
    )
      .then((media) => patch(key, { media, progress: 1 }))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        patch(key, { error: err instanceof ApiError ? err.message : "Upload failed." });
      });
  };

  const remove = (key: string) => {
    setFiles((list) => {
      const f = list.find((x) => x.key === key);
      f?.abort.abort();
      if (f?.preview) URL.revokeObjectURL(f.preview);
      return list.filter((x) => x.key !== key);
    });
  };

  const submit = () => {
    if (!sendable) return;
    send(room.id, text.trim(), replyTo, { attachments: ready, place });
    for (const f of files) if (f.preview) URL.revokeObjectURL(f.preview);
    setText("");
    setFiles([]);
    setPlace(null);
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.focus();
    }
    onSent();
  };

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="rounded-[1.5rem] bg-base/70 shadow-[inset_0_0_0_1.5px_var(--r-border-strong)] focus-within:shadow-[inset_0_0_0_2px_var(--r-focus)]"
      >
        {replyTo && (
          <div className="flex items-center gap-2 px-4 pt-2.5 text-[0.9rem] text-fg-soft">
            <ArrowBendUpLeft aria-hidden="true" size={15} />
            <span className="min-w-0 flex-1 truncate">
              Replying to <strong className="text-fg">{replyName}</strong>
            </span>
            <button
              type="button"
              onClick={onCancelReply}
              className="inline-flex size-8 items-center justify-center rounded-full hover:bg-fg/10 hover:text-fg"
            >
              <X aria-hidden="true" size={15} />
              <span className="sr-only">Cancel reply</span>
            </button>
          </div>
        )}

        {(files.length > 0 || place) && (
          <ul aria-label="Attached" className="flex gap-2 overflow-x-auto px-3 pt-3">
            {files.map((f) => (
              <li
                key={f.key}
                className="relative flex w-40 shrink-0 items-center gap-2.5 overflow-hidden rounded-[0.9rem] bg-surface p-2 shadow-[inset_0_0_0_1px_var(--r-border)]"
              >
                {f.preview ? (
                  // biome-ignore lint/performance/noImgElement: a local preview of a file being uploaded.
                  <img
                    src={f.preview}
                    alt=""
                    className="size-10 shrink-0 rounded-[0.6rem] object-cover"
                  />
                ) : (
                  <span className="grid size-10 shrink-0 place-items-center rounded-[0.6rem] bg-fg/8 text-fg-soft">
                    {f.kind === "audio" ? (
                      <Microphone aria-hidden="true" size={18} />
                    ) : (
                      <FileIcon aria-hidden="true" size={18} />
                    )}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.86rem] font-bold text-fg">
                    {f.kind === "audio" ? `Voice · ${clock(f.durationMs ?? 0)}` : f.name}
                  </span>
                  <span
                    className={cx(
                      "block truncate text-[0.78rem]",
                      f.error ? "text-danger" : "text-fg-soft",
                    )}
                  >
                    {f.error ?? (f.media ? sizeLabel(f.size) : `${Math.round(f.progress * 100)}%`)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => remove(f.key)}
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-fg-soft hover:bg-fg/10 hover:text-fg"
                >
                  <X aria-hidden="true" size={14} />
                  <span className="sr-only">Remove {f.name}</span>
                </button>
                {!f.media && !f.error && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-0 h-0.5 bg-fg-soft transition-[width] duration-150"
                    style={{ width: `${f.progress * 100}%` }}
                  />
                )}
              </li>
            ))}
            {place && (
              <li className="flex w-48 shrink-0 items-center gap-2.5 overflow-hidden rounded-[0.9rem] bg-surface p-2 shadow-[inset_0_0_0_1px_var(--r-border)]">
                {staticMap(place, 80, 80) ? (
                  // biome-ignore lint/performance/noImgElement: a remote static map image.
                  <img
                    src={staticMap(place, 80, 80) ?? ""}
                    alt=""
                    className="size-10 shrink-0 rounded-[0.6rem] object-cover"
                  />
                ) : (
                  <MapPin aria-hidden="true" size={20} className="shrink-0 text-fg-soft" />
                )}
                <span className="min-w-0 flex-1 truncate text-[0.86rem] font-bold text-fg">
                  {place.name}
                </span>
                <button
                  type="button"
                  onClick={() => setPlace(null)}
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-fg-soft hover:bg-fg/10 hover:text-fg"
                >
                  <X aria-hidden="true" size={14} />
                  <span className="sr-only">Remove the place</span>
                </button>
              </li>
            )}
          </ul>
        )}

        <div className="flex items-end gap-1.5 py-1.5 pr-1.5 pl-1.5">
          {recording ? (
            <VoiceRecorder
              onCancel={() => {
                setRecording(false);
                setSaid("Voice message thrown away");
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
              onDone={(blob, durationMs) => {
                setRecording(false);
                add(blob, { name: "Voice message", kind: "audio", durationMs });
                setSaid(`Voice message ready, ${clock(durationMs)}. Send it when you like.`);
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
              onError={(message) => {
                setRecording(false);
                setNotice(message);
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
            />
          ) : (
            <>
              {(canAttach || canPlace) && (
                <Popover
                  label="Attach"
                  placement="above"
                  panelClass="w-[15rem]"
                  buttonClass="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-fg-soft hover:bg-fg/8 hover:text-fg aria-expanded:bg-fg/8 aria-expanded:text-fg"
                  button={<Paperclip aria-hidden="true" size={21} />}
                >
                  {(close) => (
                    <div>
                      {canAttach && (
                        <>
                          <button
                            type="button"
                            className={row}
                            onClick={() => {
                              close();
                              pickMedia.current?.click();
                            }}
                          >
                            <ImageIcon aria-hidden="true" size={20} />
                            Photo or video
                          </button>
                          <button
                            type="button"
                            className={row}
                            onClick={() => {
                              close();
                              pickFile.current?.click();
                            }}
                          >
                            <FileIcon aria-hidden="true" size={20} />
                            File
                          </button>
                          <button
                            type="button"
                            className={row}
                            onClick={() => {
                              close();
                              setRecording(true);
                              setSaid("Recording started");
                            }}
                          >
                            <Microphone aria-hidden="true" size={20} />
                            Voice message
                          </button>
                        </>
                      )}
                      {canPlace && (
                        <button
                          type="button"
                          className={row}
                          onClick={() => {
                            close();
                            setPicking(true);
                          }}
                        >
                          <MapPin aria-hidden="true" size={20} />A place
                        </button>
                      )}
                    </div>
                  )}
                </Popover>
              )}
              <label htmlFor={`compose-${room.id}`} className="sr-only">
                Message {scope.label}
              </label>
              <textarea
                id={`compose-${room.id}`}
                ref={inputRef}
                rows={1}
                value={text}
                maxLength={Limits.message.max}
                placeholder={`Message ${scope.label}`}
                onChange={(e) => {
                  setText(e.target.value);
                  grow(e.target);
                  if (e.target.value.trim()) typing(room.id);
                }}
                onPaste={(e) => {
                  const pasted = [...e.clipboardData.files];
                  if (pasted.length && canAttach) {
                    e.preventDefault();
                    for (const f of pasted) add(f, { name: f.name || "Pasted image" });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submit();
                  }
                  if (e.key === "Escape" && replyTo) {
                    e.preventDefault();
                    onCancelReply();
                  }
                  if (e.key === "ArrowUp" && !text) {
                    e.preventDefault();
                    onEditLast();
                  }
                }}
                className={cx(
                  "max-h-[200px] min-h-11 flex-1 resize-none bg-transparent py-2.5 text-[1rem] leading-snug text-fg outline-none placeholder:text-fg-muted",
                  !(canAttach || canPlace) && "pl-3.5",
                )}
              />
              {left < 200 && (
                <span
                  className={cx(
                    "self-center text-[0.82rem]",
                    left < 0 ? "text-danger" : "text-fg-soft",
                  )}
                >
                  {left}
                </span>
              )}
              <Popover
                label="Emoji"
                placement="above"
                panelClass="right-0 left-auto p-2"
                buttonClass="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-fg-soft hover:bg-fg/8 hover:text-fg aria-expanded:bg-fg/8 aria-expanded:text-fg max-sm:hidden"
                button={<Smiley aria-hidden="true" size={21} />}
              >
                {(close) => (
                  <EmojiPicker
                    label="Add an emoji"
                    onPick={(emoji) => {
                      close();
                      const el = inputRef.current;
                      const at = el?.selectionStart ?? text.length;
                      const end = el?.selectionEnd ?? at;
                      const next = text.slice(0, at) + emoji + text.slice(end);
                      setText(next);
                      requestAnimationFrame(() => {
                        if (!el) return;
                        el.focus();
                        el.setSelectionRange(at + emoji.length, at + emoji.length);
                        grow(el);
                      });
                    }}
                  />
                )}
              </Popover>
              <button
                type="submit"
                aria-disabled={!sendable || undefined}
                title={uploading ? "Waiting for uploads to finish" : undefined}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent transition-[filter,transform,opacity] duration-150 ease-out hover:brightness-110 active:scale-95 aria-disabled:opacity-50"
              >
                <ArrowUp aria-hidden="true" size={20} weight="bold" />
                <span className="sr-only">{uploading ? "Send (waiting for uploads)" : "Send"}</span>
              </button>
            </>
          )}
        </div>
        <input
          ref={pickMedia}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
          multiple
          hidden
          onChange={(e) => {
            for (const f of [...(e.target.files ?? [])]) add(f, { name: f.name });
            e.target.value = "";
          }}
        />
        <input
          ref={pickFile}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            for (const f of [...(e.target.files ?? [])]) add(f, { name: f.name, kind: "file" });
            e.target.value = "";
          }}
        />
      </form>
      <p aria-live="polite" className="sr-only">
        {said}
      </p>
      {notice && (
        <p role="alert" className="mt-1.5 px-2 text-[0.88rem] text-danger">
          {notice}
        </p>
      )}
      <Dialog
        open={picking}
        onClose={() => setPicking(false)}
        title="Share a place"
        className="w-[min(42rem,calc(100vw-1.5rem))]"
      >
        <PlacePicker
          onPick={(p) => {
            setPlace(p);
            setPicking(false);
            inputRef.current?.focus();
          }}
        />
      </Dialog>
    </>
  );
}

/** Records a voice message (up to five minutes) with the browser's recorder. */
function VoiceRecorder({
  onDone,
  onCancel,
  onError,
}: {
  onDone: (blob: Blob, durationMs: number) => void;
  onCancel: () => void;
  onError: (message: string) => void;
}) {
  const [ms, setMs] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const keep = useRef(false);
  const doneButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    doneButton.current?.focus();
  }, []);

  // One recording per mount; the callbacks are read when it ends.
  // biome-ignore lint/correctness/useExhaustiveDependencies: restarting would throw the recording away.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    const started = Date.now();
    const chunks: Blob[] = [];
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) =>
          MediaRecorder.isTypeSupported(t),
        );
        const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
        recorder.current = r;
        r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        r.onstop = () => {
          for (const t of stream?.getTracks() ?? []) t.stop();
          if (keep.current && chunks.length) {
            const mime = (r.mimeType || "audio/webm").split(";")[0] ?? "audio/webm";
            onDone(new Blob(chunks, { type: mime }), Date.now() - started);
          }
        };
        r.start(250);
        timer = setInterval(() => {
          const now = Date.now() - started;
          setMs(now);
          if (now >= VOICE_MESSAGE_MAX_MS) {
            keep.current = true;
            r.stop();
          }
        }, 200);
      } catch (err) {
        const name = err instanceof Error ? err.name : "";
        onError(
          name === "NotAllowedError"
            ? "Your browser blocked the microphone. Allow it in the address bar to record."
            : "Couldn't start recording on this device.",
        );
      }
    })();
    return () => {
      clearInterval(timer);
      if (recorder.current?.state === "recording") recorder.current.stop();
      for (const t of stream?.getTracks() ?? []) t.stop();
    };
  }, []);

  return (
    <div className="flex min-h-11 flex-1 items-center gap-3 pl-2">
      <span
        aria-hidden="true"
        className="size-2.5 animate-pulse rounded-full bg-danger-line motion-reduce:animate-none"
      />
      <span className="flex-1 text-fg">
        Recording <span className="tabular-nums">{clock(ms)}</span>
        <span className="text-fg-soft"> / 5:00</span>
      </span>
      <button
        type="button"
        onClick={() => {
          keep.current = false;
          recorder.current?.stop();
          onCancel();
        }}
        className="inline-flex size-11 items-center justify-center rounded-full text-fg-soft hover:bg-fg/8 hover:text-fg"
      >
        <Trash aria-hidden="true" size={20} />
        <span className="sr-only">Throw it away</span>
      </button>
      <button
        ref={doneButton}
        type="button"
        onClick={() => {
          keep.current = true;
          recorder.current?.stop();
        }}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-fg px-4 font-bold text-[var(--r-bg)]"
      >
        <Stop aria-hidden="true" size={18} weight="fill" />
        Done
      </button>
    </div>
  );
}
