"use client";

import { Check, Globe, LockSimple } from "@phosphor-icons/react";
import { CommunityName, type ThemeAccent } from "@realm/contracts";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/dialog";
import { FormNotice, labelClass, SubmitButton, TextField } from "@/components/form";
import { currentAccent } from "@/features/auth/accent";
import { THEME_ORDER, THEMES } from "@/features/home/themes";
import { createSpace } from "@/features/realtime/actions";
import { openCreateSpace, openInvite, useRealm } from "@/features/realtime/store";
import { ApiError } from "@/lib/api";
import { cx } from "@/lib/cx";
import { SpaceBadge } from "./space-badge";

const WHO = [
  {
    id: "private",
    icon: LockSimple,
    title: "Just us",
    body: "Private. People join with an invite from someone inside.",
  },
  {
    id: "public",
    icon: Globe,
    title: "Anyone",
    body: "Public. People can find it in Explore and join.",
  },
] as const;

/**
 * Start a Space in under a minute (docs/research/2026-10-phase1-spaces-feed-safety.md §5a): a
 * name, who it's for, and its colour. You land in its #general with the invite sheet open.
 */
export function CreateSpaceDialog() {
  const open = useRealm((s) => s.ui.createSpace);
  return (
    <Dialog
      open={open}
      onClose={() => openCreateSpace(false)}
      title="Start a Space"
      lead="One place for your crew: rooms to talk in, and who's around."
    >
      <CreateSpaceForm />
    </Dialog>
  );
}

function CreateSpaceForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [who, setWho] = useState<"private" | "public">("private");
  const [accent, setAccent] = useState<ThemeAccent>("mint");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // Starts in your own colour; the Space can wear any of the four.
  useEffect(() => {
    setAccent(currentAccent());
    input.current?.focus();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const parsed = CommunityName.safeParse(name);
    if (!parsed.success) {
      setError(
        name.trim()
          ? (parsed.error.issues[0]?.message ?? "Check the name")
          : "Give your Space a name",
      );
      input.current?.focus();
      return;
    }
    setError("");
    setNotice("");
    setPending(true);
    try {
      const space = await createSpace({ name: parsed.data, visibility: who, accent });
      openCreateSpace(false);
      router.push(`/spaces/${space.slug}`);
      openInvite(space.id);
    } catch (err) {
      setPending(false);
      if (err instanceof ApiError && err.fields.name) setError(err.fields.name);
      else
        setNotice(err instanceof ApiError ? err.message : "Couldn't start the Space. Try again.");
    }
  };

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-6">
      <FormNotice>{notice}</FormNotice>
      <div className="flex items-end gap-3">
        <SpaceBadge name={name || "Space"} accent={accent} size={56} />
        <TextField
          className="flex-1"
          label="Name"
          name="space-name"
          autoComplete="off"
          maxLength={64}
          placeholder="Late Night Lobby"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
          inputRef={input}
        />
      </div>

      <fieldset>
        <legend className={labelClass}>Who's it for?</legend>
        <div className="space-y-2.5">
          {WHO.map((w) => {
            const on = who === w.id;
            const Icon = w.icon;
            return (
              <label
                key={w.id}
                className={cx(
                  "flex cursor-pointer items-start gap-3.5 rounded-card px-4 py-3.5 transition-[box-shadow,background-color] duration-150 ease-out",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                  on
                    ? "bg-surface shadow-[inset_0_0_0_1.5px_var(--r-text)]"
                    : "shadow-[inset_0_0_0_1.5px_var(--r-border-strong)] hover:bg-surface",
                )}
              >
                <input
                  type="radio"
                  name="who"
                  value={w.id}
                  checked={on}
                  onChange={() => setWho(w.id)}
                  className="sr-only"
                />
                <Icon aria-hidden="true" size={22} className="mt-0.5 shrink-0 text-fg-soft" />
                <span className="flex-1">
                  <span className="block font-bold text-fg">{w.title}</span>
                  <span className="block text-[0.94rem] leading-snug text-fg-soft">{w.body}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={cx(
                    "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full",
                    on
                      ? "bg-fg text-[var(--r-bg)]"
                      : "shadow-[inset_0_0_0_1.5px_var(--r-border-strong)]",
                  )}
                >
                  {on && <Check size={13} weight="bold" />}
                </span>
              </label>
            );
          })}
        </div>
        <p className="mt-2.5 text-[0.9rem] text-fg-soft">
          Private Spaces never show in Explore; people join only with an invite. Rooms in a Space
          aren't end-to-end encrypted.
        </p>
      </fieldset>

      <fieldset>
        <legend className={labelClass}>Its colour</legend>
        <div className="flex flex-wrap gap-2.5">
          {THEME_ORDER.map((id) => {
            const t = THEMES[id];
            const on = accent === id;
            return (
              <label
                key={id}
                className={cx(
                  "inline-flex h-11 cursor-pointer items-center gap-2 rounded-full pr-4 pl-1.5 font-bold transition-[box-shadow] duration-150 ease-out",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                  on
                    ? "bg-surface text-fg shadow-[inset_0_0_0_1.5px_var(--r-text)]"
                    : "text-fg-soft shadow-[inset_0_0_0_1.5px_var(--r-border-strong)] hover:text-fg",
                )}
              >
                <input
                  type="radio"
                  name="space-colour"
                  value={id}
                  checked={on}
                  onChange={() => setAccent(id)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className="grid size-8 place-items-center rounded-full"
                  style={{ background: t.acc, color: t.on }}
                >
                  {on && <Check size={14} weight="bold" />}
                </span>
                {t.name}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-1">
        <SubmitButton pending={pending} pendingLabel="Starting your Space" className="px-8">
          Start the Space
        </SubmitButton>
        <span className="text-[0.94rem] text-fg-soft">You can rename it later.</span>
      </div>
    </form>
  );
}
