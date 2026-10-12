import type { Metadata } from "next";
import { AuthCard, AuthHeader, AuthSwitch } from "@/features/auth/auth-shell";
import { ForgotForm } from "@/features/auth/password-forms";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Get a link to reset your Realm password.",
  alternates: { canonical: "/forgot" },
  robots: { index: false, follow: true },
};

export default function ForgotPage() {
  return (
    <>
      <AuthHeader />
      <main id="main" className="flex flex-1 items-center justify-center px-4 pt-2 pb-10">
        <AuthCard
          title="Reset your password."
          lead="Enter the email on your account and we'll send you a link to set a new one."
          footer={<AuthSwitch lead="Remembered it?" href="/login" label="Sign in" />}
        >
          <ForgotForm />
        </AuthCard>
      </main>
    </>
  );
}
