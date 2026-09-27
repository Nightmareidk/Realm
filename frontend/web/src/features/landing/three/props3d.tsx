"use client";

import { RoundedBox } from "@react-three/drei";
import type { ThreeElements } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import {
  arrowShape,
  bevel,
  bubbleShape,
  C,
  glow,
  heartShape,
  metal,
  playShape,
  sparkShape,
  toy,
} from "./toy";

type G = ThreeElements["group"];

const DARKER = "#16213a";

/** A deeper shade for the extruded sides, so flat shapes read as solid objects. */
const side = (color: string, amount = 0.28) =>
  `#${new THREE.Color(color).offsetHSL(0, 0.04, -amount * 0.5).getHexString()}`;
const twoTone = (color: string) => [toy(color), toy(side(color), { rough: 0.5 })];

/** Group wrapper that lets every solid part cast and receive soft shadows. */
function Solid({ children, ...props }: G) {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    ref.current?.traverse((o) => {
      if (o instanceof THREE.Mesh && !(o.material instanceof THREE.MeshBasicMaterial)) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }, []);
  return (
    <group ref={ref} {...props}>
      {children}
    </group>
  );
}

/** A soft gloss highlight, like light caught on vinyl. */
function Gloss({ opacity = 0.5, ...props }: { opacity?: number } & ThreeElements["mesh"]) {
  return (
    <mesh material={glow("#ffffff", opacity)} {...props}>
      <sphereGeometry args={[0.1, 16, 10]} />
    </mesh>
  );
}

/** Chat bubble with a proper tail and three typing dots. */
export function Bubble3D({ color = C.teal, ...props }: G & { color?: string }) {
  return (
    <Solid {...props}>
      <mesh position={[0, 0, -0.15]} material={twoTone(color)}>
        <extrudeGeometry
          args={[
            bubbleShape(1.5, 1, 0.34),
            { depth: 0.24, ...bevel, bevelThickness: 0.1, bevelSize: 0.08 },
          ]}
        />
      </mesh>
      {[-0.36, 0, 0.36].map((x) => (
        <mesh
          key={x}
          position={[x, 0, 0.2]}
          scale={[1, 1, 0.6]}
          material={toy(C.white, { rough: 0.2 })}
        >
          <sphereGeometry args={[0.11, 24, 16]} />
        </mesh>
      ))}
      <Gloss
        position={[-0.42, 0.3, 0.2]}
        rotation={[0, 0, 0.3]}
        scale={[2.2, 0.6, 0.3]}
        opacity={0.45}
      />
    </Solid>
  );
}

export function Heart3D({ color = C.pink, ...props }: G & { color?: string }) {
  return (
    <Solid {...props}>
      <mesh position={[0, -0.1, -0.1]} material={twoTone(color)}>
        <extrudeGeometry
          args={[heartShape(1), { depth: 0.22, ...bevel, bevelThickness: 0.14, bevelSize: 0.11 }]}
        />
      </mesh>
      <Gloss
        position={[-0.24, 0.42, 0.26]}
        rotation={[0, 0, 0.7]}
        scale={[1.6, 0.6, 0.3]}
        opacity={0.55}
      />
      <Gloss position={[0.3, 0.46, 0.24]} scale={[0.5, 0.5, 0.3]} opacity={0.4} />
    </Solid>
  );
}

export function Spark3D({ color = C.lime, ...props }: G & { color?: string }) {
  return (
    <Solid {...props}>
      <mesh
        position={[0, 0, -0.08]}
        material={[toy(color, { emissive: color, glow: 0.25 }), toy(side(color, 0.35))]}
      >
        <extrudeGeometry
          args={[sparkShape(0.9), { depth: 0.16, ...bevel, bevelThickness: 0.08, bevelSize: 0.06 }]}
        />
      </mesh>
      {(
        [
          [0.78, 0.66, 0.26, C.teal],
          [-0.72, -0.62, 0.2, C.pink],
        ] as const
      ).map(([x, y, s, c]) => (
        <mesh key={c} position={[x, y, 0]} material={twoTone(c)}>
          <extrudeGeometry
            args={[sparkShape(s), { depth: 0.06, ...bevel, bevelThickness: 0.03, bevelSize: 0.02 }]}
          />
        </mesh>
      ))}
      <Gloss position={[-0.08, 0.28, 0.16]} scale={[0.5, 1.4, 0.3]} opacity={0.5} />
    </Solid>
  );
}

export function Lock3D(props: G) {
  return (
    <Solid {...props}>
      <mesh position={[0, 0.45, 0]} material={metal()}>
        <torusGeometry args={[0.42, 0.1, 24, 48, Math.PI]} />
      </mesh>
      {[-0.42, 0.42].map((x) => (
        <mesh key={x} position={[x, 0.3, 0]} material={metal()}>
          <cylinderGeometry args={[0.1, 0.1, 0.3, 24]} />
        </mesh>
      ))}
      <RoundedBox
        args={[1.25, 1, 0.5]}
        radius={0.16}
        smoothness={8}
        position={[0, -0.2, 0]}
        material={toy(C.lime)}
      />
      <RoundedBox
        args={[1.28, 0.16, 0.53]}
        radius={0.06}
        smoothness={4}
        position={[0, -0.52, 0]}
        material={toy(side(C.lime, 0.35))}
      />
      <RoundedBox
        args={[0.5, 0.56, 0.06]}
        radius={0.06}
        smoothness={4}
        position={[0, -0.18, 0.25]}
        material={toy(DARKER, { rough: 0.3 })}
      />
      <mesh position={[0, -0.1, 0.285]} rotation={[Math.PI / 2, 0, 0]} material={toy(C.ink)}>
        <cylinderGeometry args={[0.085, 0.085, 0.03, 28]} />
      </mesh>
      <mesh position={[0, -0.25, 0.285]} material={toy(C.ink)}>
        <boxGeometry args={[0.07, 0.2, 0.03]} />
      </mesh>
      {(
        [
          [-0.48, 0.18],
          [0.48, 0.18],
          [-0.48, -0.44],
          [0.48, -0.44],
        ] as const
      ).map(([x, y]) => (
        <mesh key={`${x},${y}`} position={[x, y, 0.25]} scale={[1, 1, 0.5]} material={metal()}>
          <sphereGeometry args={[0.04, 16, 12]} />
        </mesh>
      ))}
      <Gloss
        position={[-0.38, 0.12, 0.26]}
        rotation={[0, 0, 0.2]}
        scale={[0.6, 1.6, 0.3]}
        opacity={0.4}
      />
    </Solid>
  );
}

export function Controller3D(props: G) {
  const shell = "#22345a";
  return (
    <Solid {...props}>
      <RoundedBox
        args={[1.9, 0.9, 0.42]}
        radius={0.3}
        smoothness={8}
        material={toy(shell, { rough: 0.3 })}
      />
      <RoundedBox
        args={[1.5, 0.5, 0.1]}
        radius={0.05}
        smoothness={4}
        position={[0, 0.02, 0.2]}
        material={toy(DARKER, { rough: 0.35 })}
      />
      {[-0.72, 0.72].map((x) => (
        <mesh key={x} position={[x, -0.32, 0]} material={toy(shell, { rough: 0.3 })}>
          <sphereGeometry args={[0.36, 40, 28]} />
        </mesh>
      ))}
      {[-0.55, 0.55].map((x) => (
        <mesh
          key={x}
          position={[x, 0.43, -0.02]}
          rotation={[0, 0, Math.PI / 2]}
          material={toy(x < 0 ? C.teal : C.pink)}
        >
          <capsuleGeometry args={[0.07, 0.3, 8, 20]} />
        </mesh>
      ))}
      <RoundedBox
        args={[0.36, 0.11, 0.07]}
        radius={0.03}
        position={[-0.52, 0.06, 0.26]}
        material={toy(C.ink)}
      />
      <RoundedBox
        args={[0.11, 0.36, 0.07]}
        radius={0.03}
        position={[-0.52, 0.06, 0.26]}
        material={toy(C.ink)}
      />
      {(
        [
          [0.52, 0.18, C.teal],
          [0.68, 0.04, C.pink],
          [0.52, -0.1, C.lime],
          [0.36, 0.04, C.blue],
        ] as const
      ).map(([x, y, color]) => (
        <mesh
          key={color}
          position={[x, y, 0.26]}
          scale={[1, 1, 0.7]}
          material={toy(color, { rough: 0.2, emissive: color, glow: 0.2 })}
        >
          <sphereGeometry args={[0.075, 20, 14]} />
        </mesh>
      ))}
      {[-0.26, 0.26].map((x) => (
        <group key={x} position={[x, -0.2, 0.24]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh material={toy(C.ink)}>
            <cylinderGeometry args={[0.1, 0.12, 0.08, 28]} />
          </mesh>
          <mesh position={[0, 0.07, 0]} material={toy("#3b4d74", { rough: 0.5 })}>
            <cylinderGeometry args={[0.12, 0.11, 0.05, 28]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.3, 0.215]} material={glow(C.teal)}>
        <boxGeometry args={[0.3, 0.035, 0.01]} />
      </mesh>
      <Gloss
        position={[-0.5, 0.36, 0.2]}
        rotation={[0, 0, 0.1]}
        scale={[3, 0.4, 0.3]}
        opacity={0.3}
      />
    </Solid>
  );
}

export function Play3D(props: G) {
  return (
    <Solid {...props}>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={toy(C.blue)}>
        <cylinderGeometry args={[0.7, 0.7, 0.26, 72]} />
      </mesh>
      <mesh position={[0, 0, 0.12]} material={toy("#93c5fd", { rough: 0.3 })}>
        <torusGeometry args={[0.62, 0.05, 16, 72]} />
      </mesh>
      <mesh position={[0.04, 0, 0.08]} material={twoTone(C.white)}>
        <extrudeGeometry
          args={[
            playShape(0.56, 0.16),
            { depth: 0.06, ...bevel, bevelThickness: 0.04, bevelSize: 0.035 },
          ]}
        />
      </mesh>
      <Gloss
        position={[-0.28, 0.36, 0.16]}
        rotation={[0, 0, 0.6]}
        scale={[2, 0.5, 0.3]}
        opacity={0.4}
      />
    </Solid>
  );
}

export function Upvote3D(props: G) {
  return (
    <Solid {...props}>
      <mesh position={[0, 0, -0.1]} material={twoTone(C.pink)}>
        <extrudeGeometry
          args={[arrowShape(1.4), { depth: 0.2, ...bevel, bevelThickness: 0.1, bevelSize: 0.08 }]}
        />
      </mesh>
      <Gloss
        position={[-0.2, 0.3, 0.2]}
        rotation={[0, 0, -0.9]}
        scale={[1.8, 0.4, 0.3]}
        opacity={0.45}
      />
    </Solid>
  );
}
