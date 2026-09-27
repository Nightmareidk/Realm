"use client";

import { Billboard } from "@react-three/drei";
import { type ThreeElements, useFrame } from "@react-three/fiber";
import { type RefObject, useMemo, useRef } from "react";
import * as THREE from "three";
import { type DayMix, ease, lerp } from "./theme";
import { C } from "./toy";

/**
 * The eclipse, done for real: a sun, its corona, and a dark moon in front of it.
 *
 * At night the moon covers the sun and only the corona shows past its edge: streamers in the
 * aurora colours, the Realm mark in 3D. By day the moon slides away and the sun blazes: a
 * granulated surface with sunspots, a warm corona and flares that rise and fade.
 */
export const SUN_RADIUS = 1.85;
export const MOON_RADIUS = 2.2;
const MOON_NIGHT = new THREE.Vector3(0.3, 0.3, 0.6);
const MOON_DAY = new THREE.Vector3(9.5, 5.5, 0.6);
const CORONA_SIZE = 12;

const NOISE3 = /* glsl */ `
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
varying vec3 vN;
varying vec3 vView;
varying vec3 vPos;
${NOISE3}
void main() {
  float mu = clamp(dot(normalize(vN), normalize(vView)), 0.0, 1.0);
  vec3 p = normalize(vPos);
  float gran = fbm3d(p * 7.0 + vec3(0.0, 0.0, uTime * 0.12));
  float cells = n3(p * 26.0 + uTime * 0.2);
  float spots = smoothstep(0.66, 0.74, fbm3d(p * 1.6 + 7.0));
  vec3 core = vec3(1.0, 0.88, 0.5);
  vec3 limb = vec3(1.0, 0.46, 0.08);
  vec3 col = mix(limb, core, pow(mu, 0.7));
  col *= 0.74 + 0.42 * gran + 0.14 * cells;
  col = mix(col, vec3(0.55, 0.22, 0.06), spots * 0.55);
  col += vec3(1.0, 0.5, 0.12) * pow(1.0 - mu, 4.0) * 0.5;
  gl_FragColor = vec4(col, 1.0);
}
`;

const coronaVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const coronaFragment = /* glsl */ `
uniform float uTime;
uniform float uDay;
uniform float uR;
uniform vec3 uLime;
uniform vec3 uTeal;
uniform vec3 uBlue;
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
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.02 + 17.0; a *= 0.5; }
  return v;
}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r < uR * 0.97) discard;
  float a = atan(p.y, p.x);
  float x = r - uR;
  // Wrap the angle so the noise is seamless all the way round.
  vec2 ring = vec2(cos(a), sin(a));
  float s1 = fbm(ring * 2.2 + vec2(x * 2.2 - uTime * 0.06, 0.0));
  float s2 = noise(ring * 9.0 + vec2(0.0, x * 5.0 - uTime * 0.22));
  float streak = pow(s1, 1.7) * 1.1 + pow(s2, 3.0) * 0.55;
  float fall = exp(-x * mix(4.2, 3.0, uDay));
  float rim = exp(-x * mix(30.0, 16.0, uDay));
  float burst = smoothstep(0.7, 1.0, noise(ring * 1.6 + vec2(uTime * 0.09, 3.0)));
  float flare = burst * exp(-x * mix(10.0, 6.0, uDay)) * (0.65 + 0.35 * sin(a * 23.0 + uTime * 0.8));
  float I = streak * fall * mix(1.5, 1.0, uDay) + rim * mix(2.2, 1.3, uDay) + flare * mix(1.1, 1.6, uDay);

  vec3 night = mix(uLime, uTeal, smoothstep(0.0, 0.1, x));
  night = mix(night, uBlue, smoothstep(0.1, 0.42, x));
  vec3 day = mix(vec3(1.0, 0.97, 0.86), vec3(1.0, 0.66, 0.24), smoothstep(0.0, 0.2, x));
  day = mix(day, vec3(1.0, 0.42, 0.16), smoothstep(0.2, 0.65, x));
  vec3 col = mix(night, day, uDay);
  float alpha = clamp(I, 0.0, 1.0) * (1.0 - smoothstep(0.72, 1.0, r));
  gl_FragColor = vec4(col, alpha);
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
  moon?: RefObject<THREE.Mesh | null>;
  sunAnchor?: RefObject<THREE.Object3D | null>;
} & ThreeElements["group"]) {
  const sunMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: sunVertex,
        fragmentShader: sunFragment,
        toneMapped: false,
        uniforms: { uTime: { value: 0 } },
      }),
    [],
  );
  const coronaMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: coronaVertex,
        fragmentShader: coronaFragment,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        uniforms: {
          uTime: { value: 0 },
          uDay: { value: 0 },
          uR: { value: SUN_RADIUS / (CORONA_SIZE / 2) },
          uLime: { value: new THREE.Color(C.lime) },
          uTeal: { value: new THREE.Color(C.teal) },
          uBlue: { value: new THREE.Color(C.blue) },
        },
      }),
    [],
  );
  const moonRef = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    const t = still ? 20 : state.clock.elapsedTime + 20;
    const m = mix.current;
    (sunMat.uniforms.uTime as THREE.IUniform<number>).value = t;
    (coronaMat.uniforms.uTime as THREE.IUniform<number>).value = t;
    (coronaMat.uniforms.uDay as THREE.IUniform<number>).value = m;
    const mesh = moonRef.current;
    if (mesh) mesh.position.lerpVectors(MOON_NIGHT, MOON_DAY, ease(m * 1.15));
    if (light.current) light.current.intensity = lerp(0, 60, ease(m));
  });

  return (
    <group {...props}>
      <object3D ref={sunAnchor} />
      <mesh material={sunMat}>
        <sphereGeometry args={[SUN_RADIUS, 64, 48]} />
      </mesh>
      <Billboard>
        <mesh material={coronaMat} renderOrder={1}>
          <planeGeometry args={[CORONA_SIZE, CORONA_SIZE]} />
        </mesh>
      </Billboard>
      <pointLight ref={light} color="#ffd9a8" intensity={0} distance={40} decay={1.4} />
      <mesh
        ref={(m) => {
          moonRef.current = m;
          if (moon) moon.current = m;
        }}
        position={MOON_NIGHT.toArray()}
      >
        <sphereGeometry args={[MOON_RADIUS, 64, 48]} />
        <meshStandardMaterial color={C.midnight} roughness={0.92} />
      </mesh>
    </group>
  );
}
