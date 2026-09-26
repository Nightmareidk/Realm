import type { CSSProperties } from "react";
import styles from "./hero.module.css";

/**
 * The hero landscape, drawn from the Realm logo: a lit gateway on the horizon, a winding
 * path of light running toward the viewer, rolling night hills with rim light, and stars.
 * Deterministic and server-rendered; the only motion is star twinkle (off under reduced motion).
 * viewBox 1600 × 1000. Horizon ≈ y 600, gateway centred on x 800.
 */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

interface P {
  x: number;
  y: number;
}

function cubic(p0: P, p1: P, p2: P, p3: P, t: number): P {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

/** A tapered ribbon along a cubic: narrow at the gate (t=0), wide near the viewer (t=1). */
function pathOfLight(): string {
  // Starts at the glowing horizon between the far hills, like the logo, and flows toward the viewer.
  const p0 = { x: 800, y: 574 };
  const p1 = { x: 890, y: 690 };
  const p2 = { x: 650, y: 820 };
  const p3 = { x: 790, y: 1010 };
  const n = 40;
  const left: P[] = [];
  const right: P[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const c = cubic(p0, p1, p2, p3, t);
    const d = cubic(p0, p1, p2, p3, Math.min(1, t + 0.001));
    const len = Math.hypot(d.x - c.x, d.y - c.y) || 1;
    const nx = -(d.y - c.y) / len;
    const ny = (d.x - c.x) / len;
    const w = (6 + 284 * t ** 1.7) / 2;
    left.push({ x: c.x + nx * w, y: c.y + ny * w });
    right.push({ x: c.x - nx * w, y: c.y - ny * w });
  }
  const pts = [...left, ...right.reverse()];
  return `M${pts.map((p) => `${r1(p.x)},${r1(p.y)}`).join("L")}Z`;
}

/** Four-point sparkle like the logo's stars. */
function sparkle(cx: number, cy: number, r: number): string {
  const k = r * 0.18;
  return `M${cx},${cy - r}C${cx + k},${cy - k} ${cx + k},${cy - k} ${cx + r},${cy}C${cx + k},${cy + k} ${cx + k},${cy + k} ${cx},${cy + r}C${cx - k},${cy + k} ${cx - k},${cy + k} ${cx - r},${cy}C${cx - k},${cy - k} ${cx - k},${cy - k} ${cx},${cy - r}Z`;
}

const STARS = (() => {
  const rand = mulberry32(7);
  return Array.from({ length: 150 }, () => ({
    x: r1(rand() * 1600),
    y: r1(rand() * 620),
    r: r1(0.5 + rand() * 1.3),
    o: r1(0.25 + rand() * 0.7),
    twinkle: rand() < 0.22,
    delay: r1(rand() * 6),
  })).filter((s) => !(s.x > 470 && s.x < 1130 && s.y > 130 && s.y < 620));
})();

const SPARKLES = [
  { x: 240, y: 150, r: 11 },
  { x: 1370, y: 110, r: 9 },
  { x: 1490, y: 330, r: 7 },
  { x: 120, y: 420, r: 8 },
  { x: 1250, y: 470, r: 6 },
  { x: 360, y: 520, r: 5 },
];

// The gateway: two concentric arches with elliptical crowns, like the logo's double band.
const arch = (x0: number, x1: number, spring: number, crown: number, base: number) => {
  const rx = (x1 - x0) / 2;
  return `M${x0},${base}V${spring}A${rx},${spring - crown} 0 0 1 ${x1},${spring}V${base}`;
};
const OUTER = arch(488, 1112, 330, 150, 790);
const INNER = arch(552, 1048, 344, 214, 790);

const LIGHT_PATH = pathOfLight();

export function GatewayScene({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1600 1000"
      preserveAspectRatio="xMidYMax slice"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="gw-horizon" cx="800" cy="600" r="620" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--scene-horizon-core)" stopOpacity="0.95" />
          <stop offset="0.18" stopColor="var(--scene-horizon-mid)" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="var(--scene-horizon-edge)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--scene-horizon-edge)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="gw-band" x1="0" y1="140" x2="0" y2="700" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--scene-light-hot)" />
          <stop offset="0.45" stopColor="var(--scene-light-warm)" />
          <stop offset="1" stopColor="var(--scene-light-cool)" />
        </linearGradient>
        <linearGradient
          id="gw-path"
          x1="0"
          y1="574"
          x2="0"
          y2="1010"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="var(--scene-light-hot)" />
          <stop offset="0.45" stopColor="var(--scene-light-warm)" />
          <stop offset="1" stopColor="var(--scene-light-cool)" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient
          id="gw-hill-far"
          x1="0"
          y1="560"
          x2="0"
          y2="720"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="var(--scene-hill-far-top)" />
          <stop offset="1" stopColor="var(--scene-hill-far-bottom)" />
        </linearGradient>
        <linearGradient
          id="gw-hill-mid"
          x1="0"
          y1="640"
          x2="0"
          y2="900"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="var(--scene-hill-mid-top)" />
          <stop offset="1" stopColor="var(--scene-hill-mid-bottom)" />
        </linearGradient>
        <linearGradient
          id="gw-hill-near"
          x1="0"
          y1="780"
          x2="0"
          y2="1000"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="var(--scene-hill-near-top)" />
          <stop offset="1" stopColor="var(--r-ground)" />
        </linearGradient>
        <linearGradient id="gw-rim" x1="0" y1="0" x2="1600" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--scene-rim)" stopOpacity="0.1" />
          <stop offset="0.5" stopColor="var(--scene-rim)" stopOpacity="0.9" />
          <stop offset="1" stopColor="var(--scene-rim)" stopOpacity="0.1" />
        </linearGradient>
        <filter id="gw-bloom" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="22" />
        </filter>
        <filter id="gw-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* Horizon light behind everything */}
      <rect x="0" y="0" width="1600" height="1000" fill="url(#gw-horizon)" />

      {/* Stars */}
      <g fill="var(--scene-star)">
        {STARS.map((s) => (
          <circle
            key={`${s.x}-${s.y}`}
            cx={s.x}
            cy={s.y}
            r={s.r}
            opacity={s.o}
            className={s.twinkle ? "twinkle" : undefined}
            style={
              s.twinkle
                ? ({
                    "--twinkle-delay": `${s.delay}s`,
                    "--twinkle-dur": `${4 + (s.delay % 3)}s`,
                  } as CSSProperties)
                : undefined
            }
          />
        ))}
      </g>
      <g fill="var(--scene-star)">
        {SPARKLES.map((s, i) => (
          <path
            key={`${s.x}-${s.y}`}
            d={sparkle(s.x, s.y, s.r)}
            className="twinkle"
            style={{ "--twinkle-delay": `${i * 0.9}s`, "--twinkle-dur": "6s" } as CSSProperties}
          />
        ))}
      </g>

      {/* Far ridge */}
      <path
        d="M0,612C170,572 360,598 540,590S900,560 1080,588 1420,566 1600,596V1000H0Z"
        fill="url(#gw-hill-far)"
      />

      {/* The gateway: bloom, then the two bands, then the apex star */}
      <g filter="url(#gw-bloom)" opacity="0.75">
        <path d={OUTER} fill="none" stroke="url(#gw-band)" strokeWidth="70" />
      </g>
      <path d={OUTER} fill="none" stroke="url(#gw-band)" strokeWidth="46" opacity="0.55" />
      <path d={INNER} fill="none" stroke="url(#gw-band)" strokeWidth="30" opacity="0.9" />
      <path d={INNER} fill="none" stroke="var(--scene-light-hot)" strokeWidth="6" opacity="0.8" />
      <g className={styles.apex}>
        <path d={sparkle(800, 146, 30)} fill="var(--scene-light-hot)" />
        <path d="M800,112V206" stroke="var(--scene-light-hot)" strokeWidth="2.5" opacity="0.8" />
        <path
          d={sparkle(800, 146, 60)}
          fill="var(--scene-light-warm)"
          opacity="0.35"
          filter="url(#gw-soft)"
        />
      </g>

      {/* Mid hills, left and right of the gate */}
      <path
        d="M0,680C160,632 330,640 450,684S560,760 604,824C626,868 634,934 638,1000H0Z"
        fill="url(#gw-hill-mid)"
      />
      <path
        d="M1600,668C1440,626 1270,640 1150,684S1040,760 996,824C974,868 966,934 962,1000H1600Z"
        fill="url(#gw-hill-mid)"
      />
      <g fill="none" stroke="url(#gw-rim)" strokeWidth="2.2">
        <path d="M0,680C160,632 330,640 450,684S560,760 604,824" />
        <path d="M1600,668C1440,626 1270,640 1150,684S1040,760 996,824" />
      </g>

      {/* The path of light */}
      <path d={LIGHT_PATH} fill="url(#gw-path)" filter="url(#gw-bloom)" opacity="0.7" />
      <path d={LIGHT_PATH} fill="url(#gw-path)" />

      {/* Near hills framing the path */}
      <path d="M0,836C220,796 460,852 600,934S650,1000 650,1000H0Z" fill="url(#gw-hill-near)" />
      <path
        d="M1600,818C1380,788 1120,852 990,932S940,1000 940,1000H1600Z"
        fill="url(#gw-hill-near)"
      />
      <g fill="none" stroke="url(#gw-rim)" strokeWidth="2" opacity="0.8">
        <path d="M0,836C220,796 460,852 600,934" />
        <path d="M1600,818C1380,788 1120,852 990,932" />
      </g>
    </svg>
  );
}
