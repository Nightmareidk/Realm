"use client";

import { useGLTF } from "@react-three/drei";
import { type ThreeElements, useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

/**
 * A member of Realm's cast, live in 3D. It bobs gently and turns its head a little toward the
 * pointer; with `wave` it waves. Two kinds of model:
 *
 * - Built by Blender (scripts/blender/cast.py), with the right arm on two named joints, ShoulderR
 *   and ElbowR: the wave is posed here, raising the arm and swinging from the elbow.
 * - Rigged and animated elsewhere (Meshy and the like, as a GLB with its animations inside): it
 *   plays its own clips. An idle loops if there is one; the wave (a clip named like "wave" or
 *   "hello") plays every few seconds and eases back into the idle.
 *
 * `still` freezes it.
 */
export type CastName =
  | "astro-teal"
  | "astro-violet"
  | "alien-zib"
  | "alien-meshy"
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

/**
 * The exported models keep every part as its own mesh, about 55 per character. Parts that hang
 * from the same joint and share a material are merged into one mesh here, so a character costs a
 * dozen or so draw calls instead of fifty (twice over, counting the shadow pass). Nothing moves
 * relative to its joint, so the merge can't be seen.
 */
function mergeParts(root: THREE.Object3D) {
  const groups = new Map<string, THREE.Mesh[]>();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !o.parent || o.children.length) return;
    if (Array.isArray(o.material)) return;
    const g = o.geometry as THREE.BufferGeometry;
    const key = [
      o.parent.uuid,
      o.material.uuid,
      Object.keys(g.attributes).sort().join(","),
      g.index ? "i" : "",
    ].join("|");
    groups.set(key, [...(groups.get(key) ?? []), o]);
  });
  for (const meshes of groups.values()) {
    const first = meshes[0];
    const parent = first?.parent;
    if (!first || !parent || meshes.length < 2) continue;
    const merged = mergeGeometries(
      meshes.map((m) => {
        m.updateMatrix();
        return m.geometry.clone().applyMatrix4(m.matrix);
      }),
    );
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, first.material);
    mesh.name = first.name;
    parent.add(mesh);
    for (const m of meshes) parent.remove(m);
  }
}

/**
 * Glass and jelly parts are exported with transmission, which makes three render the whole scene a
 * second time, every frame, just to see through them. Blending gives the same see-through read at
 * the size the cast appears, without that pass.
 */
function softenGlass(m: THREE.Material) {
  if (!(m instanceof THREE.MeshPhysicalMaterial) || m.transmission <= 0) return;
  m.opacity = 1 - m.transmission * 0.55;
  m.transmission = 0;
  m.transparent = true;
  m.needsUpdate = true;
}

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
  const { scene, animations } = useGLTF(url(who), DRACO);
  const model = useMemo(() => {
    let skinned = false;
    scene.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned = true;
    });
    // A rigged model needs its skeleton cloned with it (and must keep its meshes separate).
    if (skinned) return cloneSkinned(scene);
    const m = scene.clone(true);
    mergeParts(m);
    return m;
  }, [scene]);
  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model]);

  // Models that bring their own animations: idle on a loop, a wave now and then.
  useEffect(() => {
    if (!animations.length) return;
    const find = (re: RegExp) => animations.find((c) => re.test(c.name));
    const idleClip = find(/idle|breath|stand/i);
    const waveClip = find(/wave|hello|greet|hi\b/i);
    const idle = idleClip ? mixer.clipAction(idleClip).play() : null;
    const first = animations[0];
    if (!wave || !waveClip) {
      if (!idle && first) mixer.clipAction(first).play();
      return () => {
        mixer.stopAllAction();
      };
    }
    const hello = mixer.clipAction(waveClip);
    hello.setLoop(THREE.LoopOnce, 1);
    let timer = 0;
    const greet = () => {
      hello.reset().fadeIn(0.3).play();
      idle?.fadeOut(0.3);
    };
    const onDone = (e: { action: THREE.AnimationAction }) => {
      if (e.action !== hello) return;
      idle?.reset().fadeIn(0.45).play();
      hello.fadeOut(0.45);
      timer = window.setTimeout(greet, 2600);
    };
    mixer.addEventListener("finished", onDone);
    timer = window.setTimeout(greet, 600 + phase * 500);
    return () => {
      window.clearTimeout(timer);
      mixer.removeEventListener("finished", onDone);
      mixer.stopAllAction();
    };
  }, [mixer, animations, wave, phase]);
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
  const euler = useMemo(() => new THREE.Euler(), []);

  useLayoutEffect(() => {
    model.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        const m = o.material as THREE.MeshStandardMaterial;
        if (m.emissiveIntensity > 1) m.toneMapped = false;
        softenGlass(m);
      }
    });
  }, [model]);

  useFrame((state, delta) => {
    if (!still) mixer.update(delta);
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
        .multiply(q.setFromEuler(euler.set(-state.pointer.y * 0.08, yaw, tilt)));
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
