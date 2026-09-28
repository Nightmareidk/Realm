"use client";

import { Billboard } from "@react-three/drei";
import { type ThreeElements, useFrame } from "@react-three/fiber";
import { type RefObject, useMemo, useRef } from "react";
import * as THREE from "three";
import { type DayMix, ease } from "./theme";

/**
 * The day's centrepiece: the sun, hidden behind the black hole at night.
 *
 * A sphere of granulated plasma: fine convection cells over slow swirls, sunspots with dark
 * cores, bright faculae toward the limb, limb darkening from white-gold to deep orange. Around it,
 * facing the camera: a warm halo, a corona of streamers and fine filaments flowing outward with
 * flares that rise and fade, and arcs of plasma looping up from the limb.
 *
 * `mix` (0 night, 1 day) plays the eclipse: at night the sun sits back, small, behind the black
 * hole; as the hole slides away it comes forward to full size and its glow rises, blazing a little
 * while half uncovered. The glow is added light, so the day film behind stays clear rather than
 * being washed over.
 */
export const SUN_RADIUS = 1.85;
const CORONA_SIZE = 13;

const NOISE = /* glsl */ `
float h3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float n3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm3d(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * n3(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return v;
}
vec3 h33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
vec2 worley(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int x = -1; x <= 1; x++)
  for (int y = -1; y <= 1; y++)
  for (int z = -1; z <= 1; z++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 r = g + h33(i + g) - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return vec2(sqrt(d1), sqrt(d2));
}
`;

const sunVertex = /* glsl */ `
varying vec3 vN;
varying vec3 vView;
varying vec3 vPos;
void main() {
  vPos = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const sunFragment = /* glsl */ `
uniform float uTime;
uniform float uSwell;
varying vec3 vN;
varying vec3 vView;
varying vec3 vPos;
${NOISE}
void main() {
  float mu = clamp(dot(normalize(vN), normalize(vView)), 0.0, 1.0);
  vec3 p = normalize(vPos);
  // Granulation: fine convection cells with soft dark lanes, slowly churning, over larger
  // plasma swirls that brighten and dim.
  vec3 q = p * 38.0 + vec3(uTime * 0.06, 0.0, uTime * 0.04);
  q += (fbm3d(p * 4.0 + uTime * 0.03) - 0.5) * 3.0;
  vec2 w = worley(q);
  float cells = smoothstep(0.0, 0.3, w.y - w.x);
  float sup = fbm3d(p * 2.2 + uTime * 0.02);
  float plasma = fbm3d(p * 5.0 + vec3(fbm3d(p * 2.0 + uTime * 0.05)) * 2.0 + uTime * 0.03);
  float spot = smoothstep(0.64, 0.7, fbm3d(p * 1.5 + 7.0));
  float umbra = smoothstep(0.69, 0.73, fbm3d(p * 1.5 + 7.0));
  float fac = smoothstep(0.55, 0.8, fbm3d(p * 5.0 + 2.0)) * pow(1.0 - mu, 1.5);

  vec3 core = vec3(1.22, 0.96, 0.52);
  vec3 limb = vec3(0.98, 0.32, 0.04);
  vec3 col = mix(limb, core, pow(mu, 0.6));
  col *= 0.86 + 0.16 * cells;
  col *= 0.78 + 0.34 * plasma + 0.1 * sup;
  col = mix(col, vec3(0.55, 0.2, 0.05), spot * 0.55);
  col = mix(col, vec3(0.22, 0.07, 0.02), umbra * 0.7);
  col += vec3(1.0, 0.8, 0.45) * fac * 0.55;
  col *= 1.0 + uSwell * 1.2;
  gl_FragColor = vec4(col, 1.0);
}
`;

const planeVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const PLANE_NOISE = /* glsl */ `
float hash21(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}
`;

const coronaFragment = /* glsl */ `
uniform float uTime;
uniform float uSwell;
uniform float uShow;
uniform float uR;
varying vec2 vUv;
${PLANE_NOISE}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.02 + 17.0; a *= 0.5; }
  return v;
}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r < uR * 0.97) discard;
  float a = atan(p.y, p.x);
  float x = r - uR;
  vec2 ring = vec2(cos(a), sin(a));
  // Streamers flowing outward, fine filaments, and flares that rise and fade.
  float s1 = fbm(ring * 2.4 + vec2(x * 1.6 - uTime * 0.05, 0.0));
  float s2 = noise(ring * 11.0 + vec2(0.0, x * 4.0 - uTime * 0.2));
  float fil = pow(noise(ring * 34.0 + vec2(x * 2.0 - uTime * 0.12, 0.0)), 4.0);
  float streak = pow(s1, 1.6) * 1.2 + pow(s2, 3.0) * 0.55 + fil * 0.6;
  float fall = exp(-x * 2.6 / (1.0 + uSwell * 1.2));
  float rim = exp(-x * 15.0);
  float burst = smoothstep(0.66, 1.0, noise(ring * 1.6 + vec2(uTime * 0.09, 3.0)));
  float flare = burst * exp(-x * 5.0) * (0.65 + 0.35 * sin(a * 23.0 + uTime * 0.8));
  float I = streak * fall * 1.1 * (1.0 + uSwell * 1.6) + rim * 1.4 + flare * 1.7;

  vec3 col = mix(vec3(1.0, 0.97, 0.86), vec3(1.0, 0.66, 0.24), smoothstep(0.0, 0.18, x));
  col = mix(col, vec3(1.0, 0.36, 0.14), smoothstep(0.18, 0.6, x));
  // Added light (see the material), with coverage in alpha for a clear canvas.
  vec3 light = col * clamp(I, 0.0, 1.2) * (1.0 - smoothstep(0.7, 1.0, r)) * 0.8 * uShow;
  gl_FragColor = vec4(light, clamp(max(light.r, max(light.g, light.b)), 0.0, 1.0));
}
`;

const haloFragment = /* glsl */ `
uniform float uSwell;
uniform float uShow;
varying vec2 vUv;
void main() {
  // A tight glow and a faint wide bloom, added as light: the sky behind stays readable.
  float r = length(vUv * 2.0 - 1.0);
  float glow = exp(-r * mix(6.5, 3.5, uSwell)) * 0.62 + exp(-r * 2.6) * 0.1;
  vec3 col = mix(vec3(1.0, 0.9, 0.68), vec3(1.0, 0.56, 0.24), smoothstep(0.08, 0.6, r));
  vec3 light = col * glow * (1.0 + uSwell * 0.8) * uShow;
  gl_FragColor = vec4(light, clamp(max(light.r, max(light.g, light.b)), 0.0, 1.0));
}
`;

const promFragment = /* glsl */ `
uniform float uTime;
uniform float uSeed;
varying vec2 vUv;
${PLANE_NOISE}
void main() {
  // vUv.x runs along the loop, vUv.y around the tube.
  float along = vUv.x;
  float ends = smoothstep(0.0, 0.12, along) * smoothstep(1.0, 0.88, along);
  float core = 1.0 - abs(vUv.y - 0.5) * 2.0;
  float flow = noise(vec2(along * 14.0 - uTime * 0.9 + uSeed, vUv.y * 3.0));
  float life = 0.55 + 0.45 * sin(uTime * 0.35 + uSeed * 4.0);
  float I = pow(core, 1.5) * ends * (0.5 + 0.8 * flow) * life;
  vec3 col = mix(vec3(1.0, 0.55, 0.18), vec3(1.0, 0.25, 0.12), flow);
  gl_FragColor = vec4(col * 1.2, clamp(I, 0.0, 1.0));
}
`;

/** Arcs of plasma rising from the limb: angle around the disc, loop radius, tilt, seed. */
const PROMINENCES: [number, number, number, number][] = [
  [3.6, 0.42, 0.3, 1],
  [4.3, 0.28, -0.2, 2],
  [2.4, 0.34, 0.15, 3],
  [0.4, 0.3, -0.1, 4],
  [5.4, 0.22, 0.2, 5],
];

const planeMaterial = (
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>,
  additive = false,
) =>
  new THREE.ShaderMaterial({
    vertexShader: planeVertex,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    uniforms,
    ...(additive
      ? {
          // Pure addition (colour × 1 + what's behind), with coverage accumulated in alpha.
          blending: THREE.CustomBlending,
          blendSrc: THREE.OneFactor,
          blendDst: THREE.OneFactor,
          blendSrcAlpha: THREE.OneFactor,
          blendDstAlpha: THREE.OneFactor,
        }
      : {}),
  });

/** How far back the sun sits at night, behind the black hole, and how small. */
const BACK = -2.4;
const SMALL = 0.74;

export function Sun({
  mix,
  still,
  anchor,
  light,
  ...props
}: {
  mix: DayMix;
  still: boolean;
  /** Marks the sun's centre, for the label occluders. */
  anchor?: RefObject<THREE.Object3D | null>;
  /** The sun's light on the scene; its strength follows the eclipse. */
  light?: RefObject<THREE.PointLight | null>;
} & ThreeElements["group"]) {
  const m = useMemo(
    () => ({
      sun: new THREE.ShaderMaterial({
        vertexShader: sunVertex,
        fragmentShader: sunFragment,
        toneMapped: false,
        uniforms: { uTime: { value: 0 }, uSwell: { value: 0 } },
      }),
      corona: planeMaterial(
        coronaFragment,
        {
          uTime: { value: 0 },
          uSwell: { value: 0 },
          uShow: { value: 0 },
          uR: { value: SUN_RADIUS / (CORONA_SIZE / 2) },
        },
        true,
      ),
      halo: planeMaterial(haloFragment, { uSwell: { value: 0 }, uShow: { value: 0 } }, true),
      proms: PROMINENCES.map(([, , , seed]) =>
        planeMaterial(promFragment, { uTime: { value: 0 }, uSeed: { value: seed } }),
      ),
    }),
    [],
  );

  const body = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = still ? 20 : state.clock.elapsedTime + 20;
    const d = Math.min(1, Math.max(0, mix.current ?? 0));
    const show = ease(d * 1.25);
    // A little extra blaze while it's half uncovered.
    const swell = 0.5 * Math.sin(d * Math.PI);
    for (const mat of [m.sun, m.corona, ...m.proms]) {
      (mat.uniforms.uTime as THREE.IUniform<number>).value = t;
    }
    for (const mat of [m.sun, m.corona, m.halo]) {
      (mat.uniforms.uSwell as THREE.IUniform<number>).value = swell;
    }
    for (const mat of [m.corona, m.halo]) {
      (mat.uniforms.uShow as THREE.IUniform<number>).value = show;
    }
    const g = body.current;
    if (g) {
      g.position.set(0, 0, BACK * (1 - show));
      g.scale.setScalar(SMALL + (1 - SMALL) * show);
      g.visible = d > 0.001;
    }
    if (light?.current) light.current.intensity = 70 * show;
  });

  return (
    <group {...props}>
      <group ref={body}>
        <object3D ref={anchor} />
        <mesh material={m.sun}>
          <sphereGeometry args={[SUN_RADIUS, 96, 64]} />
        </mesh>
        <Billboard>
          <mesh material={m.halo} renderOrder={0} position={[0, 0, -0.5]}>
            <planeGeometry args={[CORONA_SIZE * 1.6, CORONA_SIZE * 1.6]} />
          </mesh>
          <mesh material={m.corona} renderOrder={1}>
            <planeGeometry args={[CORONA_SIZE, CORONA_SIZE]} />
          </mesh>
          {PROMINENCES.map(([angle, size, tilt], i) => (
            <mesh
              key={angle}
              material={m.proms[i]}
              renderOrder={2}
              position={[
                Math.cos(angle) * SUN_RADIUS * 0.96,
                Math.sin(angle) * SUN_RADIUS * 0.96,
                0.1,
              ]}
              rotation={[tilt, 0, angle - Math.PI / 2]}
            >
              <torusGeometry args={[size, size * 0.14, 12, 48, Math.PI]} />
            </mesh>
          ))}
        </Billboard>
      </group>
    </group>
  );
}
