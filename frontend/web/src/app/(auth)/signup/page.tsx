import type { Metadata } from "next";
import { ButtonLink } from "@/components/button";

export const metadata: Metadata = { title: "Create your account" };

// The sign-up form is the next build step (the API behind it already exists).
export default function SignupPage() {
  return (
    <div className="w-full max-w-[26rem]">
      <h1 className="display text-[2.4rem] text-ink">Create your account</h1>
      <p className="mt-3 text-ink-soft">
        Sign-up is being wired up right now and opens in the next build of early access.
      </p>
      <ButtonLink href="/" variant="secondary" className="mt-8">
        Back to the map
      </ButtonLink>
    </div>
  );
}
