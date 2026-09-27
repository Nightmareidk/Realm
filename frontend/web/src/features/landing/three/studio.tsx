"use client";

import { Environment, Lightformer } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { type DayMix, ease } from "./theme";

const night = {
  sky: new THREE.Color("#c9d6ff"),
  ground: new THREE.Color("#241a6b"),
  hemi: 1.05,
  key: new THREE.Color("#f4f0ff"),
  keyI: 2.3,
  rim: new THREE.Color("#ff8ad0"),
  rimI: 1.5,
  fill: new THREE.Color("#7fe3ff"),
  fillI: 0.9,
};
const day = {
  sky: new THREE.Color("#dcefff"),
  ground: new THREE.Color("#ffd9b0"),
  hemi: 1.35,
  key: new THREE.Color("#fff1dc"),
  keyI: 2.8,
  rim: new THREE.Color("#ffb45c"),
  rimI: 2.4,
  fill: new THREE.Color("#9fd2ff"),
  fillI: 0.8,
};

/**
 * Shared lighting for every Realm 3D scene: a key light from the front right that casts soft
 * shadows, a coloured rim from behind, a cool fill, a sky/ground hemisphere, and a tiny
 * procedural environment for the clearcoat reflections (no HDR downloads). With `mix`, it
 * eases between the night look (cool key, pink rim) and daylight (warm key, sunlit rim).
 */
export function Studio({ mix, shadows = true }: { mix?: DayMix; shadows?: boolean }) {
  const hemi = useRef<THREE.HemisphereLight>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const rim = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.DirectionalLight>(null);

  useFrame(() => {
    const m = ease(mix?.current ?? 0);
    if (hemi.current) {
      hemi.current.color.lerpColors(night.sky, day.sky, m);
      hemi.current.groundColor.lerpColors(night.ground, day.ground, m);
      hemi.current.intensity = night.hemi + (day.hemi - night.hemi) * m;
    }
    if (key.current) {
      key.current.color.lerpColors(night.key, day.key, m);
      key.current.intensity = night.keyI + (day.keyI - night.keyI) * m;
    }
    if (rim.current) {
      rim.current.color.lerpColors(night.rim, day.rim, m);
      rim.current.intensity = night.rimI + (day.rimI - night.rimI) * m;
    }
    if (fill.current) {
      fill.current.color.lerpColors(night.fill, day.fill, m);
      fill.current.intensity = night.fillI + (day.fillI - night.fillI) * m;
    }
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={[night.sky, night.ground, night.hemi]} />
      <ambientLight intensity={0.18} />
      <directionalLight
        ref={key}
        position={[5, 9, 8]}
        intensity={night.keyI}
        color={night.key}
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
      <directionalLight ref={rim} position={[-7, 4, -6]} intensity={night.rimI} color={night.rim} />
      <directionalLight
        ref={fill}
        position={[6, 1, -6]}
        intensity={night.fillI}
        color={night.fill}
      />
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
          intensity={1.3}
          color="#b8a4ff"
          position={[-6, 2, 2]}
          scale={[4, 6, 1]}
        />
        <Lightformer form="ring" intensity={1.2} color="#ff8ad0" position={[6, 3, -3]} scale={3} />
        <Lightformer
          form="rect"
          intensity={0.9}
          color="#7fe3ff"
          position={[4, -3, 4]}
          scale={[6, 2, 1]}
        />
      </Environment>
    </>
  );
}
