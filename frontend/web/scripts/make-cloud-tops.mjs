// biome-ignore-all lint/suspicious/noConsole: a CLI script; its output is the point.
// Makes the day hero's cloud sea: public/art/cloud-tops.webp, a seamless height map of cumulus
// tops seen from above (white is high). The sky shader (src/features/landing/three/sky.tsx) lays
// it over the world below the dawn, lights it with the low sun and streams it toward the camera.
//
// Heaps are clusters of round domes at three sizes, the smaller riding on the larger, gathered into fields with
// gaps between them by a slow noise; fine texture on top; a thin lower deck shows in the gaps.
// Every noise here wraps around the tile, so it repeats without a seam.
//
//   node scripts/make-cloud-tops.mjs [size]
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const N = Number(process.argv[2] ?? 1024);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "art", "cloud-tops.webp");

// A hash of integer coordinates, 0..1.
function hash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const wrap = (i, p) => ((i % p) + p) % p;
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

// Value noise with a period of `p` cells across the tile (u, v in 0..1).
function vnoise(u, v, p, seed) {
  const x = u * p;
  const y = v * p;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = fade(x - ix);
  const fy = fade(y - iy);
  const a = hash(wrap(ix, p), wrap(iy, p), seed);
  const b = hash(wrap(ix + 1, p), wrap(iy, p), seed);
  const c = hash(wrap(ix, p), wrap(iy + 1, p), seed);
  const d = hash(wrap(ix + 1, p), wrap(iy + 1, p), seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function fbm(u, v, p, octaves, seed) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * vnoise(u, v, p << i, seed + i * 17);
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}
// Round domes, one per cell at a jittered point with its own size and height, joined with a soft
// maximum (so where two meet there's a crease, as between the heads of a cumulus), period `p`.
function domes(u, v, p, seed) {
  const x = u * p;
  const y = v * p;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let sum = 0;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const cx = ix + dx;
      const cy = iy + dy;
      const wx = wrap(cx, p);
      const wy = wrap(cy, p);
      const px = cx + hash(wx, wy, seed);
      const py = cy + hash(wx, wy, seed + 101);
      const r = 0.55 + 0.5 * hash(wx, wy, seed + 202);
      const a = 0.55 + 0.45 * hash(wx, wy, seed + 303);
      const d2 = ((px - x) ** 2 + (py - y) ** 2) / (r * r);
      sum += Math.exp(9 * a * Math.exp(-d2));
    }
  }
  return Math.log(sum / 25) / 9;
}
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const h = new Float32Array(N * N);
let lo = Infinity;
let hi = -Infinity;
for (let j = 0; j < N; j++) {
  const v = j / N;
  for (let i = 0; i < N; i++) {
    const u = i / N;
    // Where the heaps gather, and a gentle warp so puffs don't sit on a grid.
    const cover = fbm(u, v, 3, 4, 7);
    const field = smoothstep(0.4, 0.62, cover);
    const wu = u + (fbm(u, v, 6, 3, 31) - 0.5) * 0.04;
    const wv = v + (fbm(u, v, 6, 3, 57) - 0.5) * 0.04;
    // Big heads, with smaller ones riding on them, and smaller still on those.
    const big = domes(wu, wv, 7, 3);
    const mid = domes(wu, wv, 16, 5);
    const small = domes(wu, wv, 38, 9);
    const heads = 0.6 * big + 0.28 * mid * (0.35 + 0.65 * big) + 0.12 * small * (0.3 + 0.7 * big);
    const detail = fbm(u, v, 64, 2, 91) - 0.5;
    const deck = 0.1 * fbm(u, v, 12, 3, 77);
    const top = field ** 0.8 * heads * (0.8 + 0.4 * cover) + detail * 0.03 * field;
    const value = Math.max(top, deck);
    h[j * N + i] = value;
    if (value < lo) lo = value;
    if (value > hi) hi = value;
  }
}
const px = Buffer.alloc(N * N);
for (let k = 0; k < N * N; k++) {
  // Normalised, with a whisper of noise so the 8 bits don't band in the lighting.
  const n = (h[k] - lo) / (hi - lo);
  px[k] = Math.max(0, Math.min(255, Math.round(n * 255 + (hash(k, 0, 5) - 0.5))));
}
await sharp(px, { raw: { width: N, height: N, channels: 1 } })
  .webp({ quality: 92, effort: 6 })
  .toFile(out);
console.log("wrote", out, `${N}x${N}`);
