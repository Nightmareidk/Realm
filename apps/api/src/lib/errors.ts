import type { ErrorCode } from "@realm/contracts";

/** An expected, client-facing failure. Anything else becomes a 500 with no details leaked. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthorized = (message = "Sign in to continue") =>
  new AppError(401, "UNAUTHORIZED", message);

export const forbidden = (message = "You can't do that") => new AppError(403, "FORBIDDEN", message);

export const notFound = (what = "Resource") => new AppError(404, "NOT_FOUND", `${what} not found`);

export const conflict = (code: ErrorCode, message: string) => new AppError(409, code, message);

export const badRequest = (code: ErrorCode, message: string, details?: Record<string, unknown>) =>
  new AppError(400, code, message, details);

export const rateLimited = (retryAfter: number) =>
  new AppError(429, "RATE_LIMITED", "Too many attempts. Try again shortly.", undefined, retryAfter);
