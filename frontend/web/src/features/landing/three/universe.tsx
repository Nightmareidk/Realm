"use client";

import { Float } from "@react-three/drei";
import { type ThreeElements, useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CastMember, type CastName, preloadCast } from "./cast3d";
import { Planet, type World } from "./planets";

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

const orbitPoint = (a: number, orbit: number, tilt: number, out = new THREE.Vector3()) =>
  out.set(
    Math.cos(a) * orbit,
    Math.sin(a) * orbit * Math.sin(tilt),
    Math.sin(a) * orbit * Math.cos(tilt) * 0.6,
  );

const ORBIT = new THREE.Color("#9fb6d8");

/** The exact path a planet travels, as a faint line. */
function orbitLine(orbit: number, tilt: number) {
  const pts = Array.from({ length: 200 }, (_, i) =>
    orbitPoint((i / 200) * Math.PI * 2, orbit, tilt),
  );
  return new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({
      color: ORBIT,
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
  radius = 6.9,
  count = 160,
}: {
  still: boolean;
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
      m.opacity = THREE.MathUtils.smoothstep(camera.position.z, 10.5, 13);
      if (mesh.current) mesh.current.visible = m.opacity > 0.01;
    }
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} receiveShadow>
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
  ...props
}: {
  still: boolean;
  anchors?: RefObject<(THREE.Object3D | null)[]>;
} & ThreeElements["group"]) {
  const planets = useRef<(THREE.Group | null)[]>([]);
  const lines = useMemo(() => PLANETS.map((p) => orbitLine(p.orbit, p.tilt)), []);
  useFrame(({ clock }) => {
    const t = still ? 0 : clock.elapsedTime;
    PLANETS.forEach((p, i) => {
      const g = planets.current[i];
      if (!g) return;
      orbitPoint(p.start + t * p.speed, p.orbit, p.tilt, g.position);
    });
  });
  return (
    <group {...props}>
      {lines.map((line, i) => (
        <primitive key={PLANETS[i]?.id} object={line} />
      ))}
      <group rotation={[0.08, 0, 0]}>
        <AsteroidBelt still={still} />
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

const CREW: CastName[] = ["astro-teal", "alien-meshy", "monster-gloop", "human-maya"];
// Fetch and decode the crew as soon as this module loads (it's loaded ahead of time by day, so the
// switch to night doesn't wait on the network).
if (typeof window !== "undefined") preloadCast(CREW);

/**
 * The four explorers, drifting in zero-g.
 *
 * Their materials are compiled in the background (KHR_parallel_shader_compile) before they are
 * shown: compiling them on first draw froze the page for seconds on some Windows GPUs.
 */
export function Explorers({
  still,
  anchors,
}: {
  still: boolean;
  anchors?: RefObject<(THREE.Object3D | null)[]>;
}) {
  const crew: {
    who: CastName;
    pos: [number, number, number];
    rot: number;
    s: number;
    wave: boolean;
    phase: number;
  }[] = [
    { who: "astro-teal", pos: [-3.1, -2.4, 2.2], rot: 0.3, s: 1.0, wave: true, phase: 0 },
    // Made in Meshy (brand/models-incoming), in place of Zib: trying it out before the rest.
    { who: "alien-meshy", pos: [4.4, 0.9, 1.0], rot: -0.35, s: 0.78, wave: true, phase: 1.2 },
    { who: "monster-gloop", pos: [1.9, -2.9, 2.6], rot: -0.25, s: 0.9, wave: false, phase: 2.3 },
    { who: "human-maya", pos: [-4.1, 1.2, 0.4], rot: 0.45, s: 0.72, wave: false, phase: 3.1 },
  ];
  const groups = useRef<(THREE.Group | null)[]>([]);
  const crewRoot = useRef<THREE.Group>(null);
  const { gl, scene, camera, invalidate } = useThree();
  useLayoutEffect(() => {
    const root = crewRoot.current;
    if (!root) return;
    let live = true;
    root.visible = false;
    gl.compileAsync(root, camera, scene)
      .catch(() => {})
      .then(() => {
        if (!live) return;
        root.visible = true;
        invalidate();
      });
    return () => {
      live = false;
    };
  }, [gl, scene, camera, invalidate]);
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
    <group ref={crewRoot}>
      {crew.map((c, i) => (
        <Float key={c.who} speed={still ? 0 : 0.9} rotationIntensity={0.25} floatIntensity={0.6}>
          <group
            ref={(g) => {
              groups.current[i] = g;
            }}
            position={c.pos}
            rotation={[0, c.rot, 0]}
            scale={c.s}
          >
            <CastMember who={c.who} wave={c.wave} still={still} phase={c.phase} />
            <object3D
              position={[0.5, 3.1, 0]}
              ref={(o) => {
                if (anchors?.current) anchors.current[i] = o;
              }}
            />
          </group>
        </Float>
      ))}
    </group>
  );
}
