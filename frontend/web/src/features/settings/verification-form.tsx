"use client";

import { SealCheck } from "@phosphor-icons/react";
import type { MyVerification } from "@realm/contracts";
import { type FormEvent, useState } from "react";
import { FormNotice, labelClass, SubmitButton } from "@/components/form";
import { useFetch } from "@/features/social/shared";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";

const field =
  "block h-12 w-full rounded-input border-[1.5px] border-line-strong bg-base/70 px-4 text-fg placeholder:text-fg-muted focus-visible:border-accent focus-visible:outline-none";

/**
 * Ask for the verified badge: who you are, what you do, and links where people already know you.
 * Realm's team checks each one by hand; you hear back in Activity.
 */
export function VerificationForm() {
  const mine = useFetch<MyVerification>("/users/@me/verification");
  const [kind, setKind] = useState<"notable" | "business">("notable");
  const [realName, setRealName] = useState("");
  const [category, setCategory] = useState("");
  const [links, setLinks] = useState(["", "", ""]);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const m = mine.data;

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setNotice(null);
    try {
      await api("/users/@me/verification", {
        body: {
          kind,
          realName: realName.trim(),
          category: category.trim(),
          links: links.map((l) => l.trim()).filter(Boolean),
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      });
      setNotice({
        tone: "success",
        text: "Sent. Realm's team will look at it and tell you in Activity.",
      });
      await mine.reload();
    } catch (err) {
      setNotice({
        tone: "error",
        text: err instanceof ApiError ? err.message : "Not sent. Try again.",
      });
    } finally {
      setPending(false);
    }
  };

  if (!m)
    return (
      <p role="status" className="text-fg-soft">
        Loading…
      </p>
    );
  if (m.verified) {
    return (
      <p className="flex items-center gap-2.5 rounded-[18px] bg-fg/[0.04] p-5 text-fg">
        <SealCheck
          aria-hidden="true"
          size={26}
          weight="fill"
          color={m.verified === "official" ? "#7ef2c4" : "#3b9cff"}
        />
        You're verified. The badge shows beside your name everywhere on Realm.
      </p>
    );
  }
  return (
    <div className="space-y-5">
      {m.request && (
        <FormNotice tone={m.request.status === "rejected" ? "error" : "info"}>
          {m.request.status === "pending"
            ? "Your request is waiting for Realm's team. You'll hear back in Activity."
            : m.request.status === "rejected"
              ? `Your last request wasn't approved${m.request.reason ? `: ${m.request.reason}` : "."}`
              : "Your request was approved."}
        </FormNotice>
      )}
      {m.canApply ? (
        <form onSubmit={send} className="space-y-4" noValidate>
          <fieldset>
            <legend className={labelClass}>You are</legend>
            <div className="flex gap-2">
              {(
                [
                  ["notable", "A well-known person"],
                  ["business", "A business or brand"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  onClick={() => setKind(k)}
                  className={cx(
                    "h-10 rounded-full px-4 font-bold",
                    kind === k ? "bg-fg text-base" : "bg-fg/8 text-fg",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className={labelClass}>
              {kind === "business" ? "Business name" : "Your real name"}
            </span>
            <input
              value={realName}
              onChange={(e) => setRealName(e.target.value)}
              maxLength={80}
              className={field}
            />
          </label>
          <label className="block">
            <span className={labelClass}>What you do</span>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              maxLength={40}
              placeholder={
                kind === "business"
                  ? "Like Coffee shop or Game studio"
                  : "Like Musician or Streamer"
              }
              className={field}
            />
          </label>
          <fieldset className="space-y-2">
            <legend className={labelClass}>Where people already know you (https:// links)</legend>
            {links.map((l, i) => (
              <input
                // biome-ignore lint/suspicious/noArrayIndexKey: three fixed link boxes.
                key={i}
                value={l}
                onChange={(e) => setLinks((x) => x.map((y, j) => (j === i ? e.target.value : y)))}
                placeholder={
                  i === 0
                    ? "Your official website or another verified account"
                    : "Another link (optional)"
                }
                aria-label={`Link ${i + 1}`}
                className={field}
              />
            ))}
          </fieldset>
          <label className="block">
            <span className={labelClass}>Anything else (optional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full resize-none rounded-input border-[1.5px] border-line-strong bg-base/70 px-4 py-3 text-fg focus-visible:border-accent focus-visible:outline-none"
            />
          </label>
          {notice && <FormNotice tone={notice.tone}>{notice.text}</FormNotice>}
          <SubmitButton pending={pending} pendingLabel="Sending" size="md">
            Ask to be verified
          </SubmitButton>
        </form>
      ) : (
        notice && <FormNotice tone={notice.tone}>{notice.text}</FormNotice>
      )}
    </div>
  );
}
