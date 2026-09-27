// biome-ignore-all lint/suspicious/noConsole: a CLI script; its progress output is the point.
// Plates for the day hero's sun, made from the day film's poster frame (its camera never moves, so
// they fit every frame):
//
//   public/video/day-sun-mask.webp  the foreground mask: white where there's sky or planet, clear
//                                   where rocks and coral stand in front, so the sun sets behind them
//   public/video/day-sky-patch.webp the sky where the film's red planet was, painted over it, so the
//                                   sun can stand in the sky instead (placed at PATCH, in % of the film)
//
//   node scripts/video/day-sun-plates.mjs
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(fileURLToPath(import.meta.url), "..", "..", "..");
const POSTER = join(root, "public", "video", "day-sun.jpg");
const OUT = join(root, "public", "video", "day-sun-mask.webp");
const PATCH_OUT = join(root, "public", "video", "day-sky-patch.webp");

// The planet in the poster, as fractions of the frame's width (x, r) and height (y).
export const PLANET = { x: 0.8356, y: 0.2877, r: 0.1638 };

const { data, info } = await sharp(POSTER).raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
const cx = PLANET.x * W;
const cy = PLANET.y * H;
const R = PLANET.r * W;

// 1. Candidate background: dark blue sky, and the planet with its atmosphere.
const cand = new Uint8Array(W * H);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * C;
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const d = Math.hypot(x - cx, y - cy);
    let bg;
    if (y > H * 0.78) bg = false;
    // The planet's upper half: nothing stands in front of it.
    else if (d < R * 1.12 && y < H * 0.4) bg = true;
    // Its lower half: the planet is warm (red over green); the rocks in front are cool.
    else if (d < R + 2) bg = r > g + 2;
    // Right of the planet, shadowed gaps between the rocks are not sky.
    else if (x > W * 0.8 && y > H * 0.5) bg = false;
    // Its atmosphere's glow, unless it's clearly a lit rock.
    else if (d < R * 1.1) bg = !(g > r + 12 && lum > 85);
    // Everywhere else: dark blue sky.
    else bg = lum < 62 && b > r;
    cand[y * W + x] = bg ? 1 : 0;
  }
}

// 2. Keep only background connected to the top edge, dropping dark specks in the foreground.
const keep = new Uint8Array(W * H);
const queue = new Int32Array(W * H);
let head = 0;
let tail = 0;
for (let x = 0; x < W; x++) {
  if (cand[x]) {
    keep[x] = 1;
    queue[tail++] = x;
  }
}
while (head < tail) {
  const p = queue[head++];
  const x = p % W;
  const y = (p - x) / W;
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    const n = ny * W + nx;
    if (cand[n] && !keep[n]) {
      keep[n] = 1;
      queue[tail++] = n;
    }
  }
}

// 3. Soften the edge a touch and store it small, as the alpha of a white image (a CSS mask).
const gray = Buffer.from(keep.map((k) => (k ? 255 : 0)));
const m = await sharp(gray, { raw: { width: W, height: H, channels: 1 } })
  .median(5)
  .blur(1.2)
  .resize(800)
  .extractChannel(0)
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width: mw, height: mh, channels: mc } = m.info;
const rgba = Buffer.alloc(mw * mh * 4, 255);
for (let i = 0; i < mw * mh; i++) rgba[i * 4 + 3] = m.data[i * mc];
await sharp(rgba, { raw: { width: mw, height: mh, channels: 4 } })
  .webp({ lossless: true })
  .toFile(OUT);
console.log("mask", mw, "x", mh, "->", OUT);

// 4. The sky patch: each row takes the sky's colour just left of the planet (continuing its trend
// toward the horizon below where rocks begin), with a little grain like the film's and a few stars,
// over the planet and its haze, feathered at the edge.
const HALO = 1.26;
const px0 = Math.floor(cx - R * HALO);
const py1 = Math.min(H, Math.ceil(cy + R * HALO));
const pw = W - px0;
const ph = py1;
const rows = [];
for (let y = 0; y < ph; y++) {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let x = Math.floor(W * 0.45); x < W * 0.64; x++) {
    if (!keep[y * W + x] || Math.hypot(x - cx, y - cy) < R * 1.15) continue;
    const i = (y * W + x) * C;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  rows.push(n > 40 ? [r / n, g / n, b / n] : null);
}
// Below the last row of open sky, carry on the gradient's slope.
const lastSky = rows.findLastIndex((c) => c);
const slope = rows[lastSky].map((v, k) => (v - rows[lastSky - 40][k]) / 40);
for (let y = lastSky + 1; y < ph; y++) {
  rows[y] = rows[lastSky].map((v, k) => Math.min(255, v + slope[k] * (y - lastSky)));
}
for (let y = 0; y < lastSky; y++) rows[y] ??= rows[y + 1] ?? rows[lastSky];

let seed = 7;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const stars = Array.from({ length: 14 }, () => ({
  x: px0 + rand() * pw,
  y: rand() * ph * 0.85,
  r: 0.6 + rand() * 0.8,
  a: 0.45 + rand() * 0.5,
}));
const patch = Buffer.alloc(pw * ph * 4);
for (let y = 0; y < ph; y++) {
  for (let x = 0; x < pw; x++) {
    const X = px0 + x;
    const d = Math.hypot(X - cx, y - cy) / R;
    const alpha = Math.min(1, Math.max(0, (HALO - d) / 0.14)) ** 1.5;
    let [r, g, b] = rows[y];
    for (const s of stars) {
      const k = Math.exp(-((X - s.x) ** 2 + (y - s.y) ** 2) / (s.r * s.r)) * s.a;
      r += (235 - r) * k;
      g += (242 - g) * k;
      b += (255 - b) * k;
    }
    const grain = (rand() - 0.5) * 3;
    const o = (y * pw + x) * 4;
    patch[o] = Math.max(0, Math.min(255, r + grain));
    patch[o + 1] = Math.max(0, Math.min(255, g + grain));
    patch[o + 2] = Math.max(0, Math.min(255, b + grain));
    patch[o + 3] = Math.round(alpha * 255);
  }
}
await sharp(patch, { raw: { width: pw, height: ph, channels: 4 } })
  .resize(Math.round(pw * 0.5))
  .webp({ quality: 82, alphaQuality: 90 })
  .toFile(PATCH_OUT);
const pct = (v) => Math.round(v * 10000) / 100;
console.log("patch ->", PATCH_OUT, {
  left: `${pct(px0 / W)}%`,
  top: "0%",
  width: `${pct(pw / W)}%`,
  height: `${pct(ph / H)}%`,
});
