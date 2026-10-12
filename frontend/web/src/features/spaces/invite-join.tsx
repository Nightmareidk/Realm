"use client";

import type { SpaceDetail } from "@realm/contracts";
import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { FormNotice } from "@/components/form";
import { pill } from "@/components/pill";
import { SignupFlow } from "@/features/auth/signup-flow";
import { ApiError, api } from "@/lib/api";

async function join(code: string) {
  const space = await api<SpaceDetail>(`/invites/${code}`, { method: "POST" });
  return `/spaces/${space.slug}`;
}

/** Signed in: one press to join, and a way out. */
export function JoinButton({ code, spaceName }: { code: string; spaceName: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <FormNotice className="mb-5">{error}</FormNotice>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-disabled={pending || undefined}
          onClick={async () => {
            if (pending) return;
            setPending(true);
            setError("");
            try {
              // A full load: the app starts fresh, already in the Space.
              window.location.assign(await join(code));
            } catch (err) {
              setPending(false);
              setError(err instanceof ApiError ? err.message : "Couldn't join. Try again.");
            }
          }}
          className={pill("action", "lg", "px-9")}
        >
          {pending ? "Joining" : `Join ${spaceName}`}
        </button>
        <Link href="/home" className={pill("quiet", "lg")}>
          Not now
        </Link>
      </div>
    </div>
  );
}

/** Signed out: the two-step sign-up beside the Space's card, joining it at the end. */
export function InviteSignup({
  code,
  heading,
  card,
}: {
  code: string;
  heading: string;
  card: ReactNode;
}) {
  return <SignupFlow next={`/i/${code}`} invite={{ heading, card, join: () => join(code) }} />;
}
