/** sRGB colour maths for verifying tokens: WCAG luminance and contrast, and the light field. */

export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

const linear = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG 2.x relative luminance of an sRGB colour (0–255 channels, clamped). */
export function luminanceRgb([r, g, b]: Rgb): number {
  const c = (v: number) => linear(Math.min(255, Math.max(0, v)));
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}

export const luminance = (hex: string) => luminanceRgb(hexToRgb(hex));

/** Contrast between two luminances (or colours), as WCAG's ratio. */
export function contrastL(a: number, b: number): number {
  const [x, y] = a > b ? [a, b] : [b, a];
  return (x + 0.05) / (y + 0.05);
}

export const contrast = (a: string, b: string) => contrastL(luminance(a), luminance(b));

/**
 * The brightest point of the light field for a theme, mirroring how the front page draws it
 * (features/home/light-field.tsx): three radial fields added with "lighter" over the ink ground,
 * moving with scroll. Sampled across every scroll position.
 */
export function fieldPeak(
  lights: [string, string, string],
  glow: number,
  ground = "#0b0b0e",
): number {
  const W = 192;
  const H = 108;
  const base = hexToRgb(ground);
  const cols = lights.map(hexToRgb);
  const alphas = [0.55 * glow, 0.42 * glow, 0.28 * glow];
  const stop = (d: number, a: number) =>
    d >= 1 ? 0 : d <= 0.55 ? a + (a * 0.35 - a) * (d / 0.55) : a * 0.35 * (1 - (d - 0.55) / 0.45);
  let peak = 0;
  for (let p = 0; p <= 6; p += 0.05) {
    const fields: [number, number, number][] = [
      [W * (0.22 + 0.16 * Math.sin(p * 2.1)), H * (1.02 - 0.18 * Math.cos(p * 1.3)), W * 0.62],
      [W * (0.84 - 0.2 * Math.sin(p * 1.6 + 1)), H * (0.12 + 0.25 * Math.sin(p * 1.1)), W * 0.5],
      [W * (0.55 + 0.25 * Math.cos(p * 0.9)), H * (0.6 + 0.2 * Math.sin(p * 1.7 + 2)), W * 0.42],
    ];
    for (let y = 0; y < H; y += 3) {
      for (let x = 0; x < W; x += 3) {
        const px: Rgb = [...base];
        fields.forEach(([fx, fy, r], i) => {
          const a = stop(Math.hypot(x - fx, y - fy) / r, alphas[i] as number);
          for (let k = 0; k < 3; k++)
            px[k] = (px[k] as number) + ((cols[i] as Rgb)[k] as number) * a;
        });
        peak = Math.max(peak, luminanceRgb(px));
      }
    }
  }
  return peak;
}
