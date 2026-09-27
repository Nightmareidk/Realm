"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { type ReactNode, type RefObject, useRef } from "react";
import type * as THREE from "three";
import { Astronaut3D, type AstronautTone } from "@/features/landing/three/astronaut3d";
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
  node: (elbow: RefObject<THREE.Object3D | null>) => ReactNode;
  camera: [number, number, number];
  look: [number, number, number];
  size?: [number, number];
  fov?: number;
  day?: boolean;
};

const TURN: Record<AstronautTone, number> = { teal: 0.25, blue: -0.3, violet: 0.2, pink: -0.25 };

/**
 * Explorers. `rest` is the standing pose; `body` and `forearm` are the two layers of the waving
 * pose (the page rotates the forearm about the elbow, which this stage reports as the pivot).
 */
const astro = (tone: AstronautTone, part: "rest" | "body" | "forearm"): Item => ({
  node: (elbow) => (
    <Astronaut3D
      tone={tone}
      wave={part !== "rest"}
      part={part === "rest" ? "all" : part}
      elbow={elbow}
      still
      rotation={[0, TURN[tone], 0]}
    />
  ),
  camera: [0.4, 1.7, 6.6],
  look: [0, 1.3, 0],
});

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

/** The hero scene without its sky, as the loading poster for one edition. */
const poster = (day: boolean): Item => ({
  node: () => <HeroCast mix={{ current: day ? 1 : 0 }} still />,
  camera: [0, 0.4, 14],
  look: [0, 0, 0],
  size: [1200, 960],
  fov: 36,
  day,
});

const TONES: AstronautTone[] = ["teal", "blue", "violet", "pink"];

/** Every renderable asset: one object, framed on a transparent background. */
const ITEMS: Record<string, Item> = {
  ...Object.fromEntries(
    TONES.flatMap((t) => [
      [`astro-${t}`, astro(t, "rest")],
      [`astro-${t}-body`, astro(t, "body")],
      [`astro-${t}-forearm`, astro(t, "forearm")],
    ]),
  ),
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
  "hero-poster-night": poster(false),
  "hero-poster-day": poster(true),
};

declare global {
  interface Window {
    __pivot?: { x: number; y: number };
  }
}

/** Reports where the elbow lands on screen, in canvas pixels, for the render script. */
function PivotProbe({ elbow }: { elbow: RefObject<THREE.Object3D | null> }) {
  useFrame(({ camera, size }) => {
    const o = elbow.current;
    if (!o) return;
    const v = o.getWorldPosition(o.position.clone().set(0, 0, 0)).project(camera);
    window.__pivot = { x: (v.x * 0.5 + 0.5) * size.width, y: (-v.y * 0.5 + 0.5) * size.height };
  });
  return null;
}

export function RenderStage({ item }: { item: string }) {
  const it = ITEMS[item];
  const elbow = useRef<THREE.Object3D>(null);
  if (!it)
    return <p style={{ color: "white" }}>Unknown item. Try: {Object.keys(ITEMS).join(", ")}</p>;
  const [w, h] = it.size ?? [640, 640];
  return (
    <div id="stage" style={{ width: w, height: h }}>
      <Canvas
        dpr={1}
        shadows="soft"
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
        camera={{ position: it.camera, fov: it.fov ?? 32 }}
        onCreated={({ camera }) => camera.lookAt(...it.look)}
      >
        <Studio mix={{ current: it.day ? 1 : 0 }} />
        {it.node(elbow)}
        <PivotProbe elbow={elbow} />
      </Canvas>
    </div>
  );
}
