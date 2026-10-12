import type { Metadata } from "next";
import Link from "next/link";
import { pill, textLink } from "@/components/pill";
import { AuthCard, AuthHeader } from "@/features/auth/auth-shell";
import { VerifyLink, VerifyWithCode } from "@/features/auth/verify-flow";
import { peekViewer } from "@/lib/viewer";

export const metadata: Metadata = {
  title: "Verify your email",
  robots: { index: false, follow: false },
};

/** The verification email's link lands here (`?token=`); signed in, the code works here too. */
export default async function VerifyPage({ searchParams }: PageProps<"/verify">) {
  const { token } = await searchParams;
  const viewer = await peekViewer();

  let card: React.ReactNode;
  if (typeof token === "string" && token) {
    card = (
      <AuthCard title="Verify your email." lead="One press and you're done.">
        <VerifyLink token={token} signedIn={Boolean(viewer)} />
      </AuthCard>
    );
  } else if (!viewer) {
    card = (
      <AuthCard
        title="Verify your email."
        lead="Open the link in the email we sent you, or sign in and enter the 6-digit code from it."
      >
        <Link href="/login?next=/verify" className={pill("action", "lg", "w-full")}>
          Sign in
        </Link>
      </AuthCard>
    );
  } else if (viewer.emailVerified) {
    card = (
      <AuthCard title="You're verified." lead={`${viewer.email} is confirmed. Nothing else to do.`}>
        <Link href="/home" className={pill("action", "lg", "w-full")}>
          Open Realm
        </Link>
      </AuthCard>
    );
  } else {
    card = (
      <AuthCard
        title="Check your email."
        lead={
          <>
            We sent a 6-digit code to <strong className="break-all text-fg">{viewer.email}</strong>.
            It works for 15 minutes.
          </>
        }
        footer={
          <Link href="/home" className={textLink}>
            Do this later
          </Link>
        }
      >
        <VerifyWithCode />
      </AuthCard>
    );
  }

  return (
    <>
      <AuthHeader />
      <main id="main" className="flex flex-1 items-center justify-center px-4 pt-2 pb-10">
        {card}
      </main>
    </>
  );
}
