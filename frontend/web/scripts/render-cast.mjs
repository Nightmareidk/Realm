// biome-ignore-all lint/suspicious/noConsole: a CLI script; its progress output is the point.
// Prepares Realm's cast for the web from each character's source model.
//
// The characters are made in Meshy (image to 3D) and dropped into brand/models-incoming as
// <who>-source.glb (those files are large and not committed). For each one this:
//   1. renders it in Blender (scripts/blender/render_model.py, Cycles): the full figure and a
//      head-and-shoulders portrait, masters in brand/renders/cast/
//   2. writes public/art/cast/<who>.webp (the page art) and <who>-face.webp (avatars)
//   3. makes the live model, public/models/<who>.glb (scripts/blender/optimize_glb.py: fewer
//      triangles, smaller textures, Draco)
//   4. records each figure's size in src/features/landing/cast.json
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
const INCOMING = join(root, "brand", "models-incoming");
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

/** `face`: how much of the figure's height the portrait shows (monsters are mostly head). */
export const CAST = {
  "astro-teal": { face: 0.5 },
  "alien-zib": { face: 0.52 },
  "alien-nova": { face: 0.5 },
  "alien-meshy": { face: 0.52 },
  "monster-bruno": { face: 0.86 },
  "monster-gloop": { face: 0.8 },
  "human-maya": { face: 0.5 },
  "human-leo": { face: 0.5 },
};

const wanted = process.argv.slice(2);
const cast = wanted.length ? wanted : Object.keys(CAST);
for (const d of [MASTERS, ART, MODELS]) mkdirSync(d, { recursive: true });

const webp = (img, quality = 88) => img.webp({ quality, alphaQuality: 92, effort: 6 });
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

for (const who of cast) {
  const source = join(INCOMING, `${who}-source.glb`);
  if (!existsSync(source)) throw new Error(`missing ${source}`);
  console.log("render", who);
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
    String(CAST[who]?.face ?? 0.5),
  ]);
  const m = (name) => join(MASTERS, `${name}.png`);
  const trimmed = await sharp(m(who)).trim({ threshold: 1 }).toBuffer();
  const rest = await webp(sharp(trimmed).resize(640, 640, { fit: "inside" })).toFile(
    join(ART, `${who}.webp`),
  );
  await webp(sharp(m(`${who}-face`)).resize(256, 256), 86).toFile(join(ART, `${who}-face.webp`));

  console.log("model", who);
  blender("optimize_glb.py", [
    "--in",
    source,
    "--out",
    join(MODELS, `${who}.glb`),
    "--tris",
    "60000",
    "--tex",
    "1024",
    "--height",
    "2.75",
  ]);

  manifest[who] = { w: rest.width, h: rest.height };
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log("exported", who, manifest[who]);
}
