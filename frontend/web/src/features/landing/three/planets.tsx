"use client";

import { type ThreeElements, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * Realm's four worlds, each with its own procedural surface (no texture downloads). The surface
 * is injected into a standard material, so the scene's lights, the sun and shadows all apply.
 *
 * - Spaces: an ocean world with continents, ice caps and drifting clouds.
 * - Feed: a banded gas giant with a storm, and a ring system.
 * - Profiles: an ice world veined with glowing crevasses.
 * - Boards: a cratered world of rose rock.
 */
export type World = "spaces" | "feed" | "profiles" | "boards" | "moon";

const NOISE = /* glsl */ `
float ph3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float pn3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(ph3(i), ph3(i + vec3(1, 0, 0)), f.x), mix(ph3(i + vec3(0, 1, 0)), ph3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(ph3(i + vec3(0, 0, 1)), ph3(i + vec3(1, 0, 1)), f.x), mix(ph3(i + vec3(0, 1, 1)), ph3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float pfbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * pn3(p); p = p * 2.02 + 7.3; a *= 0.5; }
  return v;
}
vec3 ph33(vec3 p) {
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
    vec3 r = g + ph33(i + g) - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return vec2(sqrt(d1), sqrt(d2));
}
`;

const SURFACE: Record<World, string> = {
  spaces: /* glsl */ `
    float h = pfbm(p * 1.9 + uSeed);
    float land = smoothstep(0.53, 0.57, h);
    vec3 ocean = mix(uA, uB, smoothstep(0.36, 0.54, h));
    vec3 ground = mix(uC, uD, smoothstep(0.45, 0.75, pfbm(p * 6.0 + 3.0)));
    ground = mix(ground, uD * 0.8, smoothstep(0.62, 0.72, h));
    float ice = smoothstep(0.8, 0.88, abs(p.y) + (pfbm(p * 4.0) - 0.5) * 0.15);
    albedo = mix(mix(ocean, ground, land), vec3(0.94, 0.97, 1.0), ice);
    rough = mix(0.22, 0.85, max(land, ice));
  `,
  feed: /* glsl */ `
    float warp = pfbm(p * vec3(2.0, 5.0, 2.0) + uSeed) - 0.5;
    float y = p.y + warp * 0.22;
    float b1 = 0.5 + 0.5 * sin(y * 17.0);
    float b2 = 0.5 + 0.5 * sin(y * 41.0 + warp * 6.0);
    albedo = mix(uA, uB, b1);
    albedo = mix(albedo, uC, smoothstep(0.55, 1.0, b2) * 0.55);
    vec3 s = normalize(vec3(0.55, -0.32, 0.77));
    float ds = distance(p, s);
    float swirl = sin(atan(p.x - s.x, p.y - s.y) * 3.0 + ds * 40.0);
    albedo = mix(albedo, uD, smoothstep(0.24, 0.0, ds) * (0.75 + 0.25 * swirl));
    rough = 0.55;
  `,
  profiles: /* glsl */ `
    float tone = pfbm(p * 3.0 + uSeed);
    albedo = mix(uA, uB, tone);
    // Crevasses: a warped cell pattern, thin, and only where the ice is under stress.
    vec3 q = p * 4.5 + uSeed + (vec3(pfbm(p * 2.5), pfbm(p * 2.5 + 5.0), pfbm(p * 2.5 + 9.0)) - 0.5) * 1.6;
    vec2 w = worley(q);
    float crack = (1.0 - smoothstep(0.0, 0.045, w.y - w.x)) * smoothstep(0.35, 0.65, pfbm(p * 3.5 + 2.0));
    albedo = mix(albedo, uC, crack * 0.9);
    glowAdd += uC * crack * 0.4;
    albedo = mix(albedo, uB * 1.15, smoothstep(0.6, 0.8, pfbm(p * 8.0)) * 0.3);
    float cap = smoothstep(0.78, 0.9, abs(p.y));
    albedo = mix(albedo, vec3(0.95, 0.96, 1.0), cap);
    rough = 0.3;
  `,
  boards: /* glsl */ `
    float maria = pfbm(p * 2.2 + uSeed);
    albedo = mix(uA, uB, smoothstep(0.3, 0.7, maria));
    // Craters of two sizes, mostly in the older highlands, with soft uneven rims.
    float field = smoothstep(0.42, 0.62, pfbm(p * 3.0 + 4.0));
    vec3 q = p + (vec3(pfbm(p * 6.0), pfbm(p * 6.0 + 3.0), pfbm(p * 6.0 + 6.0)) - 0.5) * 0.12;
    vec2 w1 = worley(q * 3.4 + uSeed);
    vec2 w2 = worley(q * 8.0 + uSeed * 2.0);
    float bowl = smoothstep(0.3, 0.0, w1.x) * field + smoothstep(0.22, 0.0, w2.x) * 0.5 * (1.0 - field * 0.5);
    float rim = smoothstep(0.05, 0.0, abs(w1.x - 0.3)) * field * (0.5 + 0.5 * pfbm(p * 20.0));
    albedo = mix(albedo, uC, bowl * 0.45);
    albedo = mix(albedo, uD, rim * 0.5);
    albedo *= 0.88 + 0.24 * pfbm(p * 14.0);
    rough = 0.88;
  `,
  moon: /* glsl */ `
    albedo = mix(uA, uB, pfbm(p * 3.0 + uSeed));
    vec2 w = worley(p * 5.0 + uSeed);
    albedo = mix(albedo, uA * 0.7, smoothstep(0.3, 0.0, w.x) * 0.5);
    rough = 0.95;
  `,
};

const PALETTE: Record<World, [string, string, string, string]> = {
  spaces: ["#07525a", "#2dd4bf", "#8fd14f", "#d8c38c"],
  feed: ["#1e3a8a", "#60a5fa", "#e0ecff", "#f8fbff"],
  profiles: ["#4c1d95", "#a78bfa", "#dbe4ff", "#ffffff"],
  boards: ["#8a1946", "#f472b6", "#5c0f2f", "#ffc2dd"],
  moon: ["#6b7280", "#c7ccd6", "#000000", "#000000"],
};

const materials = new Map<string, THREE.MeshStandardMaterial>();

function surfaceMaterial(world: World, seed: number) {
  const key = `${world}|${seed}`;
  let m = materials.get(key);
  if (m) return m;
  const [a, b, c, d] = PALETTE[world].map((x) => new THREE.Color(x));
  m = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uA: { value: a },
      uB: { value: b },
      uC: { value: c },
      uD: { value: d },
      uSeed: { value: seed },
    });
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObj;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vObj;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
uniform vec3 uD;
uniform float uSeed;
${NOISE}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
vec3 p = normalize(vObj);
vec3 albedo = diffuseColor.rgb;
float rough = roughness;
vec3 glowAdd = vec3(0.0);
${SURFACE[world]}
diffuseColor.rgb = albedo;`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = rough;",
      )
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance += glowAdd;",
      );
  };
  m.customProgramCacheKey = () => key;
  materials.set(key, m);
  return m;
}

const cloudMaterial = (() => {
  let m: THREE.MeshStandardMaterial | null = null;
  return () => {
    if (m) return m;
    m = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      transparent: true,
      depthWrite: false,
      roughness: 1,
    });
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vObj;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\nvarying vec3 vObj;\n${NOISE}`)
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
vec3 p = normalize(vObj);
float c = pfbm(p * 3.2 + vec3(0.0, 11.0, 0.0));
float streak = pfbm(vec3(p.x * 2.0, p.y * 9.0, p.z * 2.0));
diffuseColor.a = smoothstep(0.52, 0.72, mix(c, streak, 0.35)) * 0.9;`,
        );
    };
    m.customProgramCacheKey = () => "clouds";
    return m;
  };
})();

const atmosphereVertex = /* glsl */ `
varying vec3 vN;
varying vec3 vView;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const atmosphereFragment = /* glsl */ `
uniform vec3 uColor;
varying vec3 vN;
varying vec3 vView;
void main() {
  float f = 1.0 - clamp(dot(normalize(vN), normalize(vView)), 0.0, 1.0);
  gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.3), pow(f, 2.4) * 0.95);
}
`;

const atmospheres = new Map<string, THREE.ShaderMaterial>();
/** A thin atmosphere: a fresnel rim in the world's colour, brightest at the edge. */
function atmosphere(color: string) {
  let m = atmospheres.get(color);
  if (!m) {
    m = new THREE.ShaderMaterial({
      vertexShader: atmosphereVertex,
      fragmentShader: atmosphereFragment,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      uniforms: { uColor: { value: new THREE.Color(color) } },
    });
    atmospheres.set(color, m);
  }
  return m;
}

/** Ring system: pale bands with gaps, from a one-row canvas texture mapped across the ring. */
function useRing(inner: number, outer: number) {
  return useMemo(() => {
    const geo = new THREE.RingGeometry(inner, outer, 160, 1);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i));
      uv.setXY(i, (r - inner) / (outer - inner), 0.5);
    }
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      let seed = 7;
      const rand = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      for (let x = 0; x < 256; x++) {
        const t = x / 255;
        const gap = t > 0.62 && t < 0.67 ? 0.05 : 1;
        const band = 0.45 + 0.55 * rand();
        const edge = Math.min(t / 0.08, (1 - t) / 0.12, 1);
        const a = Math.max(0, band * gap * edge) * 0.85;
        const light = 200 + Math.round(rand() * 45);
        ctx.fillStyle = `rgba(${light}, ${light + 8}, 255, ${a})`;
        ctx.fillRect(x, 0, 1, 1);
      }
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({
      map,
      transparent: true,
      side: THREE.DoubleSide,
      roughness: 0.7,
      depthWrite: false,
    });
    return { geo, mat };
  }, [inner, outer]);
}

const RIM: Record<World, string> = {
  spaces: "#5eead4",
  feed: "#93c5fd",
  profiles: "#c4b5fd",
  boards: "#f9a8d4",
  moon: "#cbd5e1",
};

export function Planet({
  world,
  radius,
  still = false,
  moon = false,
  ...props
}: {
  world: World;
  radius: number;
  still?: boolean;
  /** A small moon in orbit. */
  moon?: boolean;
} & ThreeElements["group"]) {
  const body = useRef<THREE.Mesh>(null);
  const clouds = useRef<THREE.Mesh>(null);
  const moonRef = useRef<THREE.Group>(null);
  const ring = useRing(radius * 1.35, radius * 2.3);
  const seed = { spaces: 3.1, feed: 7.7, profiles: 1.9, boards: 5.3, moon: 9.4 }[world];

  useFrame((_, delta) => {
    if (still) return;
    if (body.current) body.current.rotation.y += delta * 0.06;
    if (clouds.current) clouds.current.rotation.y += delta * 0.085;
    if (moonRef.current) moonRef.current.rotation.y += delta * 0.35;
  });

  return (
    <group {...props}>
      <group rotation={[0.2, 0, -0.28]}>
        <mesh ref={body} material={surfaceMaterial(world, seed)} castShadow receiveShadow>
          <sphereGeometry args={[radius, 96, 64]} />
        </mesh>
        {world === "spaces" && (
          <mesh ref={clouds} material={cloudMaterial()} scale={1.025}>
            <sphereGeometry args={[radius, 72, 48]} />
          </mesh>
        )}
        {world === "feed" && (
          <mesh
            geometry={ring.geo}
            material={ring.mat}
            rotation={[Math.PI / 2 - 0.35, 0.1, 0]}
            receiveShadow
            castShadow
          />
        )}
      </group>
      <mesh material={atmosphere(RIM[world])} scale={1.1}>
        <sphereGeometry args={[radius, 48, 32]} />
      </mesh>
      {moon && (
        <group ref={moonRef} rotation={[0.35, 0, 0.2]}>
          <mesh
            position={[radius * 2.1, 0, 0]}
            material={surfaceMaterial("moon", seed + 1)}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[radius * 0.24, 40, 28]} />
          </mesh>
        </group>
      )}
    </group>
  );
}
