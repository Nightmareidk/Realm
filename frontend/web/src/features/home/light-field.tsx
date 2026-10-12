"use client";

import { useEffect, useRef } from "react";
import { THEME_EVENT, THEMES, type ThemeId } from "./themes";

/**
 * The light behind the front page: three soft colour fields in the current theme's colours,
 * drifting as you scroll and blending to a new theme when it changes. Drawn into one tiny canvas
 * (192x108) that the GPU stretches over the screen; fields this soft look the same stretched, and
 * it costs almost nothing on an integrated GPU (the old full-screen nebula layers cost 20 MB each).
 * Redrawn only when the scroll or the theme moves it; still under reduced motion / Pause motion.
 * Each theme's glow is set so grey text stays at 4.5:1 or better wherever the light drifts.
 */
const W = 192;
const H = 108;

type RGB = [number, number, number];
const hex = (h: string): RGB => [
  Number.parseInt(h.slice(1, 3), 16),
  Number.parseInt(h.slice(3, 5), 16),
  Number.parseInt(h.slice(5, 7), 16),
];
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export function LightField() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvas.current;
    const g = c?.getContext("2d");
    if (!c || !g) return;
    const root = document.documentElement;
    const still = () =>
      matchMedia("(prefers-reduced-motion: reduce)").matches || root.dataset.motion === "paused";

    let from = THEMES.mint.light.map(hex) as RGB[];
    let to = from;
    let glowFrom = THEMES.mint.glow;
    let glowTo = glowFrom;
    let blend = 1;
    let blendStart = 0;
    let scroll = 0;
    let frame = 0;

    const draw = (now: number) => {
      frame = 0;
      if (blend < 1) blend = Math.min(1, (now - blendStart) / 900);
      const k = blend < 1 ? 1 - (1 - blend) ** 3 : 1;
      const cols = to.map((col, i) => mix(from[i] as RGB, col, k));
      const glow = glowFrom + (glowTo - glowFrom) * k;
      const p = scroll;
      g.globalCompositeOperation = "source-over";
      g.fillStyle = "#0b0b0e";
      g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = "lighter";
      // Each field is placed by the scroll position so the light travels as you read down.
      const fields: [number, number, number, number][] = [
        [
          W * (0.22 + 0.16 * Math.sin(p * 2.1)),
          H * (1.02 - 0.18 * Math.cos(p * 1.3)),
          W * 0.62,
          0.55 * glow,
        ],
        [
          W * (0.84 - 0.2 * Math.sin(p * 1.6 + 1)),
          H * (0.12 + 0.25 * Math.sin(p * 1.1)),
          W * 0.5,
          0.42 * glow,
        ],
        [
          W * (0.55 + 0.25 * Math.cos(p * 0.9)),
          H * (0.6 + 0.2 * Math.sin(p * 1.7 + 2)),
          W * 0.42,
          0.28 * glow,
        ],
      ];
      fields.forEach(([x, y, r, a], i) => {
        const [cr, cg, cb] = cols[i] as RGB;
        const grad = g.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, `rgba(${cr | 0},${cg | 0},${cb | 0},${a})`);
        grad.addColorStop(0.55, `rgba(${cr | 0},${cg | 0},${cb | 0},${a * 0.35})`);
        grad.addColorStop(1, `rgba(${cr | 0},${cg | 0},${cb | 0},0)`);
        g.fillStyle = grad;
        g.fillRect(0, 0, W, H);
      });
      if (blend < 1) frame = requestAnimationFrame(draw);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };

    const onScroll = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      const next = (scrollY / max) * 6;
      if (still() && Math.abs(next - scroll) < 0.4) return;
      scroll = next;
      schedule();
    };
    const onTheme = (e: Event) => {
      const id = (e as CustomEvent<ThemeId>).detail;
      const k = blend < 1 ? 1 - (1 - blend) ** 3 : 1;
      from = to.map((col, i) => mix(from[i] as RGB, col, k));
      to = THEMES[id].light.map(hex) as RGB[];
      glowFrom = glowFrom + (glowTo - glowFrom) * k;
      glowTo = THEMES[id].glow;
      blend = still() ? 1 : 0;
      blendStart = performance.now();
      schedule();
    };

    onScroll();
    schedule();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener(THEME_EVENT, onTheme);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", onScroll);
      removeEventListener(THEME_EVENT, onTheme);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
      <canvas ref={canvas} width={W} height={H} className="size-full" />
      {/* Grain: keeps the soft fields from banding and gives the dark a surface. */}
      <div className="home-grain absolute inset-0" />
    </div>
  );
}
