"use client";

import { useGLTF } from "@react-three/drei";
import { type ThreeElements, useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * A member of Realm's cast, live in 3D: the model is built and exported by Blender
 * (scripts/blender/cast.py) with its right arm on two named joints, ShoulderR and ElbowR, so it
 * can wave here. It bobs gently, turns its head a little toward the pointer, and (with `wave`)
 * raises its arm and waves from the elbow. `still` freezes it.
 */
export type CastName =
  | "astro-teal"
  | "astro-violet"
  | "alien-zib"
  | "alien-nova"
  | "monster-gloop"
  | "monster-bruno"
  | "human-maya"
  | "human-leo";

const DRACO = "/draco/";
const url = (who: CastName) => `/models/${who}.glb`;

// Blender's rotation about its depth axis (Y) becomes a rotation about three's depth axis (Z)
// once the model is converted to Y-up; the sign flips.
const RAISE = THREE.MathUtils.degToRad(128 - 15);
const BEND = THREE.MathUtils.degToRad(48 + 12);
const Z = new THREE.Vector3(0, 0, 1);

function waveAt(t: number) {
  const p = t % 3.2;
  const env =
    THREE.MathUtils.smoothstep(p, 0, 0.35) * (1 - THREE.MathUtils.smoothstep(p, 1.75, 2.15));
  return { env, swing: Math.sin(p * Math.PI * 2 * 1.45) };
}

export function CastMember({
  who,
  wave = false,
  still = false,
  phase = 0,
  ...group
}: {
  who: CastName;
  wave?: boolean;
  still?: boolean;
  phase?: number;
} & ThreeElements["group"]) {
  const { scene } = useGLTF(url(who), DRACO);
  const model = useMemo(() => scene.clone(true), [scene]);
  const joints = useMemo(() => {
    const get = (name: string) => model.getObjectByName(name) ?? null;
    const shoulder = get("ShoulderR");
    const elbow = get("ElbowR");
    const head = get("Head");
    return {
      shoulder,
      elbow,
      head,
      q0: {
        shoulder: shoulder?.quaternion.clone() ?? new THREE.Quaternion(),
        elbow: elbow?.quaternion.clone() ?? new THREE.Quaternion(),
        head: head?.quaternion.clone() ?? new THREE.Quaternion(),
      },
    };
  }, [model]);
  const root = useRef<THREE.Group>(null);
  const q = useMemo(() => new THREE.Quaternion(), []);

  useLayoutEffect(() => {
    model.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        const m = o.material as THREE.MeshStandardMaterial;
        if (m.emissiveIntensity > 1) m.toneMapped = false;
      }
    });
  }, [model]);

  useFrame((state) => {
    const t = state.clock.elapsedTime + phase;
    const { shoulder, elbow, head, q0 } = joints;
    if (root.current) {
      root.current.position.y = still ? 0 : Math.sin(t * 0.9) * 0.14;
      root.current.rotation.z = still ? 0 : Math.sin(t * 0.6) * 0.05;
    }
    if (head) {
      const yaw = still ? 0 : state.pointer.x * 0.25;
      const tilt = still ? 0 : Math.sin(t * 0.7 + 2) * 0.05;
      head.quaternion
        .copy(q0.head)
        .multiply(q.setFromEuler(new THREE.Euler(-state.pointer.y * 0.08, yaw, tilt)));
    }
    if (!wave || !shoulder || !elbow) return;
    const { env, swing } = still ? { env: 0, swing: 0 } : waveAt(t);
    shoulder.quaternion
      .copy(q0.shoulder)
      .multiply(q.setFromAxisAngle(Z, RAISE + env * swing * 0.05));
    elbow.quaternion.copy(q0.elbow).multiply(q.setFromAxisAngle(Z, BEND + env * swing * 0.5));
  });

  return (
    <group {...group}>
      <group ref={root}>
        <primitive object={model} />
      </group>
    </group>
  );
}

export const preloadCast = (cast: CastName[]) => {
  for (const who of cast) useGLTF.preload(url(who), DRACO);
};
