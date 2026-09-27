import * as THREE from "three";

/** Aurora colours for the 3D world (fixed; the scene doesn't change with the theme). */
export const C = {
  ink: "#0c0b22",
  midnight: "#08081e",
  suit: "#f1f1f7",
  suitShade: "#cfd0e2",
  // The action accent (molten amber). Kept under its old key so existing parts pick it up.
  lime: "#ffb23d",
  amber: "#ffb23d",
  orange: "#fa7c20",
  teal: "#29d7d9",
  blue: "#4998fe",
  violet: "#a76ef8",
  pink: "#fb55b1",
  white: "#f7f7ff",
} as const;

const cache = new Map<string, THREE.Material>();

/** Glossy vinyl-toy plastic: soft diffuse, strong clearcoat. Materials are shared per colour. */
export function toy(
  color: string,
  opts: { rough?: number; emissive?: string; glow?: number } = {},
) {
  const key = `${color}|${opts.rough ?? ""}|${opts.emissive ?? ""}|${opts.glow ?? ""}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({
      color,
      roughness: opts.rough ?? 0.42,
      clearcoat: 1,
      clearcoatRoughness: 0.18,
      emissive: opts.emissive ? new THREE.Color(opts.emissive) : undefined,
      emissiveIntensity: opts.glow ?? 0,
    });
    cache.set(key, m);
  }
  return m;
}

/**
 * A banded planet surface: soft horizontal stripes in lighter and darker shades of one colour,
 * drawn on a canvas (seeded, so every render matches) and finished in the same clearcoat plastic.
 */
export function banded(color: string, seed = (Number.parseInt(color.slice(1), 16) % 997) + 1) {
  const key = `band|${color}|${seed}`;
  let m = cache.get(key);
  if (!m) {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    const base = new THREE.Color(color);
    let a = seed * 9973;
    const rand = () => {
      a = (a * 16807) % 2147483647;
      return a / 2147483647;
    };
    if (ctx) {
      let y = 0;
      while (y < 256) {
        const h = 10 + rand() * 34;
        const c = base
          .clone()
          .offsetHSL((rand() - 0.5) * 0.03, (rand() - 0.5) * 0.08, (rand() - 0.55) * 0.14);
        ctx.fillStyle = `#${c.getHexString()}`;
        ctx.fillRect(0, y, 16, h + 1);
        y += h;
      }
      // Soften the stripe edges.
      ctx.filter = "blur(3px)";
      ctx.drawImage(canvas, 0, 0);
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    m = new THREE.MeshPhysicalMaterial({
      map,
      roughness: 0.5,
      clearcoat: 1,
      clearcoatRoughness: 0.2,
    });
    cache.set(key, m);
  }
  return m;
}

/** Dark glass with a rainbow thin-film sheen: astronaut visors, the eclipse. */
export function iridescent(color = "#0b1222") {
  const key = `iri|${color}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.3,
      roughness: 0.06,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      iridescence: 1,
      iridescenceIOR: 1.35,
      iridescenceThicknessRange: [180, 900],
    });
    cache.set(key, m);
  }
  return m;
}

/** Soft self-lit material for glows (eyes, beacons, rims). */
export function glow(color: string, opacity = 1) {
  const key = `glow|${color}|${opacity}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      blending: opacity < 1 ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: opacity >= 1,
      toneMapped: false,
    });
    cache.set(key, m);
  }
  return m;
}

/** Flat-shaded matte material for rock and terrain. */
export function matte(color: string, flat = false) {
  const key = `matte|${color}|${flat}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: flat });
    cache.set(key, m);
  }
  return m;
}

/** A four-point sparkle (the Realm spark) as an extrudable shape. */
export function sparkShape(r = 1, k = 0.22) {
  const s = new THREE.Shape();
  const q = r * k;
  s.moveTo(0, r);
  s.quadraticCurveTo(q, q, r, 0);
  s.quadraticCurveTo(q, -q, 0, -r);
  s.quadraticCurveTo(-q, -q, -r, 0);
  s.quadraticCurveTo(-q, q, 0, r);
  return s;
}

/** A heart as an extrudable shape. */
export function heartShape(size = 1) {
  const s = new THREE.Shape();
  const x = 0;
  const y = 0;
  s.moveTo(x, y + 0.35 * size);
  s.bezierCurveTo(
    x,
    y + 0.7 * size,
    x - 0.55 * size,
    y + 0.75 * size,
    x - 0.55 * size,
    y + 0.35 * size,
  );
  s.bezierCurveTo(x - 0.55 * size, y, x - 0.2 * size, y - 0.25 * size, x, y - 0.5 * size);
  s.bezierCurveTo(
    x + 0.2 * size,
    y - 0.25 * size,
    x + 0.55 * size,
    y,
    x + 0.55 * size,
    y + 0.35 * size,
  );
  s.bezierCurveTo(x + 0.55 * size, y + 0.75 * size, x, y + 0.7 * size, x, y + 0.35 * size);
  return s;
}

/** A chat bubble: a rounded rectangle with a tail at the bottom left, as one extrudable shape. */
export function bubbleShape(w = 1.5, h = 1, r = 0.3) {
  const s = new THREE.Shape();
  const x0 = -w / 2;
  const y0 = -h / 2;
  s.moveTo(x0 + r, y0);
  s.lineTo(x0 + w * 0.36, y0);
  // The tail: out and down, then back into the bottom edge.
  s.quadraticCurveTo(x0 + w * 0.22, y0 - h * 0.12, x0 + w * 0.12, y0 - h * 0.34);
  s.quadraticCurveTo(x0 + w * 0.14, y0 - h * 0.08, x0 + w * 0.1, y0 + 0.02);
  s.quadraticCurveTo(x0, y0, x0, y0 + r);
  s.lineTo(x0, y0 + h - r);
  s.quadraticCurveTo(x0, y0 + h, x0 + r, y0 + h);
  s.lineTo(x0 + w - r, y0 + h);
  s.quadraticCurveTo(x0 + w, y0 + h, x0 + w, y0 + h - r);
  s.lineTo(x0 + w, y0 + r);
  s.quadraticCurveTo(x0 + w, y0, x0 + w - r, y0);
  s.closePath();
  return s;
}

/** A play triangle with rounded corners, pointing right, centred on its visual centre. */
export function playShape(size = 1, round = 0.12) {
  const pts = [
    new THREE.Vector2(-size * 0.42, size * 0.5),
    new THREE.Vector2(size * 0.58, 0),
    new THREE.Vector2(-size * 0.42, -size * 0.5),
  ];
  const s = new THREE.Shape();
  pts.forEach((p, i) => {
    const prev = pts[(i + 2) % 3] as THREE.Vector2;
    const next = pts[(i + 1) % 3] as THREE.Vector2;
    const a = p.clone().lerp(prev, round);
    const b = p.clone().lerp(next, round);
    if (i === 0) s.moveTo(a.x, a.y);
    else s.lineTo(a.x, a.y);
    s.quadraticCurveTo(p.x, p.y, b.x, b.y);
  });
  s.closePath();
  return s;
}

/** Brushed metal for small hardware (lock shackle, rivets). */
export function metal(color = "#d5dde9") {
  const key = `metal|${color}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.9,
      roughness: 0.28,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
    });
    cache.set(key, m);
  }
  return m;
}

/** An upvote arrow as an extrudable shape. */
export function arrowShape(size = 1) {
  const s = new THREE.Shape();
  const w = size;
  s.moveTo(0, w * 0.6);
  s.lineTo(w * 0.5, 0);
  s.lineTo(w * 0.2, 0);
  s.lineTo(w * 0.2, -w * 0.55);
  s.lineTo(-w * 0.2, -w * 0.55);
  s.lineTo(-w * 0.2, 0);
  s.lineTo(-w * 0.5, 0);
  s.closePath();
  return s;
}

export const bevel = {
  bevelEnabled: true,
  bevelThickness: 0.06,
  bevelSize: 0.05,
  bevelSegments: 8,
  curveSegments: 40,
};
