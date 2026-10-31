import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, hotp, seal, unseal, verifyTotp } from "./totp";

// RFC 6238 Appendix B: the secret "12345678901234567890" (SHA-1), 8-digit answers cut to 6.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("two-step codes", () => {
  it("matches the RFC 6238 test values", () => {
    expect(hotp(RFC_SECRET, Math.floor(59 / 30))).toBe("287082");
    expect(hotp(RFC_SECRET, Math.floor(1111111109 / 30))).toBe("081804");
    expect(hotp(RFC_SECRET, Math.floor(2000000000 / 30))).toBe("279037");
  });

  it("allows one step of clock drift either way, and no more", () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 30_000);
    expect(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step - 1), now)).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step + 1), now)).toBe(step + 1);
    expect(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step - 3), now)).toBeNull();
    expect(verifyTotp(RFC_SECRET, "12345", now)).toBeNull();
  });

  it("round-trips base32 and sealed secrets, and refuses a tampered seal", () => {
    expect(base32Decode(base32Encode(Buffer.from("hello world"))).toString()).toBe("hello world");
    const sealed = seal("server-secret", RFC_SECRET);
    expect(sealed).not.toContain(RFC_SECRET);
    expect(unseal("server-secret", sealed)).toBe(RFC_SECRET);
    expect(() => unseal("another-secret", sealed)).toThrow();
  });
});
