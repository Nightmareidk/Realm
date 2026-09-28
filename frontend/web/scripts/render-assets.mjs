// biome-ignore-all lint/suspicious/noConsole: a CLI script; its progress output is the point.
// Renders Realm's 3D assets to transparent WebP files in public/art.
//
// Every asset is a React Three Fiber scene on the dev-only /render-3d route
// (src/app/render-3d/stage.tsx). This script opens each one in headless Chrome, screenshots it
// with a transparent background into brand/renders/<name>.png (the lossless master), and
// exports the web version to public/art/<name>.webp.
//
//   pnpm --filter @realm/web dev                          # in one terminal
//   node scripts/render-assets.mjs                        # everything
//   node scripts/render-assets.mjs heart planet-feed      # just these
//
// Env: CHROME_PATH (defaults to the usual Windows install), RENDER_URL (default localhost:3000).
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MASTERS = join(root, "brand", "renders");
const OUT = join(root, "public", "art");
const BASE = process.env.RENDER_URL ?? "http://localhost:3000";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

// The page uses one prop render (the privacy lock); the other props stay on the stage for reuse.
const PROPS = ["lock"];
const PLANETS = ["planet-spaces", "planet-feed", "planet-profiles", "planet-boards"];
// The cast (explorers, aliens, monsters, humans) is rendered in Blender: scripts/render-cast.mjs.
const ALL = [...PROPS, ...PLANETS, "hero-poster-night", "hero-poster-day"];

const wanted = process.argv.slice(2);
const items = wanted.length ? wanted : ALL;

mkdirSync(MASTERS, { recursive: true });
mkdirSync(OUT, { recursive: true });

// 1. Render masters. SwiftShader keeps output identical on machines without a GPU.
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 960, deviceScaleFactor: 1 });
for (const item of items) {
  await page.goto(`${BASE}/render-3d?item=${item}`, {
    waitUntil: "networkidle0",
    timeout: 120_000,
  });
  await page.waitForSelector("#stage canvas");
  // The hero poster's crew compiles its shaders in the background before appearing: allow for it.
  await new Promise((r) => setTimeout(r, item.startsWith("hero-poster") ? 7000 : 2500));
  const stage = await page.$("#stage");
  await stage.screenshot({ path: join(MASTERS, `${item}.png`), omitBackground: true });
  console.log("rendered", item);
}
await browser.close();

// 2. Export for the web.
const webp = (img, quality = 86) => img.webp({ quality, alphaQuality: 90, effort: 6 });
const master = (name) => join(MASTERS, `${name}.png`);
const target = (name) => join(OUT, `${name}.webp`);

for (const item of items) {
  if (item.startsWith("hero-poster")) {
    // The hero's loading poster: full frame, no trim, same aspect as the scene's box.
    await webp(sharp(master(item)), 80).toFile(target(item));
  } else if (item.startsWith("planet-")) {
    // Fixed framing, no trim: star-chart-map.tsx sizes these by the sphere's share of the frame.
    await webp(sharp(master(item)).resize(256, 256)).toFile(target(item));
  } else {
    const trimmed = await sharp(master(item)).trim({ threshold: 1 }).toBuffer();
    await webp(sharp(trimmed).resize(480, 480, { fit: "inside" })).toFile(target(item));
  }
  console.log("exported", item);
}
