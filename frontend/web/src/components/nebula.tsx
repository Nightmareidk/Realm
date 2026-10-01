"use client";

import { useEffect, useRef } from "react";

/**
 * The page's nebula: three soft colour fields behind everything that crossfade on a 48 s cycle, in
 * step with the hero's aurora (both keyed to the wall clock). Aurora greens, cyan and magenta,
 * then a pink and violet nebula by night; by day the high sky: cyan, sky blue and periwinkle, with
 * a trace of the sun's gold.
 *
 * They're drawn into one small canvas that the GPU stretches over the screen. Fields this soft
 * look the same stretched, and it's one small texture: drawn as three full-screen layers they
 * took about 20 MB of graphics memory each at 1.75x, and their fading made the browser give most of
 * the page its own layers on top.
 */

type Field = [x: number, y: number, rx: number, ry: number, colour: string, alpha: number][];

// Radial fields, as in CSS `radial-gradient(rx ry at x y, colour / alpha, transparent 70%)`, in %
// of the box (the screen plus a margin below). Listed top first, as in CSS.
const NIGHT: Field[] = [
  [
    [10, 6, 38, 34, "0.62 0.2 300", 0.24],
    [92, 48, 34, 30, "0.66 0.17 256", 0.18],
    [30, 96, 40, 30, "0.6 0.18 285", 0.14],
  ],
  [
    [88, 8, 36, 32, "0.72 0.16 240", 0.2],
    [8, 60, 38, 34, "0.62 0.22 345", 0.16],
    [70, 98, 34, 30, "0.5 0.16 275", 0.2],
  ],
  [
    [50, 0, 40, 34, "0.72 0.16 60", 0.14],
    [96, 72, 34, 32, "0.6 0.2 300", 0.2],
    [4, 30, 36, 30, "0.62 0.17 256", 0.16],
  ],
];
const DAY: Field[] = [
  [
    [92, 6, 42, 36, "0.86 0.08 210", 0.55],
    [4, 58, 38, 34, "0.84 0.07 245", 0.45],
    [40, 100, 40, 30, "0.92 0.08 85", 0.45],
  ],
  [
    [8, 8, 40, 36, "0.87 0.07 195", 0.5],
    [96, 62, 38, 34, "0.84 0.06 272", 0.42],
    [60, 100, 34, 30, "0.9 0.08 70", 0.38],
  ],
  [
    [55, 0, 44, 36, "0.92 0.07 88", 0.45],
    [2, 86, 36, 32, "0.86 0.06 220", 0.45],
    [98, 34, 34, 30, "0.85 0.05 290", 0.38],
  ],
];

const W = 256;
const H = 160;
const PERIOD = 48;
// Where each field is in the cycle (the second and third run 32 s and 16 s ahead).
const OFFSET = [0, 32, 16];

/** A field's strength at a point in its cycle: full, fading out, gone, fading back in. */
function strength(phase: number) {
  if (phase < 1 / 3) return 1 - phase * 3;
  if (phase > 2 / 3) return phase * 3 - 2;
  return 0;
}

function draw(ctx: CanvasRenderingContext2D, fields: Field[], weights: number[]) {
  ctx.clearRect(0, 0, W, H);
  fields.forEach((field, i) => {
    const w = weights[i] ?? 0;
    if (w < 0.004) return;
    ctx.globalAlpha = w;
    // Bottom first, so the first listed ends up on top.
    for (const [x, y, rx, ry, c, a] of [...field].reverse()) {
      ctx.save();
      ctx.translate((x / 100) * W, (y / 100) * H);
      ctx.scale((rx / 100) * W, (ry / 100) * H);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, `oklch(${c} / ${a})`);
      g.addColorStop(0.7, `oklch(${c} / 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }
  });
  ctx.globalAlpha = 1;
}

export function Nebula() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer = 0;
    let last = "";

    const frame = () => {
      const day = root.dataset.theme === "day";
      const still = reduce.matches || root.dataset.motion === "paused";
      const now = Date.now() / 1000;
      // Still: all three at the resting strength; moving: crossfading round the cycle.
      const weights = still
        ? [0, 1, 2].map(() => (day ? 0.6 : 0.34))
        : OFFSET.map((o) => strength(((now + o) % PERIOD) / PERIOD));
      const key = `${day}|${weights.map((w) => w.toFixed(3)).join(",")}`;
      if (key !== last) {
        last = key;
        try {
          draw(ctx, day ? DAY : NIGHT, weights);
        } catch {
          // A browser that can't parse oklch colours in a canvas just goes without the nebula.
        }
      }
    };

    // Five times a second is plenty: a full crossfade takes 16 seconds.
    const start = () => {
      window.clearInterval(timer);
      frame();
      const still = reduce.matches || root.dataset.motion === "paused";
      if (!still && !document.hidden) timer = window.setInterval(frame, 200);
    };
    start();
    const mo = new MutationObserver(start);
    mo.observe(root, { attributes: true, attributeFilter: ["data-theme", "data-motion"] });
    reduce.addEventListener("change", start);
    document.addEventListener("visibilitychange", start);
    return () => {
      window.clearInterval(timer);
      mo.disconnect();
      reduce.removeEventListener("change", start);
      document.removeEventListener("visibilitychange", start);
    };
  }, []);

  return (
    <div className="realm-nebula" aria-hidden="true">
      <canvas ref={canvas} width={W} height={H} />
    </div>
  );
}
