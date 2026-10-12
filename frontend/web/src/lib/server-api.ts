import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./viewer";

const API_URL = process.env.REALM_API_URL ?? "http://localhost:4000";

/**
 * A GET to Realm's API from a server-rendered page, as the signed-in person. It "peeks", like
 * getViewer: rendering never extends the session. Throws on anything but a 2xx.
 */
export async function serverApi<T>(path: string): Promise<T> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const res = await fetch(`${API_URL}/v1${path}`, {
    headers: {
      accept: "application/json",
      "x-realm-peek": "1",
      ...(token ? { cookie: `${SESSION_COOKIE}=${token}` } : {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Realm's API answered ${res.status} for ${path}`);
  return (await res.json()) as T;
}
