"use client";

import { ArrowFatUp } from "@phosphor-icons/react";
import { PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { type ReactNode, type RefObject, Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { cx } from "@/lib/cx";
import { useEdition } from "@/lib/edition";
import { BlackHole, HOLE_RADIUS } from "./black-hole";
import type { LayoutRef } from "./layout";
import { SkyBackdrop } from "./sky";
import { Studio } from "./studio";
import { SUN_RADIUS, Sun } from "./sun";
import { ease, lerp, type Pulse, useIgnite } from "./theme";
import styles from "./three.module.css";
import { Explorers, Orbits, PLANETS } from "./universe";

type Anchors = RefObject<(THREE.Object3D | null)[]>;
type Targets = RefObject<(HTMLElement | null)[]>;

const SUN_AT = new THREE.Vector3(1.2, 0.9, -3);

/** Sways the universe toward the pointer, with a slow idle drift. */
function Rig({ children, still }: { children: ReactNode; still: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (!ref.current || still) return;
    const t = state.clock.elapsedTime;
    const k = Math.min(1, delta * 2.2);
    ref.current.rotation.y +=
      (state.pointer.x * 0.16 + Math.sin(t * 0.2) * 0.04 - ref.current.rotation.y) * k;
    ref.current.rotation.x += (-state.pointer.y * 0.07 - ref.current.rotation.x) * k;
  });
  return <group ref={ref}>{children}</group>;
}

const CAM_NEAR = new THREE.Vector3(SUN_AT.x, SUN_AT.y, 6.2);
const CAM_FAR = new THREE.Vector3(0, 0.4, 14);
const LOOK_FAR = new THREE.Vector3(0, 0, 0);

/**
 * The camera. The canvas fills the whole hero; a view offset frames the 3D world inside the scene
 * box (the right column on desktop, below the copy on phones), so the sky carries on behind the
 * headline. During the scroll intro (`intro` 0 → 1) it starts close on the black hole, centred in
 * the whole view, and pulls back through space into that framing.
 */
function Camera({ layout, intro }: { layout: LayoutRef; intro: RefObject<number> }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const eased = useRef(intro.current ?? 1);
  const look = useRef(new THREE.Vector3());
  const near = useRef(CAM_NEAR.clone());
  useFrame((_, delta) => {
    const { box: b, cw, ch } = layout.current;
    if (b.w < 10 || b.h < 10) return;
    eased.current += ((intro.current ?? 1) - eased.current) * Math.min(1, delta * 5);
    const t = ease(eased.current / 0.72);
    // Near the start the hole sits a little above centre, so the title card has room below it.
    const x = lerp(0, b.x, t);
    const y = lerp(-ch * 0.1, b.y, t);
    const w = lerp(cw, b.w, t);
    const h = lerp(ch, b.h, t);
    camera.aspect = w / h;
    camera.setViewOffset(w, h, -x, -y, cw, ch);
    // Narrow screens start further back, or the hole alone would fill a phone.
    near.current.z = lerp(9.6, CAM_NEAR.z, THREE.MathUtils.clamp((cw / ch - 0.45) / 0.8, 0, 1));
    camera.position.lerpVectors(near.current, CAM_FAR, t);
    look.current.lerpVectors(SUN_AT, LOOK_FAR, t);
    camera.lookAt(look.current);
    camera.updateProjectionMatrix();
  });
  return null;
}

type Occluder = { object: RefObject<THREE.Object3D | null>; radius: number };

/**
 * Projects 3D anchors to the screen every frame and moves the matching DOM labels, keeping them
 * inside the scene's box. A label fades out while its anchor is behind one of the `occluders`
 * (a planet passing behind the black hole shouldn't keep its name tag floating in front).
 *
 * It only writes to the DOM: label sizes are read when the layout changes, not every frame, and
 * styles are only touched when they change, so the browser never has to redo layout mid-frame.
 */
function Track({
  anchors,
  targets,
  layout,
  occluders = [],
}: {
  anchors: Anchors;
  targets: Targets;
  layout: LayoutRef;
  occluders?: Occluder[];
}) {
  const v = useRef(new THREE.Vector3());
  const dir = useRef(new THREE.Vector3());
  const ray = useRef(new THREE.Ray());
  const sphere = useRef(new THREE.Sphere());
  const hit = useRef(new THREE.Vector3());
  const sizes = useRef<{ w: number; h: number }[]>([]);
  const seen = useRef(-1);
  const written = useRef<string[]>([]);
  const placed = useRef<
    { i: number; x: number; y: number; w: number; h: number; hidden: boolean }[]
  >([]);
  useFrame(({ camera, size }) => {
    const L = layout.current;
    if (L.version !== seen.current) {
      seen.current = L.version;
      sizes.current = (targets.current ?? []).map((el) => ({
        w: el?.offsetWidth ?? 0,
        h: el?.offsetHeight ?? 0,
      }));
    }
    const b = L.box.w > 0 ? L.box : { x: 0, y: 0, w: size.width, h: size.height };
    // Where each label wants to be (its anchor, kept inside the box), then nudged apart so two
    // labels never sit on top of each other.
    const spots = placed.current;
    spots.length = 0;
    anchors.current?.forEach((a, i) => {
      const box = sizes.current[i];
      if (!a || !targets.current?.[i] || !box) return;
      a.getWorldPosition(v.current);
      const far = camera.position.distanceTo(v.current);
      ray.current.set(
        camera.position,
        dir.current.subVectors(v.current, camera.position).normalize(),
      );
      let hidden = occluders.some(({ object, radius }) => {
        if (!object.current) return false;
        object.current.getWorldPosition(sphere.current.center);
        sphere.current.radius = radius;
        const p = ray.current.intersectSphere(sphere.current, hit.current);
        return Boolean(p && camera.position.distanceTo(p) < far);
      });
      v.current.project(camera);
      hidden ||= v.current.z > 1;
      const half = box.w / 2 + 6;
      const px = (v.current.x * 0.5 + 0.5) * size.width;
      const py = (-v.current.y * 0.5 + 0.5) * size.height;
      spots.push({
        i,
        x: Math.min(Math.max(px, b.x + half), b.x + b.w - half),
        y: Math.max(py, b.y + box.h + 6),
        w: box.w,
        h: box.h,
        hidden,
      });
    });
    const shown = spots.filter((s) => !s.hidden).sort((p, q) => p.y - q.y);
    for (let k = 1; k < shown.length; k++) {
      const s = shown[k];
      if (!s) continue;
      for (let j = 0; j < k; j++) {
        const o = shown[j];
        if (!o) continue;
        const overlapX = (s.w + o.w) / 2 + 4 - Math.abs(s.x - o.x);
        const overlapY = s.h + 4 - Math.abs(s.y - o.y);
        if (overlapX > 0 && overlapY > 0) s.y = o.y + s.h + 4;
      }
    }
    for (const s of spots) {
      const el = targets.current?.[s.i];
      if (!el) continue;
      const transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -100%)`;
      const key = `${transform}|${s.hidden}`;
      if (written.current[s.i] === key) continue;
      written.current[s.i] = key;
      el.style.transform = transform;
      el.style.opacity = s.hidden ? "0" : "1";
    }
  });
  return null;
}

const BUBBLES = [
  { text: "who's on tonight?", tone: "teal", delay: 0.2 },
  { text: "new clip dropped", tone: "blue", delay: 1.6 },
  { text: "love the new pfp", tone: "violet", delay: 3 },
  { text: "128 upvotes", tone: "pink", delay: 4.4, upvote: true },
] as const;

/**
 * Everything in the hero that isn't sky: the centrepiece (the black hole at night, the sun by day,
 * in the same place), the four worlds in orbit with their moons and an asteroid belt, and the
 * explorer crew. Both centrepieces stay mounted (only one is shown), and the sun's light is always
 * there (dark at night), so switching edition never changes a shader. Shared with the render
 * stage, so the posters match.
 */
export function HeroCast({
  ignite,
  still,
  day = false,
  hole,
  planetAnchors,
  crewAnchors,
}: {
  ignite: Pulse;
  still: boolean;
  day?: boolean;
  hole?: RefObject<THREE.Object3D | null>;
  planetAnchors?: Anchors;
  crewAnchors?: Anchors;
}) {
  return (
    <>
      <object3D ref={hole} position={SUN_AT.toArray()} />
      <BlackHole ignite={ignite} still={still} position={SUN_AT.toArray()} visible={!day} />
      <Sun swell={ignite} still={still} position={SUN_AT.toArray()} visible={day} />
      <pointLight
        position={SUN_AT.toArray()}
        color="#ffd9a8"
        intensity={day ? 70 : 0}
        distance={40}
        decay={1.4}
      />
      <Orbits
        still={still}
        position={SUN_AT.toArray()}
        rotation={[0.25, 0, -0.12]}
        anchors={planetAnchors}
      />
      <Suspense fallback={null}>
        <Explorers still={still} anchors={crewAnchors} />
      </Suspense>
    </>
  );
}

/** Compiles the scene's shaders in the background (no frozen page), then says it's ready. */
function Warmup({ onWarm }: { onWarm: () => void }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    let live = true;
    gl.compileAsync(scene, camera)
      .catch(() => {})
      .then(() => {
        if (live) onWarm();
      });
    return () => {
      live = false;
    };
  }, [gl, scene, camera, onWarm]);
  return null;
}

function World({
  still,
  day,
  warm,
  layout,
  intro,
  planetAnchors,
  crewAnchors,
  planetLabels,
  crewBubbles,
}: {
  still: boolean;
  day: boolean;
  warm: boolean;
  layout: LayoutRef;
  intro: RefObject<number>;
  planetAnchors: Anchors;
  crewAnchors: Anchors;
  planetLabels: Targets;
  crewBubbles: Targets;
}) {
  const ignite = useIgnite();
  const hole = useRef<THREE.Object3D>(null);
  const invalidate = useThree((s) => s.invalidate);

  // With motion stilled the canvas only draws on demand; the scroll intro still moves the camera.
  useEffect(() => {
    if (!still) return;
    const onScroll = () => invalidate();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [still, invalidate]);
  useEffect(() => {
    if (warm) invalidate();
  }, [warm, invalidate]);

  return (
    <>
      <Camera layout={layout} intro={intro} />
      <SkyBackdrop
        ignite={ignite}
        still={still}
        day={day}
        hole={hole}
        layout={layout}
        scroll={intro}
      />
      <Studio day={day} />
      <Rig still={still}>
        <HeroCast
          ignite={ignite}
          still={still}
          day={day}
          hole={hole}
          planetAnchors={planetAnchors}
          crewAnchors={crewAnchors}
        />
      </Rig>
      <Track
        anchors={planetAnchors}
        targets={planetLabels}
        layout={layout}
        occluders={[{ object: hole, radius: day ? SUN_RADIUS : HOLE_RADIUS }]}
      />
      <Track anchors={crewAnchors} targets={crewBubbles} layout={layout} />
    </>
  );
}

/**
 * The live 3D hero, filling the whole hero stage: at night the sky (aurora, stars, the cosmic
 * river) and the black hole; by day a clear canvas over the day film, with the sun. Four worlds
 * and the explorer crew in both. Shaders compile in the background before the
 * first frame. Rendering pauses off screen, in a hidden tab, or while the day edition is showing;
 * reduced motion / Pause motion renders single frames. On a GPU that can't keep up, the canvas
 * drops to a lower pixel ratio rather than stutter.
 *
 * Shadows are asked for as PCF by name: three r186 dropped "soft" shadow maps and switches the type
 * on the first frame, which made every shader compiled in the background compile again, blocking.
 */
export default function HeroWorld({
  stage,
  layout,
  intro,
  onReady,
}: {
  stage: RefObject<HTMLElement | null>;
  layout: LayoutRef;
  intro: RefObject<number>;
  onReady?: () => void;
}) {
  const [visible, setVisible] = useState(true);
  const [still, setStill] = useState(false);
  const [warm, setWarm] = useState(false);
  const [dpr, setDpr] = useState(1.5);
  const day = useEdition() === "day";
  const planetAnchors = useRef<(THREE.Object3D | null)[]>([]);
  const crewAnchors = useRef<(THREE.Object3D | null)[]>([]);
  const planetLabels = useRef<(HTMLElement | null)[]>([]);
  const crewBubbles = useRef<(HTMLElement | null)[]>([]);
  const onWarm = useRef(() => setWarm(true)).current;

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    // Also reports hidden while the stage is display: none (the day edition).
    const io = new IntersectionObserver(([e]) => setVisible(Boolean(e?.isIntersecting)), {
      rootMargin: "100px",
    });
    io.observe(el);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () =>
      setStill(reduce.matches || document.documentElement.dataset.motion === "paused");
    sync();
    reduce.addEventListener("change", sync);
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
    return () => {
      io.disconnect();
      reduce.removeEventListener("change", sync);
      mo.disconnect();
    };
  }, [stage]);

  // Reveal once the first compiled frame is on screen.
  useEffect(() => {
    if (!warm) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => onReady?.());
    });
    return () => cancelAnimationFrame(frame);
  }, [warm, onReady]);

  return (
    <>
      <Canvas
        className="!absolute inset-0"
        shadows="percentage"
        dpr={[1, dpr]}
        camera={{ position: [0, 0.4, 14], fov: 36, manual: true }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        eventSource={stage as RefObject<HTMLElement>}
        eventPrefix="client"
        frameloop={!warm || !visible ? "never" : still ? "demand" : "always"}
      >
        <PerformanceMonitor
          flipflops={3}
          onDecline={() => setDpr(1)}
          onIncline={() => setDpr(1.5)}
          onFallback={() => setDpr(1)}
        />
        <Warmup onWarm={onWarm} />
        <World
          still={still}
          day={day}
          warm={warm}
          layout={layout}
          intro={intro}
          planetAnchors={planetAnchors}
          crewAnchors={crewAnchors}
          planetLabels={planetLabels}
          crewBubbles={crewBubbles}
        />
      </Canvas>
      <div
        className={cx(styles.tags, "pointer-events-none absolute inset-0 overflow-hidden")}
        aria-hidden="true"
      >
        {PLANETS.map((p, i) => (
          <span
            key={p.id}
            ref={(el) => {
              planetLabels.current[i] = el;
            }}
            className={cx(
              styles.planetLabel,
              styles[p.id],
              "absolute top-0 left-0 will-change-transform",
            )}
          >
            {p.label}
          </span>
        ))}
        {BUBBLES.map((b, i) => (
          <div
            key={b.text}
            ref={(el) => {
              crewBubbles.current[i] = el;
            }}
            className="absolute top-0 left-0 will-change-transform"
          >
            <div
              className={cx(styles.say, styles[b.tone])}
              style={{ animationDelay: `${b.delay}s` }}
            >
              {"upvote" in b && (
                <ArrowFatUp size={13} weight="fill" className="mr-1.5 inline-block align-[-1px]" />
              )}
              {b.text}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
