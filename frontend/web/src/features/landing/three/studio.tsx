"use client";

import { Environment, Lightformer } from "@react-three/drei";

/**
 * Shared lighting for every Realm 3D scene: a warm key, a pink rim from behind, a violet sky
 * fill, and a tiny procedural environment for the clearcoat reflections (no HDR downloads).
 */
export function Studio() {
  return (
    <>
      <hemisphereLight args={["#d9ccff", "#2a1a78", 1.1]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[5, 9, 7]} intensity={2.4} color="#fff3e0" />
      <directionalLight position={[-7, 4, -5]} intensity={1.6} color="#ff8ad0" />
      <directionalLight position={[6, 2, -6]} intensity={0.9} color="#8fdcff" />
      <Environment resolution={128} frames={1}>
        <Lightformer
          form="rect"
          intensity={2.2}
          color="#ffffff"
          position={[0, 5, 6]}
          scale={[10, 4, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.4}
          color="#b89bff"
          position={[-6, 2, 2]}
          scale={[4, 6, 1]}
        />
        <Lightformer form="ring" intensity={1.2} color="#ff8ad0" position={[6, 3, -3]} scale={3} />
      </Environment>
    </>
  );
}
