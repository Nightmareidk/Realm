import { z } from "zod";

/**
 * Closed set of machine-readable error codes. Clients switch on `code`, never on `message`.
 * Adding a code is backwards compatible; renaming or removing one is not.
 */
export const ErrorCode = z.enum([
  "BAD_REQUEST",
  "VALIDATION_FAILED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "MISSING_PERMISSION",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "PAYLOAD_TOO_LARGE",
  "INTERNAL",
  // auth
  "INVALID_CREDENTIALS",
  "EMAIL_TAKEN",
  "USERNAME_TAKEN",
  "USERNAME_RESERVED",
  "PASSWORD_TOO_WEAK",
  "AGE_REQUIREMENT",
  "EMAIL_NOT_VERIFIED",
  "INVALID_CODE",
  "CODE_EXPIRED",
  "TOKEN_INVALID",
  "SESSION_EXPIRED",
  "ACCOUNT_SUSPENDED",
  // social
  "BLOCKED",
  "DM_NOT_ALLOWED",
  "FRIEND_REQUEST_NOT_ALLOWED",
  "ALREADY_MEMBER",
  "BANNED_FROM_COMMUNITY",
  "SLOWMODE",
  "CLIENT_OUTDATED",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ApiErrorBody = z
  .object({
    error: z.object({
      code: ErrorCode,
      message: z.string(),
      details: z.record(z.string(), z.unknown()).optional(),
      requestId: z.string().optional(),
      retryAfter: z.number().optional(),
    }),
  })
  .meta({ id: "ApiError" });
export type ApiErrorBody = z.infer<typeof ApiErrorBody>;
