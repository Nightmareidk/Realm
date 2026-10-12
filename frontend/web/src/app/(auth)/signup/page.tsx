import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthHeader, AuthSwitch } from "@/features/auth/auth-shell";
import { SignupFlow } from "@/features/auth/signup-flow";
import { safeNext } from "@/lib/api";
import { peekViewer } from "@/lib/viewer";

export const metadata: Metadata = {
  title: "Create your account",
  description:
    "Create a Realm account and bring your friend group over: Spaces, chat, clips, profiles and boards in one app.",
  alternates: { canonical: "/signup" },
};

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const next = safeNext((await searchParams).next);
  if (await peekViewer()) redirect(next);
  const login = next === "/home" ? "/login" : `/login?next=${encodeURIComponent(next)}`;
  return (
    <>
      <AuthHeader aside={<AuthSwitch lead="Have an account?" href={login} label="Sign in" />} />
      <main id="main" className="flex flex-1 items-center">
        <SignupFlow next={next} />
      </main>
    </>
  );
}
