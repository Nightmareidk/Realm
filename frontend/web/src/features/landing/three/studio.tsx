"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { type DayMix, ease } from "./theme";
import { holdWarmup, quietShaderChecks } from "./warm";

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
/**
 * By day: dawn in orbit. The low sun rims everyone in gold from behind, space above is a cool
 * blue, and the sunlit cloud sea below bounces warm orange light up onto them.
 */
const DAY = {
  sky: "#8fb6ff",
  ground: "#ff9a5a",
  hemi: 1.2,
  key: "#ffe9d2",
  keyI: 2.4,
  rim: "#ffb35c",
  rimI: 2.6,
  fill: "#9cc7ff",
  fillI: 0.75,
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

/** The PMREM generator's internals used to build the environment without a stall (three 0.186). */
type PmremInternals = {
  _setSize?: (size: number) => void;
  _allocateTargets?: () => THREE.WebGLRenderTarget;
  _ggxMaterial?: THREE.Material | null;
  _pingPongRenderTarget?: THREE.WebGLRenderTarget | null;
};

const ENV_SIZE = 128;

/**
 * The reflection environment, built once from the light panels.
 *
 * Every lit material's shader depends on the scene having an environment, so one is set as the
 * scene mounts, before anything is compiled: an empty target of exactly the final one's size and
 * format. (Setting it later changes those shaders after they've compiled in the background, and
 * they all recompile on the spot.) The prefilter that builds the real one uses a big shader that
 * took half a second to compile on Windows, blocking the page; it compiles in the background
 * first, then the environment is built and swapped in (same size and format, so no shader
 * changes). The scene isn't counted as warm (./warm.ts) until it's in.
 */
function StudioEnvironment() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  useLayoutEffect(() => {
    // Set before anything here compiles (this runs ahead of the canvas's own setup).
    quietShaderChecks(gl);
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
    const before = scene.environment;
    const pmrem = new THREE.PMREMGenerator(gl);
    const inside = pmrem as unknown as PmremInternals;
    let live = true;
    let placeholder: THREE.WebGLRenderTarget | null = null;
    let target: THREE.WebGLRenderTarget | null = null;
    const build = () => {
      if (!live) return;
      target = pmrem.fromScene(room, 0, 0.1, 100, { size: ENV_SIZE });
      pmrem.dispose();
      for (const d of disposables) d.dispose();
      scene.environment = target.texture;
      placeholder?.dispose();
      placeholder = null;
    };

    if (inside._setSize && inside._allocateTargets) {
      inside._setSize(ENV_SIZE);
      placeholder = inside._allocateTargets();
      scene.environment = placeholder.texture;
      const filter = inside._ggxMaterial;
      if (filter) {
        // Compiled as it will be drawn: into a float target, not the screen.
        const mesh = new THREE.Mesh(new THREE.BufferGeometry(), filter);
        const was = gl.getRenderTarget();
        gl.setRenderTarget(inside._pingPongRenderTarget ?? placeholder);
        const ready = gl.compileAsync(mesh, new THREE.OrthographicCamera()).catch(() => {});
        gl.setRenderTarget(was);
        holdWarmup(scene, ready.then(build));
      } else build();
    } else build();

    return () => {
      live = false;
      if (!target) for (const d of disposables) d.dispose();
      if (scene.environment === target?.texture || scene.environment === placeholder?.texture) {
        scene.environment = before;
      }
      placeholder?.dispose();
      target?.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  return null;
}

const color = (hex: string) => new THREE.Color(hex);
const N = {
  sky: color(NIGHT.sky),
  ground: color(NIGHT.ground),
  key: color(NIGHT.key),
  rim: color(NIGHT.rim),
  fill: color(NIGHT.fill),
};
const D = {
  sky: color(DAY.sky),
  ground: color(DAY.ground),
  key: color(DAY.key),
  rim: color(DAY.rim),
  fill: color(DAY.fill),
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Shared lighting for every Realm 3D scene: a key light from the front right that casts soft
 * shadows, a coloured rim from behind, a fill, a sky/ground hemisphere, and a tiny procedural
 * environment for the clearcoat reflections (no HDR downloads). Cool with a pink rim at night;
 * a low golden sun with warm cloud light from below by day, easing between them with `mix` as the edition changes.
 * (Only colours and strengths change, so no shader recompiles.)
 */
export function Studio({ shadows = true, mix }: { shadows?: boolean; mix?: DayMix }) {
  const hemi = useRef<THREE.HemisphereLight>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const rim = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.DirectionalLight>(null);

  useFrame(() => {
    const m = ease(mix?.current ?? 0);
    if (hemi.current) {
      hemi.current.color.lerpColors(N.sky, D.sky, m);
      hemi.current.groundColor.lerpColors(N.ground, D.ground, m);
      hemi.current.intensity = lerp(NIGHT.hemi, DAY.hemi, m);
    }
    if (key.current) {
      key.current.color.lerpColors(N.key, D.key, m);
      key.current.intensity = lerp(NIGHT.keyI, DAY.keyI, m);
    }
    if (rim.current) {
      rim.current.color.lerpColors(N.rim, D.rim, m);
      rim.current.intensity = lerp(NIGHT.rimI, DAY.rimI, m);
    }
    if (fill.current) {
      fill.current.color.lerpColors(N.fill, D.fill, m);
      fill.current.intensity = lerp(NIGHT.fillI, DAY.fillI, m);
    }
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={[NIGHT.sky, NIGHT.ground, NIGHT.hemi]} />
      <ambientLight intensity={0.18} />
      <directionalLight
        ref={key}
        position={[5, 9, 8]}
        intensity={NIGHT.keyI}
        color={NIGHT.key}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={3}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-camera-near={1}
        shadow-camera-far={40}
      />
      <directionalLight ref={rim} position={[-7, 4, -6]} intensity={NIGHT.rimI} color={NIGHT.rim} />
      <directionalLight
        ref={fill}
        position={[6, 1, -6]}
        intensity={NIGHT.fillI}
        color={NIGHT.fill}
      />
      <StudioEnvironment />
    </>
  );
}
