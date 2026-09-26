/** Minimal OKLCH → sRGB conversion and WCAG contrast, so token choices are verified, not eyeballed. */

export interface Oklch {
  l: number;
  c: number;
  h: number;
  alpha?: number;
}

export const oklch = (l: number, c: number, h: number, alpha?: number): Oklch => ({ l, c, h, alpha });

export function toCss({ l, c, h, alpha }: Oklch): string {
  const base = `${round(l, 4)} ${round(c, 4)} ${round(h, 2)}`;
  return alpha === undefined ? `oklch(${base})` : `oklch(${base} / ${alpha})`;
}

const round = (n: number, d: number) => Number(n.toFixed(d));

/** OKLCH → linear sRGB (Björn Ottosson's OKLab matrices). */
function toLinearRgb({ l, c, h }: Oklch): [number, number, number] {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** True when the colour is inside the sRGB gamut (small tolerance). */
export function inGamut(color: Oklch): boolean {
  return toLinearRgb(color).every((v) => v >= -0.0005 && v <= 1.0005);
}

export function toHex(color: Oklch): string {
  const encode = (v: number) => {
    const x = clamp01(v);
    const s = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
    return Math.round(clamp01(s) * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${toLinearRgb(color).map(encode).join("")}`;
}

/** WCAG 2.x relative luminance (from linear sRGB, clamped to gamut). */
export function luminance(color: Oklch): number {
  const [r, g, b] = toLinearRgb(color).map(clamp01) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: Oklch, b: Oklch): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m) as [number, number];
  return (x + 0.05) / (y + 0.05);
}
