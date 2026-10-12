import type { ApiErrorBody } from "@realm/contracts";
import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Where Realm is. EXPO_PUBLIC_REALM_API_URL / EXPO_PUBLIC_REALM_WEB_URL when set; in development,
 * the PC that serves the app (the phone reaches it over the Wi-Fi, never through its own
 * localhost): the API on port 4000 and the website on 3000.
 */
function devHost(): string | null {
  return Constants.expoConfig?.hostUri?.split(":")[0] ?? null;
}

export function apiOrigin(): string | null {
  const set = process.env.EXPO_PUBLIC_REALM_API_URL;
  if (set) return set.replace(/\/$/, "");
  const host = devHost();
  return host ? `http://${host}:4000` : null;
}

export function webOrigin(): string | null {
  const set = process.env.EXPO_PUBLIC_REALM_WEB_URL;
  if (set) return set.replace(/\/$/, "");
  const host = devHost();
  return host ? `http://${host}:3000` : null;
}

/** Messages per form field, keyed by the field's name in the request body. */
export type FieldErrors = Record<string, string>;

/** A failed API call, in a shape forms can show: what went wrong, and where. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: FieldErrors = {},
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get signedOut() {
    return this.status === 401;
  }
}

const OFFLINE =
  "We couldn't reach Realm. Check your phone is on the same Wi-Fi as Realm, and try again.";
const DOWN = "Realm isn't answering right now. Give it a minute and try again.";

export function waitFor(seconds: number | undefined) {
  if (!seconds) return "Wait a little while";
  if (seconds < 60) return `Wait ${Math.ceil(seconds)} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "Wait a minute" : `Wait ${minutes} minutes`;
}

function toApiError(res: Response, data: unknown): ApiError {
  const body = (data as ApiErrorBody | null)?.error;
  if (!body?.code) return new ApiError(res.status, "INTERNAL", res.status >= 500 ? DOWN : OFFLINE);
  const fields: FieldErrors = {};
  const issues = (body.details as { issues?: { path?: unknown[]; message?: string }[] } | undefined)
    ?.issues;
  for (const issue of issues ?? []) {
    const key = issue.path?.[0];
    if (typeof key === "string" && issue.message && !fields[key]) fields[key] = issue.message;
  }
  const header = Number(res.headers.get("Retry-After"));
  const retryAfter =
    body.retryAfter ?? (Number.isFinite(header) && header > 0 ? header : undefined);
  if (body.code === "RATE_LIMITED") {
    return new ApiError(
      res.status,
      body.code,
      `Too many tries. ${waitFor(retryAfter)} and try again.`,
      {},
      retryAfter,
    );
  }
  if (body.code === "INTERNAL") return new ApiError(res.status, body.code, DOWN);
  return new ApiError(res.status, body.code, body.message, fields, retryAfter);
}

/** Tells the API this is the app (it then hands back a session token instead of a cookie). */
const CLIENT = `${Platform.OS}/0.1.0`;

let sessionToken: string | null = null;
/** Set by the session once signed in; every request after carries it. */
export function setSessionToken(token: string | null) {
  sessionToken = token;
}

/**
 * Calls Realm's API. Resolves with the JSON body (nothing for 204) and throws an
 * {@link ApiError} for anything else, including being offline.
 */
export async function api<T = void>(
  path: string,
  init: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  const origin = apiOrigin();
  if (!origin) throw new ApiError(0, "OFFLINE", OFFLINE);
  const hasBody = init.body !== undefined;
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 15000);
  let res: Response;
  try {
    res = await fetch(`${origin}/v1${path}`, {
      method: init.method ?? (hasBody ? "POST" : "GET"),
      headers: {
        Accept: "application/json",
        "X-Realm-Client": CLIENT,
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: hasBody ? JSON.stringify(init.body) : undefined,
      signal: stop.signal,
    });
  } catch {
    throw new ApiError(0, "OFFLINE", OFFLINE);
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, data);
  return data as T;
}
