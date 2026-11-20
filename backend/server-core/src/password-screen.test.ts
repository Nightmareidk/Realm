import { describe, expect, it } from "vitest";
import { isCommonPassword, screenPassword } from "./password-screen";

describe("password screen", () => {
  it("refuses common passwords whatever their case", () => {
    expect(isCommonPassword("1234567890")).toBe(true);
    expect(isCommonPassword("Password123")).toBe(true);
    expect(isCommonPassword("QWERTYUIOP")).toBe(true);
  });

  it("refuses common 8- and 9-character passwords now that 8 is the minimum", () => {
    expect(isCommonPassword("password")).toBe(true);
    expect(isCommonPassword("12345678")).toBe(true);
    expect(isCommonPassword("Iloveyou")).toBe(true);
    expect(isCommonPassword("qwerty123")).toBe(true);
    expect(isCommonPassword("tq7#mVw2")).toBe(false);
  });

  it("refuses trivial patterns", () => {
    expect(isCommonPassword("zzzzzzzzzzzz")).toBe(true);
    expect(isCommonPassword("abcdefghijkl")).toBe(true);
    expect(isCommonPassword("9876543210")).toBe(true);
  });

  it("refuses the person's own name with a few digits or symbols", () => {
    expect(isCommonPassword("noor_k2026!", ["noor_k"])).toBe(true);
    expect(isCommonPassword("noor_k", ["noor_k"])).toBe(true);
    expect(isCommonPassword("noor_k loves ranked nights", ["noor_k"])).toBe(false);
  });

  it("lets ordinary long passphrases through without a network call", async () => {
    expect(isCommonPassword("correct horse battery staple")).toBe(false);
    expect(await screenPassword("correct horse battery staple")).toBeNull();
  });
});
