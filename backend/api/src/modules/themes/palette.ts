import {
  argbFromRgb,
  Hct,
  hexFromArgb,
  QuantizerCelebi,
  Score,
} from "@material/material-color-utilities";
import type { PaletteSuggestion, ThemeColors } from "@realm/contracts";
import sharp from "sharp";

/**
 * Colours from a picture, the way phones pick a theme from your wallpaper (Material You, through
 * Google's Material Color Utilities): shrink the picture, group its pixels into a few colours, rank
 * them by how colourful they are and how much of the picture they cover, then build whole colour
 * sets around the best ones. Each set keeps the picture's hues but sets lightness so text reads.
 */

type Suggestion = PaletteSuggestion;

const hex = (hue: number, chroma: number, tone: number) =>
  hexFromArgb(Hct.from(hue, chroma, tone).toInt()).toLowerCase();

/** A dark set around one hue: a glassy app over the picture, your colour taken from it. */
function darkSet(source: Hct, second: Hct, third: Hct, name: string): Suggestion {
  const h = source.hue;
  const chroma = Math.max(36, Math.min(source.chroma, 84));
  const colors: ThemeColors = {
    ground: hex(h, 10, 5),
    surface: hex(h, 12, 9),
    raised: hex(h, 14, 14),
    line: hex(h, 14, 24),
    text: hex(h, 4, 96),
    textSoft: hex(h, 8, 76),
    accent: hex(h, chroma, 66),
    onAccent: hex(h, 20, 8),
    lights: [hex(h, chroma, 34), hex(second.hue, Math.min(second.chroma, 60), 26), hex(third.hue, 30, 20)],
    accent2: hex(second.hue, Math.max(30, Math.min(second.chroma, 70)), 70),
    heading: hex(h, chroma, 78),
    link: hex(h, Math.min(chroma, 50), 84),
  };
  return {
    name,
    colors,
    panels: { opacity: 0.6, blur: "soft", border: "none", shadow: "soft", headers: "bar" },
    buttons: { shape: "rounded", fill: "solid", glow: false },
    overlay: hex(h, 8, 3),
    overlay2: hex(h, Math.min(chroma, 40), 14),
  };
}

/** A light set, for pictures that are mostly bright (pastel and cute themes). */
function lightSet(source: Hct, second: Hct, name: string): Suggestion {
  const h = source.hue;
  const chroma = Math.max(30, Math.min(source.chroma, 70));
  return {
    name,
    colors: {
      ground: hex(h, 10, 97),
      surface: hex(h, 6, 99),
      raised: hex(h, 16, 92),
      line: hex(h, 18, 84),
      text: hex(h, 18, 12),
      textSoft: hex(h, 14, 34),
      accent: hex(h, chroma, 42),
      onAccent: hex(h, 8, 99),
      lights: [hex(h, chroma, 80), hex(second.hue, 40, 86), hex(h, 30, 90)],
      accent2: hex(second.hue, Math.max(30, Math.min(second.chroma, 60)), 44),
      heading: hex(h, chroma, 36),
      link: hex(h, chroma, 34),
    },
    panels: { opacity: 0.78, blur: "soft", border: "none", shadow: "soft", headers: "plain" },
    buttons: { shape: "pill", fill: "solid", glow: false },
    overlay: hex(h, 8, 98),
    overlay2: hex(second.hue, 20, 92),
  };
}

/** Up to four colour sets from a picture's bytes. */
export async function paletteFromPicture(bytes: Uint8Array): Promise<Suggestion[]> {
  const { data, info } = await sharp(bytes, { limitInputPixels: 60_000_000, failOn: "error" })
    .resize(112, 112, { fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels: number[] = [];
  let lum = 0;
  for (let i = 0; i + 2 < data.length; i += info.channels) {
    const [r, g, b] = [data[i] as number, data[i + 1] as number, data[i + 2] as number];
    pixels.push(argbFromRgb(r, g, b));
    lum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const bright = lum / (pixels.length || 1) > 150;
  const ranked = Score.score(QuantizerCelebi.quantize(pixels, 128), {
    desired: 4,
    fallbackColorARGB: 0xff3ee6b0,
    filter: true,
  }).map((argb) => Hct.fromInt(argb));
  const pick = (i: number) => ranked[i % ranked.length] as Hct;
  const sets = ranked.slice(0, 3).map((c, i) => darkSet(c, pick(i + 1), pick(i + 2), `From your picture ${i + 1}`));
  // A bright picture also gets a light set first; a dark one gets it last.
  const light = lightSet(pick(0), pick(1), "From your picture, light");
  return bright ? [light, ...sets] : [...sets, light];
}
