// biome-ignore-all lint/suspicious/noConsole: a CLI script; its output is the point.
// Makes the sky life behind the page (sky-life.tsx):
//
//   public/art/sky/cloud-*.webp  cumulus rendered in Blender (scripts/blender/render_clouds.py, into
//                                .cache/clouds), cropped and lifted a little brighter than the pale
//                                day sky they float on.
//   public/art/sky/hill.webp     the meadow the cast stands on at the end of the page, rendered
//                                blade by blade (scripts/blender/render_meadow.py, into
//                                .cache/meadow/hill.png).
//   public/art/sky/birds.webp    a gull in flight, eight frames of one wingbeat side by side, which
//                                CSS steps through: wings up, down through the stroke, and up again.
//
//   public/art/sky/{jet,rocket}.webp, {ufo,ufo-2,satellite}.webp
//                                the product owner's Meshy models, rendered by
//                                scripts/blender/render_props.py into .cache/props: stills, and
//                                turntables of 16 frames laid side by side.
//   public/art/sky/flame.webp    the rocket's fire, eight flickering frames.
//
//   blender -b --factory-startup --python scripts/blender/render_clouds.py -- //     --out .cache/clouds --count 5 --res 1000 --samples 128 --seed 11
//   (props, each: blender -b --factory-startup --python scripts/blender/render_props.py -- ...)
//     jet:       --in brand/models-incoming/sky-airplane-source.glb --name jet --elev -12 --azim 14 --res 480
//     rocket:    --in .../sky-rocket-rigged-source.glb --name rocket-up --azim 20 --elev 0 --res 640
//     saucers:   --in .../sky-ufo-source.glb --name ufo --frames 16 --elev 12 --res 240 --samples 32
//                --in .../sky-ufo-2-source.glb --name ufo2 (the same)
//     satellite: --in .../sky-satellite-source.glb --name satellite --frames 16 --elev 15 --res 240 --samples 32
//     (all with --out .cache/props)
//   public/art/sky/grass.webp    the same grass further down, a seamless tile, for the footer.
//   public/art/sky/moon.webp     the Moon the cast stands on by night (scripts/blender/render_moon.py,
//                                into .cache/moon/moon.png).
//
//   blender -b --factory-startup --python scripts/blender/render_meadow.py -- --out .cache/meadow/hill.png
//   blender -b --factory-startup --python scripts/blender/render_meadow.py -- --out .cache/meadow/tile.png --tile 25.6 --res 512
//   blender -b --factory-startup --python scripts/blender/render_moon.py -- --out .cache/moon/moon.png
//   node scripts/make-sky-sprites.mjs
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "art", "sky");
mkdirSync(out, { recursive: true });

// The clouds, if they've been rendered.
const renders = join(root, ".cache", "clouds");
if (existsSync(renders)) {
  for (const f of readdirSync(renders).filter((n) => n.endsWith(".png"))) {
    await sharp(join(renders, f))
      .trim({ threshold: 1 })
      .modulate({ brightness: 1.16, saturation: 0.85 })
      .gamma(2.2, 2.0)
      .webp({ quality: 84, alphaQuality: 88, effort: 6 })
      .toFile(join(out, f.replace(".png", ".webp")));
    console.log("wrote", f.replace(".png", ".webp"));
  }
}

// The meadow the cast stands on, if it's been rendered (scripts/blender/render_meadow.py).
// Its foot fades out over the last fifth, so where the footer carries it on down (globals.css) it
// melts into the tile of the same grass beneath it.
const hill = join(root, ".cache", "meadow", "hill.png");
if (existsSync(hill)) {
  const { width, height } = await sharp(hill).metadata();
  const fade = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0.8" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#f)"/></svg>`,
  );
  await sharp(hill)
    .composite([{ input: fade, blend: "dest-in" }])
    .webp({ quality: 74, alphaQuality: 90, effort: 6 })
    .toFile(join(out, "hill.webp"));
  console.log("wrote hill");
}
// The Moon the cast stands on by night (render_moon.py), its foot fading out the same way.
const moon = join(root, ".cache", "moon", "moon.png");
if (existsSync(moon)) {
  const { width, height } = await sharp(moon).metadata();
  const fade = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0.82" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#f)"/></svg>`,
  );
  await sharp(moon)
    .composite([{ input: fade, blend: "dest-in" }])
    .webp({ quality: 72, alphaQuality: 90, effort: 6 })
    .toFile(join(out, "moon.webp"));
  console.log("wrote moon");
}
// The same grass further down the slope, a seamless tile (render_meadow.py --tile 25.6).
const tile = join(root, ".cache", "meadow", "tile.png");
if (existsSync(tile)) {
  await sharp(tile).webp({ quality: 76, effort: 6 }).toFile(join(out, "grass.webp"));
  console.log("wrote grass");
}

// A gull, seen from below and a little behind: a small body and long crooked wings, the wrist
// lifting and the tip trailing as they beat. `beat` runs 0..1 through one wingbeat.
function gull(beat) {
  const phase = Math.cos(beat * Math.PI * 2);
  // Wrist and tip heights (up is negative): the tips lag the wrists a little.
  const wrist = -phase * 9;
  const tip = -Math.cos(beat * Math.PI * 2 - 0.9) * 13;
  const wing = (s) => {
    const x = (v) => (v * s).toFixed(2);
    return `M ${x(1.5)} -0.8 Q ${x(7)} ${(wrist - 3).toFixed(2)} ${x(13)} ${wrist.toFixed(2)} Q ${x(20)} ${(wrist + (tip - wrist) * 0.4 - 1.5).toFixed(2)} ${x(29)} ${tip.toFixed(2)} Q ${x(20)} ${(wrist + (tip - wrist) * 0.4 + 2.2).toFixed(2)} ${x(13)} ${(wrist + 2.6).toFixed(2)} Q ${x(7)} ${(wrist + 1.2).toFixed(2)} ${x(1.5)} 1.6 Z`;
  };
  return `<g fill="#26324d"><path d="${wing(1)}"/><path d="${wing(-1)}"/><ellipse cx="0" cy="0.6" rx="3.6" ry="2.1"/><path d="M -1.6 1.8 L 0 5.2 L 1.6 1.8 Z"/></g>`;
}
const FRAMES = 8;
const FW = 64;
const FH = 40;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FW * FRAMES * 2}" height="${FH * 2}" viewBox="0 0 ${FW * FRAMES} ${FH}">${Array.from(
  { length: FRAMES },
  (_, k) => `<g transform="translate(${k * FW + FW / 2} ${FH / 2})">${gull(k / FRAMES)}</g>`,
).join("")}</svg>`;
await sharp(Buffer.from(svg))
  .webp({ quality: 90, alphaQuality: 100, effort: 6 })
  .toFile(join(out, "birds.webp"));
console.log("wrote birds", `${FRAMES} frames`);

// ── The props: the product owner's Meshy models, rendered by scripts/blender/render_props.py ──

const props = join(root, ".cache", "props");
const webp = (s) => s.webp({ quality: 86, alphaQuality: 90, effort: 6 });

/** One still, cropped to the model and scaled to fit a box. */
async function still(name, file, box) {
  await webp(
    sharp(join(props, file))
      .trim({ threshold: 1 })
      .resize({ ...box, fit: "inside" }),
  ).toFile(join(out, `${name}.webp`));
  console.log("wrote", name);
}

/** A turntable: every frame cropped to the same box (the union of where the model reaches, so
 * it doesn't jump), scaled, and laid side by side for CSS to step through. */
async function strip(name, prefix, height) {
  const files = readdirSync(props)
    .filter((n) => n.startsWith(`${prefix}-`) && n.endsWith(".png"))
    .sort();
  let lo = [1e9, 1e9];
  let hi = [-1e9, -1e9];
  for (const f of files) {
    const { info } = await sharp(join(props, f))
      .trim({ threshold: 1 })
      .toBuffer({ resolveWithObject: true });
    const x = -info.trimOffsetLeft;
    const y = -info.trimOffsetTop;
    lo = [Math.min(lo[0], x), Math.min(lo[1], y)];
    hi = [Math.max(hi[0], x + info.width), Math.max(hi[1], y + info.height)];
  }
  const w0 = hi[0] - lo[0];
  const h0 = hi[1] - lo[1];
  const fw = Math.round((w0 * height) / h0);
  const frames = await Promise.all(
    files.map((f) =>
      sharp(join(props, f))
        .extract({ left: lo[0], top: lo[1], width: w0, height: h0 })
        .resize(fw, height)
        .toBuffer(),
    ),
  );
  await webp(
    sharp({
      create: { width: fw * files.length, height, channels: 4, background: "#0000" },
    }).composite(frames.map((input, k) => ({ input, left: k * fw, top: 0 }))),
  ).toFile(join(out, `${name}.webp`));
  console.log("wrote", name, `${files.length} frames of ${fw}x${height}`);
}

if (existsSync(props)) {
  await still("jet", "jet-00.png", { width: 320 });
  await still("rocket", "rocket-up-00.png", { height: 240 });
  await strip("ufo", "ufo", 96);
  await strip("ufo-2", "ufo2", 96);
  await strip("satellite", "satellite", 150);
}

// The rocket's fire, eight flickering frames of it, pointing down from the nozzles: a white-hot
// core inside a yellow flame inside an orange one, each a teardrop that stretches, narrows and
// sways a little from frame to frame (by a fixed seed, so it renders the same every time).
let seed = 7;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const FLAME = { w: 48, h: 128, frames: 8 };
function tongue(width, length, sway) {
  const w = width / 2;
  return `M ${-w} 0 C ${-w * 1.1} ${length * 0.32} ${-w * 0.35 + sway * 0.5} ${length * 0.74} ${sway} ${length} C ${w * 0.35 + sway * 0.5} ${length * 0.74} ${w * 1.1} ${length * 0.32} ${w} 0 Z`;
}
function flame() {
  const j = (k) => 1 + (rand() - 0.5) * k;
  const sway = (rand() - 0.5) * 6;
  const outer = tongue(30 * j(0.14), 112 * j(0.2), sway);
  const mid = tongue(22 * j(0.12), 78 * j(0.22), sway * 0.7);
  const core = tongue(12 * j(0.1), 40 * j(0.25), sway * 0.4);
  // Shock diamonds down the core: a hint of the bright knots in a real exhaust.
  const knots = [18, 31]
    .map(
      (y, k) =>
        `<ellipse cx="${(sway * 0.3).toFixed(2)}" cy="${(y * j(0.12)).toFixed(2)}" rx="${(3.2 - k).toFixed(2)}" ry="${(4.5 - k).toFixed(2)}" fill="#fffdf2" opacity="${(0.85 - k * 0.25).toFixed(2)}"/>`,
    )
    .join("");
  return `<ellipse cx="0" cy="6" rx="20" ry="10" fill="url(#glow)"/><path d="${outer}" fill="url(#outer)" filter="url(#soft)"/><path d="${mid}" fill="url(#mid)" filter="url(#softer)"/><path d="${core}" fill="#fff4d6"/>${knots}`;
}
const flameSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FLAME.w * FLAME.frames * 2}" height="${FLAME.h * 2}" viewBox="0 0 ${FLAME.w * FLAME.frames} ${FLAME.h}">
<defs>
  <linearGradient id="outer" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9c3a"/><stop offset="0.55" stop-color="#ff5a1e" stop-opacity="0.8"/><stop offset="1" stop-color="#e0301a" stop-opacity="0"/></linearGradient>
  <linearGradient id="mid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b0"/><stop offset="0.5" stop-color="#ffc44a"/><stop offset="1" stop-color="#ff8a2a" stop-opacity="0"/></linearGradient>
  <radialGradient id="glow"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.9"/><stop offset="1" stop-color="#ff7a2a" stop-opacity="0"/></radialGradient>
  <filter id="soft" x="-50%" y="-10%" width="200%" height="130%"><feGaussianBlur stdDeviation="2.4"/></filter>
  <filter id="softer" x="-50%" y="-10%" width="200%" height="130%"><feGaussianBlur stdDeviation="1.2"/></filter>
</defs>
${Array.from({ length: FLAME.frames }, (_, k) => `<g transform="translate(${k * FLAME.w + FLAME.w / 2} 2)">${flame()}</g>`).join("\n")}
</svg>`;
await sharp(Buffer.from(flameSvg))
  .webp({ quality: 88, alphaQuality: 95, effort: 6 })
  .toFile(join(out, "flame.webp"));
console.log("wrote flame", `${FLAME.frames} frames`);
