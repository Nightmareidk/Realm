// biome-ignore-all lint/suspicious/noConsole: a CLI script; its output is the point.
// Scales the textures inside a GLB down to at most `max` pixels on a side, re-encoded as WebP, and
// repacks the binary. The cast is drawn a few hundred pixels tall, so 1024 textures only cost
// memory (three per character, about 16 MB of graphics memory each once mipmapped).
//
//   import { shrinkGlb } from "./shrink-glb.mjs";  const smaller = await shrinkGlb(buffer, 512);
//   node scripts/shrink-glb.mjs in.glb out.glb [max]
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const align4 = (n) => (n + 3) & ~3;

export async function shrinkGlb(glb, max = 512) {
  const jsonLength = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8"));
  const binStart = 20 + jsonLength + 8;
  const bin = glb.subarray(binStart, binStart + glb.readUInt32LE(20 + jsonLength));
  const views = json.bufferViews ?? [];
  const replaced = new Map();

  for (const image of json.images ?? []) {
    if (image.bufferView === undefined) continue;
    const view = views[image.bufferView];
    const bytes = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    const { width = 0, height = 0 } = await sharp(bytes).metadata();
    if (Math.max(width, height) <= max) continue;
    const out = await sharp(bytes)
      .resize(max, max, { fit: "inside" })
      .webp({ quality: 90, alphaQuality: 95, effort: 6 })
      .toBuffer();
    replaced.set(image.bufferView, out);
    image.mimeType = "image/webp";
  }
  if (!replaced.size) return glb;
  if (!(json.extensionsUsed ?? []).includes("EXT_texture_webp")) {
    // Every texture must point at its WebP through the extension for loaders to read it.
    for (const t of json.textures ?? []) {
      if (t.source !== undefined && replaced.has(json.images[t.source].bufferView)) {
        t.extensions = { ...t.extensions, EXT_texture_webp: { source: t.source } };
      }
    }
    json.extensionsUsed = [...(json.extensionsUsed ?? []), "EXT_texture_webp"];
  }

  // Lay the views out again, in their original order, each 4-byte aligned.
  const order = views.map((v, i) => [i, v.byteOffset ?? 0]).sort((a, b) => a[1] - b[1]);
  const parts = [];
  let offset = 0;
  for (const [i] of order) {
    const view = views[i];
    const data =
      replaced.get(i) ??
      bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    const start = align4(offset);
    if (start > offset) parts.push(Buffer.alloc(start - offset));
    view.byteOffset = start;
    view.byteLength = data.length;
    parts.push(data);
    offset = start + data.length;
  }
  const newBin = Buffer.concat([...parts, Buffer.alloc(align4(offset) - offset)]);
  json.buffers[0].byteLength = newBin.length;

  let text = Buffer.from(JSON.stringify(json), "utf8");
  text = Buffer.concat([text, Buffer.alloc(align4(text.length) - text.length, 0x20)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + text.length + 8 + newBin.length, 8);
  const chunk = (type, data) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(data.length, 0);
    h.writeUInt32LE(type, 4);
    return [h, data];
  };
  return Buffer.concat([header, ...chunk(0x4e4f534a, text), ...chunk(0x004e4942, newBin)]);
}

if (process.argv[1]?.endsWith("shrink-glb.mjs")) {
  const [input, output, max = "512"] = process.argv.slice(2);
  const out = await shrinkGlb(readFileSync(input), Number(max));
  writeFileSync(output, out);
  console.log(output, out.length);
}
