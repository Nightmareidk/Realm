"use client";

import { Float } from "@react-three/drei";
import { type ThreeElements, useFrame } from "@react-three/fiber";
import { type RefObject, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Astronaut3D } from "./astronaut3d";
import { Planet, type World } from "./planets";
import type { DayMix } from "./theme";

export { Planet };

export const PLANETS: {
  id: Exclude<World, "moon">;
  label: string;
  radius: number;
  orbit: number;
  speed: number;
  start: number;
  tilt: number;
  moon?: boolean;
}[] = [
  {
    id: "spaces",
    label: "Spaces",
    radius: 0.7,
    orbit: 4.2,
    speed: 0.1,
    start: 0.3,
    tilt: 0.35,
    moon: true,
  },
  { id: "feed", label: "Feed", radius: 0.52, orbit: 5.3, speed: 0.075, start: 2.2, tilt: 0.28 },
  {
    id: "profiles",
    label: "Profiles",
    radius: 0.48,
    orbit: 3.4,
    speed: 0.13,
    start: 4.0,
    tilt: 0.42,
  },
  {
    id: "boards",
    label: "Boards",
    radius: 0.58,
    orbit: 4.8,
    speed: 0.085,
    start: 5.3,
    tilt: 0.22,
    moon: true,
  },
];

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
  const pts = Array.from({ length: 200 }, (_, i) =>
    orbitPoint((i / 200) * Math.PI * 2, orbit, tilt),
  );
  return new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({
      color: ORBIT_NIGHT,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    }),
  );
}

/**
 * A thin belt of tumbling asteroids between the orbits: gives the system scale and depth
 * without adding anything to read.
 */
function AsteroidBelt({
  still,
  mix,
  radius = 6.9,
  count = 160,
}: {
  still: boolean;
  mix?: DayMix;
  radius?: number;
  count?: number;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const rocks = useMemo(() => {
    let seed = 11;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    return Array.from({ length: count }, () => ({
      a: rand() * Math.PI * 2,
      r: radius + (rand() - 0.5) * 0.9,
      y: (rand() - 0.5) * 0.35,
      s: 0.018 + rand() ** 4 * 0.06,
      spin: rand() * 6,
    }));
  }, [radius, count]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    rocks.forEach((k, i) => {
      dummy.position.set(Math.cos(k.a) * k.r, k.y, Math.sin(k.a) * k.r * 0.6);
      dummy.rotation.set(k.spin, k.spin * 1.3, 0);
      dummy.scale.setScalar(k.s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [rocks, dummy]);

  const material = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ camera }, delta) => {
    if (!still && mesh.current) mesh.current.rotation.y += delta * 0.02;
    // Close up (the start of the scroll intro) the belt would sit in front of the title, so it
    // fades in as the camera pulls back.
    const m = material.current;
    if (m) {
      m.opacity =
        THREE.MathUtils.smoothstep(camera.position.z, 10.5, 13) * (1 - (mix?.current ?? 0));
      if (mesh.current) mesh.current.visible = m.opacity > 0.01;
    }
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        ref={material}
        color="#8b93a8"
        roughness={0.92}
        flatShading
        transparent
      />
    </instancedMesh>
  );
}

/** Four region worlds on tilted orbits around the sun, with anchors for their labels. */
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
  const planets = useRef<(THREE.Group | null)[]>([]);
  const lines = useMemo(() => PLANETS.map((p) => orbitLine(p.orbit, p.tilt)), []);
  useFrame(({ clock, camera }) => {
    const m = mix?.current ?? 0;
    for (const line of lines) {
      const mat = line.material as THREE.LineBasicMaterial;
      mat.color.lerpColors(ORBIT_NIGHT, ORBIT_DAY, m);
      // By day there's nothing at the centre to orbit, so the paths fade away.
      mat.opacity = 0.22 * (1 - m);
      line.visible = mat.opacity > 0.005;
    }
    // By day the worlds wait out the portal shot and drift in as the camera pulls back.
    const k = THREE.MathUtils.smoothstep(camera.position.z, 9.5, 12.5);
    const s = THREE.MathUtils.lerp(1, k, m);
    const t = still ? 0 : clock.elapsedTime;
    PLANETS.forEach((p, i) => {
      const g = planets.current[i];
      if (!g) return;
      g.position.copy(orbitPoint(p.start + t * p.speed, p.orbit, p.tilt));
      g.scale.setScalar(Math.max(0.001, s));
      g.visible = s > 0.01;
    });
  });
  return (
    <group {...props}>
      {lines.map((line, i) => (
        <primitive key={PLANETS[i]?.id} object={line} />
      ))}
      <group rotation={[0.08, 0, 0]}>
        <AsteroidBelt still={still} mix={mix} />
      </group>
      {PLANETS.map((p, i) => (
        <group
          key={p.id}
          ref={(g) => {
            planets.current[i] = g;
          }}
        >
          <Planet world={p.id} radius={p.radius} moon={p.moon} still={still} />
          <object3D
            position={[0, p.radius + 0.4, 0]}
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
    { tone: "blue", pos: [4.4, 1.1, 1.0], rot: -0.4, s: 0.7, wave: false, phase: 1.2 },
    { tone: "violet", pos: [1.9, -2.7, 2.6], rot: -0.25, s: 0.8, wave: false, phase: 2.3 },
    { tone: "pink", pos: [-4.1, 1.4, 0.4], rot: 0.5, s: 0.62, wave: false, phase: 3.1 },
  ] as const;
  const groups = useRef<(THREE.Group | null)[]>([]);
  // During the scroll intro the crew waits outside the frame and drifts in as the camera pulls
  // back, so the opening shot is just the eclipse and the title.
  useFrame(({ camera }) => {
    const k = THREE.MathUtils.smoothstep(camera.position.z, 8.8, 12.5);
    crew.forEach((c, i) => {
      const g = groups.current[i];
      if (!g) return;
      const out = 1 + (1 - k) * 1.1;
      g.position.set(c.pos[0] * out, c.pos[1] * out, c.pos[2]);
      g.visible = k > 0.01;
    });
  });
  return (
    <>
      {crew.map((c, i) => (
        <Float key={c.tone} speed={still ? 0 : 0.9} rotationIntensity={0.25} floatIntensity={0.6}>
          <group
            ref={(g) => {
              groups.current[i] = g;
            }}
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
