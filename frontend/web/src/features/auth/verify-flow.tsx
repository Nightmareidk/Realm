"use client";

import type { SelfUser } from "@realm/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { FormNotice, SubmitButton } from "@/components/form";
import { pill, textLink } from "@/components/pill";
import { ApiError, api } from "@/lib/api";
import { DevMailNote } from "./auth-shell";
import { CodeForm } from "./code-form";

/**
 * Opened from the email's link. Nothing happens until you press the button, so a mail scanner
 * that opens links ahead of you can't use it up; and the token leaves the address bar at once.
 * A link opened after you've already verified simply says you're verified.
 */
export function VerifyLink({ token, signedIn }: { token: string; signedIn: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"ready" | "checking" | "done" | { error: ReactNode }>("ready");

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("token")) {
      url.searchParams.delete("token");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, []);

  const verify = async () => {
    setState("checking");
    try {
      await api<SelfUser>("/auth/email/verify", { body: { token } });
      setState("done");
      router.refresh();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      const newOne = signedIn ? (
        <>Enter the code from the newest email below, or send a new one.</>
      ) : (
        <>
          <Link href="/login?next=/verify" className={textLink}>
            Sign in
          </Link>{" "}
          to get a new one.
        </>
      );
      setState({
        error:
          code === "CODE_EXPIRED" ? (
            <>This link expired. Links work for 15 minutes. {newOne}</>
          ) : code === "TOKEN_SUPERSEDED" ? (
            <>There's a newer email. Use the link or code in the latest one.</>
          ) : code === "TOKEN_OLD_EMAIL" ? (
            <>This link is for an email address you've since changed.</>
          ) : code === "TOKEN_INVALID" ? (
            <>This link isn't valid. {newOne}</>
          ) : (
            <>Something went wrong. Try the link again.</>
          ),
      });
    }
  };

  if (state === "done") {
    return (
      <div className="space-y-5">
        <FormNotice tone="success">
          <p className="font-bold">Your email is verified.</p>
        </FormNotice>
        <Link href={signedIn ? "/home" : "/login"} className={pill("action", "lg", "w-full")}>
          {signedIn ? "Open Realm" : "Sign in"}
        </Link>
      </div>
    );
  }
  if (typeof state === "object") {
    return (
      <div className="space-y-5">
        <FormNotice>{state.error}</FormNotice>
        {signedIn && <VerifyWithCode />}
      </div>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void verify();
      }}
    >
      <SubmitButton pending={state === "checking"} pendingLabel="Verifying" className="w-full">
        Verify my email
      </SubmitButton>
    </form>
  );
}

/** For someone signed in: the code from the email. */
export function VerifyWithCode() {
  const router = useRouter();
  const [done, setDone] = useState(false);
  if (done) {
    return (
      <div className="space-y-5">
        <FormNotice tone="success">
          <p className="font-bold">Your email is verified.</p>
        </FormNotice>
        <Link href="/home" className={pill("action", "lg", "w-full")}>
          Open Realm
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <CodeForm
        onVerified={() => {
          setDone(true);
          router.refresh();
        }}
      />
      <DevMailNote />
    </div>
  );
}
