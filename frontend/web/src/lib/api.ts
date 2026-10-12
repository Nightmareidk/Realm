import type { ApiErrorBody } from "@realm/contracts";

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

  /** The session is gone (signed out elsewhere, expired): send them to sign in again. */
  get signedOut() {
    return this.status === 401 && (this.code === "UNAUTHORIZED" || this.code === "SESSION_EXPIRED");
  }
}

const OFFLINE = "We couldn't reach Realm. Check your connection and try again.";
const DOWN = "Realm isn't answering right now. Give it a minute and try again.";

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
    const wait = retryAfter ? waitFor(retryAfter) : "a little while";
    return new ApiError(
      res.status,
      body.code,
      `Too many tries. Wait ${wait} and try again.`,
      {},
      retryAfter,
    );
  }
  if (body.code === "INTERNAL") return new ApiError(res.status, body.code, DOWN);
  return new ApiError(res.status, body.code, body.message, fields, retryAfter);
}

function waitFor(seconds: number) {
  if (seconds < 60) return `${Math.ceil(seconds)} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "a minute" : `${minutes} minutes`;
}

/**
 * Calls Realm's API from the browser, same-origin through `/api` (next.config rewrites), so the
 * session cookie stays first-party and HttpOnly. Resolves with the JSON body (nothing for 204)
 * and throws an {@link ApiError} for anything else, including being offline.
 */
export async function api<T = void>(
  path: string,
  init: {
    method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const hasBody = init.body !== undefined;
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: init.method ?? (hasBody ? "POST" : "GET"),
      credentials: "same-origin",
      cache: "no-store",
      headers: hasBody
        ? { Accept: "application/json", "Content-Type": "application/json" }
        : { Accept: "application/json" },
      body: hasBody ? JSON.stringify(init.body) : undefined,
      signal: init.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK", OFFLINE);
  }
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res, data);
  return data as T;
}

/** Where to go after signing in: only a path on this site, never another origin. */
export function safeNext(next: string | string[] | undefined | null, fallback = "/home") {
  const value = Array.isArray(next) ? next[0] : next;
  if (!value?.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
