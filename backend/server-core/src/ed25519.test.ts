import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyEd25519 } from "./crypto";

function keyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  return { raw: new Uint8Array(raw), privateKey };
}

describe("verifyEd25519", () => {
  const msg = new TextEncoder().encode("REALM-DEVICE-CERT-V1\nuser:1");

  it("accepts the signer's signature and nothing else", () => {
    const a = keyPair();
    const b = keyPair();
    const sig = new Uint8Array(sign(null, msg, a.privateKey));
    expect(verifyEd25519(a.raw, msg, sig)).toBe(true);
    expect(verifyEd25519(b.raw, msg, sig)).toBe(false);
    const changed = msg.slice();
    changed[changed.length - 1] = (changed.at(-1) ?? 0) ^ 1;
    expect(verifyEd25519(a.raw, changed, sig)).toBe(false);
    const flipped = sig.slice();
    flipped[0] = (flipped[0] ?? 0) ^ 1;
    expect(verifyEd25519(a.raw, msg, flipped)).toBe(false);
  });

  it("says no instead of throwing on junk", () => {
    expect(verifyEd25519(new Uint8Array(31), msg, new Uint8Array(64))).toBe(false);
    expect(verifyEd25519(new Uint8Array(32), msg, new Uint8Array(63))).toBe(false);
    expect(verifyEd25519(new Uint8Array(32), msg, new Uint8Array(64))).toBe(false);
  });
});
