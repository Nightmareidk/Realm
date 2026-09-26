/**
 * The Atlas map, computed once on the server as plain SVG path data.
 * Deterministic (seeded) so every render draws the same continent.
 *
 * One continent; four regions (Spaces, Feed, Profiles, Boards) are wedges that all meet
 * at a single hub. Contour rings sit on each region's high ground; busier regions draw
 * tighter rings. A magenta orienteering course runs start → one control per region → hub.
 */

export type RegionId = "spaces" | "feed" | "profiles" | "boards";

export interface Point {
  x: number;
  y: number;
}

export interface RegionGeometry {
  id: RegionId;
  /** Wedge shape (clip it to the continent when drawing). */
  area: string;
  /** Contours always shown. */
  contours: string[];
  /** Half-step contours that fade in when the region is active: "the lines tighten". */
  activeContours: string[];
  label: Point;
  control: Point;
  gridRef: string;
}

export interface CourseLeg {
  d: string;
  length: number;
  /** Cumulative fraction of the course at the end of this leg (drives staggered reveals). */
  at: number;
}

export interface MapGeometry {
  width: number;
  height: number;
  frame: { x: number; y: number; w: number; h: number };
  columns: { label: string; x: number }[];
  rows: { label: string; y: number }[];
  gridLines: string;
  continent: string;
  coastEchoes: string[];
  islands: string[];
  borders: string[];
  regions: RegionGeometry[];
  hub: Point;
  start: { points: string; at: Point };
  legs: CourseLeg[];
  courseLength: number;
}

// ── Seeded noise ────────────────────────────────────────────────────────────

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
const deg = (d: number) => (d * Math.PI) / 180;

// ── Path helpers ────────────────────────────────────────────────────────────

/** Closed Catmull-Rom spline through points, as cubic Béziers. */
function closedSpline(points: Point[]): string {
  const n = points.length;
  const p = (i: number) => points[((i % n) + n) % n] as Point;
  let d = `M${r1(p(0).x)},${r1(p(0).y)}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += `C${r1(c1.x)},${r1(c1.y)} ${r1(c2.x)},${r1(c2.y)} ${r1(p2.x)},${r1(p2.y)}`;
  }
  return `${d}Z`;
}

/** Open Catmull-Rom spline (endpoints duplicated). */
function openSpline(points: Point[]): string {
  const n = points.length;
  const p = (i: number) => points[Math.max(0, Math.min(n - 1, i))] as Point;
  let d = `M${r1(p(0).x)},${r1(p(0).y)}`;
  for (let i = 0; i < n - 1; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += `C${r1(c1.x)},${r1(c1.y)} ${r1(c2.x)},${r1(c2.y)} ${r1(p2.x)},${r1(p2.y)}`;
  }
  return d;
}

function blob(
  center: Point,
  radius: number,
  rand: () => number,
  { steps = 64, aspect = 1, wobble = 0.12 } = {},
): Point[] {
  const phases = [rand(), rand(), rand(), rand()].map((v) => v * Math.PI * 2);
  const amps = [wobble, wobble * 0.6, wobble * 0.35, wobble * 0.2];
  const freqs = [2, 3, 5, 7];
  return Array.from({ length: steps }, (_, i) => {
    const t = (i / steps) * Math.PI * 2;
    const k = amps.reduce((acc, a, j) => acc + a * Math.sin((freqs[j] as number) * t + (phases[j] as number)), 1);
    return { x: center.x + Math.cos(t) * radius * k * aspect, y: center.y + Math.sin(t) * radius * k };
  });
}

// ── The map ─────────────────────────────────────────────────────────────────

const REGION_ORDER: { id: RegionId; from: number; to: number; activity: number }[] = [
  // Angles in SVG degrees (0 = east, 90 = south). Borders at -98, -8, 84, 172.
  { id: "spaces", from: 172, to: 262, activity: 7 },
  { id: "feed", from: 262, to: 352, activity: 8 },
  { id: "profiles", from: 352, to: 444, activity: 5 },
  { id: "boards", from: 84, to: 172, activity: 6 },
];

export function buildMapGeometry(seed = 20260926): MapGeometry {
  const rand = mulberry32(seed);
  const width = 1000;
  const height = 740;
  const frame = { x: 40, y: 40, w: 920, h: 680 };
  const center: Point = { x: 500, y: 382 };
  const hub: Point = { x: 514, y: 396 };

  // Coordinate grid: A–D across, 1–4 down.
  const colW = frame.w / 4;
  const rowH = frame.h / 4;
  const columns = ["A", "B", "C", "D"].map((label, i) => ({ label, x: r1(frame.x + colW * (i + 0.5)) }));
  const rows = ["1", "2", "3", "4"].map((label, i) => ({ label, y: r1(frame.y + rowH * (i + 0.5)) }));
  const gridRef = (p: Point) => {
    const c = Math.min(3, Math.max(0, Math.floor((p.x - frame.x) / colW)));
    const r = Math.min(3, Math.max(0, Math.floor((p.y - frame.y) / rowH)));
    return `${"ABCD"[c]}${r + 1}`;
  };
  const gridLines = [
    ...[1, 2, 3].map((i) => `M${r1(frame.x + colW * i)},${frame.y}V${frame.y + frame.h}`),
    ...[1, 2, 3].map((i) => `M${frame.x},${r1(frame.y + rowH * i)}H${frame.x + frame.w}`),
  ].join("");

  // Continent: a noisy radial shape, wider than tall.
  const R = 268;
  const phases = Array.from({ length: 5 }, () => rand() * Math.PI * 2);
  const coastRadius = (t: number) =>
    R *
    (1 +
      0.1 * Math.sin(3 * t + (phases[0] as number)) +
      0.055 * Math.sin(5 * t + (phases[1] as number)) +
      0.035 * Math.sin(7 * t + (phases[2] as number)) +
      0.022 * Math.sin(11 * t + (phases[3] as number)) +
      0.012 * Math.sin(17 * t + (phases[4] as number)));
  const coastPoint = (t: number, scale = 1): Point => ({
    x: center.x + Math.cos(t) * coastRadius(t) * 1.34 * scale,
    y: center.y + Math.sin(t) * coastRadius(t) * 0.97 * scale,
  });
  const coast = Array.from({ length: 160 }, (_, i) => coastPoint((i / 160) * Math.PI * 2));
  const continent = closedSpline(coast);
  const coastEchoes = [1.035, 1.075].map((s) =>
    closedSpline(Array.from({ length: 160 }, (_, i) => coastPoint((i / 160) * Math.PI * 2, s))),
  );

  const islands = [
    { c: { x: 118, y: 628 }, r: 24 },
    { c: { x: 878, y: 104 }, r: 18 },
    { c: { x: 912, y: 604 }, r: 12 },
  ].map(({ c, r }) => closedSpline(blob(c, r, rand, { steps: 24, aspect: 1.4, wobble: 0.18 })));

  // Borders radiate from the hub with a gentle meander, well past the coast.
  const borderAngles = [262, 352, 84, 172];
  const borderPoints = new Map<number, Point[]>();
  for (const a of borderAngles) {
    const phase = rand() * Math.PI * 2;
    const pts: Point[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const dist = t * 620;
      const wobble = 24 * Math.sin(t * Math.PI * 2.2 + phase) * t ** 0.7;
      pts.push({
        x: hub.x + Math.cos(deg(a)) * dist + Math.cos(deg(a + 90)) * wobble,
        y: hub.y + Math.sin(deg(a)) * dist + Math.sin(deg(a + 90)) * wobble,
      });
    }
    borderPoints.set(a % 360, pts);
  }
  const borders = borderAngles.map((a) => openSpline(borderPoints.get(a % 360) as Point[]));

  const regions: RegionGeometry[] = REGION_ORDER.map(({ id, from, to, activity }) => {
    const out = borderPoints.get(from % 360) as Point[];
    const back = [...(borderPoints.get(to % 360) as Point[])].reverse();
    const arc: Point[] = [];
    for (let a = from; a <= to; a += 6) {
      arc.push({ x: hub.x + Math.cos(deg(a)) * 900, y: hub.y + Math.sin(deg(a)) * 900 });
    }
    const wedge = [hub, ...out.slice(1), ...arc, ...back.slice(0, -1)];
    const area = `M${wedge.map((p) => `${r1(p.x)},${r1(p.y)}`).join("L")}Z`;

    const mid = deg((from + to) / 2);
    const peak = { x: hub.x + Math.cos(mid) * 190 * 1.18, y: hub.y + Math.sin(mid) * 150 };
    const maxRadius = 150;
    const ring = (k: number) =>
      closedSpline(blob(peak, (maxRadius * k) / activity, rand, { steps: 48, aspect: 1.3, wobble: 0.14 }));
    const contours = Array.from({ length: activity }, (_, i) => ring(i + 1));
    const activeContours = Array.from({ length: activity - 1 }, (_, i) => ring(i + 1.5));

    const label = { x: hub.x + Math.cos(mid) * 150 * 1.25, y: hub.y + Math.sin(mid) * 118 };
    const control = { x: hub.x + Math.cos(mid) * 268 * 1.12, y: hub.y + Math.sin(mid) * 196 };
    return { id, area, contours, activeContours, label, control, gridRef: gridRef(peak) };
  });

  // Course: start on the Spaces coast, then Spaces → Feed → Profiles → Boards → hub.
  const startAt = coastPoint(deg(200), 0.9);
  const tri = 17;
  const start = {
    at: startAt,
    points: [0, 120, 240]
      .map((a) => `${r1(startAt.x + Math.cos(deg(a - 90)) * tri)},${r1(startAt.y + Math.sin(deg(a - 90)) * tri)}`)
      .join(" "),
  };
  const stops: { p: Point; r: number }[] = [
    { p: startAt, r: tri * 0.9 },
    ...REGION_ORDER.map(({ id }) => ({ p: (regions.find((g) => g.id === id) as RegionGeometry).control, r: 15 })),
    { p: hub, r: 18 },
  ];
  const legsRaw = stops.slice(0, -1).map((s, i) => {
    const e = stops[i + 1] as { p: Point; r: number };
    const dx = e.p.x - s.p.x;
    const dy = e.p.y - s.p.y;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    const a = { x: s.p.x + ux * (s.r + 4), y: s.p.y + uy * (s.r + 4) };
    const b = { x: e.p.x - ux * (e.r + 4), y: e.p.y - uy * (e.r + 4) };
    return { d: `M${r1(a.x)},${r1(a.y)}L${r1(b.x)},${r1(b.y)}`, length: Math.hypot(b.x - a.x, b.y - a.y) };
  });
  const courseLength = legsRaw.reduce((acc, l) => acc + l.length, 0);
  let run = 0;
  const legs = legsRaw.map((l) => {
    run += l.length;
    return { ...l, length: r1(l.length), at: Math.round((run / courseLength) * 1000) / 1000 };
  });

  return {
    width,
    height,
    frame,
    columns,
    rows,
    gridLines,
    continent,
    coastEchoes,
    islands,
    borders,
    regions,
    hub,
    start,
    legs,
    courseLength: r1(courseLength),
  };
}
