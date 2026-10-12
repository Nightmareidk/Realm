// Renders the front page's phone screens (screens.html) to textures:
//   node scripts/home-screens/render-screens.mjs
// Each <section class="screen" id="…"> is captured at 2x (780x1688) as public/home/screens/<id>.webp.
// Needs Chrome installed (puppeteer-core) and network access for the two Google fonts.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../../public/home/screens");
mkdirSync(out, { recursive: true });

const chrome = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 2200, height: 1000, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(resolve(here, "screens.html")).href, { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts.ready);
for (const el of await page.$$("section.screen")) {
  const id = await el.evaluate((n) => n.id);
  await el.screenshot({ path: `${out}/${id}.webp`, type: "webp", quality: 92 });
  console.log("screen", id);
}
await browser.close();
