import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/features/app/app-shell";
import { safeNext } from "@/lib/api";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Everything signed in. The proxy has already turned away visits with no session cookie; this
 * asks the API whether the session is still good. If the API can't be reached it throws, and the
 * error screen offers a retry rather than signing anyone out.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const viewer = await getViewer();
  if (!viewer) {
    const here = safeNext((await headers()).get("x-realm-path"));
    redirect(`/login?next=${encodeURIComponent(here)}`);
  }
  return <AppShell viewer={viewer}>{children}</AppShell>;
}
