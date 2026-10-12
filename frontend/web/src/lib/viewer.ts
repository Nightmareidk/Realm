import type { SelfUser } from "@realm/contracts";
import { cookies } from "next/headers";
import { cache } from "react";

const API_URL = process.env.REALM_API_URL ?? "http://localhost:4000";
export const SESSION_COOKIE = "realm_session";

/**
 * Who's signed in, for the page being rendered on the server (route guards, the app frame).
 * Null when nobody is, or the session has ended. Throws when the API can't be reached, so the
 * page shows its error state instead of wrongly sending someone to sign in. One call per request.
 *
 * It "peeks": checking never extends the session, since the server can't hand a renewed cookie
 * on to the browser. The browser's own requests do that.
 */
export const getViewer = cache(async (): Promise<SelfUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const res = await fetch(`${API_URL}/v1/users/@me`, {
    headers: {
      accept: "application/json",
      cookie: `${SESSION_COOKIE}=${token}`,
      "x-realm-peek": "1",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Realm's API answered ${res.status} when checking the session`);
  return (await res.json()) as SelfUser;
});

/** For pages that work either way (the sign-in screens): an unreachable API counts as nobody. */
export async function peekViewer(): Promise<SelfUser | null> {
  try {
    return await getViewer();
  } catch {
    return null;
  }
}
