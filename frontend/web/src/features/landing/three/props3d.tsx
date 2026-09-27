"use client";

import { RoundedBox } from "@react-three/drei";
import type { ThreeElements } from "@react-three/fiber";
import { arrowShape, bevel, C, heartShape, sparkShape, toy } from "./toy";

type G = ThreeElements["group"];

/** Chat bubble with three typing dots. */
export function Bubble3D({ color = C.teal, ...props }: G & { color?: string }) {
  return (
    <group {...props}>
      <RoundedBox args={[1.5, 1, 0.42]} radius={0.21} smoothness={6} material={toy(color)} />
      <mesh position={[-0.42, -0.58, 0]} rotation={[0, 0, 0.5]} material={toy(color)}>
        <coneGeometry args={[0.2, 0.42, 20]} />
      </mesh>
      {[-0.38, 0, 0.38].map((x) => (
        <mesh key={x} position={[x, 0, 0.22]} material={toy(C.white)}>
          <sphereGeometry args={[0.11, 16, 12]} />
        </mesh>
      ))}
    </group>
  );
}

export function Heart3D({ color = C.pink, ...props }: G & { color?: string }) {
  return (
    <group {...props}>
      <mesh position={[0, -0.1, -0.1]} material={toy(color)}>
        <extrudeGeometry
          args={[heartShape(1), { depth: 0.2, ...bevel, bevelThickness: 0.12, bevelSize: 0.1 }]}
        />
      </mesh>
    </group>
  );
}

export function Spark3D({ color = C.lime, ...props }: G & { color?: string }) {
  return (
    <group {...props}>
      <mesh position={[0, 0, -0.08]} material={toy(color, { emissive: C.lime, glow: 0.35 })}>
        <extrudeGeometry
          args={[sparkShape(0.9), { depth: 0.16, ...bevel, bevelThickness: 0.08, bevelSize: 0.06 }]}
        />
      </mesh>
    </group>
  );
}

export function Lock3D(props: G) {
  return (
    <group {...props}>
      <mesh position={[0, 0.45, 0]} material={toy("#d7d2f0", { rough: 0.2 })}>
        <torusGeometry args={[0.42, 0.11, 16, 40, Math.PI]} />
      </mesh>
      {[-0.42, 0.42].map((x) => (
        <mesh key={x} position={[x, 0.3, 0]} material={toy("#d7d2f0", { rough: 0.2 })}>
          <cylinderGeometry args={[0.11, 0.11, 0.3, 16]} />
        </mesh>
      ))}
      <RoundedBox
        args={[1.25, 1, 0.5]}
        radius={0.16}
        smoothness={6}
        position={[0, -0.2, 0]}
        material={toy(C.lime)}
      />
      <mesh position={[0, -0.1, 0.26]} rotation={[Math.PI / 2, 0, 0]} material={toy(C.ink)}>
        <cylinderGeometry args={[0.12, 0.12, 0.04, 24]} />
      </mesh>
      <mesh position={[0, -0.32, 0.26]} material={toy(C.ink)}>
        <boxGeometry args={[0.08, 0.26, 0.04]} />
      </mesh>
    </group>
  );
}

export function Controller3D(props: G) {
  return (
    <group {...props}>
      <RoundedBox
        args={[1.9, 0.9, 0.42]}
        radius={0.3}
        smoothness={6}
        material={toy("#1c2a44", { rough: 0.25 })}
      />
      {[-0.72, 0.72].map((x) => (
        <mesh key={x} position={[x, -0.32, 0]} material={toy("#1c2a44", { rough: 0.25 })}>
          <sphereGeometry args={[0.36, 24, 16]} />
        </mesh>
      ))}
      <mesh position={[-0.5, 0.06, 0.22]} material={toy(C.ink)}>
        <boxGeometry args={[0.36, 0.11, 0.06]} />
      </mesh>
      <mesh position={[-0.5, 0.06, 0.22]} material={toy(C.ink)}>
        <boxGeometry args={[0.11, 0.36, 0.06]} />
      </mesh>
      {[
        [0.48, 0.16, C.teal],
        [0.66, 0, C.pink],
        [0.48, -0.16, C.lime],
        [0.3, 0, C.blue],
      ].map(([x, y, color]) => (
        <mesh
          key={String(color)}
          position={[x as number, y as number, 0.22]}
          material={toy(color as string)}
        >
          <sphereGeometry args={[0.08, 16, 12]} />
        </mesh>
      ))}
    </group>
  );
}

export function Play3D(props: G) {
  return (
    <group {...props}>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={toy(C.blue)}>
        <cylinderGeometry args={[0.7, 0.7, 0.28, 48]} />
      </mesh>
      <group position={[0.08, 0, 0.16]} rotation={[0, 0, Math.PI / 2]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={toy(C.white)}>
          <cylinderGeometry args={[0.34, 0.34, 0.12, 3]} />
        </mesh>
      </group>
    </group>
  );
}

export function Upvote3D(props: G) {
  return (
    <group {...props}>
      <mesh position={[0, 0, -0.1]} material={toy(C.pink)}>
        <extrudeGeometry
          args={[arrowShape(1.4), { depth: 0.2, ...bevel, bevelThickness: 0.1, bevelSize: 0.08 }]}
        />
      </mesh>
    </group>
  );
}
