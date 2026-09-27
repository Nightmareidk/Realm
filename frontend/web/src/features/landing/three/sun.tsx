"use client";

import { Billboard } from "@react-three/drei";
import { type ThreeElements, useFrame } from "@react-three/fiber";
import { type RefObject, useMemo, useRef } from "react";
import * as THREE from "three";
import { auroraPhase, type DayMix, ease } from "./theme";

/**
 * The heart of the night sky: a black hole.
 *
 * A dark shadow, a razor-thin photon ring, and a hot accretion disk seen almost edge-on: its near
 * side sweeps across in front of the hole, and its far side is bent by gravity up over the top
 * (and faintly under the bottom), the way light really behaves near a black hole. The disk spins,
 * with inner orbits faster than outer ones; the side spinning toward you is brighter (Doppler
 * beaming). Molten amber and white-hot gold inside, a violet and electric-blue haze outside,
 * cycling with the aurora.
 *
 * By day the black hole collapses away: the day sky is the landscape video behind the canvas.
 * `SUN_RADIUS` / `MOON_RADIUS` keep their names for the label occluders: they are the shadow.
 */
export const HOLE_RADIUS = 1.5;
export const SUN_RADIUS = HOLE_RADIUS;
export const MOON_RADIUS = HOLE_RADIUS;
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
uniform float uNight;
uniform float uRs;
varying vec2 vUv;

float hash21(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}
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

const float RIN = 1.55;
const float ROUT = 4.6;
const float INCL = 0.17;

// Emission of the disk at radius r (in shadow radii) and orbital angle a. Differential rotation
// shears the turbulence into spiral streaks; temperature falls off from white-gold to deep ember.
vec3 disk(float r, float a, float approach) {
  float inner = smoothstep(RIN - 0.05, RIN + 0.25, r);
  float outer = 1.0 - smoothstep(ROUT * 0.62, ROUT, r);
  if (inner * outer <= 0.0) return vec3(0.0);
  float omega = 1.1 * pow(r, -1.5);
  float spin = a - omega * uTime * 1.4;
  float turb = fbm(vec2(r * 2.3, 0.0) + vec2(sin(spin), cos(spin)) * 2.2);
  float streak = noise(vec2(r * 16.0, spin * 3.0)) * 0.6 + noise(vec2(r * 41.0, spin * 5.0)) * 0.4;
  float heat = pow(RIN / r, 1.6);
  float glow = heat * (0.5 + 0.9 * turb) * (0.72 + 0.5 * streak) * inner * outer * 1.35;
  vec3 white = vec3(1.25, 1.12, 0.92);
  vec3 gold = vec3(1.0, 0.72, 0.3);
  vec3 ember = vec3(0.92, 0.32, 0.1);
  vec3 col = mix(ember, gold, smoothstep(0.08, 0.45, heat));
  col = mix(col, white, smoothstep(0.55, 1.0, heat));
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
  gl_FragColor = vec4(0.0, 0.0, 0.0, smoothstep(1.02, 0.97, rho) * uNight);
}
`;

const lightFragment = /* glsl */ `
${COMMON}
void main() {
  vec2 p = (vUv * 2.0 - 1.0) / uRs;
  float rho = length(p);
  float ang = atan(p.y, p.x);
  vec3 col = vec3(0.0);

  // Haze: the storm's violet and electric blue, glowing around the hole.
  vec3 hazeA = cycle(vec3(0.5, 0.32, 1.0), vec3(0.3, 0.5, 1.0), vec3(0.85, 0.3, 0.8), uPhase);
  vec3 hazeB = cycle(vec3(0.3, 0.55, 1.0), vec3(0.8, 0.35, 0.9), vec3(0.55, 0.35, 1.0), uPhase);
  float swirl = fbm(vec2(ang * 1.6 + uTime * 0.05, rho * 1.2 - uTime * 0.08));
  float edge = 1.0 - smoothstep(0.55, 1.0, length(vUv * 2.0 - 1.0));
  col += mix(hazeA, hazeB, swirl) * exp(-(rho - 1.0) * 0.9) * 0.3 * smoothstep(0.98, 1.3, rho) * edge;

  // The far side of the disk, lensed into a band hugging the shadow: thick above, thinner below.
  float lensTop = 0.5 + 0.5 * sin(ang);
  float bandOuter = 1.06 + mix(0.55, 1.35, pow(lensTop, 1.2));
  float band = smoothstep(1.03, 1.1, rho) * (1.0 - smoothstep(bandOuter - 0.25, bandOuter, rho));
  float rl = RIN + (rho - 1.06) / max(bandOuter - 1.06, 0.1) * (ROUT - RIN) * 0.8;
  col += disk(rl, ang + 3.14159, -cos(ang)) * band * mix(0.55, 1.15, lensTop);

  // Photon ring: light that orbits the hole once before escaping.
  col += vec3(1.25, 1.02, 0.78) * exp(-pow((rho - 1.035) / 0.022, 2.0)) * 1.4;
  col += vec3(1.0, 0.7, 0.35) * exp(-pow((rho - 1.035) / 0.09, 2.0)) * 0.35;

  // The disk seen directly. Its far half lies behind the hole; its near half crosses in front.
  vec2 d = vec2(p.x, p.y / INCL);
  float r = length(d);
  float a = atan(d.y, d.x);
  float nearSide = step(p.y, 0.0);
  float hidden = (1.0 - nearSide) * smoothstep(1.03, 0.98, rho);
  // The near side crosses the shadow: brighter there, so it reads as a lit band, not a stripe.
  col += disk(r, a, -p.x / max(r, 0.001)) * (1.0 - hidden) * (1.0 + nearSide * smoothstep(1.2, 0.6, rho) * 0.8);

  gl_FragColor = vec4(col * uNight, 1.0);
}
`;

export function Eclipse({
  mix,
  still,
  moon,
  sunAnchor,
  ...props
}: {
  mix: DayMix;
  still: boolean;
  moon?: RefObject<THREE.Object3D | null>;
  sunAnchor?: RefObject<THREE.Object3D | null>;
} & ThreeElements["group"]) {
  const materials = useMemo(() => {
    const uniforms = () => ({
      uTime: { value: 0 },
      uPhase: { value: 0 },
      uNight: { value: 1 },
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
        blending: THREE.AdditiveBlending,
        uniforms: uniforms(),
      }),
    };
  }, []);
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = still ? 24 : state.clock.elapsedTime + 24;
    const night = 1 - ease(mix.current * 1.4);
    const phase = auroraPhase();
    for (const m of [materials.shadow, materials.light]) {
      const u = m.uniforms as Record<string, THREE.IUniform<number>>;
      u.uTime.value = t;
      u.uPhase.value = phase;
      u.uNight.value = night;
    }
    // By day the hole collapses to a point and is gone.
    if (group.current) {
      group.current.scale.setScalar(Math.max(0.001, 0.25 + night * 0.75));
      group.current.visible = night > 0.002;
    }
  });

  return (
    <group {...props}>
      <object3D ref={sunAnchor} />
      <object3D ref={moon} />
      <group ref={group}>
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
