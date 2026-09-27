"use client";

import { Float, Sparkles, Stars } from "@react-three/drei";
import { type ThreeElements, useFrame } from "@react-three/fiber";
import { type RefObject, useMemo, useRef } from "react";
import * as THREE from "three";
import { Astronaut3D } from "./astronaut3d";
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

// The plane is 7.4 units wide and the disc's radius is 2.35, so its edge sits at ~0.64 of the
// gradient radius: the bright rim has to start there or the disc hides it.
const CORONA: [number, string][] = [
  [0, "rgba(177,239,74,0)"],
  [0.56, "rgba(177,239,74,0)"],
  [0.63, "rgba(177,239,74,1)"],
  [0.68, "rgba(45,212,191,0.75)"],
  [0.8, "rgba(96,165,250,0.3)"],
  [1, "rgba(96,165,250,0)"],
];

export const ECLIPSE_RADIUS = 2.35;

const HALO: [number, string][] = [
  [0, "rgba(255,255,255,0.9)"],
  [0.25, "rgba(255,255,255,0.35)"],
  [1, "rgba(255,255,255,0)"],
];

/** The eclipse: a midnight world with an aurora corona blazing around its edge (the logo, in 3D). */
export function Eclipse({
  disc,
  ...props
}: { disc?: RefObject<THREE.Mesh | null> } & ThreeElements["group"]) {
  const corona = useGlowTexture(CORONA);
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ring.current) ring.current.rotation.z = clock.elapsedTime * 0.05;
  });
  return (
    <group {...props}>
      <mesh ref={ring} scale={7.4}>
        <planeGeometry />
        <meshBasicMaterial map={corona} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={disc} position={[0.28, 0.28, 0.2]}>
        <sphereGeometry args={[ECLIPSE_RADIUS, 64, 48]} />
        <meshStandardMaterial color={C.midnight} roughness={0.9} />
      </mesh>
    </group>
  );
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
      <mesh material={banded(color)} rotation={[0.18, 0, -0.3]}>
        <sphereGeometry args={[radius, 48, 32]} />
      </mesh>
      {halo && (
        <sprite scale={radius * 4.2}>
          <spriteMaterial map={halo} color={color} transparent opacity={0.45} depthWrite={false} />
        </sprite>
      )}
      {ring && (
        <mesh rotation={[Math.PI / 2.4, 0.2, 0]}>
          <torusGeometry args={[radius * 1.7, radius * 0.08, 8, 64]} />
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
  ...props
}: { still: boolean; anchors?: RefObject<(THREE.Object3D | null)[]> } & ThreeElements["group"]) {
  const halo = useGlowTexture(HALO);
  const planets = useRef<(THREE.Group | null)[]>([]);
  const lines = useMemo(() => PLANETS.map((p) => orbitLine(p.orbit, p.tilt)), []);
  useFrame(({ clock }) => {
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

/**
 * Rippling aurora curtains: vertex-coloured ribbons swaying behind everything. Colour and alpha
 * fade together (straight alpha, not additive), so the curtain composites cleanly over the page
 * and in transparent PNG exports instead of leaving a dark rectangle.
 */
export function Aurora({ still, ...props }: { still: boolean } & ThreeElements["group"]) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(26, 7, 90, 12);
    const colors: number[] = [];
    const pos = g.attributes.position as THREE.BufferAttribute;
    const lime = new THREE.Color(C.lime);
    const teal = new THREE.Color(C.teal);
    const violet = new THREE.Color(C.violet);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const h = (y + 3.5) / 7; // 0 bottom → 1 top
      const along = (x + 13) / 26;
      const c = lime
        .clone()
        .lerp(teal, h * 0.9)
        .lerp(violet, Math.max(0, along - 0.6) * 1.2);
      const fade = Math.sin(h * Math.PI) ** 1.4 * (0.35 + 0.65 * Math.sin(along * Math.PI));
      colors.push(c.r, c.g, c.b, fade * 0.7);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
    return g;
  }, []);
  const base = useMemo(
    () => Float32Array.from((geo.attributes.position as THREE.BufferAttribute).array),
    [geo],
  );
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (still || !mesh.current) return;
    const t = clock.elapsedTime;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3] as number;
      const y = base[i * 3 + 1] as number;
      pos.setZ(i, Math.sin(x * 0.35 + t * 0.6) * 0.9 + Math.sin(x * 0.9 - t * 0.9) * 0.25);
      pos.setY(i, y + Math.sin(x * 0.25 + t * 0.4) * 0.45);
    }
    pos.needsUpdate = true;
  });
  return (
    <group {...props}>
      <mesh ref={mesh} geometry={geo}>
        <meshBasicMaterial
          vertexColors
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
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

export function Sky({ still }: { still: boolean }) {
  return (
    <>
      <Stars
        radius={60}
        depth={40}
        count={2600}
        factor={3.2}
        saturation={0.4}
        fade
        speed={still ? 0 : 0.6}
      />
      <Sparkles
        count={60}
        scale={[18, 10, 8]}
        size={2.6}
        speed={still ? 0 : 0.3}
        color={C.lime}
        opacity={0.7}
      />
      <Sparkles
        count={40}
        scale={[18, 10, 8]}
        size={2.2}
        speed={still ? 0 : 0.25}
        color={C.teal}
        opacity={0.6}
      />
    </>
  );
}

export { glow };
