import { asciiBytes, type Bytes, fromBase64Url, toBase64Url } from "./bytes";

/**
 * What an account identity key signs (docs/E2EE.md §6.1). Clients sign these bytes and the server
 * rebuilds them from its own records before checking the signature, so nothing outside these
 * fields can be slipped in. Each kind starts with its own label, so a signature over one can never
 * be passed off as the other.
 */

export const ED25519_PUBLIC_KEY_BYTES = 32;
export const ED25519_SIGNATURE_BYTES = 64;

const SNOWFLAKE = /^[1-9]\d{0,19}$/;

export interface DeviceCertificate {
  userId: string;
  deviceId: string;
  /** The device's own Ed25519 signature key (its MLS credential key). */
  signatureKey: Bytes;
  /** When the approving device signed it, in Unix milliseconds. */
  issuedAt: number;
}

export interface DeviceRevocation {
  userId: string;
  deviceId: string;
  revokedAt: number;
}

function check(userId: string, deviceId: string, at: number) {
  if (!SNOWFLAKE.test(userId) || !SNOWFLAKE.test(deviceId)) throw new Error("invalid id");
  if (!Number.isSafeInteger(at) || at <= 0) throw new Error("invalid time");
}

export function deviceCertificateBytes(c: DeviceCertificate): Bytes {
  check(c.userId, c.deviceId, c.issuedAt);
  if (c.signatureKey.length !== ED25519_PUBLIC_KEY_BYTES) throw new Error("invalid key length");
  return asciiBytes(
    [
      "REALM-DEVICE-CERT-V1",
      `user:${c.userId}`,
      `device:${c.deviceId}`,
      `key:${toBase64Url(c.signatureKey)}`,
      `issued:${c.issuedAt}`,
    ].join("\n"),
  );
}

export function deviceRevocationBytes(r: DeviceRevocation): Bytes {
  check(r.userId, r.deviceId, r.revokedAt);
  return asciiBytes(
    [
      "REALM-DEVICE-REVOKE-V1",
      `user:${r.userId}`,
      `device:${r.deviceId}`,
      `at:${r.revokedAt}`,
    ].join("\n"),
  );
}

export interface DeviceResume {
  userId: string;
  deviceId: string;
  /** When it was signed, in Unix milliseconds. */
  at: number;
}

/**
 * What a device signs with its OWN key when its owner signs in again on it: proof that this
 * sign-in really is that device, so it carries on with the keys it already has. Its public key
 * is no secret, so knowing the key must not be enough to claim to be the device.
 */
export function deviceResumeBytes(r: DeviceResume): Bytes {
  check(r.userId, r.deviceId, r.at);
  return asciiBytes(
    ["REALM-DEVICE-RESUME-V1", `user:${r.userId}`, `device:${r.deviceId}`, `at:${r.at}`].join("\n"),
  );
}

/** A 32-byte key or 64-byte signature from the wire, or an error naming which it should be. */
export function decodeFixed(text: string, length: number): Bytes {
  const bytes = fromBase64Url(text);
  if (bytes.length !== length) throw new Error(`expected ${length} bytes`);
  return bytes;
}
