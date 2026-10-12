"use client";

import { Environment, Lightformer, PerformanceMonitor, useTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { THEME_EVENT, THEMES, type ThemeId } from "../themes";
import { PHONE, PhoneModel } from "./phone-model";

export const SCREENS = ["chat", "clips", "profile", "lobby", "boards"] as const;
export type ScreenId = (typeof SCREENS)[number];

/**
 * The tour's steps, in scroll order. Step 0 is the hero (three phones fanned); from step 1 the
 * centre phone carries the story and turns half a turn per step, through its edge, so the next
 * screen comes round on its front. The last step ends by flying into the camera, handing off to
 * the profile canvas.
 */
export const STEPS: ScreenId[] = ["chat", "chat", "clips", "lobby", "boards", "profile"];

/** Story beside the phone (rather than above it): matches the tour's CSS. */
export const WIDE = "(width >= 48rem) and (aspect-ratio > 1)";

const damp = THREE.MathUtils.damp;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (t: number) => t * t * (3 - 2 * t);

type Pose = { x: number; y: number; z: number; rx: number; ry: number; rz: number; s: number };

/**
 * Measured by the tour, as fractions of the stage's height: where the hero's headline ends, and
 * the lowest point any step's story reaches.
 */
export type HeroLayout = { top: number; copy: number };

function Phones({
  progress,
  layout,
  wide,
}: {
  progress: RefObject<number>;
  layout: RefObject<HeroLayout>;
  wide: boolean;
}) {
  const tex = useTexture(SCREENS.map((s) => `/home/screens/${s}.webp`));
  const gl = useThree((s) => s.gl);
  const textures = useMemo(() => {
    const max = gl.capabilities.getMaxAnisotropy();
    const map = {} as Record<ScreenId, THREE.Texture>;
    SCREENS.forEach((id, i) => {
      const t = tex[i] as THREE.Texture;
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(8, max);
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.needsUpdate = true;
      map[id] = t;
    });
    return map;
  }, [tex, gl]);

  const center = useRef<THREE.Group>(null);
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const centerScreen = useRef<ScreenId>("chat");
  // The centre phone's turn, counted in half turns: it only ever shows its front.
  const spin = useRef(0);
  const [, force] = useState(0);
  const pointer = useRef({ x: 0, y: 0 });
  const published = useRef("");
  const restSpot = useRef("");

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / innerHeight) * 2 - 1;
    };
    addEventListener("pointermove", onMove, { passive: true });
    return () => removeEventListener("pointermove", onMove);
  }, []);

  useFrame((state, dt) => {
    const p = progress.current ?? 0;
    const n = STEPS.length;
    // Where we are: step index and how far through it.
    const f = p * n;
    const step = Math.min(n - 1, Math.floor(f));
    const t = clamp01(f - step);
    const time = state.clock.elapsedTime;
    const px = pointer.current.x;
    const py = pointer.current.y;

    // Everything is placed in screen terms (the visible width and height at the phones' depth), so
    // the composition holds at any window size.
    const vw = state.viewport.width;
    const vh = state.viewport.height;
    // Hero: three big phones standing just under the headline and running off the bottom edge.
    const top = layout.current?.top ?? 0.45;
    const heroS = Math.min((vh * 0.84) / PHONE.h, (vw * (wide ? 0.2 : 0.46)) / PHONE.w);
    const heroY = vh / 2 - (top + 0.035) * vh - (PHONE.h * heroS) / 2;
    // Tour: beside the story on wide screens, under it on narrow ones.
    const below = 1 - (layout.current?.copy ?? 0.4) - 0.09;
    const restS = wide
      ? Math.min((vh * 0.64) / PHONE.h, (vw * 0.26) / PHONE.w)
      : Math.min((vh * Math.min(0.56, Math.max(0.36, below))) / PHONE.h, (vw * 0.5) / PHONE.w);
    const restX = wide ? vw * 0.2 : 0;
    const restY = wide ? -vh * 0.01 : -vh / 2 + (PHONE.h * restS) / 2 + vh * 0.05;

    // Tell the page where the hero's centre phone stands, in CSS pixels (the loader's outline
    // grows onto it).
    const unit = state.size.height / vh;
    // And where the tour's phone rests (wide screens), so the moments can float beside it.
    const near = 6 / (6 - 0.35);
    const mid = state.size.width / 2 + restX * unit * near;
    const halfW = ((PHONE.w * restS) / 2) * unit * near;
    const rest = `${Math.round(mid - halfW)},${Math.round(mid + halfW)}`;
    if (rest !== restSpot.current) {
      restSpot.current = rest;
      const [l, r] = rest.split(",");
      document.documentElement.style.setProperty("--tour-phone-l", `${l}px`);
      document.documentElement.style.setProperty("--tour-phone-r", `${r}px`);
    }
    const spot = [
      state.size.width / 2,
      state.size.height / 2 - heroY * unit,
      PHONE.h * heroS * unit,
    ]
      .map(Math.round)
      .join(",");
    if (spot !== published.current) {
      published.current = spot;
      const [sx, sy, sh] = spot.split(",");
      const root = document.documentElement.style;
      root.setProperty("--hero-phone-x", `${sx}px`);
      root.setProperty("--hero-phone-y", `${sy}px`);
      root.setProperty("--hero-phone-h", `${sh}px`);
    }

    const show = (id: ScreenId) => {
      if (centerScreen.current === id) return;
      centerScreen.current = id;
      force((x) => x + 1);
    };

    // ── Centre phone ──
    let c: Pose;
    if (step === 0) {
      // Hero → stepping forward into place beside (or under) the story.
      const k = smooth(clamp01((t - 0.3) / 0.7));
      c = {
        x: THREE.MathUtils.lerp(0, restX, k),
        y: THREE.MathUtils.lerp(heroY, restY, k),
        z: THREE.MathUtils.lerp(0, 0.35, k),
        rx: THREE.MathUtils.lerp(0.05, 0, k),
        ry: THREE.MathUtils.lerp(0, -0.22, k),
        rz: 0,
        s: THREE.MathUtils.lerp(heroS, restS, k),
      };
    } else {
      // From step 2 on, half a turn through the middle of each step brings the next screen.
      const turn = step >= 2 ? smooth(clamp01((t - 0.12) / 0.5)) : 0;
      const last = step === n - 1;
      const fly = last ? smooth(clamp01((t - 0.74) / 0.26)) : 0;
      c = {
        x: THREE.MathUtils.lerp(restX, 0, fly),
        y: THREE.MathUtils.lerp(restY, 0, fly),
        z: 0.35 + fly * 4.6,
        rx: 0,
        // Turns add up: each step's turn starts where the last one ended.
        ry: -0.22 + (Math.max(0, step - 2) + turn) * Math.PI + fly * 0.22,
        rz: 0,
        s: restS,
      };
    }
    // Idle life: a slow float and a lean toward the pointer (decorative, so springy).
    const still = document.documentElement.dataset.motion === "paused";
    const bob = still ? 0 : Math.sin(time * 0.9) * 0.025;
    const g = center.current;
    if (g) {
      // The phone turns through its edge and never shows its back: once it passes edge-on, it
      // carries on from the other edge with its front, and the next screen, toward you. A jump
      // (the scrollbar, a key, a link) skips the half turns it would otherwise race through.
      const behind = c.ry - spin.current;
      if (Math.abs(behind) > Math.PI) spin.current += Math.trunc(behind / Math.PI) * Math.PI;
      spin.current = damp(spin.current, c.ry, 6, dt);
      const half = Math.round(spin.current / Math.PI);
      show(STEPS[Math.min(n - 1, Math.max(0, half) + 1)] ?? "chat");
      g.rotation.y = spin.current - half * Math.PI + px * 0.12;
      g.position.x = damp(g.position.x, c.x, 6, dt);
      g.position.y = damp(g.position.y, c.y + bob, 6, dt);
      g.position.z = damp(g.position.z, c.z, 6, dt);
      g.rotation.x = damp(g.rotation.x, c.rx + py * 0.06, 6, dt);
      g.rotation.z = damp(g.rotation.z, c.rz, 6, dt);
      g.scale.setScalar(damp(g.scale.x, c.s, 6, dt));
    }

    // ── Side phones: fanned in the hero, then they slide away and sink ──
    const out = step === 0 ? smooth(clamp01(t / 0.6)) : 1;
    const sides: [RefObject<THREE.Group | null>, number][] = [
      [left, -1],
      [right, 1],
    ];
    for (const [ref, side] of sides) {
      const s = ref.current;
      if (!s) continue;
      const tx = side * PHONE.w * heroS * 1.12 + side * out * vw * 0.55;
      const ty = heroY - vh * 0.035 - out * vh * 0.3;
      s.position.x = damp(s.position.x, tx, 5, dt);
      s.position.y = damp(
        s.position.y,
        ty + (still ? 0 : Math.sin(time * 0.8 + side) * 0.02),
        5,
        dt,
      );
      s.position.z = damp(s.position.z, -0.4 - out * 0.8, 5, dt);
      s.rotation.y = damp(s.rotation.y, -side * 0.38 + px * 0.08 + side * out * 0.6, 5, dt);
      s.rotation.z = damp(s.rotation.z, -side * 0.1, 5, dt);
      s.rotation.x = damp(s.rotation.x, 0.05 + py * 0.04, 5, dt);
      s.scale.setScalar(damp(s.scale.x, heroS * 0.94, 5, dt));
    }
  });

  return (
    <>
      {/* They start below the frame and rise into place as the page opens. */}
      <PhoneModel ref={left} screen={textures.clips} position={[-1.2, -4, -0.4]} />
      <PhoneModel ref={right} screen={textures.profile} position={[1.2, -4.4, -0.4]} />
      <PhoneModel ref={center} screen={textures[centerScreen.current]} position={[0, -3.6, 0]} />
    </>
  );
}

/**
 * A soft rim light in the theme's colour, behind the phones. It dims as the phone flies at the
 * camera, where it would otherwise streak down the rim.
 */
function ThemeLight({ progress }: { progress: RefObject<number> }) {
  const light = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const f = (progress.current ?? 0) * STEPS.length - (STEPS.length - 1);
    if (light.current) light.current.intensity = 14 * (1 - smooth(clamp01((f - 0.7) / 0.2)));
  });
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const on = (e: Event) => {
      const id = (e as CustomEvent<ThemeId>).detail;
      light.current?.color.set(THEMES[id].acc);
      invalidate();
    };
    addEventListener(THEME_EVENT, on);
    return () => removeEventListener(THEME_EVENT, on);
  }, [invalidate]);
  return (
    <pointLight
      ref={light}
      position={[0.6, 0.4, -2.2]}
      intensity={14}
      distance={7}
      color={THEMES.mint.acc}
    />
  );
}

/**
 * The tour's 3D stage. Renders only while the tour is on screen; still (single frames on scroll)
 * under reduced motion and Pause motion. Starts at a pixel ratio of 1 and sharpens if the GPU
 * keeps up.
 */
export default function TourScene({
  progress,
  layout,
  visible,
  onReady,
}: {
  progress: RefObject<number>;
  layout: RefObject<HeroLayout>;
  visible: boolean;
  onReady?: () => void;
}) {
  const [dpr, setDpr] = useState(1);
  const [wide, setWide] = useState(true);
  const [still, setStill] = useState(false);
  useEffect(() => {
    const mq = matchMedia(WIDE);
    const rm = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setWide(mq.matches);
      setStill(rm.matches || document.documentElement.dataset.motion === "paused");
    };
    sync();
    mq.addEventListener("change", sync);
    rm.addEventListener("change", sync);
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
    return () => {
      mq.removeEventListener("change", sync);
      rm.removeEventListener("change", sync);
      mo.disconnect();
    };
  }, []);

  return (
    <Canvas
      className="!absolute inset-0"
      dpr={[1, dpr]}
      camera={{ position: [0, 0, 6], fov: 30 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      frameloop={!visible ? "never" : still ? "demand" : "always"}
      onCreated={() => requestAnimationFrame(() => requestAnimationFrame(() => onReady?.()))}
    >
      <PerformanceMonitor
        flipflops={3}
        onDecline={() => setDpr(1)}
        onIncline={() => setDpr(1.5)}
        onFallback={() => setDpr(1)}
      />
      <ambientLight intensity={0.35} />
      <directionalLight position={[2.5, 3, 4]} intensity={1.6} />
      <ThemeLight progress={progress} />
      {/* A studio made of soft light panels: no HDR file to download. */}
      <Environment resolution={128} frames={1}>
        <Lightformer intensity={2.4} position={[0, 3, 2]} scale={[6, 1.2, 1]} />
        <Lightformer
          intensity={1.2}
          position={[-4, 0.5, 1]}
          rotation-y={Math.PI / 2}
          scale={[4, 2, 1]}
        />
        <Lightformer
          intensity={1.2}
          position={[4, -0.5, 1]}
          rotation-y={-Math.PI / 2}
          scale={[4, 2, 1]}
        />
        <Lightformer intensity={0.6} color="#3ee6b0" position={[0, -3, -2]} scale={[6, 2, 1]} />
      </Environment>
      <Phones progress={progress} layout={layout} wide={wide} />
      {still && <InvalidateOnScroll />}
    </Canvas>
  );
}

function InvalidateOnScroll() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const on = () => invalidate();
    addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  }, [invalidate]);
  return null;
}
