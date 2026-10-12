import { createHash } from "node:crypto";

/**
 * Screens a new password against what attackers try first (NIST SP 800-63B rev 4; OWASP ASVS
 * 6.2.4): a short local list of passwords long enough to pass Realm's 10-character minimum but
 * still common, and trivial patterns. Optionally also against Have I Been Pwned's Pwned
 * Passwords (k-anonymity: only the first five characters of the SHA-1 hash leave the server, and
 * an unreachable service never blocks anyone).
 */

/** Common passwords of 10+ characters, lowercased (from public breach top lists). */
const COMMON = new Set([
  "1234567890",
  "0987654321",
  "1234567891",
  "9876543210",
  "1111111111",
  "0000000000",
  "1212121212",
  "1234512345",
  "123123123123",
  "qwertyuiop",
  "qwertyuiop1",
  "qwerty1234",
  "qwerty12345",
  "q1w2e3r4t5",
  "1q2w3e4r5t",
  "1q2w3e4r5t6y",
  "1qaz2wsx3edc",
  "zaq12wsxcde",
  "qazwsxedc1",
  "qazwsxedcrfv",
  "123qweasdzxc",
  "asdfghjkl1",
  "zxcvbnm123",
  "abcdefghij",
  "abc1234567",
  "abcabcabc1",
  "123456789a",
  "a123456789",
  "1234567890a",
  "password12",
  "password123",
  "password1234",
  "password12345",
  "passw0rd12",
  "passw0rd123",
  "p@ssword123",
  "p@ssw0rd123",
  "password1!",
  "changeme123",
  "welcome123",
  "welcome1234",
  "letmein123",
  "iloveyou12",
  "iloveyou123",
  "admin12345",
  "administrator",
  "monkey1234",
  "dragon1234",
  "master1234",
  "shadow1234",
  "superman12",
  "superman123",
  "batman1234",
  "spiderman1",
  "football12",
  "football123",
  "baseball12",
  "basketball",
  "basketball1",
  "princess12",
  "sunshine12",
  "whatever12",
  "computer12",
  "internet12",
  "minecraft1",
  "minecraft12",
  "minecraft123",
  "fortnite123",
  "pokemon123",
  "starwars123",
  "liverpool1",
  "chelsea123",
  "arsenal123",
  "samsung123",
  "naruto1234",
  "michael123",
  "charlie123",
  "jessica123",
  "realm12345",
  "realmpassword",
]);

/** Why a password was refused, or null when it's fine. */
export type ScreenResult = "common" | "breached" | null;

/** True for one repeated character, or a straight run of digits or letters. */
function trivial(pw: string): boolean {
  if (/^(.)\1+$/.test(pw)) return true;
  const codes = [...pw].map((c) => c.charCodeAt(0));
  const step = (codes[1] ?? 0) - (codes[0] ?? 0);
  return (
    (step === 1 || step === -1) &&
    codes.every((c, i) => i === 0 || c - (codes[i - 1] as number) === step)
  );
}

export function isCommonPassword(password: string, related: string[] = []): boolean {
  const pw = password.toLowerCase();
  if (COMMON.has(pw) || trivial(pw)) return true;
  // The password is just the username or the email's name part, plus at most a few digits or
  // symbols ("noor_k2026!").
  return related.some((r) => {
    const name = r.toLowerCase();
    return (
      name.length >= 3 &&
      pw.startsWith(name) &&
      /^[\d!@#$%^&*._-]{0,6}$/.test(pw.slice(name.length))
    );
  });
}

/** Pwned Passwords range lookup: how many breaches the password appears in (0 if unknown). */
export async function pwnedCount(password: string, timeoutMs = 1500): Promise<number> {
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "Realm password screening" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return 0;
    for (const line of (await res.text()).split("\n")) {
      const [s, n] = line.trim().split(":");
      if (s === suffix) return Number(n) || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

export async function screenPassword(
  password: string,
  opts: { related?: string[]; pwned?: boolean } = {},
): Promise<ScreenResult> {
  if (isCommonPassword(password, opts.related)) return "common";
  if (opts.pwned && (await pwnedCount(password)) > 0) return "breached";
  return null;
}
