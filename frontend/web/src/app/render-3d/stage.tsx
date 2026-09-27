"use client";

import { Canvas } from "@react-three/fiber";
import type { ReactNode } from "react";
import { Astronaut3D } from "@/features/landing/three/astronaut3d";
import {
  Bubble3D,
  Controller3D,
  Heart3D,
  Lock3D,
  Play3D,
  Spark3D,
  Upvote3D,
} from "@/features/landing/three/props3d";
import { Studio } from "@/features/landing/three/studio";
import { C } from "@/features/landing/three/toy";
import { Aurora, Eclipse, Explorers, Orbits, Planet, Sky } from "@/features/landing/three/universe";

type Item = {
  node: ReactNode;
  camera: [number, number, number];
  look: [number, number, number];
  size?: [number, number];
  fov?: number;
};

const astro = (tone: "teal" | "blue" | "violet" | "pink", wave: boolean, turn: number): Item => ({
  node: <Astronaut3D tone={tone} wave={wave} still rotation={[0, turn, 0]} />,
  camera: [0.4, 1.7, 6.6],
  look: [0, 1.3, 0],
});

/**
 * Star-chart planets share one fixed framing (not trimmed on export), so the sphere always spans
 * the same fraction of the image: radius 1 at distance 7.5 with a 32° fov fills 1 / 2.15 of the
 * half-height. star-chart-map.tsx relies on that ratio (PLANET_FRAME).
 */
const planet = (color: string, ring?: string): Item => ({
  node: <Planet color={color} radius={1} ring={ring} />,
  camera: [0, 0, 7.5],
  look: [0, 0, 0],
  size: [512, 512],
});

/** Every renderable asset: one object, framed on a transparent background. */
const ITEMS: Record<string, Item> = {
  "astro-teal": astro("teal", false, 0.25),
  "astro-teal-wave": astro("teal", true, 0.25),
  "astro-blue": astro("blue", false, -0.3),
  "astro-blue-wave": astro("blue", true, -0.3),
  "astro-violet": astro("violet", false, 0.2),
  "astro-violet-wave": astro("violet", true, 0.2),
  "astro-pink": astro("pink", false, -0.25),
  "astro-pink-wave": astro("pink", true, -0.25),
  heart: { node: <Heart3D rotation={[0.1, 0.35, 0.1]} />, camera: [0, 0, 4], look: [0, 0.1, 0] },
  bubble: {
    node: <Bubble3D rotation={[0.1, -0.35, 0.05]} />,
    camera: [0, 0, 4],
    look: [0, -0.1, 0],
  },
  spark: { node: <Spark3D rotation={[0.15, 0.4, 0]} />, camera: [0, 0, 3.6], look: [0, 0, 0] },
  lock: { node: <Lock3D rotation={[0.15, -0.4, 0]} />, camera: [0, 0.2, 4.2], look: [0, 0.05, 0] },
  controller: {
    node: <Controller3D rotation={[0.35, -0.4, 0.15]} />,
    camera: [0, 0, 4.4],
    look: [0, -0.1, 0],
  },
  play: { node: <Play3D rotation={[0.1, 0.4, 0]} />, camera: [0, 0, 3.6], look: [0, 0, 0] },
  upvote: { node: <Upvote3D rotation={[0.1, -0.4, 0]} />, camera: [0, 0, 3.8], look: [0, 0.05, 0] },
  eclipse: { node: <Eclipse />, camera: [0, 0, 11], look: [0, 0, 0] },
  "planet-spaces": planet(C.teal),
  "planet-feed": planet(C.blue, C.lime),
  "planet-profiles": planet(C.violet),
  "planet-boards": planet(C.pink),
  "hero-poster": {
    node: (
      <>
        <Sky still />
        <Aurora still position={[0, 2.4, -9]} rotation={[0.15, 0, 0]} />
        <Eclipse position={[1.2, 0.9, -3]} />
        <Orbits still position={[1.2, 0.9, -3]} rotation={[0.25, 0, -0.12]} />
        <Explorers still />
      </>
    ),
    camera: [0, 0.4, 14],
    look: [0, 0.4, 0],
    size: [1200, 960],
    fov: 36,
  },
};

export function RenderStage({ item }: { item: string }) {
  const it = ITEMS[item];
  if (!it)
    return <p style={{ color: "white" }}>Unknown item. Try: {Object.keys(ITEMS).join(", ")}</p>;
  const [w, h] = it.size ?? [640, 640];
  return (
    <div id="stage" style={{ width: w, height: h }}>
      <Canvas
        dpr={1}
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
        camera={{ position: it.camera, fov: it.fov ?? 32 }}
        onCreated={({ camera }) => camera.lookAt(...it.look)}
      >
        <Studio />
        {it.node}
      </Canvas>
    </div>
  );
}
