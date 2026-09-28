"use client";

import { useGLTF } from "@react-three/drei";
import { type ThreeElements, useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

/**
 * A member of Realm's cast, live in 3D. The characters are made in Meshy (image to 3D) and made
 * light for the web by scripts/render-cast.mjs. It bobs gently in zero-g; with `wave` it says hello.
 * Two kinds of model:
 *
 * - Posed (a single mesh, already standing with a hand up): the hello is the whole body rocking
 *   from the feet, a few quick sways every few seconds, then back to drifting.
 * - Rigged and animated (a GLB with its animations inside, as Meshy's Animate step exports): it
 *   plays its own clips. An idle loops if there is one; the wave (a clip named like "wave" or
 *   "hello") plays every few seconds and eases back into the idle.
 *
 * `still` freezes it.
 */
export type CastName =
  | "astro-teal"
  | "alien-zib"
  | "alien-meshy"
  | "alien-nova"
  | "monster-gloop"
  | "monster-bruno"
  | "human-maya"
  | "human-leo";

const DRACO = "/draco/";
const url = (who: CastName) => `/models/${who}.glb`;

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
    // A rigged model needs its skeleton cloned with it.
    return skinned ? cloneSkinned(scene) : scene.clone(true);
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
  const root = useRef<THREE.Group>(null);
  // A posed model says hello by rocking from its feet; an animated one plays its own wave.
  const rock = wave && !animations.length;

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
    const g = root.current;
    if (!g) return;
    if (still) {
      g.position.y = 0;
      g.rotation.set(0, 0, 0);
      return;
    }
    const { env, swing } = rock ? waveAt(t) : { env: 0, swing: 0 };
    g.position.y = Math.sin(t * 0.9) * 0.14 + env * Math.abs(swing) * 0.05;
    g.rotation.z = Math.sin(t * 0.6) * 0.05 + env * swing * 0.11;
    // A little turn toward the pointer, like a glance.
    g.rotation.y = state.pointer.x * 0.18 + env * 0.12;
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
