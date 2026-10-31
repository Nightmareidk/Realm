"use client";

import { FolderSimplePlus, Plus, UserCircle } from "@phosphor-icons/react";
import type { Collection, UserSummary } from "@realm/contracts";
import Link from "next/link";
import { type FormEvent, Fragment, useEffect, useState } from "react";
import { Dialog } from "@/components/dialog";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";

/** Text with @names turned into links to those profiles. */
export function MentionText({ text }: { text: string }) {
  const parts = text.split(/(@[a-z0-9_.]{1,30})/gi);
  return (
    <>
      {parts.map((p, i) => {
        const name = p.startsWith("@") ? p.slice(1).replace(/\.+$/, "") : null;
        return name ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the pieces of one fixed string.
          <Fragment key={i}>
            <Link
              href={`/u/${name.toLowerCase()}`}
              className="font-bold text-[var(--r-link,var(--r-text))] hover:underline"
            >
              @{name}
            </Link>
            {p.slice(1 + name.length)}
          </Fragment>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: the pieces of one fixed string.
          <Fragment key={i}>{p}</Fragment>
        );
      })}
    </>
  );
}

/** The people tagged in a photo: a small button on it, and their names when pressed. */
export function TagsOnPhoto({ tags }: { tags: UserSummary[] }) {
  const [open, setOpen] = useState(false);
  if (!tags.length) return null;
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="absolute right-3 bottom-3 grid size-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm"
      >
        <UserCircle aria-hidden="true" size={20} weight="fill" />
        <span className="sr-only">
          {open ? "Hide" : "Show"} {tags.length} tagged {tags.length === 1 ? "person" : "people"}
        </span>
      </button>
      {open && (
        <ul className="absolute inset-x-3 bottom-14 flex flex-wrap justify-center gap-1.5">
          {tags.map((u) => (
            <li key={u.id}>
              <Link
                href={`/u/${u.username}`}
                onClick={(e) => e.stopPropagation()}
                className="block rounded-lg bg-black/70 px-2.5 py-1 text-[0.85rem] font-bold text-white backdrop-blur-sm hover:bg-black/85"
              >
                {u.username}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * Save a post into one of your collections (or a new one). Putting it in a collection also saves
 * it, as on Instagram.
 */
export function CollectionPicker({
  postId,
  open,
  onClose,
  onSaved,
}: {
  postId: string;
  open: boolean;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [items, setItems] = useState<Collection[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    api<{ items: Collection[] }>("/users/@me/collections")
      .then((r) => setItems(r.items))
      .catch(() => setError("Couldn't load your collections. Try again."));
  }, [open]);

  const put = async (c: Collection) => {
    if (busy) return;
    setBusy(true);
    try {
      await api(`/users/@me/collections/${c.id}/posts/${postId}`, { method: "PUT" });
      onSaved(c.name);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Not saved. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const make = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const c = await api<Collection>("/users/@me/collections", { body: { name: name.trim() } });
      setName("");
      setBusy(false);
      await put(c);
    } catch (err) {
      setBusy(false);
      setError(err instanceof ApiError ? err.message : "Not made. Try again.");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Save to a collection">
      {error && <p className="mb-3 text-[0.9rem] text-danger">{error}</p>}
      {items === null ? (
        <p className="text-fg-soft">Loading…</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => void put(c)} className="group w-full text-left">
                <span className="grid aspect-square grid-cols-2 grid-rows-2 overflow-hidden rounded-2xl bg-surface-raised transition-transform duration-150 group-active:scale-[0.97]">
                  {c.covers.slice(0, 4).map((u) => (
                    // biome-ignore lint/performance/noImgElement: saved posts' own photos.
                    <img key={u} src={u} alt="" className="size-full object-cover" />
                  ))}
                </span>
                <span className="mt-1.5 block truncate font-bold text-fg">{c.name}</span>
                <span className="block text-[0.82rem] text-fg-soft">{c.count} saved</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={make} className="mt-5 flex items-center gap-2">
        <FolderSimplePlus aria-hidden="true" size={22} className="shrink-0 text-fg-soft" />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="New collection"
          aria-label="New collection name"
          className="h-11 min-w-0 flex-1 rounded-input border-[1.5px] border-line-strong bg-base/70 px-3 text-fg outline-none focus-visible:border-accent"
        />
        <button
          type="submit"
          aria-disabled={!name.trim() || busy || undefined}
          className={cx(
            "grid size-11 shrink-0 place-items-center rounded-full bg-accent text-on-accent",
            !name.trim() && "opacity-50",
          )}
        >
          <Plus aria-hidden="true" size={20} weight="bold" />
          <span className="sr-only">Make it and save</span>
        </button>
      </form>
    </Dialog>
  );
}
