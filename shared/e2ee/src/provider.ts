import { ed25519 } from "@noble/curves/ed25519.js";
import { type CryptoProvider, nobleCryptoProvider, type Signature } from "ts-mls";

/**
 * The crypto ts-mls runs on, the same on every device (docs/E2EE.md, phase 1 appendix).
 *
 * - Signing is always @noble/curves Ed25519, so a device key has the same raw 32-byte form on a
 *   phone, in a browser and on the server, whatever WebCrypto the platform has or lacks.
 * - HPKE and HKDF go through `crypto.subtle`: the browser's own, or react-native-quick-crypto's
 *   native one on phones (installed by the app before any of this runs).
 *
 * Nothing here is hand-made crypto: it only chooses which audited library does each step.
 */
const ed25519Signature: Signature = {
  async sign(signKey, message) {
    return ed25519.sign(message, signKey);
  },
  async verify(publicKey, message, signature) {
    try {
      return ed25519.verify(signature, message, publicKey);
    } catch {
      return false;
    }
  },
  async keygen() {
    const signKey = ed25519.utils.randomSecretKey();
    return { signKey, publicKey: ed25519.getPublicKey(signKey) };
  },
};

export const realmCryptoProvider: CryptoProvider = {
  async getCiphersuiteImpl(cs) {
    if (cs.signature !== "Ed25519") {
      throw new Error(`Realm only uses Ed25519 signatures, not ${cs.signature}`);
    }
    const impl = await nobleCryptoProvider.getCiphersuiteImpl(cs);
    return { ...impl, signature: ed25519Signature };
  },
};
