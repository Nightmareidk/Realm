import { z } from "zod";
import { Limits } from "../limits";
import { IsoDateTime } from "./common";

/**
 * Your account: taking a break, deleting it, two-step sign-in, and a copy of your data.
 * Anything that can't be undone asks for the password again (and the code, with two-step on).
 */

/** A code from the authenticator app (6 digits), or one of the backup codes (xxxx-xxxx). */
export const SecondStepCode = z
  .string()
  .trim()
  .min(6)
  .max(20)
  .transform((v) => v.replace(/\s+/g, "").toLowerCase());

export const ConfirmWithPassword = z.object({
  password: z.string().min(1).max(Limits.password.max),
  code: SecondStepCode.optional(),
});
export type ConfirmWithPassword = z.infer<typeof ConfirmWithPassword>;

/** Days between asking to delete an account and it being gone for good. */
export const DELETION_GRACE_DAYS = 30;

export const DeletionScheduled = z
  .object({ deletesAt: IsoDateTime })
  .meta({ id: "DeletionScheduled" });
export type DeletionScheduled = z.infer<typeof DeletionScheduled>;

/** Step one of turning on two-step sign-in: the secret to put in the authenticator app. */
export const TwoStepSetup = z
  .object({
    /** Base32, for typing in by hand. */
    secret: z.string(),
    /** otpauth:// link, shown as a QR code. */
    uri: z.string(),
  })
  .meta({ id: "TwoStepSetup" });
export type TwoStepSetup = z.infer<typeof TwoStepSetup>;

export const TwoStepEnableBody = z.object({
  secret: z.string().regex(/^[A-Z2-7]{32}$/),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from the app"),
});
export type TwoStepEnableBody = z.infer<typeof TwoStepEnableBody>;

/** Shown once: ten single-use codes for when the phone is lost. */
export const BackupCodes = z.object({ codes: z.array(z.string()) }).meta({ id: "BackupCodes" });
export type BackupCodes = z.infer<typeof BackupCodes>;

export const TwoStepStatus = z
  .object({ enabled: z.boolean(), backupCodesLeft: z.number().int() })
  .meta({ id: "TwoStepStatus" });
export type TwoStepStatus = z.infer<typeof TwoStepStatus>;
