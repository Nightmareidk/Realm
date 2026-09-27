"use client";

import { ArrowFatUp } from "@phosphor-icons/react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { cx } from "@/lib/cx";
import { SkyBackdrop } from "./sky";
import { Studio } from "./studio";
import { Eclipse, MOON_RADIUS, SUN_RADIUS } from "./sun";
import { type DayMix, ease, lerp, useDayMix, useIsDay } from "./theme";
import styles from "./three.module.css";
import { Explorers, Orbits, PLANETS } from "./universe";

type Anchors = RefObject<(THREE.Object3D | null)[]>;
type Targets = RefObject<(HTMLElement | null)[]>;
type El = RefObject<HTMLElement | null>;

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

/** Box of `el` in canvas pixels. */
function boxIn(canvas: HTMLCanvasElement, el: HTMLElement) {
  const c = canvas.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return {
    x: r.left - c.left,
    y: r.top - c.top,
    w: r.width,
    h: r.height,
    cw: c.width,
    ch: c.height,
  };
}

const CAM_NEAR = new THREE.Vector3(SUN_AT.x, SUN_AT.y, 6.2);
const CAM_FAR = new THREE.Vector3(0, 0.4, 14);
const LOOK_FAR = new THREE.Vector3(0, 0, 0);

/**
 * The camera. The canvas fills the whole hero; a view offset frames the 3D world inside `box`
 * (the right column on desktop, below the copy on phones), so the sky carries on behind the
 * headline. During the scroll intro (`intro` 0 → 1) it starts close on the eclipse, centred in
 * the whole view, and pulls back through space into that framing.
 */
function Camera({ box, intro }: { box: El; intro: RefObject<number> }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const eased = useRef(intro.current ?? 1);
  const look = useRef(new THREE.Vector3());
  const near = useRef(CAM_NEAR.clone());
  useFrame((_, delta) => {
    const el = box.current;
    if (!el) return;
    eased.current += ((intro.current ?? 1) - eased.current) * Math.min(1, delta * 5);
    const t = ease(eased.current / 0.72);
    const b = boxIn(gl.domElement, el);
    if (b.w < 10 || b.h < 10) return;
    // Near the start the sun sits a little above centre, so the title card has room below it.
    const x = lerp(0, b.x, t);
    const y = lerp(-b.ch * 0.1, b.y, t);
    const w = lerp(b.cw, b.w, t);
    const h = lerp(b.ch, b.h, t);
    camera.aspect = w / h;
    camera.setViewOffset(w, h, -x, -y, b.cw, b.ch);
    // Narrow screens start further back, or the moon alone would fill a phone.
    const aspect = b.cw / b.ch;
    near.current.z = lerp(9.6, CAM_NEAR.z, THREE.MathUtils.clamp((aspect - 0.45) / 0.8, 0, 1));
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
 * (a planet passing behind the moon or the sun shouldn't keep its name tag floating in front).
 */
function Track({
  anchors,
  targets,
  box,
  occluders = [],
}: {
  anchors: Anchors;
  targets: Targets;
  box: El;
  occluders?: Occluder[];
}) {
  const v = useRef(new THREE.Vector3());
  const ray = useRef(new THREE.Ray());
  const sphere = useRef(new THREE.Sphere());
  const hit = useRef(new THREE.Vector3());
  const gl = useThree((s) => s.gl);
  useFrame(({ camera, size }) => {
    const b = box.current
      ? boxIn(gl.domElement, box.current)
      : { x: 0, y: 0, w: size.width, h: size.height };
    anchors.current?.forEach((a, i) => {
      const el = targets.current?.[i];
      if (!a || !el) return;
      a.getWorldPosition(v.current);
      const far = camera.position.distanceTo(v.current);
      ray.current.set(camera.position, v.current.clone().sub(camera.position).normalize());
      let hidden = occluders.some(({ object, radius }) => {
        if (!object.current) return false;
        object.current.getWorldPosition(sphere.current.center);
        sphere.current.radius = radius;
        const p = ray.current.intersectSphere(sphere.current, hit.current);
        return Boolean(p && camera.position.distanceTo(p) < far);
      });
      v.current.project(camera);
      hidden ||= v.current.z > 1;
      const half = el.offsetWidth / 2 + 6;
      const px = (v.current.x * 0.5 + 0.5) * size.width;
      const py = (-v.current.y * 0.5 + 0.5) * size.height;
      const x = Math.min(Math.max(px, b.x + half), b.x + b.w - half);
      const y = Math.max(py, b.y + el.offsetHeight + 6);
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      el.style.opacity = hidden ? "0" : "1";
    });
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
 * Everything in the hero that isn't sky: the eclipse (or the sun), the four worlds in orbit with
 * their moons and an asteroid belt, and the explorer crew. Shared with the render stage, so the
 * poster matches.
 */
export function HeroCast({
  mix,
  still,
  moon,
  sun,
  planetAnchors,
  crewAnchors,
}: {
  mix: DayMix;
  still: boolean;
  moon?: RefObject<THREE.Mesh | null>;
  sun?: RefObject<THREE.Object3D | null>;
  planetAnchors?: Anchors;
  crewAnchors?: Anchors;
}) {
  return (
    <>
      <Eclipse mix={mix} still={still} moon={moon} sunAnchor={sun} position={SUN_AT.toArray()} />
      <Orbits
        still={still}
        mix={mix}
        position={SUN_AT.toArray()}
        rotation={[0.25, 0, -0.12]}
        anchors={planetAnchors}
      />
      <Explorers still={still} anchors={crewAnchors} />
    </>
  );
}

function World({
  still,
  day,
  box,
  text,
  intro,
  planetAnchors,
  crewAnchors,
  planetLabels,
  crewBubbles,
}: {
  still: boolean;
  day: boolean;
  box: El;
  text: El;
  intro: RefObject<number>;
  planetAnchors: Anchors;
  crewAnchors: Anchors;
  planetLabels: Targets;
  crewBubbles: Targets;
}) {
  const mix: DayMix = useDayMix(day, still);
  const moon = useRef<THREE.Mesh>(null);
  const sun = useRef<THREE.Object3D>(null);
  const invalidate = useThree((s) => s.invalidate);

  // With motion stilled the canvas only draws on demand; the scroll intro still moves the camera.
  useEffect(() => {
    if (!still) return;
    const onScroll = () => invalidate();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [still, invalidate]);

  return (
    <>
      <Camera box={box} intro={intro} />
      <SkyBackdrop mix={mix} still={still} sun={sun} text={text} scroll={intro} />
      <Studio mix={mix} />
      <Rig still={still}>
        <HeroCast
          mix={mix}
          still={still}
          moon={moon}
          sun={sun}
          planetAnchors={planetAnchors}
          crewAnchors={crewAnchors}
        />
      </Rig>
      <Track
        anchors={planetAnchors}
        targets={planetLabels}
        box={box}
        occluders={[
          { object: moon, radius: MOON_RADIUS },
          { object: sun, radius: SUN_RADIUS },
        ]}
      />
      <Track anchors={crewAnchors} targets={crewBubbles} box={box} />
    </>
  );
}

/**
 * The live 3D hero, filling the whole hero stage: the sky (aurora and stars at night, a bright sky
 * by day), the eclipse or the sun, four worlds and the explorer crew. Rendering pauses off screen
 * or in a hidden tab; reduced motion / Pause motion renders single frames.
 */
export default function HeroWorld({
  stage,
  box,
  text,
  intro,
  onReady,
}: {
  stage: El;
  box: El;
  text: El;
  intro: RefObject<number>;
  onReady?: () => void;
}) {
  const [visible, setVisible] = useState(true);
  const [still, setStill] = useState(false);
  const day = useIsDay();
  const planetAnchors = useRef<(THREE.Object3D | null)[]>([]);
  const crewAnchors = useRef<(THREE.Object3D | null)[]>([]);
  const planetLabels = useRef<(HTMLElement | null)[]>([]);
  const crewBubbles = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
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

  return (
    <>
      <Canvas
        className="!absolute inset-0"
        shadows="soft"
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.4, 14], fov: 36, manual: true }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        eventSource={stage as RefObject<HTMLElement>}
        eventPrefix="client"
        frameloop={!visible ? "never" : still ? "demand" : "always"}
        onCreated={() => onReady?.()}
      >
        <World
          still={still}
          day={day}
          box={box}
          text={text}
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
