import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

/** 256-bit random token, URL-safe. Used for sessions, reset links, verification links. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Six-digit numeric code (uniform, crypto-random). */
export function randomNumericCode(digits = 6): string {
  return randomInt(0, 10 ** digits)
    .toString()
    .padStart(digits, "0");
}

/** For high-entropy secrets (tokens): a plain hash is sufficient. */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** For low-entropy secrets (6-digit codes): keyed so a leaked table can't be brute-forced offline. */
export function hmacHex(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// OWASP-recommended Argon2id parameters (19 MiB, 2 iterations, 1 lane).
const ARGON2 = { algorithm: 2 /* Argon2id */, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/**
 * A real Argon2id hash of a random value. Verifying against it when an account doesn't exist
 * keeps login timing identical for known and unknown accounts (no user enumeration by timing).
 */
let dummyHash: Promise<string> | undefined;
export function timingSafeDummyVerify(password: string): Promise<boolean> {
  dummyHash ??= hashPassword(randomToken());
  return dummyHash.then((h) => verifyPassword(h, password)).then(() => false);
}
