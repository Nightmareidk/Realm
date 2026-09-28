"use client";

import { useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import * as THREE from "three";

const NIGHT = {
  sky: "#c9d6ff",
  ground: "#241a6b",
  hemi: 1.05,
  key: "#f4f0ff",
  keyI: 2.3,
  rim: "#ff8ad0",
  rimI: 1.5,
  fill: "#7fe3ff",
  fillI: 0.9,
};
/** By day: sunlight, a warm key and an ember rim from the crimson sky. */
const DAY = {
  sky: "#ffe2c8",
  ground: "#5a1e1a",
  hemi: 1.2,
  key: "#fff1dc",
  keyI: 2.7,
  rim: "#ff7a45",
  rimI: 2.2,
  fill: "#ffb38a",
  fillI: 0.7,
};

/** Soft light panels around the scene, reflected in the cast's clearcoat. */
const PANELS: {
  form: "rect" | "ring";
  color: string;
  intensity: number;
  position: [number, number, number];
  scale: [number, number, number];
}[] = [
  { form: "rect", color: "#ffffff", intensity: 2.2, position: [0, 5, 6], scale: [10, 4, 1] },
  { form: "rect", color: "#b8a4ff", intensity: 1.3, position: [-6, 2, 2], scale: [4, 6, 1] },
  { form: "ring", color: "#ff8ad0", intensity: 1.2, position: [6, 3, -3], scale: [3, 3, 3] },
  { form: "rect", color: "#7fe3ff", intensity: 0.9, position: [4, -3, 4], scale: [6, 2, 1] },
];

/**
 * The reflection environment, built once from the light panels and set on the scene as the
 * scene mounts, before anything is compiled or drawn. (Attaching it on the first frame instead,
 * as a render-time environment does, changes every lit material's shader after the scene has been
 * compiled in the background, so they all recompile on the spot; on a cold shader cache that froze
 * the page for seconds.)
 */
function StudioEnvironment() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  useLayoutEffect(() => {
    const room = new THREE.Scene();
    const disposables: { dispose: () => void }[] = [];
    for (const p of PANELS) {
      const geometry =
        p.form === "ring" ? new THREE.RingGeometry(0.25, 0.5, 64) : new THREE.PlaneGeometry(1, 1);
      const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
      material.color.set(p.color).multiplyScalar(p.intensity);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...p.position);
      mesh.scale.set(...p.scale);
      mesh.lookAt(0, 0, 0);
      room.add(mesh);
      disposables.push(geometry, material);
    }
    const pmrem = new THREE.PMREMGenerator(gl);
    const target = pmrem.fromScene(room, 0, 0.1, 100, { size: 128 });
    pmrem.dispose();
    for (const d of disposables) d.dispose();
    const before = scene.environment;
    scene.environment = target.texture;
    return () => {
      if (scene.environment === target.texture) scene.environment = before;
      target.dispose();
    };
  }, [gl, scene]);

  return null;
}

/**
 * Shared lighting for every Realm 3D scene: a key light from the front right that casts soft
 * shadows, a coloured rim from behind, a fill, a sky/ground hemisphere, and a tiny procedural
 * environment for the clearcoat reflections (no HDR downloads). Cool with a pink rim at night;
 * warm sunlight with an ember rim by day. (Only colours and strengths change between the two, so
 * no shader has to recompile when the edition switches.)
 */
export function Studio({ shadows = true, day = false }: { shadows?: boolean; day?: boolean }) {
  const light = day ? DAY : NIGHT;
  return (
    <>
      <hemisphereLight color={light.sky} groundColor={light.ground} intensity={light.hemi} />
      <ambientLight intensity={0.18} />
      <directionalLight
        position={[5, 9, 8]}
        intensity={light.keyI}
        color={light.key}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={6}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-camera-near={1}
        shadow-camera-far={40}
      />
      <directionalLight position={[-7, 4, -6]} intensity={light.rimI} color={light.rim} />
      <directionalLight position={[6, 1, -6]} intensity={light.fillI} color={light.fill} />
      <StudioEnvironment />
    </>
  );
}
