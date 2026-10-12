"use client";

import { Limits, Password, type ResetTokenStatus } from "@realm/contracts";
import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { FormNotice, PasswordField, SubmitButton, TextField } from "@/components/form";
import { pill, textLink } from "@/components/pill";
import { ApiError, api } from "@/lib/api";
import { DevMailNote } from "./auth-shell";
import { waitFor } from "./wait";

/** Asks for a reset link. Says the same thing whether or not the email has an account. */
export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [pending, setPending] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setNotice("");
    const value = email.trim();
    if (!value?.includes("@")) {
      setError(
        value ? "Enter an email address like name@example.com." : "Enter your email address.",
      );
      input.current?.focus();
      return;
    }
    setError("");
    setPending(true);
    try {
      await api("/auth/password/forgot", { body: { email: value } });
      setSentTo(value);
    } catch (err) {
      if (err instanceof ApiError && err.fields.email) {
        setError(err.fields.email);
        input.current?.focus();
      } else if (err instanceof ApiError && err.code === "RATE_LIMITED") {
        setNotice(`We've sent a few links already. ${waitFor(err.retryAfter)}, then try again.`);
      } else {
        setNotice(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      }
    } finally {
      setPending(false);
    }
  };

  if (sentTo) {
    return (
      <div className="space-y-5" role="status">
        <FormNotice tone="success">
          <p>
            If an account uses <strong className="break-all">{sentTo}</strong>, we've sent it a link
            to set a new password. It works once, for 60 minutes.
          </p>
        </FormNotice>
        <p className="text-fg-soft">
          Nothing after a few minutes? Check your spam folder, or{" "}
          <button type="button" className={textLink} onClick={() => setSentTo("")}>
            try another email
          </button>
          .
        </p>
        <DevMailNote />
        <Link href="/login" className={pill("ghost", "lg", "w-full")}>
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-5">
      <FormNotice>{notice}</FormNotice>
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (error) setError("");
        }}
        error={error}
        inputRef={input}
      />
      <SubmitButton pending={pending} pendingLabel="Sending the link" className="w-full">
        Send reset link
      </SubmitButton>
    </form>
  );
}

const DEAD: Record<Exclude<ResetTokenStatus["status"], "valid">, string> = {
  expired: "This link has expired. Links work for 60 minutes.",
  used: "This link was already used. Each one works once.",
  invalid: "This link isn't valid. It may be incomplete.",
};

/**
 * Sets a new password from the emailed link. The link's state is checked when the page opens, so
 * a dead link says so before any typing. Saving signs the account out everywhere.
 */
export function ResetForm({ token }: { token: string }) {
  const [status, setStatus] = useState<ResetTokenStatus["status"] | "checking">("checking");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<ReactNode>("");
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<ResetTokenStatus>(`/auth/password/reset/status?token=${encodeURIComponent(token)}`)
      .then((r) => setStatus(r.status))
      .catch(() => setStatus("valid")); // Can't tell: let them try; the save says if it's dead.
  }, [token]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setNotice("");
    if (!Password.safeParse(password).success) {
      setError(`Use at least ${Limits.password.min} characters.`);
      input.current?.focus();
      return;
    }
    setError("");
    setPending(true);
    try {
      await api("/auth/password/reset", { body: { token, password } });
      setDone(true);
    } catch (err) {
      setPending(false);
      if (
        err instanceof ApiError &&
        (err.code === "TOKEN_INVALID" || err.code === "CODE_EXPIRED")
      ) {
        setStatus("used");
        return;
      }
      if (
        err instanceof ApiError &&
        (err.code === "PASSWORD_TOO_COMMON" || err.code === "PASSWORD_BREACHED")
      ) {
        setError(err.message);
        input.current?.focus();
        return;
      }
      if (err instanceof ApiError && err.fields.password) {
        setError(err.fields.password);
        input.current?.focus();
        return;
      }
      if (err instanceof ApiError && err.code === "RATE_LIMITED") {
        setNotice(`Too many tries. ${waitFor(err.retryAfter)} and try again.`);
        return;
      }
      setNotice(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    }
  };

  if (done) {
    return (
      <div className="space-y-5">
        <FormNotice tone="success">
          <p className="font-bold">Password changed.</p>
          <p className="mt-1">We signed you out everywhere. Sign in with your new password.</p>
        </FormNotice>
        <Link href="/login" className={pill("action", "lg", "w-full")}>
          Sign in
        </Link>
      </div>
    );
  }

  if (status === "expired" || status === "used" || status === "invalid") {
    return (
      <div className="space-y-5">
        <FormNotice>{DEAD[status]}</FormNotice>
        <Link href="/forgot" className={pill("action", "lg", "w-full")}>
          Get a new link
        </Link>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-5" aria-busy={status === "checking"}>
      <FormNotice>{notice}</FormNotice>
      <PasswordField
        label="New password"
        hint={`At least ${Limits.password.min} characters. A few unrelated words make a strong one.`}
        name="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          if (error) setError("");
        }}
        error={error}
        inputRef={input}
      />
      <SubmitButton pending={pending} pendingLabel="Saving your password" className="w-full">
        Save new password
      </SubmitButton>
    </form>
  );
}
