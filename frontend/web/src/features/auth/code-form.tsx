"use client";

import type { SelfUser } from "@realm/contracts";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { FieldError, FormNotice, hintClass, labelClass, SubmitButton } from "@/components/form";
import { pill, textLink } from "@/components/pill";
import { ApiError, api } from "@/lib/api";
import { cx } from "@/lib/cx";
import { waitFor } from "./wait";

const RESEND_COOLDOWN_S = 60;

/** Seconds left before another code can be sent, counting down once a second. */
function useCooldown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return [left, setLeft] as const;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * The six-digit email code, typed or pasted (phones offer it from the email: one-time-code).
 * Pasting keeps only the digits, whatever spaces the mail app adds. It checks itself as soon as
 * all six are in, and says so up front (WCAG 3.2.2). "Send a new code" waits a minute between
 * sends, with the countdown shown, not announced every second.
 */
export function CodeForm({
  onVerified,
  compact = false,
}: {
  onVerified: (user: SelfUser) => void;
  /** The one-line version for the banner in the app. */
  compact?: boolean;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [resent, setResent] = useState("");
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useCooldown();
  const input = useRef<HTMLInputElement>(null);

  const submit = async (value: string) => {
    if (pending) return;
    if (!/^\d{6}$/.test(value)) {
      setError("Enter all 6 digits from the email.");
      input.current?.focus();
      return;
    }
    setError("");
    setPending(true);
    try {
      const user = await api<SelfUser>("/auth/email/verify", { body: { code: value } });
      onVerified(user);
    } catch (err) {
      setPending(false);
      if (err instanceof ApiError && err.code === "CODE_EXPIRED") {
        setError("That code expired. Send a new one below.");
      } else if (err instanceof ApiError && err.code === "INVALID_CODE") {
        setError(
          err.message.includes("anymore")
            ? "That code can't be used any more. Send a new one."
            : "That code doesn't match. Check the email and try again.",
        );
      } else if (err instanceof ApiError && err.code === "RATE_LIMITED") {
        setError(`Too many tries. ${waitFor(err.retryAfter)} and try again.`);
      } else {
        setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      }
      input.current?.select();
    }
  };

  const resend = async () => {
    if (resending || cooldown > 0) return;
    setResending(true);
    setResent("");
    setError("");
    try {
      await api("/auth/email/resend", { method: "POST" });
      setResent("A new code is on its way. It works for 15 minutes.");
      setCooldown(RESEND_COOLDOWN_S);
      setCode("");
      input.current?.focus();
    } catch (err) {
      if (err instanceof ApiError && err.code === "RATE_LIMITED") {
        setError(`We've sent a few codes already. ${waitFor(err.retryAfter)}, then try again.`);
        setCooldown(err.retryAfter ?? RESEND_COOLDOWN_S);
      } else {
        setError(err instanceof ApiError ? err.message : "Couldn't send a new code. Try again.");
      }
    } finally {
      setResending(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit(code);
  };

  const resendLabel = resending
    ? "Sending a new code"
    : cooldown > 0
      ? `Send a new code (in ${clock(cooldown)})`
      : "Send a new code";

  return (
    <form noValidate onSubmit={onSubmit} className={cx(!compact && "space-y-4")}>
      <div className={cx(compact ? "flex flex-wrap items-center gap-2" : "")}>
        <label htmlFor="email-code" className={cx(compact ? "sr-only" : labelClass)}>
          6-digit code
        </label>
        {!compact && (
          <p id="email-code-hint" className={hintClass}>
            It checks itself when all 6 digits are in.
          </p>
        )}
        <input
          ref={input}
          id="email-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={12}
          placeholder={compact ? "6-digit code" : undefined}
          value={code}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            cx(!compact && "email-code-hint", error && "email-code-error") || undefined
          }
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(digits);
            if (error) setError("");
            if (digits.length === 6) void submit(digits);
          }}
          className={cx(
            "block rounded-input border-[1.5px] border-line-strong bg-base/70 text-fg tabular placeholder:tracking-normal placeholder:text-fg-muted",
            "transition-[border-color,box-shadow] duration-150 ease-out hover:border-fg-muted",
            "focus-visible:border-accent focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--r-accent)_22%,transparent)] focus-visible:outline-none",
            "aria-[invalid=true]:border-danger-line",
            compact
              ? "h-11 w-[9.5rem] px-4 text-base tracking-[0.2em]"
              : "h-16 w-full px-6 text-center text-[1.6rem] font-bold tracking-[0.45em]",
          )}
        />
        {compact && (
          <>
            <SubmitButton pending={pending} pendingLabel="Checking" size="md">
              Verify
            </SubmitButton>
            <button
              type="button"
              onClick={resend}
              aria-disabled={resending || cooldown > 0 || undefined}
              className={pill("quiet", "md", "aria-disabled:cursor-not-allowed")}
            >
              {resendLabel}
            </button>
          </>
        )}
      </div>
      <FieldError id="email-code-error">{error}</FieldError>
      {compact ? (
        resent && (
          <p role="status" className="mt-2 text-[0.95rem] text-fg-soft">
            {resent}
          </p>
        )
      ) : (
        <>
          <FormNotice tone="success">{resent}</FormNotice>
          <SubmitButton pending={pending} pendingLabel="Checking the code" className="w-full">
            Verify email
          </SubmitButton>
          <p className="text-center text-[0.95rem] text-fg-soft">
            No email? Check spam, or{" "}
            <button
              type="button"
              onClick={resend}
              aria-disabled={resending || cooldown > 0 || undefined}
              className={cx(
                textLink,
                "aria-disabled:cursor-not-allowed aria-disabled:no-underline aria-disabled:font-normal",
              )}
            >
              {resendLabel.charAt(0).toLowerCase() + resendLabel.slice(1)}
            </button>
            .
          </p>
        </>
      )}
    </form>
  );
}
