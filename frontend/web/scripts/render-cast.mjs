// biome-ignore-all lint/suspicious/noConsole: a CLI script; its progress output is the point.
// Renders Realm's cast in Blender and exports it for the web.
//
// Each character is modelled and rendered by scripts/blender/cast.py (Cycles, GPU when present):
// standing, waving body, waving forearm and a portrait, plus a light GLB for the live 3D hero.
// This script then writes:
//   public/art/cast/<who>.webp                      standing
//   public/art/cast/<who>-body.webp, -forearm.webp  the wave layers, one shared crop
//   public/art/cast/<who>-face.webp                 portrait (avatars)
//   public/models/<who>.glb                         live model
//   src/features/landing/cast.json                  sizes and the elbow pivot per character
//
//   node scripts/render-cast.mjs                   # everyone
//   node scripts/render-cast.mjs alien-zib         # one
//
// Env: BLENDER (defaults to the portable install under %LOCALAPPDATA%\Programs\Blender).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MASTERS = join(root, "brand", "renders", "cast");
const ART = join(root, "public", "art", "cast");
const MODELS = join(root, "public", "models");
const MANIFEST = join(root, "src", "features", "landing", "cast.json");
const BLENDER =
  process.env.BLENDER ??
  join(
    process.env.LOCALAPPDATA ?? "",
    "Programs",
    "Blender",
    "blender-5.2.1-windows-x64",
    "blender.exe",
  );

export const CAST = [
  "astro-teal",
  "astro-violet",
  "alien-zib",
  "alien-nova",
  "monster-gloop",
  "monster-bruno",
  "human-maya",
  "human-leo",
];

const wanted = process.argv.slice(2);
const cast = wanted.length ? wanted : CAST;
for (const d of [MASTERS, ART, MODELS]) mkdirSync(d, { recursive: true });

const webp = (img, quality = 88) => img.webp({ quality, alphaQuality: 92, effort: 6 });
const bounds = async (file) => {
  const { info } = await sharp(file).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
  const left = -info.trimOffsetLeft;
  const top = -info.trimOffsetTop;
  return { left, top, right: left + info.width, bottom: top + info.height };
};

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};

for (const who of cast) {
  console.log("blender", who);
  execFileSync(
    BLENDER,
    [
      "-b",
      "--factory-startup",
      "--python",
      join(root, "scripts", "blender", "cast.py"),
      "--",
      "--out",
      MASTERS,
      "--who",
      who,
      "--res",
      "1000",
      "--samples",
      "192",
      "--glb",
      join(MODELS, `${who}.glb`),
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  const info = JSON.parse(readFileSync(join(MASTERS, `${who}.json`), "utf8"));
  const m = (name) => join(MASTERS, `${name}.png`);
  const out = (name) => join(ART, `${name}.webp`);

  const trimmed = await sharp(m(who)).trim({ threshold: 1 }).toBuffer();
  const rest = await webp(sharp(trimmed).resize(560, 560, { fit: "inside" })).toFile(out(who));

  const [a, b] = await Promise.all([bounds(m(`${who}-body`)), bounds(m(`${who}-forearm`))]);
  const box = { left: Math.min(a.left, b.left), top: Math.min(a.top, b.top) };
  box.width = Math.max(a.right, b.right) - box.left;
  box.height = Math.max(a.bottom, b.bottom) - box.top;
  let size = { w: 0, h: 0 };
  for (const layer of ["body", "forearm"]) {
    const img = sharp(m(`${who}-${layer}`))
      .extract(box)
      .resize(560, 560, { fit: "inside" });
    const r = await webp(img).toFile(out(`${who}-${layer}`));
    size = { w: r.width, h: r.height };
  }
  const px = info.elbow.x * info.res;
  const py = info.elbow.y * info.res;
  await webp(sharp(m(`${who}-face`)).resize(256, 256), 86).toFile(out(`${who}-face`));

  manifest[who] = {
    rest: { w: rest.width, h: rest.height },
    wave: {
      w: size.w,
      h: size.h,
      x: Math.round(((px - box.left) / box.width) * 1000) / 10,
      y: Math.round(((py - box.top) / box.height) * 1000) / 10,
    },
  };
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log("exported", who, manifest[who]);
}
