/**
 * What a file really is, from its first bytes (never its name or what the browser claimed),
 * and an image's size from its header. Enough of each format to decide; no decoding.
 */

export type Sniffed =
  | "image/png"
  | "image/jpeg"
  | "image/gif"
  | "image/webp"
  | "video/mp4"
  | "video/quicktime"
  | "audio/mp4"
  | "webm"
  | "audio/ogg"
  | "audio/mpeg"
  | "audio/wav"
  | "application/pdf"
  | "application/zip"
  | "text/plain"
  | "executable"
  | "markup"
  | "unknown";

const at = (b: Uint8Array, i: number, s: string) =>
  [...s].every((c, k) => b[i + k] === c.charCodeAt(0));

export function sniff(b: Uint8Array): Sniffed {
  if (b.length < 4) return "unknown";
  if (b[0] === 0x89 && at(b, 1, "PNG")) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (at(b, 0, "GIF87a") || at(b, 0, "GIF89a")) return "image/gif";
  if (at(b, 0, "RIFF") && at(b, 8, "WEBP")) return "image/webp";
  if (at(b, 0, "RIFF") && at(b, 8, "WAVE")) return "audio/wav";
  if (at(b, 4, "ftyp")) {
    const brand = String.fromCharCode(...b.slice(8, 12));
    if (brand === "qt  ") return "video/quicktime";
    if (brand === "M4A " || brand === "M4B ") return "audio/mp4";
    return "video/mp4";
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "webm";
  if (at(b, 0, "OggS")) return "audio/ogg";
  if (at(b, 0, "ID3") || (b[0] === 0xff && ((b[1] ?? 0) & 0xe0) === 0xe0)) return "audio/mpeg";
  if (at(b, 0, "%PDF")) return "application/pdf";
  if (b[0] === 0x50 && b[1] === 0x4b && (b[2] === 3 || b[2] === 5) && (b[3] === 4 || b[3] === 6)) {
    return "application/zip";
  }
  // Programs: Windows (MZ), Linux (ELF), macOS (Mach-O), and scripts with a #! line.
  if (at(b, 0, "MZ") || (b[0] === 0x7f && at(b, 1, "ELF"))) return "executable";
  if ((b[0] === 0xcf || b[0] === 0xce) && b[1] === 0xfa && b[2] === 0xed && b[3] === 0xfe) {
    return "executable";
  }
  if (b[0] === 0xfe && b[1] === 0xed && b[2] === 0xfa) return "executable";
  if (at(b, 0, "#!")) return "executable";
  // Markup (HTML, SVG, XML) can carry script: never shown inline, only downloaded.
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(b.slice(0, 256))
    .trimStart()
    .toLowerCase();
  if (/^<(\?xml|svg|!doctype|html|script)/.test(head)) return "markup";
  if (!b.slice(0, 512).some((c) => c === 0)) return "text/plain";
  return "unknown";
}

/** Which real types each upload kind accepts, and what to call them. */
export function acceptAs(
  kind: "image" | "video" | "audio" | "file",
  found: Sniffed,
  declared: string,
): string | null {
  switch (kind) {
    case "image":
      return found.startsWith("image/") ? found : null;
    case "video":
      if (found === "video/mp4" || found === "video/quicktime") return found;
      return found === "webm" ? "video/webm" : null;
    case "audio":
      if (found === "audio/ogg" || found === "audio/mpeg" || found === "audio/wav") return found;
      // Recorders put voice in webm or mp4 containers; the declared type says which.
      if (found === "webm") return "audio/webm";
      if (found === "audio/mp4" || found === "video/mp4")
        return declared === "audio/x-m4a" ? "audio/x-m4a" : "audio/mp4";
      return null;
    case "file":
      // Anything but programs. Files are always downloaded, never opened in the page.
      return found === "executable" ? null : "application/octet-stream";
  }
}

const u16be = (b: Uint8Array, i: number) => ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
const u16le = (b: Uint8Array, i: number) => (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8);
const u24le = (b: Uint8Array, i: number) => u16le(b, i) | ((b[i + 2] ?? 0) << 16);
const u32be = (b: Uint8Array, i: number) => ((u16be(b, i) << 16) >>> 0) + u16be(b, i + 2);

/** Width and height from an image's header, or null if it can't be read from these bytes. */
export function imageSize(type: string, b: Uint8Array): { width: number; height: number } | null {
  if (type === "image/png" && b.length >= 24) return { width: u32be(b, 16), height: u32be(b, 20) };
  if (type === "image/gif" && b.length >= 10) return { width: u16le(b, 6), height: u16le(b, 8) };
  if (type === "image/webp" && b.length >= 30) {
    if (at(b, 12, "VP8X")) return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
    if (at(b, 12, "VP8L")) {
      const bits = (b[21] ?? 0) | ((b[22] ?? 0) << 8) | ((b[23] ?? 0) << 16) | ((b[24] ?? 0) << 24);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (at(b, 12, "VP8 ")) return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  if (type === "image/jpeg") {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = b[i + 1] ?? 0;
      // Start-of-frame markers carry the size (not DHT C4, JPG C8 or DAC CC).
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc
      ) {
        return { height: u16be(b, i + 5), width: u16be(b, i + 7) };
      }
      i += 2 + u16be(b, i + 2);
    }
  }
  return null;
}
