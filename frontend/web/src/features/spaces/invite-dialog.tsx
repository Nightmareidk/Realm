"use client";

import { Check, Copy, ShareNetwork } from "@phosphor-icons/react";
import { INVITE_MAX_AGES, INVITE_MAX_USES, type Invite } from "@realm/contracts";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Dialog } from "@/components/dialog";
import { FormNotice, labelClass } from "@/components/form";
import { pill } from "@/components/pill";
import { createInvite } from "@/features/realtime/actions";
import { openInvite, useRealm } from "@/features/realtime/store";
import { ApiError } from "@/lib/api";

type MaxAge = (typeof INVITE_MAX_AGES)[number];
type MaxUses = (typeof INVITE_MAX_USES)[number];

const AGE_LABEL: Record<MaxAge, string> = {
  1800: "30 minutes",
  3600: "1 hour",
  86400: "1 day",
  604800: "7 days",
  0: "Never expires",
};
const USES_LABEL: Record<MaxUses, string> = {
  0: "No limit",
  1: "1 use",
  5: "5 uses",
  10: "10 uses",
  25: "25 uses",
};

function describe(invite: Invite) {
  const expiry = invite.expiresAt
    ? `Works until ${new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(invite.expiresAt))}`
    : "Never expires";
  const uses = invite.maxUses
    ? `, for ${invite.maxUses} ${invite.maxUses === 1 ? "person" : "people"}`
    : "";
  return `${expiry}${uses}.`;
}

/** Bring your friends: a link to send, made the moment the sheet opens. */
export function InviteDialog() {
  const spaceId = useRealm((s) => s.ui.invite);
  const space = useRealm((s) => s.spaces.find((x) => x.id === s.ui.invite));
  return (
    <Dialog
      open={Boolean(spaceId)}
      onClose={() => openInvite(null)}
      title={space ? `Invite people to ${space.name}` : "Invite people"}
      lead="Send this link to your friends. Anyone with it can join."
    >
      {spaceId && <InviteBody spaceId={spaceId} spaceName={space?.name ?? "the Space"} />}
    </Dialog>
  );
}

function InviteBody({ spaceId, spaceName }: { spaceId: string; spaceName: string }) {
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [maxAge, setMaxAge] = useState<MaxAge>(604800);
  const [maxUses, setMaxUses] = useState<MaxUses>(0);
  const [pending, setPending] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const ageId = useId();
  const usesId = useId();

  const make = useCallback(
    async (age: MaxAge, uses: MaxUses) => {
      setPending(true);
      setError("");
      setCopied(false);
      try {
        setInvite(await createInvite(spaceId, { maxAgeSeconds: age, maxUses: uses }));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't make a link. Try again.");
      } finally {
        setPending(false);
      }
    },
    [spaceId],
  );

  // One link per opening (development runs effects twice; this keeps it to one).
  const made = useRef(false);
  useEffect(() => {
    setCanShare(typeof navigator.share === "function" && matchMedia("(pointer: coarse)").matches);
    if (made.current) return;
    made.current = true;
    void make(604800, 0);
  }, [make]);

  const link = invite ? `${window.location.origin}/i/${invite.code}` : "";

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setError("Couldn't copy. Select the link and copy it yourself.");
    }
  };

  return (
    <div className="space-y-6">
      <FormNotice>{error}</FormNotice>
      <div>
        <label htmlFor="invite-link" className={labelClass}>
          Invite link
        </label>
        <div className="flex gap-2">
          <input
            id="invite-link"
            readOnly
            value={pending && !invite ? "Making a link…" : link}
            onFocus={(e) => e.currentTarget.select()}
            className="h-14 min-w-0 flex-1 rounded-input bg-base/70 px-4 text-[1rem] text-fg shadow-[inset_0_0_0_1.5px_var(--r-border-strong)] outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--r-focus)]"
          />
          <button
            type="button"
            onClick={copy}
            disabled={!invite}
            className={pill("action", "lg", "px-6 disabled:opacity-60")}
          >
            {copied ? (
              <Check aria-hidden="true" size={18} weight="bold" />
            ) : (
              <Copy aria-hidden="true" size={18} />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p role="status" className="mt-2 text-[0.92rem] text-fg-soft">
          {invite ? describe(invite) : ""}
        </p>
      </div>

      {canShare && invite && (
        <button
          type="button"
          onClick={() =>
            void navigator.share({ title: `Join ${spaceName} on Realm`, url: link }).catch(() => {})
          }
          className={pill("ghost", "md")}
        >
          <ShareNetwork aria-hidden="true" size={18} />
          Share
        </button>
      )}

      <details className="group rounded-card shadow-[inset_0_0_0_1px_var(--r-border)]">
        <summary className="flex h-12 cursor-pointer list-none items-center justify-between rounded-card px-4 font-bold text-fg marker:hidden hover:bg-surface [&::-webkit-details-marker]:hidden">
          Link settings
          <span className="text-[0.92rem] font-normal text-fg-soft">
            {AGE_LABEL[maxAge]} · {USES_LABEL[maxUses]}
          </span>
        </summary>
        <div className="grid gap-4 px-4 pt-2 pb-4 sm:grid-cols-2">
          <div>
            <label htmlFor={ageId} className="mb-1.5 block text-[0.92rem] text-fg-soft">
              Lasts
            </label>
            <select
              id={ageId}
              value={maxAge}
              onChange={(e) => setMaxAge(Number(e.target.value) as MaxAge)}
              className="h-12 w-full rounded-input bg-base/70 px-3 text-fg shadow-[inset_0_0_0_1.5px_var(--r-border-strong)] outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--r-focus)]"
            >
              {INVITE_MAX_AGES.map((a) => (
                <option key={a} value={a}>
                  {AGE_LABEL[a]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={usesId} className="mb-1.5 block text-[0.92rem] text-fg-soft">
              Uses
            </label>
            <select
              id={usesId}
              value={maxUses}
              onChange={(e) => setMaxUses(Number(e.target.value) as MaxUses)}
              className="h-12 w-full rounded-input bg-base/70 px-3 text-fg shadow-[inset_0_0_0_1.5px_var(--r-border-strong)] outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--r-focus)]"
            >
              {INVITE_MAX_USES.map((u) => (
                <option key={u} value={u}>
                  {USES_LABEL[u]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => void make(maxAge, maxUses)}
            aria-disabled={pending || undefined}
            className={pill("ghost", "md", "justify-self-start sm:col-span-2")}
          >
            {pending ? "Making a link…" : "Make a new link"}
          </button>
        </div>
      </details>
    </div>
  );
}
