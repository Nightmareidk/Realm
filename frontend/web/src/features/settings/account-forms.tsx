"use client";

import { SignOut } from "@phosphor-icons/react";
import { Limits, Password } from "@realm/contracts";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import { FormNotice, focusFirstError, PasswordField, SubmitButton } from "@/components/form";
import { pill } from "@/components/pill";
import { useSignOut } from "@/features/app/menus";
import { ApiError, api } from "@/lib/api";

type Errors = { currentPassword?: string; newPassword?: string };

/** Change password. Other devices are signed out; this one stays signed in. */
export function ChangePasswordForm() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState("");
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const currentRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLInputElement>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setNotice("");
    setDone(false);
    const found: Errors = {};
    if (!current) found.currentPassword = "Enter your current password.";
    if (!Password.safeParse(next).success) {
      found.newPassword = `Use at least ${Limits.password.min} characters.`;
    } else if (next === current) {
      found.newPassword = "Choose a password you're not using now.";
    }
    setErrors(found);
    if (found.currentPassword || found.newPassword) {
      focusFirstError(found, [
        ["currentPassword", currentRef],
        ["newPassword", nextRef],
      ]);
      return;
    }
    setPending(true);
    try {
      await api("/auth/password/change", {
        body: { currentPassword: current, newPassword: next },
      });
      setCurrent("");
      setNext("");
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.signedOut) {
        router.replace("/login?next=/settings/account");
        return;
      }
      if (err instanceof ApiError && err.code === "INVALID_CREDENTIALS") {
        setErrors({ currentPassword: "That isn't your current password. Check it and try again." });
        currentRef.current?.select();
      } else if (err instanceof ApiError && Object.keys(err.fields).length > 0) {
        setErrors(err.fields);
      } else {
        setNotice(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <form noValidate onSubmit={onSubmit} className="max-w-[28rem] space-y-5">
      <FormNotice>{notice}</FormNotice>
      <FormNotice tone="success">
        {done && "Password changed. Any other devices signed in to your account were signed out."}
      </FormNotice>
      <PasswordField
        label="Current password"
        name="currentPassword"
        autoComplete="current-password"
        value={current}
        onChange={(e) => {
          setCurrent(e.target.value);
          if (errors.currentPassword) setErrors((x) => ({ ...x, currentPassword: undefined }));
        }}
        error={errors.currentPassword}
        inputRef={currentRef}
      />
      <PasswordField
        label="New password"
        hint={`At least ${Limits.password.min} characters. A few unrelated words make a strong one.`}
        name="newPassword"
        autoComplete="new-password"
        value={next}
        onChange={(e) => {
          setNext(e.target.value);
          if (errors.newPassword) setErrors((x) => ({ ...x, newPassword: undefined }));
        }}
        error={errors.newPassword}
        inputRef={nextRef}
      />
      <SubmitButton pending={pending} pendingLabel="Changing your password" variant="secondary">
        Change password
      </SubmitButton>
    </form>
  );
}

export function SignOutButton({ className }: { className?: string }) {
  const { signOut, pending, error } = useSignOut();
  return (
    <div className={className}>
      <button
        type="button"
        onClick={signOut}
        aria-disabled={pending || undefined}
        className={pill("ghost", "md")}
      >
        <SignOut aria-hidden="true" size={20} />
        {pending ? "Signing out" : "Sign out"}
      </button>
      <FormNotice className="mt-3">{error}</FormNotice>
    </div>
  );
}
