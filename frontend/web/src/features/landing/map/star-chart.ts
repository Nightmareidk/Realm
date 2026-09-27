/**
 * The star chart: Realm drawn as a small solar system, computed once on the server as plain
 * SVG data. Deterministic (seeded) so every render draws the same sky.
 *
 * The eclipse (the logo) sits at the centre; each region is a planet on its own tilted orbit.
 * A lime flight path launches from the edge of the chart, visits every planet in order, and
 * lands at the eclipse: four apps, one destination.
 */

export type RegionId = "spaces" | "feed" | "profiles" | "boards";

export interface Point {
  x: number;
  y: number;
}

export interface PlanetGeometry {
  id: RegionId;
  /** Planet centre and body radius. */
  x: number;
  y: number;
  r: number;
  /** Index into `orbits`. */
  orbit: number;
  /** Where the name is lettered (baseline point and text-anchor). */
  label: Point & { anchor: "middle" | "start" };
}

export interface FlightLeg {
  d: string;
  length: number;
  /** Cumulative fraction of the flight at the end of this leg (drives staggered reveals). */
  at: number;
}

export interface Star {
  x: number;
  y: number;
  r: number;
  twinkle: boolean;
}

export interface StarChart {
  width: number;
  height: number;
  center: Point;
  /** Eclipse disc radius. */
  eclipse: number;
  /** Orbit ellipses: all share the centre and tilt. */
  orbits: { rx: number; ry: number }[];
  tilt: number;
  /** In visit order: the flight reaches planets[i] at legs[i].at. */
  planets: PlanetGeometry[];
  stars: Star[];
  launch: Point;
  legs: FlightLeg[];
}

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
const rad = (d: number) => (d * Math.PI) / 180;

const WIDTH = 1000;
const HEIGHT = 700;
const CENTER = { x: 500, y: 352 };
const TILT = -12;
const ECLIPSE = 66;

const ORBITS = [150, 238, 326, 414].map((rx) => ({ rx, ry: Math.round(rx * 0.44) }));

/** Planets in flight order. `at` is the angle along the orbit (0° = right, 90° = down). */
const PLAN: {
  id: RegionId;
  orbit: number;
  at: number;
  r: number;
  label: "above" | "below" | "right";
}[] = [
  { id: "spaces", orbit: 3, at: 240, r: 36, label: "above" },
  { id: "feed", orbit: 2, at: 318, r: 29, label: "above" },
  { id: "profiles", orbit: 1, at: 55, r: 27, label: "right" },
  { id: "boards", orbit: 2, at: 125, r: 32, label: "below" },
];

/** A point on a tilted orbit. */
export function onOrbit(orbit: { rx: number; ry: number }, deg: number, tilt = TILT): Point {
  const x = orbit.rx * Math.cos(rad(deg));
  const y = orbit.ry * Math.sin(rad(deg));
  const t = rad(tilt);
  return {
    x: CENTER.x + x * Math.cos(t) - y * Math.sin(t),
    y: CENTER.y + x * Math.sin(t) + y * Math.cos(t),
  };
}

/** Quadratic Bézier from a to b, bowed away from the chart centre so legs arc around the eclipse. */
function arc(a: Point, b: Point, bow: number) {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const away = { x: mid.x - CENTER.x, y: mid.y - CENTER.y };
  const len = Math.hypot(away.x, away.y) || 1;
  const c = { x: mid.x + (away.x / len) * bow, y: mid.y + (away.y / len) * bow };
  const d = `M${r1(a.x)},${r1(a.y)} Q${r1(c.x)},${r1(c.y)} ${r1(b.x)},${r1(b.y)}`;
  let length = 0;
  let prev = a;
  for (let i = 1; i <= 40; i++) {
    const t = i / 40;
    const p = {
      x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t ** 2 * b.x,
      y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t ** 2 * b.y,
    };
    length += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return { d, length };
}

/** Pull `to` back towards `from` by `by` units (legs stop at the waypoint ring, not the core). */
function stopShort(from: Point, to: Point, by: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: to.x - (dx / len) * by, y: to.y - (dy / len) * by };
}

export function buildStarChart(seed = 20260927): StarChart {
  const rand = mulberry32(seed);

  const planets: PlanetGeometry[] = PLAN.map((p) => {
    const c = onOrbit(ORBITS[p.orbit] as { rx: number; ry: number }, p.at);
    const label =
      p.label === "right"
        ? { x: r1(c.x + p.r + 18), y: r1(c.y + 7), anchor: "start" as const }
        : {
            x: r1(c.x),
            y: r1(p.label === "above" ? c.y - p.r - 22 : c.y + p.r + 36),
            anchor: "middle" as const,
          };
    return {
      id: p.id,
      x: r1(c.x),
      y: r1(c.y),
      r: p.r,
      orbit: p.orbit,
      label,
    };
  });

  const stars: Star[] = Array.from({ length: 170 }, () => ({
    x: r1(rand() * WIDTH),
    y: r1(rand() * HEIGHT),
    r: r1(0.5 + rand() ** 3 * 1.6),
    twinkle: rand() < 0.22,
  }));

  const launch = { x: 46, y: 470 };
  const WAYPOINT = 14; // gap between a planet's body and where the path meets it
  const stops: Point[] = [launch, ...planets];
  const raw = planets.map((p, i) => {
    const from = stops[i] as Point;
    const a = i === 0 ? from : stopShort(p, from, (planets[i - 1] as PlanetGeometry).r + WAYPOINT);
    const b = stopShort(from, p, p.r + WAYPOINT);
    return arc(a, b, i === 0 ? 40 : 70);
  });
  const last = planets[planets.length - 1] as PlanetGeometry;
  raw.push(
    arc(stopShort(CENTER, last, last.r + WAYPOINT), stopShort(last, CENTER, ECLIPSE + 22), -30),
  );

  const total = raw.reduce((acc, l) => acc + l.length, 0);
  let run = 0;
  const legs = raw.map((l) => {
    run += l.length;
    return { d: l.d, length: r1(l.length), at: Math.round((run / total) * 1000) / 1000 };
  });

  return {
    width: WIDTH,
    height: HEIGHT,
    center: CENTER,
    eclipse: ECLIPSE,
    orbits: ORBITS,
    tilt: TILT,
    planets,
    stars,
    launch,
    legs,
  };
}
