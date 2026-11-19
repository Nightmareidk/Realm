import { gcm } from "@noble/ciphers/aes.js";
import { randomBytes } from "@noble/ciphers/utils.js";
import { asciiBytes, type Bytes } from "./bytes";
import type { KeyStore } from "./engine";

/**
 * Encryption at rest for everything the engine keeps on a device (docs/E2EE.md §10): keys, group
 * state and saved messages are sealed with AES-256-GCM before they touch the disk. The 256-bit
 * storage key itself lives in the platform's keystore (Android Keystore, iOS Keychain), or is a
 * non-extractable WebCrypto key in a browser, so it is never in a file and never sent anywhere.
 *
 * AES-256-GCM from a reviewed library (@noble/ciphers) or from the platform's WebCrypto. The only
 * Realm code here is the framing: a version byte, a fresh random 96-bit nonce, then the sealed
 * bytes. Each record is bound to its own name, so one saved record can't be put in place of
 * another. Random nonces are safe for 2^32 writes per key (NIST SP 800-38D), far beyond a chat app.
 */

export const STORAGE_KEY_BYTES = 32;
const VERSION = 1;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

/** Plain bytes on disk, by name: files, SQLite rows or IndexedDB records. Holds only sealed data. */
export interface BlobStore {
  get(name: string): Promise<Bytes | null>;
  put(name: string, value: Bytes): Promise<void>;
  delete(name: string): Promise<void>;
}

/** Seals and opens bytes. `context` must match on both sides or opening fails. */
export interface Sealer {
  seal(plain: Bytes, context: Bytes): Promise<Bytes>;
  open(sealed: Bytes, context: Bytes): Promise<Bytes>;
}

function frame(nonce: Bytes, sealed: Bytes): Bytes {
  const out = new Uint8Array(1 + NONCE_BYTES + sealed.length);
  out[0] = VERSION;
  out.set(nonce, 1);
  out.set(sealed, 1 + NONCE_BYTES);
  return out;
}

function unframe(blob: Bytes): { nonce: Bytes; sealed: Bytes } {
  if (blob.length < 1 + NONCE_BYTES + TAG_BYTES) throw new Error("sealed record is too short");
  if (blob[0] !== VERSION) throw new Error("unknown sealed record version");
  return { nonce: blob.subarray(1, 1 + NONCE_BYTES), sealed: blob.subarray(1 + NONCE_BYTES) };
}

/** A fresh 256-bit storage key, from the system's secure random source. */
export function newStorageKey(): Bytes {
  return randomBytes(STORAGE_KEY_BYTES);
}

/** AES-256-GCM with a raw key (phones: the key comes out of the OS keystore). */
export function aes256GcmSealer(key: Bytes): Sealer {
  if (key.length !== STORAGE_KEY_BYTES) throw new Error("the storage key must be 256 bits");
  return {
    async seal(plain, context) {
      const nonce = randomBytes(NONCE_BYTES);
      return frame(nonce, gcm(key, nonce, context).encrypt(plain));
    },
    async open(blob, context) {
      const { nonce, sealed } = unframe(blob);
      return gcm(key, nonce, context).decrypt(sealed);
    },
  };
}

/** The slice of WebCrypto this needs, so the package doesn't depend on browser types. */
export interface SubtleAesGcm<Key> {
  encrypt(
    algorithm: { name: "AES-GCM"; iv: Bytes; additionalData: Bytes },
    key: Key,
    data: Bytes,
  ): Promise<ArrayBuffer>;
  decrypt(
    algorithm: { name: "AES-GCM"; iv: Bytes; additionalData: Bytes },
    key: Key,
    data: Bytes,
  ): Promise<ArrayBuffer>;
}

/**
 * AES-256-GCM through WebCrypto with a key the page can use but never read (browsers: a
 * non-extractable CryptoKey kept in IndexedDB). Same record format as `aes256GcmSealer`.
 */
export function subtleAes256GcmSealer<Key>(subtle: SubtleAesGcm<Key>, key: Key): Sealer {
  return {
    async seal(plain, context) {
      const nonce = randomBytes(NONCE_BYTES);
      const sealed = await subtle.encrypt(
        { name: "AES-GCM", iv: nonce, additionalData: context },
        key,
        plain,
      );
      return frame(nonce, new Uint8Array(sealed));
    },
    async open(blob, context) {
      const { nonce, sealed } = unframe(blob);
      const plain = await subtle.decrypt(
        { name: "AES-GCM", iv: nonce, additionalData: context },
        key,
        sealed,
      );
      return new Uint8Array(plain);
    },
  };
}

const NAME = /^[A-Za-z0-9:_-]{1,120}$/;

/** A KeyStore whose every record is sealed before it reaches the disk. */
export class SealedKeyStore implements KeyStore {
  constructor(
    private readonly blobs: BlobStore,
    private readonly sealer: Sealer,
  ) {}

  private context(name: string): Bytes {
    if (!NAME.test(name)) throw new Error("invalid record name");
    return asciiBytes(`realm-e2ee-store-v1:${name}`);
  }

  async get(name: string): Promise<Bytes | null> {
    const context = this.context(name);
    const blob = await this.blobs.get(name);
    return blob ? this.sealer.open(blob, context) : null;
  }

  async put(name: string, value: Bytes): Promise<void> {
    await this.blobs.put(name, await this.sealer.seal(value, this.context(name)));
  }

  async delete(name: string): Promise<void> {
    this.context(name);
    await this.blobs.delete(name);
  }
}
