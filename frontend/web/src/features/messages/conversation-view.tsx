"use client";

import { CaretLeft, Info, MagnifyingGlass, Sparkle, UserPlus } from "@phosphor-icons/react";
import type { Conversation, UserSummary } from "@realm/contracts";
import { Limits } from "@realm/contracts";
import { THEME_ORDER, themes } from "@realm/design-tokens";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Dialog } from "@/components/dialog";
import { FormNotice, labelClass } from "@/components/form";
import { pill, textLink } from "@/components/pill";
import { Popover } from "@/features/app/menus";
import { conversationScope } from "@/features/chat/scope";
import { addToGroup, leaveConversation, updateConversation } from "@/features/realtime/actions";
import {
  conversationTitle,
  isMuted,
  openReport,
  setState,
  upsertConversation,
  useRealm,
} from "@/features/realtime/store";
import { Chat } from "@/features/spaces/chat";
import { Avatar, presenceLabel } from "@/features/spaces/person";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";
import { ConversationAvatar, NotE2eeChip } from "./parts";

/** One DM or group chat: who it's with, the chat, and its details. */
export function ConversationView({ id }: { id: string }) {
  const c = useRealm((s) => s.conversations.find((x) => x.id === id));
  const loaded = useRealm((s) => s.conversationsLoaded);
  const meId = useRealm((s) => s.me?.id);
  const blocked = useRealm((s) => s.blocked);
  const presence = useRealm((s) => s.presence);
  const [missing, setMissing] = useState(false);
  const [explain, setExplain] = useState(false);
  const [details, setDetails] = useState(false);

  // A closed DM (or one this device hasn't heard of) is fetched when opened by its link.
  useEffect(() => {
    if (c || !loaded) return;
    api<Conversation>(`/users/@me/channels/${id}`)
      .then((found) =>
        setState((s) => ({
          ...s,
          conversations: upsertConversation(s.conversations, found, s.me?.id),
        })),
      )
      .catch(() => setMissing(true));
  }, [c, loaded, id]);

  const scope = useMemo(
    () => (c && meId ? conversationScope(c, meId, blocked) : null),
    [c, meId, blocked],
  );

  useEffect(() => {
    if (c) document.title = `${conversationTitle(c)} | Realm`;
  }, [c]);

  if (!c || !scope) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        {missing ? (
          <>
            <p className="font-display text-[1.4rem] font-bold text-fg">
              This conversation isn't here.
            </p>
            <p className="mt-2 text-fg-soft">You may have left it, or it was never yours.</p>
            <Link href="/messages" className={cx(textLink, "mt-5")}>
              Back to your messages
            </Link>
          </>
        ) : (
          <p role="status" className="text-fg-soft">
            Opening the conversation…
          </p>
        )}
      </div>
    );
  }

  const title = conversationTitle(c);
  const other = c.type === "dm" ? c.recipients[0] : undefined;
  const otherStatus = other ? (presence[other.id] ?? "offline") : null;
  const around = c.recipients.filter((r) => presence[r.id] && presence[r.id] !== "offline").length;

  const tint = chatTint(c.id, c.colour);
  return (
    <div
      className="r-chat-tint relative isolate flex h-dvh min-h-0 flex-col md:h-auto md:flex-1"
      style={
        {
          "--chat": tint.accent,
          "--on-chat": tint.onAccent,
          "--chat-2": tint.lights[1] ?? tint.accent,
        } as React.CSSProperties
      }
    >
      <div aria-hidden="true" className="r-chat-wall" />
      <header className="relative flex items-center gap-3 border-b border-line px-2 pt-2 pb-2.5 md:px-6 md:pt-0">
        <Link
          href="/messages"
          className="-mr-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-fg-soft hover:bg-fg/8 hover:text-fg lg:hidden"
        >
          <CaretLeft aria-hidden="true" size={22} />
          <span className="sr-only">Your messages</span>
        </Link>
        <button
          type="button"
          onClick={() => setDetails(true)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-[1rem] text-left"
        >
          <ConversationAvatar conversation={c} presence={presence} size={40} />
          <span className="min-w-0">
            <span className="block truncate font-display text-[1.15rem] leading-tight font-bold tracking-[-0.02em] text-fg md:text-[1.3rem]">
              {title}
            </span>
            <span className="block truncate text-[0.85rem] text-fg-soft sm:hidden">
              Not end-to-end encrypted yet
            </span>
            <span
              className={cx(
                "truncate text-[0.85rem] max-sm:hidden sm:block",
                (otherStatus && otherStatus !== "offline") || (!other && around > 0)
                  ? "font-semibold text-presence"
                  : "text-fg-soft",
              )}
            >
              {other
                ? otherStatus === "offline"
                  ? `@${other.username}`
                  : presenceLabel[otherStatus ?? "offline"]
                : `${c.recipients.length + 1} people${around ? ` · ${around} around` : ""}`}
            </span>
          </span>
        </button>
        <NotE2eeChip onClick={() => setExplain(true)} className="max-sm:hidden" />
        <ChatColour c={c} />
        <button
          type="button"
          onClick={() => setDetails(true)}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-fg-soft hover:bg-fg/8 hover:text-fg"
        >
          <Info aria-hidden="true" size={22} />
          <span className="sr-only">Details</span>
        </button>
      </header>

      {c.request && <RequestBar c={c} />}
      {c.awaiting && (
        <p className="relative border-b border-line px-6 py-2 text-[0.88rem] text-fg-soft">
          They haven't accepted yet, so it's words only until they do.
        </p>
      )}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <Chat
          key={c.id}
          room={c}
          scope={scope}
          presenceNote={
            // The peek: in a DM, the other person's face while they're around.
            other && otherStatus === "online" ? (
              <span className="inline-flex items-center gap-2 px-1 text-[0.85rem] font-semibold text-presence">
                <span className="grid size-6 place-items-center rounded-full shadow-[inset_0_0_0_1.5px_var(--r-presence)]">
                  <Avatar user={other} size={20} />
                </span>
                {other.displayName.split(/\s+/)[0]} is here
              </span>
            ) : null
          }
        />
      </div>

      <Dialog open={explain} onClose={() => setExplain(false)} title="Not end-to-end encrypted yet">
        <div className="space-y-3 text-fg-soft">
          <p>
            Messages here are encrypted on the way and where they're stored, but Realm's servers can
            read them, as with most chat apps today.
          </p>
          <p>
            End-to-end encryption for direct messages and group chats is planned before Realm opens
            to everyone. This label changes when it arrives.
          </p>
          <button type="button" onClick={() => setExplain(false)} className={pill("ghost", "md")}>
            Got it
          </button>
        </div>
      </Dialog>

      <Dialog open={details} onClose={() => setDetails(false)} title={title}>
        {details && <Details conversation={c} onClose={() => setDetails(false)} />}
      </Dialog>
    </div>
  );
}

function Details({
  conversation: c,
  onClose,
}: {
  conversation: Conversation;
  onClose: () => void;
}) {
  const presence = useRealm((s) => s.presence);
  const meId = useRealm((s) => s.me?.id);
  const muted = useRealm((s) => isMuted(s, "channel", c.id));
  const members = useRealm((s) => s.members);
  const spaces = useRealm((s) => s.spaces);
  const [name, setName] = useState(c.name ?? "");
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const group = c.type === "group_dm";
  const other = c.type === "dm" ? c.recipients[0] : undefined;

  const fail = (err: unknown, fallback: string) =>
    setNotice({ tone: "error", text: err instanceof ApiError ? err.message : fallback });

  const rename = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await updateConversation(c.id, { name: name.trim() || null });
      setNotice({ tone: "success", text: "Saved." });
    } catch (err) {
      fail(err, "Couldn't rename it.");
    }
  };

  const toggleMute = async () => {
    const path = `/users/@me/mutes/channel/${c.id}`;
    try {
      if (muted) await api(path, { method: "DELETE" });
      else await api(path, { method: "PUT", body: {} });
      setState((s) => ({
        ...s,
        mutes: muted
          ? s.mutes.filter((m) => !(m.targetType === "channel" && m.targetId === c.id))
          : [...s.mutes, { targetType: "channel", targetId: c.id, until: null }],
      }));
    } catch (err) {
      fail(err, "Couldn't change that.");
    }
  };

  const candidates = useMemo(() => {
    const all = new Map<string, UserSummary>();
    for (const sp of spaces) for (const m of members[sp.id] ?? []) all.set(m.user.id, m.user);
    for (const r of c.recipients) all.delete(r.id);
    all.delete(meId ?? "");
    const q = query.trim().toLowerCase();
    return [...all.values()]
      .filter((u) => !q || u.displayName.toLowerCase().includes(q) || u.username.includes(q))
      .slice(0, 30);
  }, [spaces, members, c.recipients, meId, query]);

  return (
    <div className="space-y-6">
      {notice && <FormNotice tone={notice.tone}>{notice.text}</FormNotice>}
      <p className="text-[0.92rem] text-fg-soft">
        <span className="font-bold text-fg">Not end-to-end encrypted yet.</span> Messages here are
        encrypted on the way and where they're stored, but Realm's servers can read them. End-to-end
        encryption is planned before public launch.
      </p>
      {group && (
        <form noValidate onSubmit={rename} className="space-y-2">
          <label htmlFor="group-rename" className={labelClass}>
            Group name
          </label>
          <div className="flex gap-2">
            <input
              id="group-rename"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              placeholder={conversationTitle({ name: null, recipients: c.recipients })}
              className="h-11 min-w-0 flex-1 rounded-input bg-base/70 px-4 text-fg shadow-[inset_0_0_0_1.5px_var(--r-border-strong)] outline-none placeholder:text-fg-muted focus-visible:shadow-[inset_0_0_0_2px_var(--r-focus)]"
            />
            <button type="submit" className={pill("ghost", "md")}>
              Save
            </button>
          </div>
        </form>
      )}

      <section aria-labelledby="details-people">
        <div className="flex items-center justify-between">
          <h3 id="details-people" className={labelClass}>
            {group ? `${c.recipients.length + 1} people` : "With"}
          </h3>
          {group && c.recipients.length + 1 < Limits.groupDmRecipients.max && (
            <button
              type="button"
              onClick={() => setAdding((a) => !a)}
              aria-expanded={adding}
              className={pill("quiet", "sm")}
            >
              <UserPlus aria-hidden="true" size={16} />
              Add people
            </button>
          )}
        </div>
        {adding && (
          <div className="mt-2 rounded-[1rem] bg-fg/[0.04] p-2">
            <div className="relative">
              <MagnifyingGlass
                aria-hidden="true"
                size={16}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-soft"
              />
              <label htmlFor="details-add" className="sr-only">
                Search people to add
              </label>
              <input
                id="details-add"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people from your Spaces"
                className="h-10 w-full rounded-full bg-base/60 pr-3 pl-9 text-[0.95rem] text-fg outline-none placeholder:text-fg-muted focus-visible:shadow-[inset_0_0_0_2px_var(--r-focus)]"
              />
            </div>
            <ul className="mt-1 max-h-48 overflow-y-auto">
              {candidates.length === 0 ? (
                <li className="px-2 py-3 text-[0.9rem] text-fg-soft">
                  Open your Spaces to see more people here.
                </li>
              ) : (
                candidates.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 px-1.5 py-1.5">
                    <Avatar user={u} size={32} />
                    <span className="min-w-0 flex-1 truncate font-semibold text-fg">
                      {u.displayName}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        addToGroup(c.id, u.id)
                          .then(() =>
                            setNotice({ tone: "success", text: `${u.displayName} is in.` }),
                          )
                          .catch((err) => fail(err, "Couldn't add them."))
                      }
                      className={pill("ghost", "sm")}
                    >
                      Add
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
        <ul className="mt-2 divide-y divide-line">
          {c.recipients.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2.5">
              <Avatar user={r} size={40} presence={presence[r.id]} ring="var(--r-surface-raised)" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-fg">{r.displayName}</span>
                <span className="block truncate text-[0.85rem] text-fg-soft">
                  {presenceLabel[presence[r.id] ?? "offline"]}
                  {c.ownerId === r.id ? " · started the group" : ""}
                </span>
              </span>
              {group && c.ownerId === meId && (
                <RemoveButton
                  name={r.displayName}
                  onRemove={() =>
                    api(`/users/@me/channels/${c.id}/recipients/${r.id}`, {
                      method: "DELETE",
                    }).catch((err) => fail(err, "Couldn't remove them."))
                  }
                />
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-2 border-t border-line pt-5">
        <button
          type="button"
          onClick={() =>
            updateConversation(c.id, { pinned: !c.pinned }).catch((err) =>
              fail(err, "Couldn't change that."),
            )
          }
          className={pill("ghost", "sm")}
        >
          {c.pinned ? "Unpin from the top" : "Pin to the top"}
        </button>
        <button type="button" onClick={() => void toggleMute()} className={pill("ghost", "sm")}>
          {muted ? "Unmute" : "Mute"}
        </button>
        {other && (
          <button
            type="button"
            onClick={() => {
              onClose();
              openReport({
                targetType: "user",
                targetId: other.id,
                label: other.displayName,
                blockUserId: other.id,
              });
            }}
            className={pill("ghost", "sm")}
          >
            Report or block
          </button>
        )}
        <button
          type="button"
          onClick={() =>
            leaveConversation(c.id)
              .then(() => {
                onClose();
                router.push("/messages");
              })
              .catch((err) => fail(err, "Couldn't do that."))
          }
          className={pill(
            "ghost",
            "sm",
            "text-danger shadow-[inset_0_0_0_1.5px_var(--r-danger-line)]",
          )}
        >
          {group ? "Leave the group" : "Close the chat"}
        </button>
      </div>
      {!group && (
        <p className="text-[0.85rem] text-fg-soft">
          Closing a chat takes it off your list until someone sends something new.
        </p>
      )}
    </div>
  );
}

/** Remove someone from the group: asked once, in place. */
function RemoveButton({ name, onRemove }: { name: string; onRemove: () => void }) {
  const [asking, setAsking] = useState(false);
  const danger = "text-danger shadow-[inset_0_0_0_1.5px_var(--r-danger-line)]";
  return asking ? (
    <span className="flex shrink-0 items-center gap-1.5">
      <button type="button" onClick={onRemove} className={pill("ghost", "sm", danger)}>
        Remove<span className="sr-only"> {name}</span>
      </button>
      <button type="button" onClick={() => setAsking(false)} className={pill("quiet", "sm")}>
        Keep
      </button>
    </span>
  ) : (
    <button type="button" onClick={() => setAsking(true)} className={pill("ghost", "sm", danger)}>
      Remove<span className="sr-only"> {name}</span>
    </button>
  );
}

/**
 * A conversation's own colour (Look B): the one someone in it picked, or one of Realm's colours
 * picked from its id so it stays.
 */
function chatTint(id: string, chosen?: Conversation["colour"]) {
  if (chosen) return themes[chosen];
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return themes[THEME_ORDER[h % THEME_ORDER.length] ?? "mint"];
}

/** Chat colour: anyone in the conversation picks it, and everyone in it sees it. */
function ChatColour({ c }: { c: Conversation }) {
  const [error, setError] = useState("");
  const pick = async (colour: Conversation["colour"], close: () => void) => {
    setError("");
    try {
      await updateConversation(c.id, { colour });
      close();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't change. Try again.");
    }
  };
  return (
    <Popover
      label="Chat colour"
      buttonClass="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-fg/10 px-3.5 text-[0.88rem] font-bold text-fg hover:bg-fg/15 aria-expanded:bg-fg/15 max-sm:hidden"
      panelClass="w-[15rem]"
      button={
        <>
          <Sparkle aria-hidden="true" size={16} />
          Chat colour
        </>
      }
    >
      {(close) => (
        <div className="p-2">
          <p className="px-1 pb-2 text-[0.85rem] text-fg-soft">Everyone in this chat sees it.</p>
          <div className="grid grid-cols-5 gap-2">
            <button
              type="button"
              aria-pressed={!c.colour}
              onClick={() => void pick(null, close)}
              className={cx(
                "grid size-10 place-items-center rounded-full bg-fg/8 text-[0.7rem] font-bold text-fg-soft",
                !c.colour && "ring-[3px] ring-fg",
              )}
            >
              Auto
            </button>
            {THEME_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={c.colour === id}
                aria-label={themes[id].name}
                onClick={() => void pick(id, close)}
                className={cx("size-10 rounded-full", c.colour === id && "ring-[3px] ring-fg")}
                style={{ backgroundColor: themes[id].accent }}
              />
            ))}
          </div>
          {error && (
            <p role="alert" className="px-1 pt-2 text-[0.85rem] text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </Popover>
  );
}

/**
 * A message request (someone you don't follow wrote first): they can't see you've read it, and
 * nothing more arrives as a notification, until you accept. Replying accepts too.
 */
function RequestBar({ c }: { c: Conversation }) {
  const router = useRouter();
  const meId = useRealm((s) => s.me?.id);
  const them = c.recipients.find((r) => r.id !== meId) ?? c.recipients[0];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const act = async (what: "accept" | "delete" | "block") => {
    setBusy(true);
    setError("");
    try {
      if (what === "accept") {
        await api(`/users/@me/channels/${c.id}/accept`, { body: {} });
        setState((s) => ({
          ...s,
          conversations: s.conversations.map((x) => (x.id === c.id ? { ...x, request: false } : x)),
        }));
      } else {
        if (what === "block" && them) {
          await api(`/users/@me/blocks/${them.id}`, { method: "PUT" });
        }
        await leaveConversation(c.id);
        router.push("/messages");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't work. Try again.");
      setBusy(false);
    }
  };
  return (
    <div className="relative border-b border-line bg-fg/[0.04] px-6 py-3.5">
      <p className="font-bold text-fg">Message request</p>
      <p className="mt-0.5 text-[0.92rem] text-fg-soft">
        {them ? `${them.displayName} wants to message you.` : "Someone wants to message you."} They
        won't know you've seen it until you accept. Replying accepts it too.
      </p>
      {error && (
        <p role="alert" className="mt-1.5 text-[0.9rem] text-danger">
          {error}
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          type="button"
          aria-disabled={busy || undefined}
          onClick={() => void act("accept")}
          className={pill("action", "sm")}
        >
          Accept
        </button>
        <button
          type="button"
          aria-disabled={busy || undefined}
          onClick={() => void act("delete")}
          className={pill("ghost", "sm")}
        >
          Delete
        </button>
        {them && (
          <button
            type="button"
            aria-disabled={busy || undefined}
            onClick={() => void act("block")}
            className={pill(
              "ghost",
              "sm",
              "text-danger shadow-[inset_0_0_0_1.5px_var(--r-danger-line)]",
            )}
          >
            Block
          </button>
        )}
      </div>
    </div>
  );
}
