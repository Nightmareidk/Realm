"use client";

import { RoundedBox } from "@react-three/drei";
import { type ThreeElements, useFrame } from "@react-three/fiber";
import { type RefObject, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { C, glow, iridescent, toy } from "./toy";

export type AstronautTone = "teal" | "blue" | "violet" | "pink";

/** Main accent (gloves, boots, collar, shoulders) and a second colour for the smaller details. */
const PALETTE: Record<AstronautTone, { accent: string; second: string }> = {
  teal: { accent: C.teal, second: C.lime },
  blue: { accent: C.blue, second: C.teal },
  violet: { accent: C.violet, second: C.pink },
  pink: { accent: C.pink, second: C.violet },
};

const DARK = "#1b2742";
const SOLE = "#2b3653";

/** The waving arm's resting pose: upper arm raised out to the side, forearm pointing up. */
export const WAVE_SHOULDER = 2.3;
export const WAVE_ELBOW = 0.62;

/**
 * One wave cycle (3.2 s): raise into it, three easy swings from the elbow, then hold with the
 * hand up. Returns 0..1 envelope and the swing (-1..1) so the body can react to it too.
 */
function waveAt(t: number) {
  const p = t % 3.2;
  const env =
    THREE.MathUtils.smoothstep(p, 0, 0.35) * (1 - THREE.MathUtils.smoothstep(p, 1.75, 2.15));
  return { env, swing: Math.sin(p * Math.PI * 2 * 1.45) };
}

/**
 * A Realm explorer: a stylized astronaut built from primitives (no model files). Big helmet with
 * an iridescent visor and softly glowing eyes that follow the pointer, glossy suit with panels,
 * belt, knee pads and cuffs in the explorer's colours, a backpack with two tanks, side lamps on
 * the helmet and a Realm mission patch. Floats in zero-g; `wave` waves hello from the elbow.
 * `still` freezes the pose. About 2.6 units tall, feet at y=0.
 *
 * `part` renders a subset for the 2D wave renders: "body" leaves out the waving forearm and
 * "forearm" draws only it, so the page can rotate the forearm about the elbow smoothly.
 */
export function Astronaut3D({
  tone,
  wave = false,
  still = false,
  phase = 0,
  part = "all",
  elbow,
  ...group
}: {
  tone: AstronautTone;
  wave?: boolean;
  still?: boolean;
  phase?: number;
  part?: "all" | "body" | "forearm";
  elbow?: RefObject<THREE.Object3D | null>;
} & ThreeElements["group"]) {
  const { accent, second } = PALETTE[tone];
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const shoulderR = useRef<THREE.Group>(null);
  const elbowR = useRef<THREE.Group>(null);
  const wristR = useRef<THREE.Group>(null);
  const shoulderL = useRef<THREE.Group>(null);
  const elbowL = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.Mesh>(null);

  const body = part !== "forearm";
  const fore = part !== "body";

  // Every solid part casts and receives soft shadows (glows and the visor don't).
  useLayoutEffect(() => {
    root.current?.traverse((o) => {
      if (o instanceof THREE.Mesh && !(o.material instanceof THREE.MeshBasicMaterial)) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }, []);

  useFrame((state) => {
    if (still) return;
    const t = state.clock.elapsedTime + phase;
    const { env, swing } = wave ? waveAt(t) : { env: 0, swing: 0 };
    if (root.current) {
      root.current.position.y = Math.sin(t * 0.9) * 0.16;
      root.current.rotation.z = Math.sin(t * 0.6) * 0.07 - env * 0.06;
      root.current.rotation.x = Math.sin(t * 0.5 + 1) * 0.05;
    }
    if (head.current) {
      head.current.rotation.z = Math.sin(t * 0.7 + 2) * 0.05 + env * (0.1 + swing * 0.03);
      head.current.rotation.y = state.pointer.x * 0.18;
      head.current.rotation.x = -state.pointer.y * 0.08;
    }
    if (wave) {
      if (shoulderR.current)
        shoulderR.current.rotation.z =
          WAVE_SHOULDER + env * swing * 0.05 + Math.sin(t * 0.8) * 0.03;
      if (elbowR.current) elbowR.current.rotation.z = WAVE_ELBOW + env * swing * 0.5;
      // The hand trails the forearm a little, which is what makes a wave read as loose.
      if (wristR.current)
        wristR.current.rotation.z = env * Math.sin((t % 3.2) * Math.PI * 2 * 1.45 - 0.9) * 0.28;
    } else {
      if (shoulderR.current) shoulderR.current.rotation.z = 0.42 + Math.sin(t * 0.8) * 0.08;
      if (elbowR.current) elbowR.current.rotation.z = -0.22 + Math.sin(t * 0.8 + 0.6) * 0.06;
    }
    if (shoulderL.current) shoulderL.current.rotation.z = -0.42 - Math.sin(t * 0.8 + 1) * 0.08;
    if (elbowL.current) elbowL.current.rotation.z = 0.22 - Math.sin(t * 0.8 + 1.6) * 0.06;
    if (eyes.current) {
      eyes.current.scale.y = (t * 0.8) % 4.2 < 0.12 ? 0.1 : 1;
      eyes.current.position.x = state.pointer.x * 0.05;
      eyes.current.position.y = state.pointer.y * 0.03;
    }
    if (beacon.current) beacon.current.scale.setScalar(0.85 + Math.abs(Math.sin(t * 2.2)) * 0.3);
  });

  const shoulderRest = wave ? WAVE_SHOULDER : 0.42;
  const elbowRest = wave ? WAVE_ELBOW : -0.22;

  return (
    <group {...group}>
      <group ref={root}>
        <group visible={body}>
          {/* Legs: thigh, knee pad, boot with a dark sole and a cuff in the second colour */}
          {[-0.24, 0.24].map((x) => (
            <group key={x} position={[x, 0, 0]}>
              <mesh position={[0, 0.52, 0]} material={toy(C.suit)}>
                <capsuleGeometry args={[0.19, 0.24, 12, 32]} />
              </mesh>
              <mesh
                position={[0, 0.5, 0.16]}
                scale={[1, 1, 0.5]}
                material={toy(C.suitShade, { rough: 0.3 })}
              >
                <sphereGeometry args={[0.12, 32, 20]} />
              </mesh>
              <mesh position={[0, 0.3, 0.02]} rotation={[Math.PI / 2, 0, 0]} material={toy(second)}>
                <torusGeometry args={[0.18, 0.04, 16, 40]} />
              </mesh>
              <mesh position={[0, 0.17, 0.06]} scale={[1, 0.72, 1.28]} material={toy(accent)}>
                <sphereGeometry args={[0.21, 40, 28]} />
              </mesh>
              <RoundedBox
                args={[0.36, 0.08, 0.5]}
                radius={0.035}
                smoothness={4}
                position={[0, 0.04, 0.08]}
                material={toy(SOLE, { rough: 0.6 })}
              />
            </group>
          ))}

          {/* Backpack with two tanks, vents and a beacon */}
          <RoundedBox
            args={[0.9, 0.86, 0.4]}
            radius={0.14}
            smoothness={6}
            position={[0, 1.02, -0.46]}
            material={toy(C.suitShade)}
          />
          {[-0.22, 0.22].map((x) => (
            <mesh key={x} position={[x, 1.02, -0.7]} material={toy(accent, { rough: 0.3 })}>
              <capsuleGeometry args={[0.13, 0.5, 12, 32]} />
            </mesh>
          ))}
          {[0.86, 0.94, 1.02].map((y) => (
            <RoundedBox
              key={y}
              args={[0.16, 0.035, 0.05]}
              radius={0.015}
              position={[0, y, -0.67]}
              material={toy(DARK)}
            />
          ))}
          <mesh position={[0, 1.32, -0.68]} material={glow(second)}>
            <sphereGeometry args={[0.05, 16, 12]} />
          </mesh>

          {/* Torso, belt with a buckle */}
          <mesh position={[0, 0.98, 0]} material={toy(C.suit)}>
            <capsuleGeometry args={[0.5, 0.34, 16, 40]} />
          </mesh>
          <mesh
            position={[0, 0.7, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[1, 0.93, 1]}
            material={toy(second, { rough: 0.35 })}
          >
            <torusGeometry args={[0.46, 0.065, 18, 56]} />
          </mesh>
          <RoundedBox
            args={[0.24, 0.15, 0.08]}
            radius={0.035}
            smoothness={4}
            position={[0, 0.7, 0.49]}
            material={toy(DARK)}
          />
          <mesh position={[0, 0.7, 0.535]} material={glow(second)}>
            <sphereGeometry args={[0.03, 12, 8]} />
          </mesh>

          {/* Chest control panel: a little screen and three buttons */}
          <RoundedBox
            args={[0.5, 0.33, 0.1]}
            radius={0.05}
            smoothness={4}
            position={[0, 1.06, 0.46]}
            rotation={[-0.12, 0, 0]}
            material={toy(DARK, { rough: 0.3 })}
          />
          <RoundedBox
            args={[0.2, 0.13, 0.02]}
            radius={0.02}
            position={[-0.1, 1.09, 0.52]}
            rotation={[-0.12, 0, 0]}
            material={glow(C.teal)}
          />
          <mesh
            position={[-0.1, 1.09, 0.535]}
            rotation={[-0.12, 0, 0]}
            material={glow("#e8fffb", 0.5)}
          >
            <planeGeometry args={[0.13, 0.015]} />
          </mesh>
          {[
            [0.1, 1.13, C.lime],
            [0.18, 1.13, C.pink],
            [0.14, 1.03, C.blue],
          ].map(([x, y, c]) => (
            <mesh
              key={String(c)}
              position={[x as number, y as number, 0.53]}
              material={toy(c as string, { rough: 0.25, emissive: c as string, glow: 0.35 })}
            >
              <sphereGeometry args={[0.032, 16, 12]} />
            </mesh>
          ))}

          {/* Collar */}
          <mesh position={[0, 1.42, 0]} rotation={[Math.PI / 2, 0, 0]} material={toy(accent)}>
            <torusGeometry args={[0.4, 0.08, 20, 56]} />
          </mesh>
        </group>

        {/* Right arm: shoulder, elbow and wrist joints (the waving arm) */}
        <group ref={shoulderR} position={[0.5, 1.22, 0]} rotation={[0, 0, shoulderRest]}>
          <group visible={body}>
            <mesh position={[0.02, 0.02, 0]} scale={[1, 0.75, 1]} material={toy(accent)}>
              <sphereGeometry args={[0.2, 32, 20]} />
            </mesh>
            <mesh position={[0, -0.2, 0]} material={toy(C.suit)}>
              <capsuleGeometry args={[0.15, 0.2, 12, 32]} />
            </mesh>
          </group>
          <group ref={elbowR} position={[0, -0.4, 0]} rotation={[0, 0, elbowRest]}>
            <object3D ref={elbow} />
            <mesh visible={body} material={toy(C.suitShade)}>
              <sphereGeometry args={[0.145, 32, 20]} />
            </mesh>
            <group visible={fore}>
              <mesh position={[0, -0.19, 0]} material={toy(C.suit)}>
                <capsuleGeometry args={[0.14, 0.18, 12, 32]} />
              </mesh>
              <mesh position={[0, -0.33, 0]} rotation={[Math.PI / 2, 0, 0]} material={toy(second)}>
                <torusGeometry args={[0.13, 0.038, 16, 36]} />
              </mesh>
              <group ref={wristR} position={[0, -0.38, 0]}>
                <mesh position={[0, -0.1, 0]} scale={[1, 1.12, 0.86]} material={toy(accent)}>
                  <sphereGeometry args={[0.16, 36, 24]} />
                </mesh>
                <mesh position={[0.12, -0.04, 0.05]} material={toy(accent)}>
                  <sphereGeometry args={[0.065, 20, 14]} />
                </mesh>
              </group>
            </group>
          </group>
        </group>

        {/* Left arm with the Realm mission patch on the shoulder */}
        <group ref={shoulderL} position={[-0.5, 1.22, 0]} rotation={[0, 0, -0.42]} visible={body}>
          <mesh position={[-0.02, 0.02, 0]} scale={[1, 0.75, 1]} material={toy(accent)}>
            <sphereGeometry args={[0.2, 32, 20]} />
          </mesh>
          <mesh position={[0, -0.2, 0]} material={toy(C.suit)}>
            <capsuleGeometry args={[0.15, 0.2, 12, 32]} />
          </mesh>
          <group position={[-0.1, -0.16, 0.1]} rotation={[0, -0.9, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} material={toy(C.midnight, { rough: 0.3 })}>
              <cylinderGeometry args={[0.075, 0.075, 0.02, 28]} />
            </mesh>
            <mesh
              position={[-0.01, -0.01, 0.012]}
              material={toy(C.lime, { emissive: C.lime, glow: 0.4 })}
            >
              <torusGeometry args={[0.052, 0.012, 10, 32]} />
            </mesh>
          </group>
          <group ref={elbowL} position={[0, -0.4, 0]} rotation={[0, 0, 0.22]}>
            <mesh material={toy(C.suitShade)}>
              <sphereGeometry args={[0.145, 32, 20]} />
            </mesh>
            <mesh position={[0, -0.19, 0]} material={toy(C.suit)}>
              <capsuleGeometry args={[0.14, 0.18, 12, 32]} />
            </mesh>
            <mesh position={[0, -0.33, 0]} rotation={[Math.PI / 2, 0, 0]} material={toy(second)}>
              <torusGeometry args={[0.13, 0.038, 16, 36]} />
            </mesh>
            <mesh position={[0, -0.48, 0]} scale={[1, 1.12, 0.86]} material={toy(accent)}>
              <sphereGeometry args={[0.16, 36, 24]} />
            </mesh>
          </group>
        </group>

        {/* Head: helmet, visor rim, visor, eyes, lamps and antenna, pivoting at the neck */}
        <group ref={head} position={[0, 1.42, 0]} visible={body}>
          <mesh position={[0, 0.5, 0]} material={toy(C.suit, { rough: 0.22 })}>
            <sphereGeometry args={[0.66, 64, 48]} />
          </mesh>
          <mesh
            position={[0, 0.5, 0.4]}
            scale={[1.04, 1, 1]}
            material={toy(accent, { rough: 0.3 })}
          >
            <torusGeometry args={[0.54, 0.045, 18, 72]} />
          </mesh>
          <mesh position={[0, 0.5, 0.2]} scale={[0.84, 0.66, 0.74]} material={iridescent()}>
            <sphereGeometry args={[0.66, 64, 48]} />
          </mesh>
          <group ref={eyes} position={[0, 0.54, 0.68]}>
            {[-0.15, 0.15].map((x) => (
              <mesh
                key={x}
                position={[x, 0, 0]}
                scale={[0.75, 1.15, 0.4]}
                material={glow("#dffcff")}
              >
                <sphereGeometry args={[0.075, 20, 14]} />
              </mesh>
            ))}
          </group>
          <mesh
            position={[-0.22, 0.72, 0.6]}
            rotation={[0, 0, 0.55]}
            scale={[1.7, 0.45, 0.3]}
            material={glow("#ffffff", 0.55)}
          >
            <sphereGeometry args={[0.06, 16, 10]} />
          </mesh>
          <mesh
            position={[0.27, 0.36, 0.63]}
            rotation={[0, 0, 0.9]}
            scale={[1, 0.35, 0.3]}
            material={glow("#ffffff", 0.3)}
          >
            <sphereGeometry args={[0.05, 12, 8]} />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.64, 0.5, 0]} rotation={[0, 0, (s * Math.PI) / 2]}>
              <mesh material={toy(C.suitShade)}>
                <cylinderGeometry args={[0.12, 0.13, 0.1, 32]} />
              </mesh>
              <mesh position={[0, -0.06 * s, 0]} scale={[1, 0.3, 1]} material={glow(second)}>
                <sphereGeometry args={[0.08, 20, 12]} />
              </mesh>
            </group>
          ))}
          <mesh position={[-0.34, 1.08, -0.05]} rotation={[0, 0, 0.35]} material={toy(C.suitShade)}>
            <cylinderGeometry args={[0.022, 0.022, 0.36, 12]} />
          </mesh>
          <mesh ref={beacon} position={[-0.41, 1.27, -0.05]} material={glow(accent)}>
            <sphereGeometry args={[0.07, 20, 14]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
