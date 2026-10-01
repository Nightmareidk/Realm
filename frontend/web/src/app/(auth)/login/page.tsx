import type { Metadata } from "next";
import { ButtonLink } from "@/components/button";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Realm.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: true },
};

// The sign-in form is the next build step (the API behind it already exists).
export default function LoginPage() {
  return (
    <div className="w-full max-w-[26rem]">
      <h1 className="display text-[2.4rem] text-ink">Sign in</h1>
      <p className="mt-3 text-ink-soft">
        Sign-in is being wired up right now and opens in the next build of early access.
      </p>
      <ButtonLink href="/" variant="secondary" className="mt-8">
        Back to the map
      </ButtonLink>
    </div>
  );
}
