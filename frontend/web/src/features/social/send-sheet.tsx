"use client";

import { Check, Link as LinkIcon, MagnifyingGlass, PaperPlaneTilt, X } from "@phosphor-icons/react";
import type { Conversation, SearchResults, UserSummary } from "@realm/contracts";
import { useEffect, useRef, useState } from "react";
import { openConversation } from "@/features/realtime/actions";
import { conversationTitle, useRealm } from "@/features/realtime/store";
import { Avatar } from "@/features/spaces/person";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";

type Target = { key: string; label: string; user?: UserSummary; conversation?: Conversation };

/**
 * Send something to people in Realm (Instagram's paper plane): your recent chats first, or anyone
 * you search for; pick several, add a note, and it arrives in each chat as a card. Copy link is
 * here too.
 */
export function SendSheet({
  open,
  link,
  what,
  onClose,
}: {
  open: boolean;
  /** The link the message carries (the chat shows it as a card). */
  link: string;
  /** "post", "profile": said in the title. */
  what: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const conversations = useRealm((s) => s.conversations);
  const meId = useRealm((s) => s.me?.id);
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<UserSummary[]>([]);
  const [picked, setPicked] = useState<Target[]>([]);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "copied">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setPicked([]);
      setNote("");
      setQuery("");
      setState("idle");
      setError("");
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    const q = query.trim().replace(/^@/, "");
    if (q.length < 2) return setPeople([]);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api<SearchResults>(`/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => setPeople(r.users.filter((u) => u.id !== meId).slice(0, 8)))
        .catch(() => {});
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, meId]);

  const recent: Target[] = conversations
    .filter((c) => !c.request)
    .slice(0, 12)
    .map((c) => ({
      key: `c${c.id}`,
      label: conversationTitle(c),
      conversation: c,
      user: c.recipients.find((r) => r.id !== meId),
    }));
  const found: Target[] = people.map((u) => ({ key: `u${u.id}`, label: u.displayName, user: u }));
  const shown = query.trim().length >= 2 ? found : recent;
  const isPicked = (t: Target) => picked.some((p) => p.key === t.key);
  const toggle = (t: Target) =>
    setPicked((p) => (isPicked(t) ? p.filter((x) => x.key !== t.key) : [...p, t].slice(0, 15)));

  const send = async () => {
    if (!picked.length || state === "sending") return;
    setState("sending");
    setError("");
    try {
      for (const t of picked) {
        const channelId =
          t.conversation?.id ?? (t.user ? (await openConversation([t.user.id])).id : null);
        if (!channelId) continue;
        const content = note.trim() ? `${note.trim()}\n${link}` : link;
        await api(`/channels/${channelId}/messages`, {
          body: { content, nonce: crypto.randomUUID().slice(0, 25) },
        });
      }
      setState("sent");
      setTimeout(onClose, 900);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Not sent. Try again.");
      setState("idle");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setState("copied");
    } catch {
      setError(link);
    }
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes it (the dialog's own cancel).
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={`Send this ${what}`}
      className="m-auto max-h-[80vh] w-[min(28rem,calc(100vw-1.5rem))] overflow-hidden rounded-[22px] bg-surface p-0 text-fg backdrop:bg-[rgb(5_5_7/0.75)]"
    >
      {open && (
        <div className="flex max-h-[80vh] flex-col">
          <header className="flex items-center border-b border-line px-4 py-3">
            <h2 className="flex-1 text-center font-display text-[1.05rem] font-bold">Send</h2>
            <button
              type="button"
              onClick={onClose}
              className="grid size-9 place-items-center rounded-full text-fg-soft hover:bg-fg/8 hover:text-fg"
            >
              <X aria-hidden="true" size={20} />
              <span className="sr-only">Close</span>
            </button>
          </header>
          <div className="px-4 pt-3">
            <div className="flex h-11 items-center gap-2.5 rounded-full bg-surface-raised px-4">
              <MagnifyingGlass aria-hidden="true" size={18} className="text-fg-soft" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people"
                aria-label="Search people"
                className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-fg-muted"
              />
            </div>
          </div>
          <ul className="grid min-h-[12rem] flex-1 grid-cols-4 content-start gap-x-2 gap-y-4 overflow-y-auto px-4 py-4 max-sm:grid-cols-3">
            {shown.length === 0 ? (
              <li className="col-span-full py-6 text-center text-fg-soft">
                {query.trim().length >= 2
                  ? "Nobody by that name."
                  : "Search for someone to send it to."}
              </li>
            ) : (
              shown.map((t) => {
                const on = isPicked(t);
                return (
                  <li key={t.key}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(t)}
                      className="flex w-full flex-col items-center gap-1.5 text-center"
                    >
                      <span className="relative">
                        {t.user ? (
                          <Avatar user={t.user} size={60} />
                        ) : (
                          <span className="grid size-[60px] place-items-center rounded-full bg-surface-raised font-bold">
                            {t.label.slice(0, 1)}
                          </span>
                        )}
                        {on && (
                          <span className="absolute right-0 bottom-0 grid size-6 place-items-center rounded-full bg-accent text-on-accent shadow-[0_0_0_2.5px_var(--r-surface)]">
                            <Check aria-hidden="true" size={13} weight="bold" />
                          </span>
                        )}
                      </span>
                      <span className="line-clamp-2 text-[0.8rem] leading-tight text-fg">
                        {t.label}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <div className="border-t border-line px-4 py-3">
            {picked.length > 0 && (
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                placeholder="Write a message…"
                aria-label="Write a message"
                className="mb-2.5 h-11 w-full rounded-full bg-surface-raised px-4 outline-none placeholder:text-fg-muted"
              />
            )}
            {error && (
              <p role="alert" className="mb-2 text-[0.88rem] text-danger [overflow-wrap:anywhere]">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void copy()}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-fg/10 px-4 font-bold hover:bg-fg/15"
              >
                <LinkIcon aria-hidden="true" size={17} />
                {state === "copied" ? "Copied" : "Copy link"}
              </button>
              <button
                type="button"
                onClick={() => void send()}
                aria-disabled={!picked.length || state === "sending" || undefined}
                className={cx(
                  "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-accent font-bold text-on-accent aria-disabled:opacity-50",
                )}
              >
                <PaperPlaneTilt aria-hidden="true" size={17} weight="fill" />
                {state === "sent"
                  ? "Sent"
                  : state === "sending"
                    ? "Sending…"
                    : picked.length > 1
                      ? `Send separately (${picked.length})`
                      : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
