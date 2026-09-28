"use client";

import { Billboard } from "@react-three/drei";
import { type ThreeElements, useFrame } from "@react-three/fiber";
import { type RefObject, useMemo, useRef } from "react";
import * as THREE from "three";
import { auroraPhase, type DayMix, ease } from "./theme";

/**
 * The heart of the night sky: a black hole, alive.
 *
 * A dark shadow; a razor-thin photon ring where light races round the hole (brighter on the side
 * turning toward you); a hot accretion disk seen almost edge-on, its near side sweeping in front
 * of the hole and its far side bent up over the top (and faintly under the bottom) by gravity.
 * The disk turns the way real ones do, inner orbits faster than outer ones, its turbulence sheared
 * into long soft arcs, with hot clumps orbiting in it. A soft violet and blue glow surrounds it.
 * Faint jets stream from the poles, knots of light travelling out along them. Every few seconds a
 * magnetic flare erupts on the ring, flashes a starburst and a lens streak, and is carried round
 * the hole as it fades. Molten amber and white-hot gold inside; the outer haze cycles with the
 * aurora.
 *
 * By day (`mix` → 1) it slides off the sun it has been hiding, up and out of frame, flaring as it
 * crosses; switching back to night it slides back across the sun and covers it again.
 */
export const HOLE_RADIUS = 1.5;
const SIZE = 16;

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const COMMON = /* glsl */ `
uniform float uTime;
uniform float uPhase;
uniform float uIgnite;
uniform float uRs;
varying vec2 vUv;

float hash11(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float hash21(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}
// Value noise that repeats every so many cells along y. Angles go on y (scaled so a full turn is a
// whole number of cells), so there's no seam where they wrap round.
float noiseP(vec2 p, float period) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float y0 = mod(i.y, period);
  float y1 = mod(i.y + 1.0, period);
  return mix(mix(hash21(vec2(i.x, y0)), hash21(vec2(i.x + 1.0, y0)), u.x),
             mix(hash21(vec2(i.x, y1)), hash21(vec2(i.x + 1.0, y1)), u.x), u.y);
}
const float TURN = 0.15915494; // 1 / 2pi
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
vec3 cycle(vec3 a, vec3 b, vec3 c, float t) {
  float x = fract(t) * 3.0;
  if (x < 1.0) return mix(a, b, smoothstep(0.0, 1.0, x));
  if (x < 2.0) return mix(b, c, smoothstep(0.0, 1.0, x - 1.0));
  return mix(c, a, smoothstep(0.0, 1.0, x - 2.0));
}
// Signed angle from b to a, wrapped to -pi..pi.
float dAngle(float a, float b) { return atan(sin(a - b), cos(a - b)); }

const float RIN = 1.55;
const float ROUT = 4.0;
const float INCL = 0.17;

// Keplerian angular speed: inner orbits are faster.
float omega(float r) { return 1.54 * pow(r, -1.5); }

// Emission of the disk at radius r (in shadow radii) and orbital angle a. Differential rotation
// shears the turbulence into spiral streaks; hot clumps orbit with trailing tails; temperature
// falls off from white-gold to deep ember.
vec3 disk(float r, float a, float approach) {
  float inner = smoothstep(RIN - 0.05, RIN + 0.25, r);
  float outer = 1.0 - smoothstep(ROUT * 0.62, ROUT, r);
  if (inner * outer <= 0.0) return vec3(0.0);
  // Turbulent gas: soft clouds carried round and sheared by the orbits. Inner orbits are faster,
  // so a pattern left to spin winds tighter and tighter into thin rings; instead each pattern
  // lives a few seconds and crossfades into a fresh one (two overlapping phases), so the gas
  // always flows and shears but never winds up.
  const float LIFE = 6.0;
  float ph1 = fract(uTime / LIFE);
  float ph2 = fract(uTime / LIFE + 0.5);
  float w1 = 1.0 - abs(2.0 * ph1 - 1.0);
  vec2 o1 = vec2(floor(uTime / LIFE) * 3.1, 0.0);
  vec2 o2 = vec2(floor(uTime / LIFE + 0.5) * 3.1 + 11.0, 0.0);
  float s1 = a - omega(r) * ph1 * LIFE;
  float s2 = a - omega(r) * ph2 * LIFE;
  float turb = fbm(vec2(r * 1.5, 0.0) + vec2(sin(s1), cos(s1)) * 1.8 + o1) * w1
             + fbm(vec2(r * 1.5, 0.0) + vec2(sin(s2), cos(s2)) * 1.8 + o2) * (1.0 - w1);
  float streak = fbm(vec2(r * 2.2 + 5.0, 3.0) + vec2(sin(s1 * 2.0), cos(s1 * 2.0)) * 1.4 + o1) * w1
               + fbm(vec2(r * 2.2 + 5.0, 3.0) + vec2(sin(s2 * 2.0), cos(s2 * 2.0)) * 1.4 + o2) * (1.0 - w1);
  // Averaging two patterns flattens them; restore their contrast around the middle.
  turb = 0.5 + (turb - 0.5) * 1.35;
  streak = 0.5 + (streak - 0.5) * 1.35;
  float heat = pow(RIN / r, 2.0);

  // Hot clumps, each on its own orbit, with a sharp leading edge and a long tail.
  float clumps = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float rr = 1.85 + fi * 0.62;
    float lead = dAngle(a, uTime * omega(rr) + fi * 2.39);
    float along = lead > 0.0 ? lead * lead / 0.012 : lead * lead / 0.55;
    float beat = 0.7 + 0.3 * sin(uTime * (1.3 + fi * 0.4) + fi * 5.0);
    clumps += exp(-pow((r - rr) / 0.16, 2.0) - along) * beat;
  }

  // The gas flickers: brightness wanders a little over time.
  float flicker = 0.88 + 0.24 * noise(vec2(uTime * 0.9 + cos(a), r * 1.7 + sin(a)));
  float glow = heat * (0.55 + 0.9 * turb * turb * 1.5) * (0.78 + 0.4 * streak) * flicker;
  glow += clumps * heat * 1.3;
  glow *= inner * outer * 1.35;

  vec3 white = vec3(1.25, 1.12, 0.92);
  vec3 gold = vec3(1.0, 0.72, 0.3);
  vec3 ember = vec3(0.92, 0.32, 0.1);
  vec3 col = mix(ember, gold, smoothstep(0.08, 0.45, heat));
  col = mix(col, white, smoothstep(0.55, 1.0, heat) + clumps * 0.35);
  // Doppler beaming: the side spinning toward us is brighter and whiter.
  float beam = clamp(1.0 + 0.6 * approach, 0.35, 1.6);
  col = mix(col, gold, clamp(approach, 0.0, 1.0) * 0.2);
  return col * glow * beam;
}
`;

const shadowFragment = /* glsl */ `
${COMMON}
void main() {
  vec2 p = (vUv * 2.0 - 1.0) / uRs;
  float rho = length(p);
  gl_FragColor = vec4(0.0, 0.0, 0.0, smoothstep(1.02, 0.97, rho));
}
`;

const lightFragment = /* glsl */ `
${COMMON}
void main() {
  vec2 c = vUv * 2.0 - 1.0;
  vec2 p = c / uRs;
  float rho = length(p);
  float ang = atan(p.y, p.x);
  // Everything fades well before the edge of the plane, so it never shows as a square.
  float edge = 1.0 - smoothstep(0.55, 1.0, length(c));
  float edgeX = 1.0 - smoothstep(0.6, 1.0, abs(c.x));
  float edgeY = 1.0 - smoothstep(0.6, 1.0, abs(c.y));
  float ig = uIgnite;
  vec3 col = vec3(0.0);

  // Infalling gas: a soft violet and blue glow, slowly turning, thinning with distance.
  vec3 hazeA = cycle(vec3(0.5, 0.32, 1.0), vec3(0.3, 0.5, 1.0), vec3(0.85, 0.3, 0.8), uPhase);
  vec3 hazeB = cycle(vec3(0.3, 0.55, 1.0), vec3(0.8, 0.35, 0.9), vec3(0.55, 0.35, 1.0), uPhase);
  float swirl = fbm(vec2(cos(ang + uTime * 0.03), sin(ang + uTime * 0.03)) * 1.3 + vec2(rho * 0.9 - uTime * 0.06, 0.0));
  float haze = exp(-(rho - 1.0) * 1.1) * smoothstep(0.98, 1.4, rho) * edge;
  col += mix(hazeA, hazeB, swirl) * haze * (0.08 + 0.12 * swirl);

  // Polar jets: two thin beams of blue-white plasma, knots of light running outward along them.
  float h = abs(p.y);
  float width = 0.1 + h * 0.07;
  float beamLine = exp(-p.x * p.x / (width * width));
  float knots = 0.55 + 0.45 * sin(h * 4.2 - uTime * 3.2) * (0.6 + 0.4 * noise(vec2(h * 2.0 - uTime * 1.5, 3.0)));
  float jet = beamLine * knots * exp(-h * 0.42) * smoothstep(1.05, 1.9, h) * edgeY;
  col += mix(vec3(0.45, 0.6, 1.0), vec3(0.8, 0.9, 1.0), beamLine) * jet * 0.14;

  // The far side of the disk, lensed into a band hugging the shadow: thick above, thinner below.
  float lensTop = 0.5 + 0.5 * sin(ang);
  float bandOuter = 1.06 + mix(0.55, 1.35, pow(lensTop, 1.2));
  float band = smoothstep(1.03, 1.1, rho) * (1.0 - smoothstep(bandOuter - 0.25, bandOuter, rho));
  if (band > 0.0) {
    float rl = RIN + (rho - 1.06) / max(bandOuter - 1.06, 0.1) * (ROUT - RIN) * 0.8;
    col += disk(rl, ang + 3.14159, -cos(ang)) * band * mix(0.55, 1.15, lensTop) * (1.0 + ig * 2.0);
  }

  // Photon ring: light orbiting the hole once before escaping. Arcs of it race round the ring,
  // brighter on the side turning toward us.
  float race = 0.55 + 0.75 * noiseP(vec2(uTime * 0.35, (ang - uTime * 0.92) * TURN * 16.0), 16.0)
             + 0.35 * noiseP(vec2(1.7, (ang + uTime * 0.44) * TURN * 44.0), 44.0);
  float side = 1.0 + 0.4 * -cos(ang);
  float ringCore = exp(-pow((rho - 1.035) / 0.02, 2.0));
  float ringGlow = exp(-pow((rho - 1.035) / 0.09, 2.0));
  col += vec3(1.25, 1.02, 0.78) * ringCore * 1.3 * race * side * (1.0 + ig * 3.0);
  col += vec3(1.0, 0.7, 0.35) * ringGlow * 0.38 * side * (0.8 + 0.4 * race) * (1.0 + ig * 2.0);

  // The disk seen directly. Its far half lies behind the hole; its near half crosses in front.
  vec2 d = vec2(p.x, p.y / INCL);
  float r = length(d);
  float a = atan(d.y, d.x);
  float nearSide = step(p.y, 0.0);
  float hidden = (1.0 - nearSide) * smoothstep(1.03, 0.98, rho);
  // The near side crosses the shadow: brighter there, so it reads as a lit band, not a stripe.
  col += disk(r, a, -p.x / max(r, 0.001)) * (1.0 - hidden)
       * (1.0 + nearSide * smoothstep(1.2, 0.6, rho) * 0.8) * (1.0 + ig * 2.5);

  // A magnetic flare every few seconds: it bursts on the ring, flashes a starburst and a lens
  // streak, and is carried round the hole as it fades.
  float period = 5.5;
  float n = floor(uTime / period);
  float life = fract(uTime / period) * period / 1.8;
  if (life < 1.0) {
    float fa = hash11(n + 3.0) * 6.2832 + life * 1.4;
    vec2 fc = vec2(cos(fa), sin(fa)) * 1.07;
    vec2 fd = p - fc;
    float env = smoothstep(0.0, 0.06, life) * pow(1.0 - life, 2.2);
    vec2 af = abs(fd);
    float core = exp(-dot(fd, fd) / 0.006);
    float bloom = exp(-length(fd) * 3.2) * 0.5;
    float spikes = (exp(-af.x * 38.0) * exp(-af.y * 1.8) + exp(-af.y * 38.0) * exp(-af.x * 1.8)) * 0.8;
    float streak = exp(-af.y * 150.0) * exp(-af.x * 0.45) * edgeX;
    col += vec3(1.3, 1.12, 0.9) * (core * 2.4 + bloom + spikes) * env;
    col += vec3(0.55, 0.7, 1.0) * streak * env * 0.9;
  }

  // Switching to day: a white-hot core swelling out of the hole.
  col += vec3(1.2, 1.0, 0.78) * exp(-max(rho - 1.0, 0.0) * mix(6.0, 1.2, ig)) * ig * ig * 1.5 * edge;

  // Light is added to what's behind (see the material's blending); alpha records how much light
  // there is, so on a transparent canvas (the render stage's poster) dark areas stay clear.
  gl_FragColor = vec4(col, clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0));
}
`;

/** Where the hole goes when it slides off the sun by day: up and away, out of frame. */
// Toward the camera too, so it stays in front of the sun as the sun comes forward.
const AWAY = new THREE.Vector3(9.5, 5.5, 3.0);

export function BlackHole({
  mix,
  still,
  anchor,
  ...props
}: {
  mix: DayMix;
  still: boolean;
  /** Marks the hole's centre as it moves, for the sky's lens and the label occluders. */
  anchor?: RefObject<THREE.Object3D | null>;
} & ThreeElements["group"]) {
  const materials = useMemo(() => {
    const uniforms = () => ({
      uTime: { value: 0 },
      uPhase: { value: 0 },
      uIgnite: { value: 0 },
      uRs: { value: HOLE_RADIUS / (SIZE / 2) },
    });
    return {
      shadow: new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: shadowFragment,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        uniforms: uniforms(),
      }),
      light: new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: lightFragment,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        // Pure addition (colour × 1 + what's behind), with coverage accumulated in alpha.
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        blendSrcAlpha: THREE.OneFactor,
        blendDstAlpha: THREE.OneFactor,
        uniforms: uniforms(),
      }),
    };
  }, []);
  const body = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = still ? 24 : state.clock.elapsedTime + 24;
    const phase = auroraPhase();
    const m = mix.current ?? 0;
    // The disk flares as the hole moves across the sun, and settles when it's gone or back.
    const flare = 0.35 * Math.sin(Math.min(1, Math.max(0, m)) * Math.PI);
    for (const mat of [materials.shadow, materials.light]) {
      const u = mat.uniforms as Record<string, THREE.IUniform<number>>;
      u.uTime.value = t;
      u.uPhase.value = phase;
      u.uIgnite.value = flare;
    }
    // By day it slides off the sun, up and away, shrinking a little with distance.
    const g = body.current;
    if (g) {
      const k = ease(m * 1.1);
      g.position.copy(AWAY).multiplyScalar(k);
      g.scale.setScalar(1 - 0.2 * k);
      g.visible = m < 0.999;
    }
  });

  return (
    <group {...props}>
      <group ref={body}>
        <object3D ref={anchor} />
        <Billboard>
          <mesh material={materials.shadow} renderOrder={1}>
            <planeGeometry args={[SIZE, SIZE]} />
          </mesh>
          <mesh material={materials.light} renderOrder={2}>
            <planeGeometry args={[SIZE, SIZE]} />
          </mesh>
        </Billboard>
      </group>
    </group>
  );
}
