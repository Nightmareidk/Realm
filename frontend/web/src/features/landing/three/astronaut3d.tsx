"use client";

import { RoundedBox } from "@react-three/drei";
import { type ThreeElements, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { C, glow, iridescent, toy } from "./toy";

export type AstronautTone = "teal" | "blue" | "violet" | "pink";

const ACCENT: Record<AstronautTone, string> = {
  teal: C.teal,
  blue: C.blue,
  violet: C.violet,
  pink: C.pink,
};

/**
 * A Realm explorer: a stylized astronaut built from primitives (no model files).
 * Big helmet, glossy suit, iridescent visor with two softly glowing eyes behind it.
 * Floats in zero-g; `wave` raises the right arm in a hello. `still` freezes the pose.
 * About 2.3 units tall, feet at y=0.
 */
export function Astronaut3D({
  tone,
  wave = false,
  still = false,
  phase = 0,
  ...group
}: {
  tone: AstronautTone;
  wave?: boolean;
  still?: boolean;
  phase?: number;
} & ThreeElements["group"]) {
  const accent = ACCENT[tone];
  const root = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (still) return;
    const t = state.clock.elapsedTime + phase;
    if (root.current) {
      root.current.position.y = Math.sin(t * 0.9) * 0.18;
      root.current.rotation.z = Math.sin(t * 0.6) * 0.08;
      root.current.rotation.x = Math.sin(t * 0.5 + 1) * 0.05;
    }
    if (armR.current) {
      armR.current.rotation.z = wave
        ? 2.5 + Math.sin(t * 6.5) * 0.35
        : 0.5 + Math.sin(t * 0.8) * 0.1;
    }
    if (armL.current) armL.current.rotation.z = -0.55 - Math.sin(t * 0.8 + 1) * 0.1;
    if (eyes.current) {
      eyes.current.scale.y = (t * 0.8) % 4.2 < 0.12 ? 0.1 : 1;
      eyes.current.position.x = state.pointer.x * 0.06;
      eyes.current.position.y = state.pointer.y * 0.04;
    }
    if (beacon.current) beacon.current.scale.setScalar(0.85 + Math.abs(Math.sin(t * 2.2)) * 0.3);
  });

  return (
    <group {...group}>
      <group ref={root}>
        {/* Legs and boots */}
        {[-0.24, 0.24].map((x) => (
          <group key={x} position={[x, 0.32, 0]}>
            <mesh material={toy(C.suit)}>
              <capsuleGeometry args={[0.19, 0.28, 8, 16]} />
            </mesh>
            <mesh position={[0, -0.28, 0.05]} scale={[1, 0.7, 1.25]} material={toy(accent)}>
              <sphereGeometry args={[0.21, 20, 14]} />
            </mesh>
          </group>
        ))}

        {/* Backpack */}
        <RoundedBox
          args={[0.9, 0.85, 0.42]}
          radius={0.14}
          smoothness={5}
          position={[0, 0.95, -0.46]}
          material={toy(C.suitShade)}
        />
        <mesh position={[0.26, 1.2, -0.68]} material={glow(accent)}>
          <sphereGeometry args={[0.055, 12, 8]} />
        </mesh>

        {/* Torso */}
        <mesh position={[0, 0.88, 0]} material={toy(C.suit)}>
          <capsuleGeometry args={[0.5, 0.36, 10, 24]} />
        </mesh>
        <RoundedBox
          args={[0.46, 0.3, 0.1]}
          radius={0.05}
          position={[0, 0.9, 0.46]}
          rotation={[-0.15, 0, 0]}
          material={toy(C.suitShade)}
        />
        {[-0.1, 0.06, 0.18].map((x, i) => (
          <mesh
            key={x}
            position={[x, 0.91, 0.52]}
            material={glow([C.lime, C.teal, accent][i] as string)}
          >
            <sphereGeometry args={[0.035, 10, 8]} />
          </mesh>
        ))}

        {/* Arms (pivot at the shoulders) with accent gloves */}
        <group ref={armL} position={[-0.52, 1.12, 0]} rotation={[0, 0, -0.55]}>
          <mesh position={[0, -0.3, 0]} material={toy(C.suit)}>
            <capsuleGeometry args={[0.16, 0.36, 8, 16]} />
          </mesh>
          <mesh position={[0, -0.62, 0]} material={toy(accent)}>
            <sphereGeometry args={[0.18, 18, 12]} />
          </mesh>
        </group>
        <group ref={armR} position={[0.52, 1.12, 0]} rotation={[0, 0, wave ? 2.5 : 0.5]}>
          <mesh position={[0, -0.3, 0]} material={toy(C.suit)}>
            <capsuleGeometry args={[0.16, 0.36, 8, 16]} />
          </mesh>
          <mesh position={[0, -0.62, 0]} material={toy(accent)}>
            <sphereGeometry args={[0.18, 18, 12]} />
          </mesh>
        </group>

        {/* Collar ring */}
        <mesh position={[0, 1.36, 0]} rotation={[Math.PI / 2, 0, 0]} material={toy(accent)}>
          <torusGeometry args={[0.42, 0.08, 12, 32]} />
        </mesh>

        {/* Helmet, visor, eyes */}
        <mesh position={[0, 1.86, 0]} material={toy(C.suit, { rough: 0.25 })}>
          <sphereGeometry args={[0.66, 40, 28]} />
        </mesh>
        <mesh position={[0, 1.86, 0.2]} scale={[0.84, 0.66, 0.74]} material={iridescent()}>
          <sphereGeometry args={[0.66, 40, 28]} />
        </mesh>
        <group ref={eyes} position={[0, 1.9, 0.68]}>
          {[-0.15, 0.15].map((x) => (
            <mesh key={x} position={[x, 0, 0]} scale={[0.75, 1.15, 0.4]} material={glow("#dffcff")}>
              <sphereGeometry args={[0.075, 16, 12]} />
            </mesh>
          ))}
        </group>
        {/* Visor highlight */}
        <mesh
          position={[-0.2, 2.07, 0.62]}
          rotation={[0, 0, 0.5]}
          scale={[1.6, 0.5, 0.3]}
          material={glow("#ffffff", 0.55)}
        >
          <sphereGeometry args={[0.06, 12, 8]} />
        </mesh>

        {/* Antenna with a beacon */}
        <mesh position={[-0.34, 2.5, -0.05]} rotation={[0, 0, 0.35]} material={toy(C.suitShade)}>
          <cylinderGeometry args={[0.025, 0.025, 0.36, 8]} />
        </mesh>
        <mesh ref={beacon} position={[-0.41, 2.69, -0.05]} material={glow(accent)}>
          <sphereGeometry args={[0.07, 14, 10]} />
        </mesh>
      </group>
    </group>
  );
}
