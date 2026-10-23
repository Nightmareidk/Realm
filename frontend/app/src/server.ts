import type { ApiErrorBody } from "@realm/contracts";
import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Where Realm is. EXPO_PUBLIC_REALM_API_URL / EXPO_PUBLIC_REALM_WEB_URL when set; in development,
 * the PC that serves the app (the phone reaches it over the Wi-Fi, never through its own
 * localhost): the API on port 4000 and the website on 3000.
 */
function devHost(): string | null {
  // The browser preview of the app (Expo web) runs on this PC.
  if (Platform.OS === "web") return globalThis.location?.hostname ?? "localhost";
  return Constants.expoConfig?.hostUri?.split(":")[0] ?? null;
}

export function apiOrigin(): string | null {
  const set = process.env.EXPO_PUBLIC_REALM_API_URL;
  if (set) return set.replace(/\/$/, "");
  // Only a development build may find the API on the Wi-Fi; a release build must be told where.
  if (!__DEV__) return null;
  const host = devHost();
  return host ? `http://${host}:4000` : null;
}

/**
 * Plain http only to this PC on the home network while developing. A release build talks to
 * Realm over https and nothing else, so the session token never crosses a network in the clear.
 */
function secureEnough(origin: string) {
  return origin.startsWith("https://") || __DEV__;
}

/** Where the live connection is: the API's own address in development, or its own host. */
export function gatewayUrl(): string | null {
  const set = process.env.EXPO_PUBLIC_REALM_GATEWAY_URL;
  if (set) return set;
  const origin = apiOrigin();
  return origin ? `${origin.replace(/^http/, "ws")}/gateway` : null;
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

  /** The session is gone (not a wrong password, which is a 401 too). */
  get signedOut() {
    return this.status === 401 && this.code === "UNAUTHORIZED";
  }
}

const OFFLINE =
  "We couldn't reach Realm. Check your phone is on the same Wi-Fi as Realm, and try again.";
const DOWN = "Realm isn't answering right now. Give it a minute and try again.";
const INSECURE = "This build of Realm isn't set up to reach Realm safely. Update the app.";

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

/**
 * Tells the API this is the app (it then hands back a session token instead of a cookie). The
 * browser preview stands in for the Android app.
 */
export const CLIENT_PLATFORM = Platform.OS === "web" ? "android" : Platform.OS;
export const CLIENT_VERSION = "0.1.0";
const CLIENT = `${CLIENT_PLATFORM}/${CLIENT_VERSION}`;

/**
 * The phone's name for the "Where you're signed in" list ("Google Pixel 7"), so you can tell
 * your devices apart and sign out the one you lost.
 */
function deviceName(): string {
  if (Platform.OS === "web") return "Browser preview";
  const c = Platform.constants as { Brand?: string; Model?: string; interfaceIdiom?: string };
  if (Platform.OS === "android") {
    const brand = c.Brand ? c.Brand[0]?.toUpperCase() + c.Brand.slice(1) : "";
    const model = c.Model ?? "";
    return (model.toLowerCase().startsWith(brand.toLowerCase()) ? model : `${brand} ${model}`)
      .trim()
      .slice(0, 48);
  }
  return c.interfaceIdiom === "pad" ? "iPad" : "iPhone";
}
const DEVICE = deviceName();

let sessionToken: string | null = null;
/** Set by the session once signed in; every request after carries it. */
export function setSessionToken(token: string | null) {
  sessionToken = token;
}
export function currentToken() {
  return sessionToken;
}

/**
 * Told when the API turns this session away (signed out from another device, or the password
 * changed): the session then forgets it and the app goes back to the start.
 */
let onSessionEnded: (() => void) | null = null;
export function whenSessionEnds(fn: (() => void) | null) {
  onSessionEnded = fn;
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
  if (!secureEnough(origin)) throw new ApiError(0, "INSECURE", INSECURE);
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
        "X-Realm-Device": DEVICE,
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
  if (!res.ok) {
    const error = toApiError(res, data);
    // Sent with a session and refused as signed out: that session is over, wherever it ended.
    if (error.signedOut && sessionToken && path !== "/auth/logout") onSessionEnded?.();
    throw error;
  }
  return data as T;
}

/** Headers that let the app read the API directly (for images and video it loads itself). */
export function authHeaders(): Record<string, string> {
  return {
    "X-Realm-Client": CLIENT,
    ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
  };
}

/**
 * The API gives file links as web paths (`/api/v1/media/…`, through the website's proxy); the app
 * calls the API itself, where the same path starts at `/v1`.
 */
export function resolveUrl(url: string): string {
  if (/^https?:/.test(url)) return url;
  const origin = apiOrigin() ?? "";
  return `${origin}${url.replace(/^\/api\/v1\//, "/v1/")}`;
}

/** An image or video source for a Realm file: the link plus the session to read it with. */
export function mediaSource(url: string) {
  return { uri: resolveUrl(url), headers: authHeaders() };
}

/**
 * Uploads a picked photo or video: ask for a ticket, send the bytes where it says, then finish.
 * Returns the upload's id, ready to attach to a post.
 */
export async function upload(file: {
  uri: string;
  kind: "image" | "video" | "audio";
  mimeType: string;
  durationMs?: number;
}): Promise<string> {
  const bytes = await (await fetch(file.uri)).blob();
  const ticket = await api<{ mediaId: string; uploadUrl: string; headers: Record<string, string> }>(
    "/media/uploads",
    {
      body: {
        kind: file.kind,
        mimeType: file.mimeType,
        sizeBytes: bytes.size,
        ...(file.durationMs ? { durationMs: Math.round(file.durationMs) } : {}),
      },
    },
  );
  let res: Response;
  try {
    res = await fetch(resolveUrl(ticket.uploadUrl), {
      method: "PUT",
      headers: ticket.headers,
      body: bytes,
    });
  } catch {
    throw new ApiError(0, "OFFLINE", OFFLINE);
  }
  if (!res.ok)
    throw new ApiError(res.status, "UPLOAD_INVALID", "That upload didn't go through. Try again.");
  await api(`/media/${ticket.mediaId}/complete`, { method: "POST" });
  return ticket.mediaId;
}
