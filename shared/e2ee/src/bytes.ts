/** Raw bytes. Every key, signature and ciphertext in this package is one of these. */
export type Bytes = Uint8Array;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const LOOKUP = new Map([...ALPHABET].map((c, i) => [c, i]));

/**
 * Base64url without padding (RFC 4648 §5): how keys and signatures travel in JSON. Written out
 * here so it behaves the same in browsers, Node and Hermes, which don't share one built-in.
 */
export function toBase64Url(bytes: Bytes): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const n = (a << 16) | (b << 8) | c;
    const left = bytes.length - i;
    out += ALPHABET[(n >> 18) & 63];
    out += ALPHABET[(n >> 12) & 63];
    if (left > 1) out += ALPHABET[(n >> 6) & 63];
    if (left > 2) out += ALPHABET[n & 63];
  }
  return out;
}

/** The reverse of `toBase64Url`. Throws on anything that isn't strict, unpadded base64url. */
export function fromBase64Url(text: string): Bytes {
  if (text.length % 4 === 1) throw new Error("base64url: impossible length");
  const out = new Uint8Array(Math.floor((text.length * 3) / 4));
  let bits = 0;
  let value = 0;
  let o = 0;
  for (const ch of text) {
    const v = LOOKUP.get(ch);
    if (v === undefined) throw new Error("base64url: invalid character");
    value = (value << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (value >> bits) & 0xff;
    }
  }
  // Leftover bits must be zero, so each byte string has exactly one encoding.
  if (value & ((1 << bits) - 1)) throw new Error("base64url: non-canonical encoding");
  return out;
}

/** ASCII text to bytes. Certificate text is ASCII by construction (digits, base64url, labels). */
export function asciiBytes(text: string): Bytes {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 0x7e || (code < 0x20 && code !== 0x0a)) throw new Error("not printable ASCII");
    out[i] = code;
  }
  return out;
}

/** The reverse of `asciiBytes`. Throws on anything that isn't printable ASCII. */
export function asciiText(bytes: Bytes): string {
  let out = "";
  for (const code of bytes) {
    if (code > 0x7e || (code < 0x20 && code !== 0x0a)) throw new Error("not printable ASCII");
    out += String.fromCharCode(code);
  }
  return out;
}
