import type { Bytes } from "./bytes";

/**
 * UTF-8, written out so it behaves the same in browsers, Node and Hermes (which don't all have
 * TextEncoder and TextDecoder). Decoding is strict: anything that isn't well-formed UTF-8 throws,
 * so two devices can never read the same bytes as different text.
 */

export function utf8Bytes(text: string): Bytes {
  const out: number[] = [];
  for (const ch of text) {
    let cp = ch.codePointAt(0) as number;
    // A lone surrogate isn't a character: it becomes U+FFFD, as TextEncoder does.
    if (cp >= 0xd800 && cp <= 0xdfff) cp = 0xfffd;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) {
      out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
    }
  }
  return new Uint8Array(out);
}

export function utf8Text(bytes: Bytes): string {
  const bad = () => new Error("not valid UTF-8");
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i++] as number;
    let need: number;
    let cp: number;
    let min: number;
    if (b < 0x80) {
      out += String.fromCharCode(b);
      continue;
    }
    if (b >= 0xc2 && b <= 0xdf) [need, cp, min] = [1, b & 0x1f, 0x80];
    else if (b >= 0xe0 && b <= 0xef) [need, cp, min] = [2, b & 0x0f, 0x800];
    else if (b >= 0xf0 && b <= 0xf4) [need, cp, min] = [3, b & 0x07, 0x10000];
    else throw bad();
    if (i + need > bytes.length) throw bad();
    for (let k = 0; k < need; k++) {
      const next = bytes[i++] as number;
      if ((next & 0xc0) !== 0x80) throw bad();
      cp = (cp << 6) | (next & 0x3f);
    }
    // No overlong forms, no surrogates, nothing past the last code point.
    if (cp < min || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) throw bad();
    out += String.fromCodePoint(cp);
  }
  return out;
}
