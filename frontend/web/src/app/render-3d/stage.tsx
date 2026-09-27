"use client";

import { Canvas } from "@react-three/fiber";
import { type ReactNode, Suspense } from "react";
import { HeroCast } from "@/features/landing/three/hero-world";
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
import { Planet } from "@/features/landing/three/universe";

type Item = {
  node: () => ReactNode;
  camera: [number, number, number];
  look: [number, number, number];
  size?: [number, number];
  fov?: number;
};

/**
 * Star-chart planets share one fixed framing (not trimmed on export), so the sphere always spans
 * the same fraction of the image: radius 1 at distance 9.5 with a 32° fov fills 1 / 2.72 of the
 * half-height. star-chart-map.tsx relies on that ratio (PLANET_FRAME).
 */
const planet = (world: "spaces" | "feed" | "profiles" | "boards"): Item => ({
  node: () => <Planet world={world} radius={1} still />,
  camera: [0, 0, 9.5],
  look: [0, 0, 0],
  size: [512, 512],
});

/** The night hero scene without its sky, as its loading poster. */
const heroPoster: Item = {
  node: () => <HeroCast ignite={{ current: 0 }} still />,
  camera: [0, 0.4, 14],
  look: [0, 0, 0],
  size: [1200, 960],
  fov: 36,
};

/** Every renderable asset: one object, framed on a transparent background. */
const ITEMS: Record<string, Item> = {
  heart: {
    node: () => <Heart3D rotation={[0.1, 0.35, 0.1]} />,
    camera: [0, 0, 4],
    look: [0, 0.1, 0],
  },
  bubble: {
    node: () => <Bubble3D rotation={[0.1, -0.35, 0.05]} />,
    camera: [0, 0, 4],
    look: [0, -0.1, 0],
  },
  spark: {
    node: () => <Spark3D rotation={[0.15, 0.4, 0]} />,
    camera: [0, 0, 4.2],
    look: [0, 0, 0],
  },
  lock: {
    node: () => <Lock3D rotation={[0.15, -0.4, 0]} />,
    camera: [0, 0.2, 4.2],
    look: [0, 0.05, 0],
  },
  controller: {
    node: () => <Controller3D rotation={[0.35, -0.4, 0.15]} />,
    camera: [0, 0, 4.4],
    look: [0, -0.1, 0],
  },
  play: { node: () => <Play3D rotation={[0.1, 0.4, 0]} />, camera: [0, 0, 3.6], look: [0, 0, 0] },
  upvote: {
    node: () => <Upvote3D rotation={[0.1, -0.4, 0]} />,
    camera: [0, 0, 3.8],
    look: [0, 0.05, 0],
  },
  "planet-spaces": planet("spaces"),
  "planet-feed": planet("feed"),
  "planet-profiles": planet("profiles"),
  "planet-boards": planet("boards"),
  "hero-poster-night": heroPoster,
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
        shadows="percentage"
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
        camera={{ position: it.camera, fov: it.fov ?? 32 }}
        onCreated={({ camera }) => camera.lookAt(...it.look)}
      >
        <Studio />
        <Suspense fallback={null}>{it.node()}</Suspense>
      </Canvas>
    </div>
  );
}
