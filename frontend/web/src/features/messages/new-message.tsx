"use client";

import { Check, MagnifyingGlass, X } from "@phosphor-icons/react";
import { Limits, type UserSummary } from "@realm/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@/components/dialog";
import { FormNotice, labelClass } from "@/components/form";
import { pill } from "@/components/pill";
import { loadMembers, openConversation } from "@/features/realtime/actions";
import { useRealm } from "@/features/realtime/store";
import { Avatar } from "@/features/spaces/person";
import { ApiError } from "@/lib/api";
import { cx } from "@/lib/cx";

/** How many Spaces' member lists the picker reads. */
const FROM_SPACES = 12;

/**
 * New message: pick one person for a DM, or several for a group (with an optional name). People
 * come from your Spaces and your conversations; whether they can be messaged is their call.
 */
export function NewMessageDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New message"
      className="w-[min(30rem,calc(100vw-1.5rem))]"
    >
      {open && <Picker onClose={onClose} />}
    </Dialog>
  );
}

function Picker({ onClose }: { onClose: () => void }) {
  const spaces = useRealm((s) => s.spaces);
  const members = useRealm((s) => s.members);
  const conversations = useRealm((s) => s.conversations);
  const presence = useRealm((s) => s.presence);
  const meId = useRealm((s) => s.me?.id);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<UserSummary[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();

  const ids = useMemo(() => spaces.slice(0, FROM_SPACES).map((s) => s.id), [spaces]);
  useEffect(() => {
    for (const id of ids) if (!members[id]) void loadMembers(id).catch(() => {});
  }, [ids, members]);

  const people = useMemo(() => {
    const all = new Map<string, UserSummary>();
    for (const c of conversations) for (const r of c.recipients) all.set(r.id, r);
    for (const id of ids) for (const m of members[id] ?? []) all.set(m.user.id, m.user);
    all.delete(meId ?? "");
    const q = query.trim().toLowerCase();
    return [...all.values()]
      .filter(
        (u) =>
          !q || u.displayName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        const on = (u: UserSummary) => (presence[u.id] && presence[u.id] !== "offline" ? 0 : 1);
        return on(a) - on(b) || a.displayName.localeCompare(b.displayName);
      });
  }, [conversations, members, ids, meId, query, presence]);

  const toggle = (u: UserSummary) =>
    setPicked((list) =>
      list.some((p) => p.id === u.id)
        ? list.filter((p) => p.id !== u.id)
        : list.length + 1 >= Limits.groupDmRecipients.max
          ? list
          : [...list, u],
    );

  const start = async () => {
    if (picked.length === 0 || pending) return;
    setPending(true);
    setError("");
    try {
      const c = await openConversation(
        picked.map((p) => p.id),
        picked.length > 1 && name.trim() ? name.trim() : undefined,
      );
      onClose();
      router.push(`/messages/${c.id}`);
    } catch (err) {
      setPending(false);
      setError(err instanceof ApiError ? err.message : "Couldn't start that. Try again.");
    }
  };

  return (
    <div className="space-y-4">
      <FormNotice>{error}</FormNotice>
      {picked.length > 0 && (
        <ul aria-label="To" className="flex flex-wrap gap-1.5">
          {picked.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => toggle(p)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-fg/8 pr-2 pl-1 text-[0.9rem] font-semibold text-fg hover:bg-fg/12"
              >
                <Avatar user={p} size={24} />
                {p.displayName}
                <X aria-hidden="true" size={14} className="text-fg-soft" />
                <span className="sr-only">(remove)</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <MagnifyingGlass
          aria-hidden="true"
          size={17}
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-fg-soft"
        />
        <label htmlFor="new-message-q" className="sr-only">
          Search people
        </label>
        <input
          id="new-message-q"
          // biome-ignore lint/a11y/noAutofocus: the sheet opens to pick someone; search is the first step.
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people from your Spaces"
          autoComplete="off"
          className="h-11 w-full rounded-full bg-fg/[0.05] pr-3 pl-10 text-fg outline-none placeholder:text-fg-muted focus-visible:shadow-[inset_0_0_0_2px_var(--r-focus)]"
        />
      </div>
      <ul aria-label="People" className="-mx-2 max-h-[min(20rem,45vh)] overflow-y-auto">
        {people.length === 0 ? (
          <li className="px-2 py-6 text-center text-[0.95rem] text-fg-soft">
            {query
              ? "Nobody by that name in your Spaces."
              : "People from your Spaces show up here."}
          </li>
        ) : (
          people.map((u) => {
            const on = picked.some((p) => p.id === u.id);
            return (
              <li key={u.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(u)}
                  className={cx(
                    "flex w-full items-center gap-3 rounded-[0.9rem] px-2 py-2 text-left transition-colors duration-150",
                    on ? "bg-fg/8" : "hover:bg-fg/[0.05]",
                  )}
                >
                  <Avatar
                    user={u}
                    size={40}
                    presence={presence[u.id]}
                    ring="var(--r-surface-raised)"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-fg">{u.displayName}</span>
                    <span className="block truncate text-[0.85rem] text-fg-soft">
                      @{u.username}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={cx(
                      "grid size-6 shrink-0 place-items-center rounded-full",
                      on
                        ? "bg-accent text-on-accent"
                        : "shadow-[inset_0_0_0_1.5px_var(--r-border-strong)]",
                    )}
                  >
                    {on && <Check size={14} weight="bold" />}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
      {picked.length > 1 && (
        <div>
          <label htmlFor="group-name" className={labelClass}>
            Group name <span className="font-normal text-fg-soft">(optional)</span>
          </label>
          <input
            id="group-name"
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ranked night"
            className="h-11 w-full rounded-input bg-base/70 px-4 text-fg shadow-[inset_0_0_0_1.5px_var(--r-border-strong)] outline-none placeholder:text-fg-muted focus-visible:shadow-[inset_0_0_0_2px_var(--r-focus)]"
          />
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void start()}
          aria-disabled={picked.length === 0 || pending || undefined}
          className={pill("action", "md", "aria-disabled:opacity-50")}
        >
          {pending ? "One moment" : picked.length > 1 ? "Start the group" : "Chat"}
        </button>
        <p className="text-[0.85rem] text-fg-soft">
          {picked.length > 1
            ? `${picked.length + 1} people, you included`
            : "Their DM settings decide who can message them."}
        </p>
      </div>
    </div>
  );
}
