import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppBackdrop } from "@/features/auth/app-backdrop";
import { AuthCard, AuthHeader, AuthSwitch } from "@/features/auth/auth-shell";
import { LoginForm } from "@/features/auth/login-form";
import { safeNext } from "@/lib/api";
import { peekViewer } from "@/lib/viewer";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Realm.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: true },
};

/** Sign in, over a still view of the app you're about to open. */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeNext((await searchParams).next);
  if (await peekViewer()) redirect(next);
  const signup = next === "/home" ? "/signup" : `/signup?next=${encodeURIComponent(next)}`;
  return (
    <>
      <AppBackdrop />
      <div className="lg:hidden">
        <AuthHeader
          aside={<AuthSwitch lead="New here?" href={signup} label="Create an account" />}
        />
      </div>
      <main id="main" className="flex flex-1 items-center justify-center px-4 pt-2 pb-10 lg:py-16">
        <AuthCard
          title="Welcome back."
          brand="max-lg:hidden"
          footer={<AuthSwitch lead="New here?" href={signup} label="Create an account" />}
        >
          <LoginForm next={next} />
        </AuthCard>
      </main>
    </>
  );
}
