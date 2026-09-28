"use client";

import { useGLTF } from "@react-three/drei";
import { type ThreeElements, useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

/**
 * A member of Realm's cast, live in 3D. The characters are made in Meshy (image to 3D); their
 * raised arm is rigged and given a "Wave" by scripts/render-cast.mjs (Blender), so with `wave` the
 * forearm swings from the elbow every few seconds, hand firm, while the body just floats. A model that brings an idle clip loops it between waves. `still` freezes it.
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
      timer = window.setTimeout(greet, 1800);
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
    // Floating in zero-g: a slow bob, nothing more. The hello is the arm's own animation.
    g.position.y = Math.sin(t * 0.9) * 0.12;
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
