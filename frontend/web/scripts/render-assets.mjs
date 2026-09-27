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
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MASTERS = join(root, "brand", "renders");
const OUT = join(root, "public", "art");
const PIVOTS = join(root, "src", "features", "landing", "explorer-pivots.json");
const BASE = process.env.RENDER_URL ?? "http://localhost:3000";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

const TONES = ["teal", "blue", "violet", "pink"];
// The page uses one prop render (the privacy lock); the other props stay on the stage for reuse.
const PROPS = ["lock"];
const PLANETS = ["planet-spaces", "planet-feed", "planet-profiles", "planet-boards"];
const EXPLORERS = TONES.flatMap((t) => [`astro-${t}`, `astro-${t}-body`, `astro-${t}-forearm`]);
const ALL = [...EXPLORERS, ...PROPS, ...PLANETS, "hero-poster-night", "hero-poster-day"];

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
// Where each waving explorer's elbow lands in its master render (canvas pixels).
const elbows = {};
for (const item of items) {
  await page.goto(`${BASE}/render-3d?item=${item}`, {
    waitUntil: "networkidle0",
    timeout: 120_000,
  });
  await page.waitForSelector("#stage canvas");
  await new Promise((r) => setTimeout(r, 2500));
  const stage = await page.$("#stage");
  await stage.screenshot({ path: join(MASTERS, `${item}.png`), omitBackground: true });
  if (item.endsWith("-body")) {
    elbows[item.replace(/^astro-|-body$/g, "")] = await page.evaluate(() => window.__pivot);
  }
  console.log("rendered", item);
}
await browser.close();

// 2. Export for the web.
const webp = (img, quality = 86) => img.webp({ quality, alphaQuality: 90, effort: 6 });
const bounds = async (file) => {
  const { info } = await sharp(file).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
  const left = -info.trimOffsetLeft;
  const top = -info.trimOffsetTop;
  return { left, top, right: left + info.width, bottom: top + info.height };
};
const master = (name) => join(MASTERS, `${name}.png`);
const target = (name) => join(OUT, `${name}.webp`);
const readPivots = () => JSON.parse(readFileSync(PIVOTS, "utf8"));
const writePivots = (p) => writeFileSync(PIVOTS, `${JSON.stringify(p, null, 2)}\n`);
const done = new Set();

for (const item of items) {
  if (done.has(item)) continue;

  if (item.startsWith("hero-poster")) {
    // The hero's loading poster: full frame, no trim, same aspect as the scene's box.
    await webp(sharp(master(item)), 80).toFile(target(item));
  } else if (item.startsWith("planet-")) {
    // Fixed framing, no trim: star-chart-map.tsx sizes these by the sphere's share of the frame.
    await webp(sharp(master(item)).resize(256, 256)).toFile(target(item));
  } else if (/^astro-[a-z]+-(body|forearm)$/.test(item)) {
    // The waving pose is two layers the page stacks: the body, and the forearm it rotates about
    // the elbow. Both share one crop (the union of their bounds) so they line up exactly, and
    // the elbow's position in that crop goes into explorer-pivots.json.
    const tone = item.replace(/^astro-|-(body|forearm)$/g, "");
    const pair = [`astro-${tone}-body`, `astro-${tone}-forearm`];
    const [a, b] = await Promise.all(pair.map((n) => bounds(master(n))));
    const left = Math.min(a.left, b.left);
    const top = Math.min(a.top, b.top);
    const box = {
      left,
      top,
      width: Math.max(a.right, b.right) - left,
      height: Math.max(a.bottom, b.bottom) - top,
    };
    let size = { w: 0, h: 0 };
    for (const n of pair) {
      const img = sharp(master(n)).extract(box).resize(480, 480, { fit: "inside" });
      const info = await webp(img).toFile(target(n));
      size = { w: info.width, h: info.height };
      done.add(n);
    }
    const elbow = elbows[tone];
    if (elbow) {
      const pivots = readPivots();
      pivots.wave = {
        ...pivots.wave,
        [tone]: {
          x: Math.round(((elbow.x - box.left) / box.width) * 1000) / 10,
          y: Math.round(((elbow.y - box.top) / box.height) * 1000) / 10,
          ...size,
        },
      };
      writePivots(pivots);
    } else {
      console.warn(`no elbow pivot for ${tone}: render astro-${tone}-body in the same run`);
    }
  } else {
    const trimmed = await sharp(master(item)).trim({ threshold: 1 }).toBuffer();
    const img = sharp(trimmed).resize(480, 480, { fit: "inside" });
    const info = await webp(img).toFile(target(item));
    if (item.startsWith("astro-")) {
      const pivots = readPivots();
      const tone = item.replace(/^astro-/, "");
      pivots.rest = { ...pivots.rest, [tone]: { w: info.width, h: info.height } };
      writePivots(pivots);
    }
  }
  done.add(item);
  console.log("exported", item);
}
