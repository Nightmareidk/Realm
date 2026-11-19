import { describe, expect, it } from "vitest";
import { fromBase64Url, toBase64Url } from "./bytes";
import { decodeFixed, deviceCertificateBytes, deviceRevocationBytes } from "./certificate";

const ascii = (b: Uint8Array) => String.fromCharCode(...b);

describe("base64url", () => {
  it("round-trips every length and matches the standard alphabet", () => {
    for (let n = 0; n < 70; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n) & 0xff);
      expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
    }
    expect(toBase64Url(Uint8Array.from([0xfb, 0xff, 0xbf]))).toBe("-_-_");
    expect(toBase64Url(Uint8Array.from([104, 105]))).toBe("aGk");
  });

  it("refuses padding, foreign characters and non-canonical endings", () => {
    expect(() => fromBase64Url("aGk=")).toThrow();
    expect(() => fromBase64Url("a+b/")).toThrow();
    expect(() => fromBase64Url("aGl")).toThrow(); // "hi" with a stray low bit
    expect(() => fromBase64Url("a")).toThrow();
  });
});

describe("device certificates", () => {
  const key = Uint8Array.from({ length: 32 }, (_, i) => i);

  it("has one exact, labelled text form", () => {
    const text = ascii(
      deviceCertificateBytes({ userId: "12", deviceId: "34", signatureKey: key, issuedAt: 1700 }),
    );
    expect(text).toBe(
      `REALM-DEVICE-CERT-V1\nuser:12\ndevice:34\nkey:${toBase64Url(key)}\nissued:1700`,
    );
  });

  it("can't be confused with a revocation", () => {
    const cert = ascii(
      deviceCertificateBytes({ userId: "1", deviceId: "2", signatureKey: key, issuedAt: 3 }),
    );
    const revoke = ascii(deviceRevocationBytes({ userId: "1", deviceId: "2", revokedAt: 3 }));
    expect(cert.split("\n")[0]).not.toBe(revoke.split("\n")[0]);
  });

  it("refuses bad ids, times and key sizes instead of signing them", () => {
    const ok = { userId: "1", deviceId: "2", signatureKey: key, issuedAt: 3 };
    expect(() => deviceCertificateBytes({ ...ok, userId: "1\nuser:9" })).toThrow();
    expect(() => deviceCertificateBytes({ ...ok, deviceId: "007" })).toThrow();
    expect(() => deviceCertificateBytes({ ...ok, issuedAt: 1.5 })).toThrow();
    expect(() => deviceCertificateBytes({ ...ok, signatureKey: key.slice(1) })).toThrow();
    expect(() => decodeFixed(toBase64Url(key), 64)).toThrow();
    expect(decodeFixed(toBase64Url(key), 32)).toEqual(key);
  });
});
