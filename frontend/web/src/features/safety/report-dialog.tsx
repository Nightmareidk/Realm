"use client";

import type { ReportReason, ReportReceipt } from "@realm/contracts";
import { type FormEvent, useState } from "react";
import { Dialog } from "@/components/dialog";
import { FormNotice, labelClass, SubmitButton } from "@/components/form";
import { pill } from "@/components/pill";
import { openReport, type ReportTarget, setState, useRealm } from "@/features/realtime/store";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";

// Pairs read across in two columns on wider screens; the gravest one gets a row to itself.
const REASONS: { id: ReportReason; label: string; wide?: true }[] = [
  { id: "spam", label: "Spam or scams" },
  { id: "harassment", label: "Harassment or bullying" },
  { id: "hate", label: "Hate" },
  { id: "violence", label: "Threats or violence" },
  { id: "sexual_content", label: "Sexual content" },
  { id: "self_harm", label: "Self-harm or suicide" },
  { id: "sexual_minors", label: "Sexual content involving someone under 18", wide: true },
  { id: "impersonation", label: "Impersonating someone" },
  { id: "other", label: "Something else" },
];

/**
 * Report something: pick what's wrong, optionally say more, optionally block them too. The
 * answer says what happened straight away (hidden, or who'll look), so it never feels like
 * shouting into a void.
 */
export function ReportDialog() {
  const target = useRealm((s) => s.ui.report);
  return (
    <Dialog
      open={target !== null}
      onClose={() => openReport(null)}
      title={target ? `Report ${target.label}` : "Report"}
      lead="Reports go to this Space's moderators, or to Realm for the most serious ones. Nobody sees who sent them."
    >
      {target && <ReportForm key={`${target.targetType}:${target.targetId}`} target={target} />}
    </Dialog>
  );
}

function ReportForm({ target }: { target: ReportTarget }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<ReportReceipt | null>(null);
  const blockable = target.targetType !== "community";
  const authorId = target.blockUserId;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason) return setError("Pick what's wrong.");
    setPending(true);
    setError("");
    try {
      const receipt = await api<ReportReceipt>("/reports", {
        body: {
          targetType: target.targetType,
          targetId: target.targetId,
          reason,
          ...(details.trim() ? { details: details.trim() } : {}),
          ...(target.communityId ? { communityId: target.communityId } : {}),
        },
      });
      if (alsoBlock && authorId) {
        await api(`/users/@me/blocks/${authorId}`, { method: "PUT" });
        setState((s) => ({ ...s, blocked: [...new Set([...s.blocked, authorId])] }));
      }
      setDone(receipt);
    } catch (err) {
      setPending(false);
      setError(err instanceof ApiError ? err.message : "Couldn't send the report. Try again.");
    }
  };

  if (done) {
    return (
      <div className="space-y-5">
        <FormNotice tone="success">
          {done.hidden
            ? "Thanks. It's hidden now, and the Space's moderators will decide what happens to it."
            : done.goesTo === "realm"
              ? "Thanks. Realm will look at this."
              : "Thanks. The Space's moderators will look at it."}
          {alsoBlock ? " You've blocked them too." : ""}
        </FormNotice>
        {done.goesTo === "realm" && reason === "sexual_minors" && (
          <p className="text-[0.95rem] text-fg-soft">
            If someone is in danger right now, contact your local police or emergency number.
          </p>
        )}
        <button type="button" onClick={() => openReport(null)} className={pill("ghost", "md")}>
          Done
        </button>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-5">
      <FormNotice>{error}</FormNotice>
      <fieldset>
        <legend className={labelClass}>What's wrong?</legend>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {REASONS.map((r) => (
            <label
              key={r.id}
              className={cx(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-[0.8rem] px-3.5 py-2 transition-[box-shadow,background-color] duration-150",
                r.wide && "sm:col-span-2",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                reason === r.id
                  ? "bg-surface shadow-[inset_0_0_0_1.5px_var(--r-text)]"
                  : "hover:bg-surface",
              )}
            >
              <input
                type="radio"
                name="reason"
                value={r.id}
                checked={reason === r.id}
                onChange={() => setReason(r.id)}
                className="size-4 accent-[var(--r-text)]"
              />
              <span className="text-fg">{r.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="report-details" className={labelClass}>
          Anything else? <span className="font-normal text-fg-soft">(optional)</span>
        </label>
        <textarea
          id="report-details"
          rows={3}
          maxLength={1000}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          className="block w-full resize-y rounded-input bg-base/70 px-4 py-3 text-fg shadow-[inset_0_0_0_1.5px_var(--r-border-strong)] outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--r-focus)]"
        />
      </div>
      {blockable && authorId && (
        <label className="flex cursor-pointer items-center gap-3 text-fg">
          <input
            type="checkbox"
            checked={alsoBlock}
            onChange={(e) => setAlsoBlock(e.target.checked)}
            className="size-4 accent-[var(--r-text)]"
          />
          Block them too (their messages fold away for you)
        </label>
      )}
      {/* The send button stays in reach on a short screen, however far the list scrolls. */}
      <div className="sticky bottom-0 -mx-6 -mb-6 bg-surface-raised px-6 pt-3 pb-6 sm:-mx-7 sm:px-7">
        <SubmitButton pending={pending} pendingLabel="Sending" size="md">
          Send report
        </SubmitButton>
      </div>
    </form>
  );
}
