"use client";

import { ArrowFatUp } from "@phosphor-icons/react";
import { Float } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { cx } from "@/lib/cx";
import { Bubble3D, Controller3D, Heart3D, Play3D } from "./props3d";
import { Studio } from "./studio";
import styles from "./three.module.css";
import { Aurora, ECLIPSE_RADIUS, Eclipse, Explorers, Orbits, PLANETS, Sky } from "./universe";

type Anchors = RefObject<(THREE.Object3D | null)[]>;
type Targets = RefObject<(HTMLElement | null)[]>;

/** Sways the universe toward the pointer, with a slow idle drift. */
function Rig({ children, still }: { children: ReactNode; still: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (!ref.current || still) return;
    const t = state.clock.elapsedTime;
    const k = Math.min(1, delta * 2.2);
    ref.current.rotation.y +=
      (state.pointer.x * 0.22 + Math.sin(t * 0.2) * 0.05 - ref.current.rotation.y) * k;
    ref.current.rotation.x += (-state.pointer.y * 0.1 - ref.current.rotation.x) * k;
  });
  return <group ref={ref}>{children}</group>;
}

/**
 * Projects 3D anchors to the screen every frame and moves the matching DOM labels. With an
 * `occluder`, a label fades out while its anchor is behind that sphere (a planet passing
 * behind the eclipse shouldn't keep its name tag floating in front).
 */
function Track({
  anchors,
  targets,
  occluder,
}: {
  anchors: Anchors;
  targets: Targets;
  occluder?: RefObject<THREE.Mesh | null>;
}) {
  const v = useRef(new THREE.Vector3());
  const ray = useRef(new THREE.Ray());
  const sphere = useRef(new THREE.Sphere(new THREE.Vector3(), ECLIPSE_RADIUS));
  const hit = useRef(new THREE.Vector3());
  useFrame(({ camera, size }) => {
    if (occluder?.current) occluder.current.getWorldPosition(sphere.current.center);
    anchors.current?.forEach((a, i) => {
      const el = targets.current?.[i];
      if (!a || !el) return;
      a.getWorldPosition(v.current);
      let hidden = false;
      if (occluder?.current) {
        const far = camera.position.distanceTo(v.current);
        ray.current.set(camera.position, v.current.clone().sub(camera.position).normalize());
        const p = ray.current.intersectSphere(sphere.current, hit.current);
        hidden = Boolean(p && camera.position.distanceTo(p) < far);
      }
      v.current.project(camera);
      hidden ||= v.current.z > 1;
      // Keep the tag fully inside the canvas so it never gets cut off at an edge.
      const half = el.offsetWidth / 2 + 6;
      const x = Math.min(Math.max((v.current.x * 0.5 + 0.5) * size.width, half), size.width - half);
      const y = Math.max((-v.current.y * 0.5 + 0.5) * size.height, el.offsetHeight + 6);
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

function World({
  still,
  planetAnchors,
  crewAnchors,
  planetLabels,
  crewBubbles,
}: {
  still: boolean;
  planetAnchors: Anchors;
  crewAnchors: Anchors;
  planetLabels: Targets;
  crewBubbles: Targets;
}) {
  const disc = useRef<THREE.Mesh>(null);
  return (
    <>
      <Studio />
      <Sky still={still} />
      <Aurora still={still} position={[0, 2.4, -9]} rotation={[0.15, 0, 0]} />
      <Rig still={still}>
        <Eclipse position={[1.2, 0.9, -3]} disc={disc} />
        <Orbits
          still={still}
          position={[1.2, 0.9, -3]}
          rotation={[0.25, 0, -0.12]}
          anchors={planetAnchors}
        />
        <Explorers still={still} anchors={crewAnchors} />
        <Float speed={still ? 0 : 2} rotationIntensity={1} floatIntensity={1.2}>
          <Heart3D position={[-0.9, -3.3, 1]} scale={0.4} rotation={[0, 0.4, 0.2]} />
        </Float>
        <Float speed={still ? 0 : 1.6} rotationIntensity={0.8} floatIntensity={1}>
          <Bubble3D
            position={[4.2, -2.6, 0.8]}
            scale={0.45}
            rotation={[0, -0.5, 0.1]}
            color={C_TEAL}
          />
        </Float>
        <Float speed={still ? 0 : 1.4} rotationIntensity={0.9} floatIntensity={1}>
          <Controller3D position={[-2.6, 3.4, -1.5]} scale={0.4} rotation={[0.3, 0.6, -0.2]} />
        </Float>
        <Float speed={still ? 0 : 1.7} rotationIntensity={1} floatIntensity={1.2}>
          <Play3D position={[5.4, 3.1, -1.5]} scale={0.36} rotation={[0.1, -0.6, 0.1]} />
        </Float>
      </Rig>
      <Track anchors={planetAnchors} targets={planetLabels} occluder={disc} />
      <Track anchors={crewAnchors} targets={crewBubbles} />
    </>
  );
}

const C_TEAL = "#2dd4bf";

/**
 * The live 3D hero: an aurora universe with the eclipse, four region planets, and the explorer
 * crew. Rendering pauses off screen or in a hidden tab; reduced motion / Pause motion renders a
 * single still frame.
 */
export default function HeroWorld({ onReady }: { onReady?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [still, setStill] = useState(false);
  const planetAnchors = useRef<(THREE.Object3D | null)[]>([]);
  const crewAnchors = useRef<(THREE.Object3D | null)[]>([]);
  const planetLabels = useRef<(HTMLElement | null)[]>([]);
  const crewBubbles = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const el = box.current;
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
  }, []);

  return (
    <div ref={box} className="absolute inset-0">
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden="true">
        {PLANETS.map((p, i) => (
          <span
            key={p.id}
            ref={(el) => {
              planetLabels.current[i] = el;
            }}
            className={cx(styles.planetLabel, "absolute top-0 left-0 will-change-transform")}
            style={{ color: p.color }}
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
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0.4, 14], fov: 36 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        frameloop={!visible ? "never" : still ? "demand" : "always"}
        onCreated={() => onReady?.()}
      >
        <World
          still={still}
          planetAnchors={planetAnchors}
          crewAnchors={crewAnchors}
          planetLabels={planetLabels}
          crewBubbles={crewBubbles}
        />
      </Canvas>
    </div>
  );
}
