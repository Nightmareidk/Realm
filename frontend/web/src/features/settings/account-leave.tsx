"use client";

import { DownloadSimple } from "@phosphor-icons/react";
import { DELETION_GRACE_DAYS, type DeletionScheduled } from "@realm/contracts";
import { type FormEvent, useState } from "react";
import { FormNotice, PasswordField, SubmitButton, TextField } from "@/components/form";
import { pill } from "@/components/pill";
import { ApiError, api } from "@/lib/api";

/** Download your information: one JSON file with everything Realm keeps about you. */
export function DownloadData() {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const get = async () => {
    if (pending) return;
    setPending(true);
    setNotice("");
    try {
      const res = await fetch("/api/v1/users/@me/data", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setNotice(
          (data as { error?: { message?: string } } | null)?.error?.message ??
            "That didn't work. Try again later.",
        );
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `realm-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setNotice("You seem to be offline. Try again.");
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="space-y-3">
      <FormNotice>{notice}</FormNotice>
      <button
        type="button"
        onClick={() => void get()}
        aria-disabled={pending || undefined}
        className={pill("ghost", "md")}
      >
        <DownloadSimple aria-hidden="true" size={20} />
        {pending ? "Getting it ready" : "Download your information"}
      </button>
    </div>
  );
}

/**
 * Take a break (hidden until you sign in again) or delete the account (hidden now, gone after
 * 30 days unless you sign in). Both ask for the password, and the code with two-step on.
 */
export function LeaveRealm({ twoStep }: { twoStep: boolean }) {
  const [mode, setMode] = useState<"break" | "delete" | null>(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sure, setSure] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending || !mode) return;
    if (mode === "delete" && sure.trim().toLowerCase() !== "delete") {
      setNotice('Type "delete" to confirm.');
      return;
    }
    setPending(true);
    setNotice("");
    try {
      const body = { password, code: code.trim() || undefined };
      if (mode === "break") {
        await api("/users/@me/deactivate", { body });
        window.location.replace("/?left=break");
      } else {
        await api<DeletionScheduled>("/users/@me/delete", { body });
        window.location.replace("/?left=deleted");
      }
    } catch (err) {
      setPending(false);
      if (err instanceof ApiError && err.code === "MFA_REQUIRED") {
        setNotice("Enter the code from your authenticator app too.");
        return;
      }
      setNotice(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    }
  };

  if (!mode) {
    return (
      <div className="space-y-4">
        <div>
          <p className="font-bold text-fg">Take a break</p>
          <p className="mt-1 max-w-[34rem] text-fg-soft">
            Your profile, posts and Stories are hidden until you sign in again. Nothing is deleted.
          </p>
          <button
            type="button"
            className={pill("ghost", "md", "mt-3")}
            onClick={() => setMode("break")}
          >
            Take a break
          </button>
        </div>
        <div>
          <p className="font-bold text-fg">Delete your account</p>
          <p className="mt-1 max-w-[34rem] text-fg-soft">
            Your account is hidden straight away and deleted for good after {DELETION_GRACE_DAYS}{" "}
            days. Sign in before then and everything comes back. Download your information first if
            you want a copy.
          </p>
          <button
            type="button"
            className={pill("quiet", "md", "mt-3 text-danger hover:text-danger")}
            onClick={() => setMode("delete")}
          >
            Delete account
          </button>
        </div>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={submit} className="max-w-[28rem] space-y-4">
      <p className="font-bold text-fg">
        {mode === "break" ? "Take a break" : `Delete your account in ${DELETION_GRACE_DAYS} days`}
      </p>
      <FormNotice>{notice}</FormNotice>
      <PasswordField
        label="Password"
        name="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {twoStep && (
        <TextField
          label="Code from your authenticator app"
          name="code"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      )}
      {mode === "delete" && (
        <TextField
          label='Type "delete" to confirm'
          name="confirm"
          autoComplete="off"
          spellCheck={false}
          value={sure}
          onChange={(e) => setSure(e.target.value)}
        />
      )}
      <div className="flex gap-2">
        <SubmitButton
          pending={pending}
          pendingLabel="One moment"
          size="md"
          variant="secondary"
          className={mode === "delete" ? "text-danger" : undefined}
        >
          {mode === "break" ? "Hide my account" : "Delete my account"}
        </SubmitButton>
        <button
          type="button"
          className={pill("quiet", "md")}
          onClick={() => {
            setMode(null);
            setNotice("");
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
