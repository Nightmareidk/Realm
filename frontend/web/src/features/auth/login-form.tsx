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

type Errors = { login?: string; password?: string };

export function LoginForm({ next }: { next: string }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<ReactNode>("");
  const [pending, setPending] = useState(false);
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
    setErrors(found);
    if (found.login || found.password) {
      focusFirstError(found, [
        ["login", loginRef],
        ["password", passwordRef],
      ]);
      return;
    }

    setPending(true);
    try {
      await api<AuthResult>("/auth/login", { body: { login: login.trim(), password } });
      // A full load into the app: nothing cached from before signing in carries over.
      window.location.replace(next);
    } catch (err) {
      setPending(false);
      if (!(err instanceof ApiError)) {
        setNotice("Something went wrong. Try again.");
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
      <SubmitButton pending={pending} pendingLabel="Signing in" className="w-full">
        Sign in
      </SubmitButton>
    </form>
  );
}
