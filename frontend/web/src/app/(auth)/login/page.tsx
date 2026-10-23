import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard, AuthHeader, AuthSwitch } from "@/features/auth/auth-shell";
import { LoginForm } from "@/features/auth/login-form";
import { SignInStage } from "@/features/auth/sign-in-stage";
import { safeNext } from "@/lib/api";
import { peekViewer } from "@/lib/viewer";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Realm.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: true },
};

/** Sign in: Realm in three lines beside the card, on Look B's light. */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeNext((await searchParams).next);
  if (await peekViewer()) redirect(next);
  const signup = next === "/home" ? "/signup" : `/signup?next=${encodeURIComponent(next)}`;
  return (
    <SignInStage
      header={
        <div className="lg:hidden">
          <AuthHeader
            aside={<AuthSwitch lead="New here?" href={signup} label="Create an account" />}
          />
        </div>
      }
      card={
        <AuthCard
          title="Welcome back."
          brand="lg:hidden"
          className="shrink-0"
          footer={<AuthSwitch lead="New here?" href={signup} label="Create an account" />}
        >
          <LoginForm next={next} />
        </AuthCard>
      }
    />
  );
}
