"use client";

import { Float } from "@react-three/drei";
import { type ThreeElements, useFrame } from "@react-three/fiber";
import { type RefObject, useMemo, useRef } from "react";
import * as THREE from "three";
import { Astronaut3D } from "./astronaut3d";
import type { DayMix } from "./theme";
import { banded, C, glow } from "./toy";

/** A soft radial glow texture drawn on a canvas (no image downloads). */
function useGlowTexture(stops: [number, string][]) {
  return useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      for (const [o, c] of stops) g.addColorStop(o, c);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [stops]);
}

const HALO: [number, string][] = [
  [0, "rgba(255,255,255,0.9)"],
  [0.25, "rgba(255,255,255,0.35)"],
  [1, "rgba(255,255,255,0)"],
];

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
  float a = pow(f, 2.6) * 0.95;
  gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.25), a);
}
`;

const atmospheres = new Map<string, THREE.ShaderMaterial>();
/** A thin atmosphere: a fresnel rim of the planet's own colour, brightest at the edge. */
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

/** One planet: a glossy world with an optional soft atmosphere glow and ring. */
export function Planet({
  color,
  radius,
  ring,
  halo,
  ...props
}: {
  color: string;
  radius: number;
  ring?: string;
  halo?: THREE.Texture;
} & ThreeElements["group"]) {
  return (
    <group {...props}>
      <mesh material={banded(color)} rotation={[0.18, 0, -0.3]} castShadow receiveShadow>
        <sphereGeometry args={[radius, 64, 48]} />
      </mesh>
      <mesh material={atmosphere(color)} scale={1.14}>
        <sphereGeometry args={[radius, 48, 32]} />
      </mesh>
      {halo && (
        <sprite scale={radius * 4.2}>
          <spriteMaterial map={halo} color={color} transparent opacity={0.45} depthWrite={false} />
        </sprite>
      )}
      {ring && (
        <mesh rotation={[Math.PI / 2.4, 0.2, 0]} castShadow receiveShadow>
          <torusGeometry args={[radius * 1.7, radius * 0.08, 16, 96]} />
          <meshStandardMaterial
            color={ring}
            roughness={0.4}
            emissive={ring}
            emissiveIntensity={0.3}
          />
        </mesh>
      )}
    </group>
  );
}

export const PLANETS = [
  {
    id: "spaces",
    label: "Spaces",
    color: C.teal,
    radius: 0.62,
    orbit: 4.1,
    speed: 0.12,
    start: 0.3,
    tilt: 0.35,
  },
  {
    id: "feed",
    label: "Feed",
    color: C.blue,
    radius: 0.5,
    orbit: 5.1,
    speed: 0.09,
    start: 2.2,
    tilt: 0.28,
    ring: C.lime,
  },
  {
    id: "profiles",
    label: "Profiles",
    color: C.violet,
    radius: 0.44,
    orbit: 3.4,
    speed: 0.15,
    start: 4.0,
    tilt: 0.42,
  },
  {
    id: "boards",
    label: "Boards",
    color: C.pink,
    radius: 0.55,
    orbit: 4.7,
    speed: 0.1,
    start: 5.3,
    tilt: 0.22,
  },
] as const;

const orbitPoint = (a: number, orbit: number, tilt: number) =>
  new THREE.Vector3(
    Math.cos(a) * orbit,
    Math.sin(a) * orbit * Math.sin(tilt),
    Math.sin(a) * orbit * Math.cos(tilt) * 0.6,
  );

const ORBIT_NIGHT = new THREE.Color("#9fb6d8");
const ORBIT_DAY = new THREE.Color("#ffffff");

/** The exact path a planet travels, as a faint line. */
function orbitLine(orbit: number, tilt: number) {
  const pts = Array.from({ length: 160 }, (_, i) =>
    orbitPoint((i / 160) * Math.PI * 2, orbit, tilt),
  );
  return new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({
      color: "#9fb6d8",
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    }),
  );
}

/** Four region planets on tilted orbits around the eclipse, with anchors for their labels. */
export function Orbits({
  still,
  anchors,
  mix,
  ...props
}: {
  still: boolean;
  anchors?: RefObject<(THREE.Object3D | null)[]>;
  mix?: DayMix;
} & ThreeElements["group"]) {
  const halo = useGlowTexture(HALO);
  const planets = useRef<(THREE.Group | null)[]>([]);
  const lines = useMemo(() => PLANETS.map((p) => orbitLine(p.orbit, p.tilt)), []);
  useFrame(({ clock }) => {
    const m = mix?.current ?? 0;
    for (const line of lines) {
      const mat = line.material as THREE.LineBasicMaterial;
      mat.color.lerpColors(ORBIT_NIGHT, ORBIT_DAY, m);
      mat.opacity = 0.25 + m * 0.2;
    }
    const t = still ? 0 : clock.elapsedTime;
    PLANETS.forEach((p, i) => {
      const g = planets.current[i];
      if (!g) return;
      const a = p.start + t * p.speed;
      g.position.copy(orbitPoint(a, p.orbit, p.tilt));
    });
  });
  return (
    <group {...props}>
      {lines.map((line, i) => (
        <primitive key={PLANETS[i]?.id} object={line} />
      ))}
      {PLANETS.map((p, i) => (
        <group
          key={p.id}
          ref={(g) => {
            planets.current[i] = g;
          }}
        >
          <Planet
            color={p.color}
            radius={p.radius}
            ring={"ring" in p ? p.ring : undefined}
            halo={halo}
          />
          <object3D
            position={[0, p.radius + 0.35, 0]}
            ref={(o) => {
              if (anchors?.current) anchors.current[i] = o;
            }}
          />
        </group>
      ))}
    </group>
  );
}

/** The four explorers, one per region colour, drifting in zero-g. */
export function Explorers({
  still,
  anchors,
}: {
  still: boolean;
  anchors?: RefObject<(THREE.Object3D | null)[]>;
}) {
  const crew = [
    { tone: "teal", pos: [-3.1, -2.2, 2.2], rot: 0.35, s: 0.95, wave: true, phase: 0 },
    { tone: "blue", pos: [3.7, 0.9, 1.2], rot: -0.4, s: 0.7, wave: false, phase: 1.2 },
    { tone: "violet", pos: [1.9, -2.7, 2.6], rot: -0.25, s: 0.8, wave: false, phase: 2.3 },
    { tone: "pink", pos: [-4.1, 1.4, 0.4], rot: 0.5, s: 0.62, wave: false, phase: 3.1 },
  ] as const;
  return (
    <>
      {crew.map((c, i) => (
        <Float key={c.tone} speed={still ? 0 : 0.9} rotationIntensity={0.25} floatIntensity={0.6}>
          <group
            position={c.pos as unknown as [number, number, number]}
            rotation={[0, c.rot, 0]}
            scale={c.s}
          >
            <Astronaut3D tone={c.tone} wave={c.wave} still={still} phase={c.phase} />
            <object3D
              position={[0.5, 3.1, 0]}
              ref={(o) => {
                if (anchors?.current) anchors.current[i] = o;
              }}
            />
          </group>
        </Float>
      ))}
    </>
  );
}

export { glow };
