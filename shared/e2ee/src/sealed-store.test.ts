import { describe, expect, it } from "vitest";
import { asciiBytes, type Bytes, toBase64Url } from "./bytes";
import {
  aes256GcmSealer,
  type BlobStore,
  newStorageKey,
  SealedKeyStore,
  type SubtleAesGcm,
  subtleAes256GcmSealer,
} from "./sealed-store";
import { utf8Bytes, utf8Text } from "./utf8";

class Disk implements BlobStore {
  readonly files = new Map<string, Bytes>();
  async get(name: string) {
    return this.files.get(name) ?? null;
  }
  async put(name: string, value: Bytes) {
    this.files.set(name, value.slice());
  }
  async delete(name: string) {
    this.files.delete(name);
  }
}

// Node's WebCrypto, typed loosely: this package is built without browser or Node types.
const webcrypto = (
  globalThis as unknown as {
    crypto: {
      subtle: SubtleAesGcm<unknown> & {
        generateKey(a: object, extractable: boolean, uses: string[]): Promise<unknown>;
        importKey(f: string, k: Bytes, a: object, e: boolean, uses: string[]): Promise<unknown>;
        exportKey(format: string, key: unknown): Promise<ArrayBuffer>;
      };
    };
  }
).crypto;

describe("SealedKeyStore", () => {
  it("gives back what was stored, and the disk never holds it in the clear", async () => {
    const disk = new Disk();
    const store = new SealedKeyStore(disk, aes256GcmSealer(newStorageKey()));
    const secret = asciiBytes("device signing key: do not leak");
    await store.put("device", secret);
    expect(await store.get("device")).toEqual(secret);
    expect(await store.get("missing")).toBeNull();

    const onDisk = disk.files.get("device") as Bytes;
    expect(toBase64Url(onDisk)).not.toContain(toBase64Url(secret).slice(0, 16));
    // Version byte, 12-byte nonce, the data, 16-byte tag.
    expect(onDisk.length).toBe(1 + 12 + secret.length + 16);

    // The same value sealed twice looks different each time (a fresh nonce).
    await store.put("again", secret);
    await store.put("again2", secret);
    expect(disk.files.get("again")).not.toEqual(disk.files.get("again2"));

    await store.delete("device");
    expect(await store.get("device")).toBeNull();
  });

  it("refuses a changed record, a swapped record and the wrong key", async () => {
    const disk = new Disk();
    const store = new SealedKeyStore(disk, aes256GcmSealer(newStorageKey()));
    await store.put("group:1", asciiBytes("state of chat one"));
    await store.put("group:2", asciiBytes("state of chat two"));

    // One flipped bit anywhere is caught.
    const bent = (disk.files.get("group:1") as Bytes).slice();
    bent[20] = (bent[20] as number) ^ 1;
    disk.files.set("group:1", bent);
    await expect(store.get("group:1")).rejects.toThrow();

    // A valid record moved under another name is caught too.
    disk.files.set("group:1", disk.files.get("group:2") as Bytes);
    await expect(store.get("group:1")).rejects.toThrow();
    expect(await store.get("group:2")).toEqual(asciiBytes("state of chat two"));

    // Another device's key can't open it.
    const other = new SealedKeyStore(disk, aes256GcmSealer(newStorageKey()));
    await expect(other.get("group:2")).rejects.toThrow();

    // Junk and unknown versions don't crash, they are refused.
    disk.files.set("group:2", new Uint8Array(5));
    await expect(store.get("group:2")).rejects.toThrow("too short");
    const future = new Uint8Array(40);
    future[0] = 9;
    disk.files.set("group:2", future);
    await expect(store.get("group:2")).rejects.toThrow("version");
  });

  it("only takes a 256-bit key and safe record names", async () => {
    expect(() => aes256GcmSealer(new Uint8Array(16))).toThrow("256 bits");
    const store = new SealedKeyStore(new Disk(), aes256GcmSealer(newStorageKey()));
    await expect(store.put("../../etc/passwd", new Uint8Array(1))).rejects.toThrow("name");
    await expect(store.get("")).rejects.toThrow("name");
  });

  it("works with a WebCrypto key the page can't read, in the same format", async () => {
    const hidden = await webcrypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
      "encrypt",
      "decrypt",
    ]);
    await expect(webcrypto.subtle.exportKey("raw", hidden)).rejects.toThrow();
    const disk = new Disk();
    const store = new SealedKeyStore(disk, subtleAes256GcmSealer(webcrypto.subtle, hidden));
    await store.put("identity", asciiBytes("hello"));
    expect(await store.get("identity")).toEqual(asciiBytes("hello"));

    // The two sealers write the same format: a record sealed by one opens with the other.
    const raw = newStorageKey();
    const imported = await webcrypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
      "encrypt",
      "decrypt",
    ]);
    const shared = new Disk();
    await new SealedKeyStore(shared, aes256GcmSealer(raw)).put("x", asciiBytes("same format"));
    const viaSubtle = new SealedKeyStore(shared, subtleAes256GcmSealer(webcrypto.subtle, imported));
    expect(await viaSubtle.get("x")).toEqual(asciiBytes("same format"));
  });
});

describe("utf8", () => {
  it("round-trips every kind of text", () => {
    for (const text of [
      "",
      "hello",
      "naïve café",
      "日本語",
      "😀👩‍👩‍👧",
      "a\u0000b",
      "\u{10FFFF}",
    ]) {
      expect(utf8Text(utf8Bytes(text))).toBe(text);
    }
    expect([...utf8Bytes("é")]).toEqual([0xc3, 0xa9]);
    expect([...utf8Bytes("😀")]).toEqual([0xf0, 0x9f, 0x98, 0x80]);
    // A lone surrogate becomes the replacement character.
    expect([...utf8Bytes("\ud800")]).toEqual([0xef, 0xbf, 0xbd]);
  });

  it("refuses bytes that aren't well-formed UTF-8", () => {
    const bad = [
      [0x80],
      [0xc0, 0xaf], // overlong "/"
      [0xe0, 0x80, 0xaf], // overlong
      [0xed, 0xa0, 0x80], // a surrogate
      [0xf4, 0x90, 0x80, 0x80], // past U+10FFFF
      [0xe2, 0x82], // cut short
      [0xc3, 0x28], // bad continuation
      [0xff],
    ];
    for (const b of bad) expect(() => utf8Text(new Uint8Array(b))).toThrow("UTF-8");
  });
});
