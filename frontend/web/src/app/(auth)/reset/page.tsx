import type { Metadata } from "next";
import Link from "next/link";
import { pill } from "@/components/pill";
import { AuthCard, AuthHeader } from "@/features/auth/auth-shell";
import { ResetForm } from "@/features/auth/password-forms";

export const metadata: Metadata = {
  title: "Set a new password",
  robots: { index: false, follow: false },
};

/** The password reset email's link lands here (`?token=`). */
export default async function ResetPage({ searchParams }: PageProps<"/reset">) {
  const { token } = await searchParams;
  const complete = typeof token === "string" && token.length >= 20;
  return (
    <>
      <AuthHeader />
      <main id="main" className="flex flex-1 items-center justify-center px-4 pt-2 pb-10">
        {complete ? (
          <AuthCard
            title="Set a new password."
            lead="Saving it signs you out on every device, including this one."
          >
            <ResetForm token={token} />
          </AuthCard>
        ) : (
          <AuthCard
            title="This link isn't complete."
            lead="Open the link from your reset email again, or ask for a new one."
          >
            <Link href="/forgot" className={pill("action", "lg", "w-full")}>
              Get a new link
            </Link>
          </AuthCard>
        )}
      </main>
    </>
  );
}
