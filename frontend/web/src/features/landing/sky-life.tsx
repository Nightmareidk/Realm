"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useSkyIsDay } from "@/lib/edition";
import styles from "./sky-life.module.css";

/**
 * Life in the sky behind the page, once you've come down out of the hero: the page is the sky,
 * and everything in it moves with your scroll. Nothing runs on a clock: scroll on and things fly;
 * stop, and they hold where they are; scroll back, and they fly backwards.
 *
 * By day, clouds pass by (the near ones big and quick, the far ones small, pale and slow, each
 * drifting sideways as it goes); a jet crosses high up now and then, drawing its contrails behind
 * it; and a few gulls fly over, beating their wings as you go.
 *
 * By night it's space: shooting stars streak across and burn out; satellites glide over, turning,
 * a beacon blinking and a flash of sun off their panels; a rocket lifts off from the foot of the
 * screen and climbs away into space on its fire, its exhaust growing behind it; and a flying
 * saucer darts across spinning, hangs a moment (its glowing wake fading), then zips off.
 *
 * Each flight has its stretch of the page: `at` is where it sets off (0 as the hero goes, 1 at the
 * cast's horizon at the foot of the page) and `span` how many screens of scrolling it lasts.
 *
 * The clouds are rendered volumes (scripts/blender/render_clouds.py), the gull is drawn by
 * scripts/make-sky-sprites.mjs, and the jet, rocket, saucers and satellite are the product
 * owner's own models (scripts/blender/render_props.py).
 *
 * It's decoration: behind everything, never over text, hidden from assistive tech. Everything
 * moves by transform, so the compositor runs it. With reduced motion or Pause motion the clouds
 * stand still and nothing flies.
 */

const CLOUDS = 6;
const CLOUD_ART = 5;
const src = (name: string) => `/art/sky/${name}.webp`;

// Repeatable randomness, so each cloud and flock keeps its character.
const hash = (a: number, b: number) => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
// A strip's frame for a running count (negative counts, scrolling back up, wrap too).
const frameOf = (count: number, frames: number) => ((Math.floor(count) % frames) + frames) % frames;

// The sprite strips: each frame's width over its height.
const ASPECT = { ufo: 217 / 96, "ufo-2": 305 / 96, satellite: 256 / 150 };

type Dir = 1 | -1;
type Bird = { x: number; y: number; size: number; phase: number };
type Flight = { at: number; span: number } & (
  | { kind: "jet"; dir: Dir; top: number; size: number }
  | { kind: "flock"; dir: Dir; top: number; birds: Bird[] }
  | { kind: "meteor"; top: number; left: number; angle: number; length: number }
  | { kind: "satellite"; top: number; drop: number; size: number }
  | { kind: "light"; top: number; drop: number }
  | { kind: "rocket"; left: number; tilt: number; size: number }
  | { kind: "ufo"; dir: Dir; top: number; size: number; art: "ufo" | "ufo-2" }
);

/** A loose V of gulls, each a little off its place. */
function flock(n: number, scale: number, seed: number): Bird[] {
  return Array.from({ length: n }, (_, j) => ({
    x: -Math.ceil(j / 2) * 34 * scale + (hash(seed, j) - 0.5) * 12,
    y: (j % 2 ? 1 : -1) * Math.ceil(j / 2) * 13 * scale + (hash(seed, j + 9) - 0.5) * 8,
    size: (22 + 8 * hash(seed, j + 17)) * scale,
    phase: hash(seed, j + 31),
  }));
}

const DAY: Flight[] = [
  { kind: "jet", at: 0.02, span: 2.4, dir: 1, top: 14, size: 118 },
  { kind: "flock", at: 0.13, span: 1.8, dir: -1, top: 30, birds: flock(5, 1.1, 1) },
  { kind: "jet", at: 0.32, span: 2.6, dir: -1, top: 8, size: 92 },
  { kind: "flock", at: 0.46, span: 1.6, dir: 1, top: 22, birds: flock(4, 0.9, 2) },
  { kind: "jet", at: 0.6, span: 2.2, dir: 1, top: 20, size: 128 },
  { kind: "flock", at: 0.74, span: 1.6, dir: -1, top: 36, birds: flock(6, 1.2, 3) },
];

const NIGHT: Flight[] = [
  ...[0.01, 0.08, 0.15, 0.24, 0.31, 0.43, 0.5, 0.63, 0.7, 0.8].map(
    (at, i): Flight => ({
      kind: "meteor",
      at,
      span: 0.5,
      top: 4 + 46 * hash(i, 41),
      left: 30 + 62 * hash(i, 42),
      angle: 200 + 36 * hash(i, 43),
      length: 130 + 100 * hash(i, 44),
    }),
  ),
  { kind: "satellite", at: 0.04, span: 2.8, top: 12, drop: 10, size: 84 },
  { kind: "rocket", at: 0.14, span: 2.4, left: 16, tilt: 22, size: 118 },
  { kind: "ufo", at: 0.34, span: 2.6, dir: -1, top: 28, size: 124, art: "ufo" },
  { kind: "light", at: 0.42, span: 3, top: 8, drop: 14 },
  { kind: "rocket", at: 0.54, span: 2.2, left: 82, tilt: -18, size: 104 },
  { kind: "satellite", at: 0.64, span: 2.6, top: 18, drop: -6, size: 72 },
  { kind: "ufo", at: 0.74, span: 2.2, dir: 1, top: 22, size: 108, art: "ufo-2" },
];

type Draw = (el: HTMLElement, f: Flight, t: number, scroll: number, w: number, h: number) => void;
// Smaller on a narrow screen, so a saucer isn't a third of a phone across.
const shrink = (w: number) => Math.min(1, Math.max(0.7, w / 1100));
const kids = (el: Element | null | undefined) =>
  el ? (Array.from(el.children) as HTMLElement[]) : [];

// Each kind's pose for how far through its flight it is (t, 0 to 1) and the scroll itself (for
// wingbeats, flame flicker and spin, which run as you scroll).
const DRAW: Record<Flight["kind"], Draw> = {
  jet(el, f, t, _s, w, h) {
    if (f.kind !== "jet") return;
    const size = f.size * shrink(w);
    const from = f.dir === 1 ? -0.1 * w - size : 1.1 * w;
    const to = f.dir === 1 ? 1.1 * w : -0.1 * w - size;
    const x = lerp(from, to, t);
    // A gentle climb as it goes, and the contrails drawn out behind it.
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${(f.top * h * 0.01 - 0.04 * h * t).toFixed(1)}px, 0)`;
    const [trail] = kids(el);
    if (trail) {
      trail.style.transform = `scaleX(${clamp01(Math.abs(x - from) / (0.34 * w)).toFixed(3)})`;
    }
  },
  flock(el, f, t, s, w, h) {
    if (f.kind !== "flock") return;
    const x = f.dir === 1 ? lerp(-0.2 * w, 1.15 * w, t) : lerp(1.15 * w, -0.2 * w, t);
    const y = f.top * h * 0.01 - Math.sin(t * Math.PI) * 0.03 * h;
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    // Each bird's wingbeat, a frame of eight every few pixels of scroll.
    kids(el).forEach((bird, j) => {
      const [img] = kids(bird);
      if (img)
        img.style.transform = `translateX(${-12.5 * frameOf(s / 9 + f.birds[j].phase * 8, 8)}%)`;
    });
  },
  meteor(el, f, t, _s, w, h) {
    if (f.kind !== "meteor") return;
    // Streaking along its heading, the tail growing out behind the head, burning out at the end.
    const go = f.length * 1.6 * (1 - (1 - t) ** 2);
    el.style.transform = `translate3d(${(f.left * w * 0.01).toFixed(1)}px, ${(f.top * h * 0.01).toFixed(1)}px, 0) rotate(${f.angle}deg) translateX(${go.toFixed(1)}px) scaleX(${(0.2 + 0.8 * t).toFixed(3)})`;
    el.style.opacity = Math.min(t / 0.15, 1, (1 - t) / 0.35).toFixed(3);
  },
  satellite(el, f, t, s, w, h) {
    if (f.kind !== "satellite") return;
    const x = lerp(-0.12 * w, 1.05 * w, t);
    const y = (f.top + f.drop * t) * h * 0.01;
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    const [frames, beacon, flash] = kids(el);
    const [img] = kids(frames);
    if (img) img.style.transform = `translateX(${-6.25 * frameOf(t * 24, 16)}%)`;
    if (beacon) beacon.style.opacity = frameOf(s / 26, 5) === 0 ? "1" : "0.15";
    // The sun off its panels, twice on the way over.
    if (flash) {
      const glint = Math.max(0, 1 - Math.abs(t - 0.38) / 0.03, 1 - Math.abs(t - 0.72) / 0.03);
      flash.style.opacity = glint.toFixed(3);
    }
  },
  light(el, f, t, _s, w, h) {
    if (f.kind !== "light") return;
    const x = lerp(-0.05 * w, 1.05 * w, t);
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${((f.top + f.drop * t) * h * 0.01).toFixed(1)}px, 0)`;
    const [flash] = kids(el);
    if (flash) flash.style.opacity = Math.max(0, 1 - Math.abs(t - 0.55) / 0.025).toFixed(3);
  },
  rocket(el, f, t, s, w, h) {
    if (f.kind !== "rocket") return;
    // Lifting off from just below the screen and climbing away along its lean, quicker and
    // quicker, clean out of the top.
    el.style.transform = `translate3d(${(f.left * w * 0.01).toFixed(1)}px, ${h.toFixed(1)}px, 0) rotate(${f.tilt}deg)`;
    const [ship] = kids(el);
    if (!ship) return;
    ship.style.transform = `translate3d(0, ${(-2.1 * h * t ** 1.5).toFixed(1)}px, 0)`;
    const [plume, fire] = kids(ship);
    // The exhaust grows out behind it as it climbs; the fire flickers as you scroll.
    if (plume) plume.style.transform = `scaleY(${(0.2 + 0.8 * clamp01(t * 2.4)).toFixed(3)})`;
    if (fire) {
      const k = frameOf(s / 11, 8);
      fire.style.transform = `scale(${(0.94 + 0.1 * hash(k, 1)).toFixed(3)}, ${(0.86 + 0.24 * hash(k, 2)).toFixed(3)})`;
      const [img] = kids(fire);
      if (img) img.style.transform = `translateX(${-12.5 * k}%)`;
    }
  },
  ufo(el, f, t, s, w, h) {
    if (f.kind !== "ufo") return;
    // Across in three moves: darting in, a hover (22% of its stretch for a few percent of the
    // way), then off faster still.
    const a =
      t < 0.4
        ? lerp(-0.45, 0.38, 1 - (1 - t / 0.4) ** 2)
        : t < 0.62
          ? lerp(0.38, 0.44, smooth((t - 0.4) / 0.22))
          : lerp(0.44, 1.25, ((t - 0.62) / 0.38) ** 2);
    const x = f.dir === 1 ? a * w : w - a * w - f.size * shrink(w);
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${(f.top * h * 0.01).toFixed(1)}px, 0)`;
    const [hover] = kids(el);
    if (!hover) return;
    hover.style.transform = `translateY(${(5 * Math.sin(s / 55)).toFixed(2)}px) rotate(${(3 * Math.sin(s / 70)).toFixed(2)}deg)`;
    const [wake, frames] = kids(hover);
    // The wake is bright while it moves and fades while it hangs there.
    if (wake) {
      const glow =
        t < 0.36
          ? 1
          : t < 0.44
            ? lerp(1, 0.12, (t - 0.36) / 0.08)
            : t < 0.58
              ? 0.12
              : t < 0.66
                ? lerp(0.12, 1, (t - 0.58) / 0.08)
                : 1;
      wake.style.opacity = glow.toFixed(3);
    }
    const [img] = kids(frames);
    if (img) img.style.transform = `translateX(${-6.25 * frameOf(s / 10, 16)}%)`;
  },
};

export function SkyLife() {
  const day = useSkyIsDay();
  const clouds = useRef<(HTMLDivElement | null)[]>([]);
  const flights = useRef<(HTMLElement | null)[]>([]);
  const [shown, setShown] = useState(false);
  const [moving, setMoving] = useState(false);
  // The edition is only known in the browser, so the sky fills in after the page comes to life
  // (the server's page and the first render in the browser must match).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const plan = day ? DAY : NIGHT;

  // Whether things may move at all.
  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setMoving(!reduce.matches && root.dataset.motion !== "paused");
    sync();
    reduce.addEventListener("change", sync);
    const mo = new MutationObserver(sync);
    mo.observe(root, { attributes: true, attributeFilter: ["data-motion"] });
    return () => {
      reduce.removeEventListener("change", sync);
      mo.disconnect();
    };
  }, []);

  // Everything placed by the scroll.
  useEffect(() => {
    if (!mounted) return;
    let frame = 0;
    const seen: boolean[] = [];
    // Where the hero ends and the cast's ground begins on the page: measured only when the page
    // changes size, so scrolling reads nothing but the scroll position (no forced layout).
    let heroEnd = 0;
    let groundTop = 0;
    let stale = true;
    const update = () => {
      frame = 0;
      const h = window.innerHeight;
      const w = window.innerWidth;
      const scroll = window.scrollY;
      if (stale) {
        stale = false;
        const hero = document.querySelector("[data-hero]");
        heroEnd = hero ? hero.getBoundingClientRect().bottom + scroll : 0;
        const ground = document.querySelector("[data-ground]");
        groundTop = ground
          ? ground.getBoundingClientRect().top + scroll
          : document.documentElement.scrollHeight;
      }
      setShown(heroEnd - scroll < h * 0.35);

      if (day) {
        const s = moving ? scroll : 0;
        const range = h * 1.7;
        const margin = h * 0.35;
        clouds.current.forEach((el, i) => {
          if (!el) return;
          const depth = 0.25 + 0.75 * hash(i, 1);
          const speed = 0.18 + 0.72 * depth;
          const size = Math.max(w, 720) * (0.16 + 0.3 * depth);
          const raw = hash(i, 2) * range - s * speed;
          const lap = Math.floor(raw / range);
          const y = raw - lap * range - margin;
          // Each time round, somewhere new across the sky, drifting sideways as it rises.
          const drift = Math.sin(s / (h * 2.2) + i * 1.7) * 0.05 * w;
          const x = hash(i, lap + 7) * (w + size * 0.4) - size * 0.7 + drift;
          el.style.width = `${size.toFixed(0)}px`;
          // Paler the lower they sink toward the horizon, where the air is hazier (and the cast is).
          const low = Math.min(1, Math.max(0, (y + size * 0.25 - h * 0.5) / (h * 0.5)));
          el.style.opacity = ((0.4 + 0.45 * depth) * (1 - 0.6 * low)).toFixed(2);
          el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        });
      }

      // The flights, along the stretch from where the sky shows to the cast's horizon.
      const start = heroEnd - h * 0.35;
      const end = groundTop - h * 0.2;
      const k = shrink(w);
      plan.forEach((f, i) => {
        const el = flights.current[i];
        if (!el) return;
        const t = (scroll - (start + f.at * Math.max(end - start, h))) / (f.span * h);
        const on = moving && t > 0 && t < 1;
        if (on !== seen[i]) {
          seen[i] = on;
          el.style.visibility = on ? "visible" : "hidden";
          el.style.willChange = on ? "transform" : "auto";
          if (on && "size" in f) el.style.setProperty("--size", `${(f.size * k).toFixed(0)}px`);
        }
        if (on) DRAW[f.kind](el, f, t, scroll, w, h);
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const remeasure = () => {
      stale = true;
      schedule();
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", remeasure);
    const ro = new ResizeObserver(remeasure);
    ro.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", remeasure);
      ro.disconnect();
    };
  }, [day, moving, mounted, plan]);

  return (
    <div className={styles.life} data-shown={shown || undefined} aria-hidden="true">
      {mounted &&
        day &&
        Array.from({ length: CLOUDS }, (_, i) => {
          const depth = 0.25 + 0.75 * hash(i, 1);
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed set of clouds, never reordered.
              key={i}
              ref={(el) => {
                clouds.current[i] = el;
              }}
              className={styles.cloud}
              style={{ zIndex: Math.round(depth * 10) }}
            >
              {/* biome-ignore lint/performance/noImgElement: decorative sprites, sized by the scroll code. */}
              <img src={`/art/sky/cloud-${(i % CLOUD_ART) + 1}.webp`} alt="" decoding="async" />
            </div>
          );
        })}

      {mounted &&
        plan.map((f, i) => (
          <FlightView
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed flight plan, never reordered.
            key={`${day ? "d" : "n"}${i}`}
            f={f}
            refFn={(el) => {
              flights.current[i] = el;
            }}
          />
        ))}
    </div>
  );
}

// biome-ignore-start lint/performance/noImgElement: decorative sprites and frame strips, moved by the scroll.
function FlightView({ f, refFn }: { f: Flight; refFn: (el: HTMLElement | null) => void }) {
  switch (f.kind) {
    case "jet":
      return (
        <div ref={refFn} className={styles.jet} data-dir={f.dir} style={{ zIndex: 4 }}>
          <span className={styles.trail} />
          <img src={src("jet")} alt="" decoding="async" />
        </div>
      );
    case "flock":
      return (
        <div ref={refFn} className={styles.flock} data-dir={f.dir} style={{ zIndex: 11 }}>
          {f.birds.map((b, j) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: a flock's birds never change.
              key={j}
              className={styles.bird}
              style={
                { left: `${b.x}px`, top: `${b.y}px`, "--bird": `${b.size}px` } as CSSProperties
              }
            >
              <img src={src("birds")} alt="" decoding="async" />
            </span>
          ))}
        </div>
      );
    case "meteor":
      return (
        <span
          ref={refFn}
          className={styles.meteor}
          style={{ "--length": `${f.length}px` } as CSSProperties}
        />
      );
    case "satellite":
      return (
        <div
          ref={refFn}
          className={styles.satellite}
          style={{ "--aspect": ASPECT.satellite } as CSSProperties}
        >
          <span className={styles.frames}>
            <img src={src("satellite")} alt="" decoding="async" />
          </span>
          <span className={styles.beacon} />
          <span className={styles.flash} />
        </div>
      );
    case "light":
      return (
        <span ref={refFn} className={styles.light}>
          <span className={styles.flash} />
        </span>
      );
    case "rocket":
      return (
        <div ref={refFn} className={styles.rocket}>
          <div className={styles.ship}>
            <span className={styles.plume} />
            <span className={styles.fire}>
              <img src={src("flame")} alt="" decoding="async" />
            </span>
            <img className={styles.body} src={src("rocket")} alt="" decoding="async" />
          </div>
        </div>
      );
    case "ufo":
      return (
        <div
          ref={refFn}
          className={styles.ufo}
          data-dir={f.dir}
          style={{ "--aspect": ASPECT[f.art] } as CSSProperties}
        >
          <div className={styles.hover}>
            <span className={styles.wake} />
            <span className={styles.frames}>
              <img src={src(f.art)} alt="" decoding="async" />
            </span>
          </div>
        </div>
      );
  }
}
// biome-ignore-end lint/performance/noImgElement: see above.
