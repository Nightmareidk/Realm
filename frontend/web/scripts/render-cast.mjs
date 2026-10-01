// biome-ignore-all lint/suspicious/noConsole: a CLI script; its progress output is the point.
// Prepares Realm's cast for the web from each character's source model, with a real wave.
//
// The characters are made in Meshy (image to 3D), each standing with one hand up, and dropped into
// brand/models-incoming as <who>-source.glb (large, not committed). For each one this:
//   1. rigs the raised arm and bakes a wave (scripts/blender/rig_wave.py): shoulder, elbow, wrist
//      and hand bones on the joints below, weighted only around the arm with crisp joints; the
//      forearm swings from the elbow, hand firm. It writes the live model,
//      public/models/<who>.<hash>.glb (skinned, with its "Wave" animation, Draco, WebP textures; the
//      hash changes with every re-rig so nothing keeps playing an old one), and renders the wave's 41 frames
//      in Blender (Cycles).
//      A character with joints for its whole body (scripts/blender/joints/<who>.json) is then
//      rigged head to toe instead for the live model (scripts/blender/rig_body.py): it floats,
//      swims, flails and tumbles as well as waving. The frames stay the arm-only render.
//      One the product owner has rigged in Meshy (<who>-rigged-source.glb, with its bones named
//      in scripts/blender/joints/<who>-rig.json) keeps Meshy's skeleton and weights instead.
//   2. packs those frames for the page: public/art/cast/<who>.webp is the pose with the arm's area
//      cut out, and <who>-wave.webp is that area in every frame side by side, which CSS steps
//      through (the page never moves the whole body). The pose's master goes to brand/renders/cast.
//   3. renders a portrait (scripts/blender/render_model.py) for the avatars: <who>-face.webp.
//   4. records the sizes and the arm's area in src/features/landing/cast.json.
//
//   node scripts/render-cast.mjs                   # everyone
//   node scripts/render-cast.mjs alien-zib         # one
//   node scripts/render-cast.mjs --pack            # re-pack the kept frames, no Blender
//
// The frames are kept in .cache/cast-frames/<who> (not committed) so a re-pack is quick.
//
// Joints are (x, z) on the model stood 2.75 high with its feet at z 0, read off a front view.
// Env: BLENDER (defaults to the portable install under %LOCALAPPDATA%\Programs\Blender).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { shrinkGlb } from "./shrink-glb.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const INCOMING = join(root, "brand", "models-incoming");
const MASTERS = join(root, "brand", "renders", "cast");
const ART = join(root, "public", "art", "cast");
const MODELS = join(root, "public", "models");
const MANIFEST = join(root, "src", "features", "landing", "cast.json");
const FRAMES = join(root, ".cache", "cast-frames");
const BLENDER =
  process.env.BLENDER ??
  join(
    process.env.LOCALAPPDATA ?? "",
    "Programs",
    "Blender",
    "blender-5.2.1-windows-x64",
    "blender.exe",
  );

/**
 * Per character: the raised arm's joints, the arm's thickness (`radius`), a `guard` x the hand's
 * weights may not cross toward the body (keeps a nearby head or ear still), how big the wave is
 * (`swing`), and how much of the figure the portrait shows (`face`; monsters are mostly head).
 */
export const CAST = {
  "astro-teal": {
    shoulder: "0.32,1.57",
    elbow: "0.42,1.33",
    wrist: "0.62,1.68",
    tip: "0.73,2.05",
    radius: 0.15,
    guard: 0.45,
    face: 0.5,
  },
  "alien-zib": {
    shoulder: "0.25,1.33",
    elbow: "0.47,1.05",
    wrist: "0.55,1.42",
    tip: "0.64,1.70",
    radius: 0.14,
    guard: 0.4,
    face: 0.52,
  },
  "alien-nova": {
    shoulder: "0.15,1.43",
    elbow: "0.35,1.28",
    wrist: "0.40,1.52",
    tip: "0.47,1.85",
    radius: 0.11,
    guard: 0.3,
    face: 0.5,
  },
  "alien-meshy": {
    shoulder: "-0.28,1.40",
    elbow: "-0.47,1.22",
    wrist: "-0.52,1.42",
    tip: "-0.62,1.70",
    radius: 0.13,
    guard: -0.4,
    face: 0.52,
  },
  "monster-bruno": {
    shoulder: "0.68,1.50",
    elbow: "0.88,1.25",
    wrist: "1.02,1.62",
    tip: "1.12,1.95",
    radius: 0.2,
    guard: 0.72,
    swing: 1.15,
    face: 0.86,
  },
  "monster-gloop": {
    shoulder: "0.52,1.35",
    elbow: "0.80,1.27",
    wrist: "1.03,1.62",
    tip: "1.07,2.00",
    radius: 0.18,
    guard: 0.62,
    swing: 1.2,
    face: 0.8,
  },
  "human-maya": {
    shoulder: "0.27,1.67",
    elbow: "0.53,1.37",
    wrist: "0.53,1.63",
    tip: "0.62,1.93",
    radius: 0.14,
    guard: 0.4,
    face: 0.5,
  },
  "human-leo": {
    shoulder: "0.30,1.53",
    elbow: "0.48,1.22",
    wrist: "0.48,1.48",
    tip: "0.53,1.73",
    radius: 0.13,
    guard: 0.38,
    face: 0.5,
  },
};

const args = process.argv.slice(2);
const packOnly = args.includes("--pack");
const wanted = args.filter((a) => !a.startsWith("--"));
const cast = wanted.length ? wanted : Object.keys(CAST);
for (const d of [MASTERS, ART, MODELS]) mkdirSync(d, { recursive: true });

const blender = (script, args) =>
  execFileSync(
    BLENDER,
    [
      "-b",
      "--factory-startup",
      "--python",
      join(root, "scripts", "blender", script),
      "--",
      ...args,
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};

/**
 * Writes page art under a name that carries a hash of its content (`astro-teal.1a2b3c4d.webp`), so a
 * re-render is always a new address: no image cache (the browser's, or Next's optimizer, which keeps
 * resized images for hours) can pair an old pose with a new wave.
 */
function publish(buf, name) {
  const file = `${name}.${createHash("sha1").update(buf).digest("hex").slice(0, 8)}.webp`;
  writeFileSync(join(ART, file), buf);
  return file;
}

/**
 * Publishes the rigged model from the frames folder as public/models/<who>.<hash>.glb (a new address
 * whenever it changes, so no browser or hot reload keeps an old rig) and removes older copies.
 */
async function publishModel(who, frames) {
  const src = join(frames, "model.glb");
  // Textures no bigger than the cast is ever drawn (see shrink-glb.mjs).
  const buf = await shrinkGlb(readFileSync(src), 512);
  const file = `${who}.${createHash("sha1").update(buf).digest("hex").slice(0, 8)}.glb`;
  writeFileSync(join(MODELS, file), buf);
  const mine = new RegExp(`^${who}(\\.[0-9a-f]{8})?\\.glb$`);
  for (const f of readdirSync(MODELS)) {
    if (mine.test(f) && f !== file) unlinkSync(join(MODELS, f));
  }
  return file;
}

/** Removes a character's previous art, keeping only the files just published. */
function prune(who, keep) {
  const mine = new RegExp(`^${who}(-wave|-face)?(\\.[0-9a-f]{8})?\\.webp$`);
  for (const f of readdirSync(ART)) {
    if (mine.test(f) && !keep.includes(f)) unlinkSync(join(ART, f));
  }
}

/** Pack the wave frames: the pose with the arm's area cut out, and that area in every frame. */
/** How tall each frame of a wave strip is: the arm is shown at most ~45 px tall, 3x on a phone. */
const STRIP_H = 136;

async function pack(who, dir) {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".png"))
    .sort();
  const frames = await Promise.all(
    files.map((f) => sharp(join(dir, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })),
  );
  const { width: W, height: H } = frames[0].info;
  const px = (x, y) => (y * W + x) * 4;
  // The figure's box over every frame; the arm's area comes from the rig (the screen area its
  // moving vertices cover over the whole wave), so reflections of the arm elsewhere don't count.
  const fig = { x0: W, y0: H, x1: 0, y1: 0 };
  const base = frames[0].data;
  for (const { data } of frames) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (data[px(x, y) + 3] > 2) {
          if (x < fig.x0) fig.x0 = x;
          if (x > fig.x1) fig.x1 = x;
          if (y < fig.y0) fig.y0 = y;
          if (y > fig.y1) fig.y1 = y;
        }
      }
    }
  }
  const [bx0, by0, bx1, by1] = JSON.parse(readFileSync(join(dir, "arm.json"), "utf8")).box;
  const pad = Math.round(W * 0.025);
  const T = { left: fig.x0, top: fig.y0, width: fig.x1 - fig.x0 + 1, height: fig.y1 - fig.y0 + 1 };
  const A = {
    left: Math.max(T.left, Math.floor(bx0 * W) - pad),
    top: Math.max(T.top, Math.floor(by0 * H) - pad),
  };
  A.width = Math.min(T.left + T.width, Math.ceil(bx1 * W) + pad) - A.left;
  A.height = Math.min(T.top + T.height, Math.ceil(by1 * H) + pad) - A.top;

  // The pose, trimmed, with only what the arm sweeps through cleared: every pixel of the arm's area
  // that changes in any frame, grown by a few pixels for soft edges. The strip fills those in frame
  // by frame; everywhere else the pose and the strip show the same pixels, so their edges can't
  // show a seam when the browser scales both.
  const moved = new Uint8Array(W * H);
  for (const { data } of frames) {
    for (let y = A.top; y < A.top + A.height; y++) {
      for (let x = A.left; x < A.left + A.width; x++) {
        const i = px(x, y);
        let d = 0;
        for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(data[i + c] - base[i + c]));
        if (d > 12) moved[y * W + x] = 1;
      }
    }
  }
  const grow = 4;
  const cut = Buffer.from(base);
  for (let y = A.top; y < A.top + A.height; y++) {
    for (let x = A.left; x < A.left + A.width; x++) {
      let near = false;
      for (let dy = -grow; dy <= grow && !near; dy++) {
        for (let dx = -grow; dx <= grow; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy >= 0 && yy < H && xx >= 0 && xx < W && moved[yy * W + xx]) {
            near = true;
            break;
          }
        }
      }
      if (near) cut[px(x, y) + 3] = 0;
    }
  }
  const raw = { raw: { width: W, height: H, channels: 4 } };
  await sharp(base, raw)
    .extract(T)
    .png()
    .toFile(join(MASTERS, `${who}.png`));
  const pose = publish(
    await sharp(cut, raw).extract(T).webp({ quality: 88, alphaQuality: 92, effort: 6 }).toBuffer(),
    who,
  );

  // The arm's area in every frame, side by side, scaled down to the size it's shown at: the arm is
  // drawn at most about 45 px tall, so a frame STRIP_H tall is sharp even on a 3x phone screen. (At
  // the renders' full size the strips were over 9000 px wide and took about 8 MB of memory each
  // once decoded, 14 of them on the page.) Each tile carries a few more pixels of its own frame on
  // either side, so when the browser scales the strip, the pixels it blends in at a tile's edge are
  // that frame's real neighbours (never the next frame, and never a transparent gap, which would
  // draw a faint line).
  const k = Math.min(1, STRIP_H / A.height);
  const edge = Math.ceil(3 / k);
  const pitch = A.width + edge * 2;
  const tileW = Math.round(pitch * k);
  const tileH = Math.round(A.height * k);
  const tiles = await Promise.all(
    frames.map(({ data }) =>
      sharp(data, raw)
        .extract({ left: A.left - edge, top: A.top, width: pitch, height: A.height })
        .resize(tileW, tileH, { fit: "fill" })
        .png()
        .toBuffer(),
    ),
  );
  const wave = publish(
    await sharp({
      create: {
        width: tileW * tiles.length,
        height: tileH,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(tiles.map((input, i) => ({ input, left: i * tileW, top: 0 })))
      .webp({ quality: 88, alphaQuality: 92, effort: 6 })
      .toBuffer(),
    `${who}-wave`,
  );
  // The arm's area as it lands in a scaled tile, for the ratios below.
  const area = A.width * k;

  const pct = (v, of) => Math.round((v / of) * 10000) / 100;
  return {
    w: T.width,
    h: T.height,
    pose,
    wave,
    arm: {
      x: pct(A.left - T.left, T.width),
      y: pct(A.top - T.top, T.height),
      w: pct(A.width, T.width),
      h: pct(A.height, T.height),
      n: tiles.length,
      // The strip's width in arm-areas, and how far each tile's margin reaches past the area.
      span: Math.round(((tileW * tiles.length) / area) * 10000) / 10000,
      pad: Math.round(((tileW - area) / 2 / area) * 100000) / 100000,
    },
  };
}

/** The avatar: the portrait master, small, under a hashed name. */
async function portrait(who) {
  const buf = await sharp(join(MASTERS, `${who}-face.png`))
    .resize(256, 256)
    .webp({ quality: 86, alphaQuality: 92, effort: 6 })
    .toBuffer();
  return publish(buf, `${who}-face`);
}

for (const who of cast) {
  const c = CAST[who];
  const source = join(INCOMING, `${who}-source.glb`);
  if (!c) throw new Error(`no joints for ${who}`);
  if (!existsSync(source)) throw new Error(`missing ${source}`);
  const frames = join(FRAMES, who);
  if (packOnly) {
    // A model from before models were kept with the frames: adopt it.
    const legacy = join(MODELS, `${who}.glb`);
    if (!existsSync(join(frames, "model.glb")) && existsSync(legacy)) {
      writeFileSync(join(frames, "model.glb"), readFileSync(legacy));
    }
    const art = await pack(who, frames);
    const face = await portrait(who);
    prune(who, [art.pose, art.wave, face]);
    manifest[who] = { ...art, face, model: await publishModel(who, frames) };
    writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log("repacked", who, JSON.stringify(manifest[who]));
    continue;
  }
  // Empty the folder rather than delete it: Windows won't remove a folder something has open.
  mkdirSync(frames, { recursive: true });
  for (const f of readdirSync(frames)) rmSync(join(frames, f), { force: true });
  console.log("rig", who);
  blender("rig_wave.py", [
    "--in",
    source,
    "--glb",
    join(frames, "model.glb"),
    "--frames",
    frames,
    // "=" so a negative value (an arm on the left) isn't read as an option.
    `--shoulder=${c.shoulder}`,
    `--elbow=${c.elbow}`,
    `--wrist=${c.wrist}`,
    `--tip=${c.tip}`,
    `--radius=${c.radius}`,
    `--guard=${c.guard}`,
    "--swing",
    String(c.swing ?? 1),
    "--res",
    "760",
    "--samples",
    "64",
  ]);
  const joints = join(root, "scripts", "blender", "joints", `${who}.json`);
  const rigged = join(INCOMING, `${who}-rigged-source.glb`);
  const bones = join(root, "scripts", "blender", "joints", `${who}-rig.json`);
  if (existsSync(rigged) && existsSync(bones)) {
    console.log("rig body (Meshy's rig)", who);
    blender("rig_body.py", ["--in", rigged, "--bones", bones, "--out", join(frames, "model.glb")]);
  } else if (existsSync(joints)) {
    console.log("rig body", who);
    blender("rig_body.py", [
      "--in",
      source,
      "--joints",
      joints,
      "--out",
      join(frames, "model.glb"),
    ]);
  }
  console.log("pack", who);
  const art = await pack(who, frames);

  console.log("portrait", who);
  blender("render_model.py", [
    "--in",
    source,
    "--out",
    MASTERS,
    "--name",
    who,
    "--res",
    "1000",
    "--samples",
    "160",
    "--face",
    String(c.face),
    "--face-only",
  ]);
  const face = await portrait(who);
  prune(who, [art.pose, art.wave, face]);

  manifest[who] = { ...art, face, model: await publishModel(who, frames) };
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log("exported", who, JSON.stringify(art));
}
