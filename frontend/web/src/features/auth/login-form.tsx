"use client";

import type { AuthResult } from "@realm/contracts";
import Link from "next/link";
import { type FormEvent, type ReactNode, useRef, useState } from "react";
import {
  FormNotice,
  focusFirstError,
  PasswordField,
  SubmitButton,
  TextField,
} from "@/components/form";
import { textLink } from "@/components/pill";
import { ApiError, api } from "@/lib/api";
import { waitFor } from "./wait";

type Errors = { login?: string; password?: string; code?: string };

export function LoginForm({ next }: { next: string }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<ReactNode>("");
  const [pending, setPending] = useState(false);
  // Two-step sign-in: asked for once the password is right.
  const [askCode, setAskCode] = useState(false);
  const [welcome, setWelcome] = useState("");
  const [code, setCode] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);
  const loginRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const reset = (
    <Link href="/forgot" className={textLink}>
      reset your password
    </Link>
  );

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setNotice("");
    const found: Errors = {};
    if (!login.trim()) found.login = "Enter your email or username.";
    if (!password) found.password = "Enter your password.";
    if (askCode && !code.trim()) found.code = "Enter the code from your app.";
    setErrors(found);
    if (found.code) {
      codeRef.current?.focus();
      return;
    }
    if (found.login || found.password) {
      focusFirstError(found, [
        ["login", loginRef],
        ["password", passwordRef],
      ]);
      return;
    }

    setPending(true);
    try {
      const result = await api<AuthResult>("/auth/login", {
        body: { login: login.trim(), password, ...(askCode ? { code: code.trim() } : {}) },
      });
      if (result.welcomeBack) {
        setWelcome(
          result.welcomeBack === "deletion_cancelled"
            ? "Welcome back. Your account won't be deleted, and everything is as you left it."
            : "Welcome back. Your profile is visible again.",
        );
        await new Promise((r) => setTimeout(r, 1800));
      }
      // A full load into the app: nothing cached from before signing in carries over.
      window.location.replace(next);
    } catch (err) {
      setPending(false);
      if (!(err instanceof ApiError)) {
        setNotice("Something went wrong. Try again.");
        return;
      }
      if (err.code === "MFA_REQUIRED") {
        setAskCode(true);
        setTimeout(() => codeRef.current?.focus(), 0);
        return;
      }
      if (err.code === "INVALID_CODE") {
        setErrors({ code: "That code isn't right. Try the newest one, or a backup code." });
        codeRef.current?.select();
        return;
      }
      if (err.code === "INVALID_CREDENTIALS") {
        setNotice(<>That email or username and password don't match. Try again, or {reset}.</>);
        passwordRef.current?.select();
        return;
      }
      if (err.code === "RATE_LIMITED") {
        setNotice(
          <>
            Too many tries. {waitFor(err.retryAfter)}, or {reset}.
          </>,
        );
        return;
      }
      if (err.code === "ACCOUNT_SUSPENDED") {
        setNotice(
          <>
            This account is suspended.{" "}
            <Link href="/help" className={textLink}>
              What this means
            </Link>
          </>,
        );
        return;
      }
      setNotice(err.message);
    }
  };

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-5">
      <FormNotice>{notice}</FormNotice>
      <FormNotice tone="success">{welcome}</FormNotice>
      <TextField
        label="Email or username"
        name="login"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        value={login}
        onChange={(e) => {
          setLogin(e.target.value);
          if (errors.login) setErrors((x) => ({ ...x, login: undefined }));
        }}
        error={errors.login}
        inputRef={loginRef}
      />
      <div>
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (errors.password) setErrors((x) => ({ ...x, password: undefined }));
          }}
          error={errors.password}
          inputRef={passwordRef}
        />
        <p className="mt-3 text-[0.95rem]">
          <Link href="/forgot" className={textLink}>
            Forgot your password?
          </Link>
        </p>
      </div>
      {askCode && (
        <TextField
          label="Code from your authenticator app"
          hint="Lost your phone? Use one of your backup codes."
          name="code"
          autoComplete="one-time-code"
          autoCapitalize="none"
          spellCheck={false}
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (errors.code) setErrors((x) => ({ ...x, code: undefined }));
          }}
          error={errors.code}
          inputRef={codeRef}
        />
      )}
      <SubmitButton pending={pending} pendingLabel="Signing in" className="w-full">
        Sign in
      </SubmitButton>
    </form>
  );
}
