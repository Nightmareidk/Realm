import { z } from "zod";
import { Snowflake } from "../ids";
import { Limits } from "../limits";
import { IsoDateTime, Platform } from "./common";
import { DisplayName, SelfUser, ThemeAccent, Username } from "./users";

export const Email = z.email("Enter a valid email address").trim().max(254);

export const Password = z
  .string()
  .min(Limits.password.min, `Use at least ${Limits.password.min} characters`)
  .max(Limits.password.max);

/** Whole years between `birthDate` (YYYY-MM-DD) and `now`. */
export function ageInYears(birthDate: string, now: Date = new Date()): number {
  const [y, m, d] = birthDate.split("-").map(Number) as [number, number, number];
  let age = now.getUTCFullYear() - y;
  const beforeBirthday =
    now.getUTCMonth() + 1 < m || (now.getUTCMonth() + 1 === m && now.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

/** Under 18: the teen defaults apply. */
export function isMinor(birthDate: string, now: Date = new Date()): boolean {
  return ageInYears(birthDate, now) < Limits.adultAgeYears;
}

export const BirthDate = z.iso
  .date()
  .refine((v) => ageInYears(v) >= Limits.minimumAgeYears, {
    message: `You must be at least ${Limits.minimumAgeYears} to use Realm`,
  })
  .refine((v) => ageInYears(v) <= 120, { message: "Enter a real date of birth" });

export const RegisterBody = z
  .object({
    email: Email,
    username: Username,
    displayName: DisplayName,
    password: Password,
    birthDate: BirthDate,
    /** The colour picked on sign-up's first step. */
    accent: ThemeAccent.optional(),
  })
  .meta({ id: "RegisterBody" });

/**
 * Sign-up's birthday step, asked before anything personal. A date under the minimum age puts a
 * 24-hour hold on this browser (an HttpOnly cookie the API enforces on register).
 */
export const AgeCheckBody = z.object({ birthDate: z.iso.date() }).meta({ id: "AgeCheckBody" });
export type AgeCheckBody = z.infer<typeof AgeCheckBody>;

/** Whether a username can be taken, checked as someone types it. */
export const UsernameAvailability = z
  .object({
    available: z.boolean(),
    reason: z.enum(["taken", "reserved", "invalid"]).optional(),
  })
  .meta({ id: "UsernameAvailability" });
export type UsernameAvailability = z.infer<typeof UsernameAvailability>;

/** A reset link's state, checked when the page opens (reading it never uses it up). */
export const ResetTokenStatus = z
  .object({ status: z.enum(["valid", "expired", "used", "invalid"]) })
  .meta({ id: "ResetTokenStatus" });
export type ResetTokenStatus = z.infer<typeof ResetTokenStatus>;
export type RegisterBody = z.infer<typeof RegisterBody>;

export const LoginBody = z
  .object({
    /** Email address or username. */
    login: z.string().trim().min(1).max(254),
    password: z.string().min(1).max(Limits.password.max),
  })
  .meta({ id: "LoginBody" });
export type LoginBody = z.infer<typeof LoginBody>;

export const SessionInfo = z
  .object({
    id: Snowflake,
    platform: Platform,
    deviceName: z.string(),
    country: z.string().length(2).nullable(),
    createdAt: IsoDateTime,
    lastActiveAt: IsoDateTime,
    expiresAt: IsoDateTime,
    current: z.boolean(),
  })
  .meta({ id: "SessionInfo" });
export type SessionInfo = z.infer<typeof SessionInfo>;

/**
 * Web clients receive the session only as an HttpOnly cookie. Native clients
 * (identified by `X-Realm-Client`) also receive `token`, to store in the OS keychain.
 */
export const AuthResult = z
  .object({
    user: SelfUser,
    session: SessionInfo,
    token: z.string().optional(),
  })
  .meta({ id: "AuthResult" });
export type AuthResult = z.infer<typeof AuthResult>;

export const VerifyEmailBody = z.union([
  z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") }),
  z.object({ token: z.string().min(20).max(200) }),
]);
export type VerifyEmailBody = z.infer<typeof VerifyEmailBody>;

export const ForgotPasswordBody = z.object({ email: Email });
export const ResetPasswordBody = z.object({
  token: z.string().min(20).max(200),
  password: Password,
});
export const ChangePasswordBody = z.object({
  currentPassword: z.string().min(1).max(Limits.password.max),
  newPassword: Password,
});

export const GatewayTicket = z.object({
  ticket: z.string(),
  expiresAt: IsoDateTime,
});
