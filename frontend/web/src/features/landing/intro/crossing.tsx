"use client";

import { useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { gsap } from "gsap";
import {
  type RefObject,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { locateCentrepiece } from "@/lib/edition";
import cast from "../cast.json";
import { BlackHole, HOLE_RADIUS } from "../three/black-hole";
import { softenGlass } from "../three/cast3d";
import { Studio } from "../three/studio";
import { holdWarmup, quietShaderChecks, warmScene } from "../three/warm";

/**
 * "The Crossing", the site's opening, in 3D.
 *
 * While the site loads, Realm's astronaut (the real model, rigged head to toe) drifts alone in deep
 * space, treading the void, looking round, now and then waving, a puff of his thrusters correcting
 * his drift.
 *
 * Then a black hole (the same one as the hero) ignites behind him and space bends around it. He's
 * yanked backwards. He spins round and fights it, thrusters blazing, arms flailing, clawing back a
 * little before being dragged further, twice, each tug harder. His thrusters sputter out and he's
 * ripped away: whipped round the hole in a tightening spiral, stretched along the pull, tumbling,
 * rocks and dust dragged in around him, the view shaking. At the edge he slows, reddens and freezes,
 * as someone falling in really would look from outside, and he's gone. The camera is dragged in
 * after him, rolling, until the shadow is everything.
 *
 * On the far side, a white hole bursts open from the hero's own black hole onto the site, and he's
 * flung out of it, end over end, straight past you.
 *
 * `state` is driven by the director below (a GSAP timeline); everything here reads it every frame.
 */
export type CrossingState = {
  /** The astronaut has drifted in from the dark (0 → 1). */
  shown: number;
  /** The black hole's size (0 → 1), and its extra flare. */
  hole: number;
  ignite: number;
  /** The flash of light as it ignites (0 → 1 → 0). */
  flash: number;
  /** He turns to look behind him, as space starts to warp (0 → 1). */
  look: number;
  /** A yank's kick through his body (spikes, then settles). */
  jolt: number;
  /** He turns to face us and fights it (0 → 1). */
  fight: number;
  /** Thrusters, 0 → 1. */
  thrust: number;
  /** How far he's been dragged along the spiral into the hole (0 → 1). */
  pull: number;
  /** Camera shake. */
  shake: number;
  /** The camera, dragged into the hole (0 → 1). */
  dive: number;
  /** On the far side: flung out of the hero's black hole (0 → 1). */
  far: boolean;
  eject: number;
  /** Where the hero's black hole is on screen (viewport px), for the far side. */
  from: { x: number; y: number };
};

export const initialCrossing = (): CrossingState => ({
  shown: 0,
  hole: 0,
  ignite: 0,
  flash: 0,
  look: 0,
  jolt: 0,
  fight: 0,
  thrust: 0,
  pull: 0,
  shake: 0,
  dive: 0,
  far: false,
  eject: 0,
  from: { x: 0, y: 0 },
});

/** Where the black hole opens, behind him and a little up and right. */
const HOLE = new THREE.Vector3(1.1, 0.9, -14);
const HOLE_SCALE = 2.1;
const CAMERA = new THREE.Vector3(0, 0, 10);
/** The astronaut's model stands 2.75 tall with its feet at 0; his pivot is his middle. */
const MID = 1.375;
const DRACO = "/draco/";
const ASTRO = `/models/${cast["astro-teal"].model}`;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Where he drifts, near enough (he wanders a little round it). */
const DRIFT = new THREE.Vector3(0, 0.1, 0);
/**
 * How far he's pulled (`pull`) while he can still fight it. Up to here each yank drags him
 * straight back toward the hole, in front of it, and the camera is dragged partway with him;
 * past it, the hole has him and whips him round.
 */
const TUG = 0.42;
const FOLLOW = 0.35;

/** Where he's been dragged to, while he fights: straight back toward the hole. */
function tugged(from: THREE.Vector3, f: number, out: THREE.Vector3) {
  return out.copy(from).lerp(HOLE, Math.min(f, TUG));
}

/**
 * Where something being dragged in is, at fraction f of its fall: whipped round the hole in a
 * spiral that swings wide and then tightens, receding as it goes, ending just behind the hole.
 */
function spiral(from: THREE.Vector3, f: number, twist: number, out: THREE.Vector3) {
  const dx = from.x - HOLE.x;
  const dy = from.y - HOLE.y;
  const r0 = Math.hypot(dx, dy) || 1;
  const a0 = Math.atan2(dy, dx);
  const swing = 4.4 * Math.sin(Math.PI * Math.min(f, 1)) ** 1.2 * (1 - f) ** 0.5;
  const r = r0 * (1 - f ** 1.4) + swing;
  const a = a0 + twist * f ** 2.1;
  out.set(
    HOLE.x + Math.cos(a) * r,
    HOLE.y + Math.sin(a) * r,
    HOLE.z + (from.z - HOLE.z) * (1 - f) ** 1.15 - 0.5 * f ** 10,
  );
  return out;
}

// ── The sky: deep space drawn per pixel, bent around the hole ───────────────────────────────────

const skyVertex = /* glsl */ `
varying vec2 vNdc;
void main() {
  vNdc = position.xy;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

const skyCommon = /* glsl */ `
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
uniform vec2 uHole;
uniform float uRs;
uniform float uLens;
uniform float uAspect;
uniform float uTime;
uniform float uFlash;
varying vec2 vNdc;

vec3 hash33(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yxz + 19.19);
  return fract((p.xxy + p.yxx) * p.zyx);
}
float hash31(vec3 p) { return hash33(p).x; }
float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i), hash31(i + vec3(1, 0, 0)), u.x), mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), u.x), u.y),
    mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), u.x), mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), u.x), u.y),
    u.z);
}
float fbm3(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise3(p); p = p * 2.07 + 11.3; a *= 0.5; }
  return v;
}
// One layer of stars: at most one per cell, soft, twinkling, a few coloured.
vec3 stars(vec3 d, float scale, float density, float size, float bright) {
  vec3 p = d * scale;
  vec3 c = floor(p);
  vec3 h = hash33(c);
  if (h.x > density) return vec3(0.0);
  vec3 sp = 0.25 + 0.5 * hash33(c + 7.13);
  float dist = length(fract(p) - sp);
  float core = exp(-dist * dist / (size * size));
  float tw = 0.65 + 0.35 * sin(uTime * (1.2 + 3.0 * h.y) + h.z * 40.0);
  vec3 tint = mix(vec3(0.75, 0.82, 1.0), mix(vec3(1.0, 0.8, 0.6), vec3(0.8, 0.7, 1.0), h.z), step(0.7, h.y));
  return tint * core * tw * bright;
}

// The soft, costly part: nebula and the galaxy's band, drawn at half size.
vec3 nebula(vec3 d) {
  // Nebula: violet and electric-blue cloud with darker dust lanes, drifting very slowly.
  vec3 q = d * 1.6 + vec3(0.0, 0.0, uTime * 0.004);
  float n = fbm3(q);
  float m = fbm3(q * 2.3 + 5.0);
  float dust = smoothstep(0.35, 0.75, fbm3(q * 3.1 - 9.0));
  vec3 violet = vec3(0.28, 0.12, 0.55);
  vec3 blue = vec3(0.08, 0.2, 0.55);
  vec3 neb = mix(violet, blue, smoothstep(0.3, 0.7, m)) * smoothstep(0.42, 0.85, n) * (1.0 - 0.7 * dust);
  // A faint band of the galaxy across the sky.
  float band = exp(-pow(dot(d, normalize(vec3(0.35, 1.0, 0.2))), 2.0) / 0.03);
  return vec3(0.012, 0.012, 0.035) + neb * 0.55 + vec3(0.25, 0.22, 0.4) * band * 0.08 * (0.6 + n);
}

// The sharp part: three layers of stars, drawn at full size over it.
vec3 starfield(vec3 d) {
  float band = exp(-pow(dot(d, normalize(vec3(0.35, 1.0, 0.2))), 2.0) / 0.03);
  return stars(d, 60.0, 0.22, 0.09, 0.9) + stars(d, 140.0, 0.3, 0.1, 0.55)
       + stars(d, 320.0, 0.35, 0.12, 0.35) * (0.6 + band);
}

// Where this pixel's light comes from, bent round the hole (see main).
vec3 lensed(out float r, out float thetaE) {
  // Gravitational lensing: each pixel sees the sky from a direction bent toward the hole (inside
  // the Einstein radius, from the far side of it), so the sky around the hole bends into rings.
  vec2 q = (vNdc - uHole) * vec2(uAspect, 1.0);
  r = length(q);
  thetaE = uRs * 2.3 * uLens;
  vec2 dir = q / max(r, 1e-4);
  float rr = max(r, uRs * 0.98);
  vec2 src = dir * (r - thetaE * thetaE / rr);
  vec2 ndc = uHole + src / vec2(uAspect, 1.0);
  vec4 v = uInvProj * vec4(ndc, 1.0, 1.0);
  return normalize((uCamWorld * vec4(v.xyz / v.w, 0.0)).xyz);
}
`;

const skyCloudsFragment = /* glsl */ `
${skyCommon}
void main() {
  float r;
  float thetaE;
  gl_FragColor = vec4(nebula(lensed(r, thetaE)), 1.0);
}
`;

const skyFragment = /* glsl */ `
${skyCommon}
uniform sampler2D uNebula;
void main() {
  float r;
  float thetaE;
  vec3 d = lensed(r, thetaE);
  vec3 col = texture2D(uNebula, vNdc * 0.5 + 0.5).rgb + starfield(d);
  // Light piles up on the Einstein ring.
  float ring = exp(-pow((r - thetaE) / (uRs * 0.22 + 1e-4), 2.0)) * uLens;
  col += col * ring * 2.2 + vec3(0.55, 0.45, 0.9) * ring * 0.05;
  // Near the hole, light climbing out is redshifted and dimmed.
  float z = smoothstep(uRs * 3.4, uRs * 1.0, r) * uLens;
  col = mix(col, col * vec3(1.25, 0.42, 0.18), z);
  col *= 1.0 - 0.85 * smoothstep(uRs * 1.6, uRs * 1.0, r) * uLens;
  // The ignition: a burst of light from where the hole is being born, washing the sky.
  float fr = length((vNdc - uHole) * vec2(uAspect, 1.0));
  col += vec3(1.0, 0.82, 0.55) * (exp(-fr * 5.0) * 1.4 + exp(-fr * 1.4) * 0.25) * uFlash;
  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * The sky. Its nebula is soft and costly (3D noise, per pixel), so it's drawn at half size into its
 * own target and scaled up, a quarter of the pixels; the stars are drawn sharp over it.
 */
function Sky({ state }: { state: RefObject<CrossingState> }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const nebula = useMemo(() => {
    const half =
      gl.extensions.has("EXT_color_buffer_half_float") ||
      gl.extensions.has("EXT_color_buffer_float");
    return {
      target: new THREE.WebGLRenderTarget(1, 1, {
        type: half ? THREE.HalfFloatType : THREE.UnsignedByteType,
        depthBuffer: false,
      }),
      scene: new THREE.Scene(),
      camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
    };
  }, [gl]);
  const { material, nebulaMaterial } = useMemo(() => {
    const uniforms = {
      uInvProj: { value: new THREE.Matrix4() },
      uCamWorld: { value: new THREE.Matrix4() },
      uHole: { value: new THREE.Vector2() },
      uRs: { value: 0.1 },
      uLens: { value: 0 },
      uAspect: { value: 1 },
      uTime: { value: 0 },
      uFlash: { value: 0 },
      uNebula: { value: nebula.target.texture },
    };
    const pass = { vertexShader: skyVertex, depthTest: false, depthWrite: false, uniforms };
    return {
      material: new THREE.ShaderMaterial({ ...pass, fragmentShader: skyFragment }),
      nebulaMaterial: new THREE.ShaderMaterial({ ...pass, fragmentShader: skyCloudsFragment }),
    };
  }, [nebula]);
  useEffect(() => {
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), nebulaMaterial);
    quad.frustumCulled = false;
    nebula.scene.add(quad);
    // Compiled in the background as it's drawn (into its target), before the opening is drawn.
    const was = gl.getRenderTarget();
    gl.setRenderTarget(nebula.target);
    holdWarmup(scene, gl.compileAsync(nebula.scene, nebula.camera));
    gl.setRenderTarget(was);
    return () => {
      nebula.scene.remove(quad);
      quad.geometry.dispose();
    };
  }, [gl, scene, nebula, nebulaMaterial]);
  useEffect(
    () => () => {
      nebula.target.dispose();
      material.dispose();
      nebulaMaterial.dispose();
    },
    [nebula, material, nebulaMaterial],
  );
  const mesh = useRef<THREE.Mesh>(null);
  const p = useMemo(() => new THREE.Vector3(), []);
  const e = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera, size, clock }) => {
    const s = state.current;
    const u = material.uniforms as Record<string, THREE.IUniform>;
    if (mesh.current) mesh.current.visible = !s.far;
    u.uTime.value = clock.elapsedTime;
    (u.uInvProj.value as THREE.Matrix4).copy(camera.projectionMatrixInverse);
    (u.uCamWorld.value as THREE.Matrix4).copy(camera.matrixWorld);
    u.uAspect.value = size.width / size.height;
    // The hole's centre and shadow radius on screen, for the lens.
    p.copy(HOLE).project(camera);
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    e.copy(HOLE)
      .addScaledVector(right, HOLE_RADIUS * HOLE_SCALE * Math.max(s.hole, 0.001))
      .project(camera);
    (u.uHole.value as THREE.Vector2).set(p.x, p.y);
    u.uRs.value = Math.max(1e-4, Math.abs(e.x - p.x) * (size.width / size.height));
    u.uLens.value = s.hole;
    u.uFlash.value = s.flash;
    // The nebula at half size, ahead of the frame.
    if (!s.far) {
      const w = Math.max(1, Math.round(size.width * gl.getPixelRatio() * 0.5));
      const h = Math.max(1, Math.round(size.height * gl.getPixelRatio() * 0.5));
      if (nebula.target.width !== w || nebula.target.height !== h) nebula.target.setSize(w, h);
      const was = gl.getRenderTarget();
      gl.setRenderTarget(nebula.target);
      gl.render(nebula.scene, nebula.camera);
      gl.setRenderTarget(was);
    }
  });

  return (
    <mesh ref={mesh} material={material} frustumCulled={false} renderOrder={-1000}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}

// ── The astronaut ────────────────────────────────────────────────────────────────────────────

const REDSHIFT = new THREE.Color(1.1, 0.28, 0.12);

function Astronaut({ state, onLoaded }: { state: RefObject<CrossingState>; onLoaded: () => void }) {
  const { scene, animations } = useGLTF(ASTRO, DRACO);
  // His own copy of the materials: the hero's astronaut shares the originals, and he reddens.
  const { model, tinted } = useMemo(() => {
    const m = cloneSkinned(scene);
    const tinted: { mat: THREE.MeshStandardMaterial; base: THREE.Color; emissive: THREE.Color }[] =
      [];
    m.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
      softenGlass(mat);
      mesh.material = mat;
      mesh.frustumCulled = false;
      tinted.push({ mat, base: mat.color.clone(), emissive: mat.emissive.clone() });
    });
    return { model: m, tinted };
  }, [scene]);
  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model]);
  // His body's moves (scripts/blender/rig_body.py) all loop at once; what he's doing is only how
  // they're weighted. The wave is layered on top of whatever he's doing.
  const moves = useMemo(() => {
    const act = (name: string) => {
      const clip = animations.find((c) => c.name.toLowerCase() === name);
      if (!clip) return null;
      const a = mixer.clipAction(clip);
      a.setEffectiveWeight(0).play();
      return a;
    };
    const waveClip = animations.find((c) => /wave/i.test(c.name));
    const wave = waveClip
      ? mixer.clipAction(
          THREE.AnimationUtils.makeClipAdditive(waveClip.clone()),
          undefined,
          THREE.AdditiveAnimationBlendMode,
        )
      : null;
    wave?.setLoop(THREE.LoopOnce, 1);
    return {
      float: act("float"),
      swim: act("swim"),
      flail: act("flail"),
      spread: act("spread"),
      wave,
    };
  }, [animations, mixer]);
  const weights = useRef({ float: 1, swim: 0, flail: 0, spread: 0 });
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const pack = useRef<THREE.Object3D>(null);
  const loaded = useRef(false);

  useLayoutEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    onLoaded();
  }, [onLoaded]);

  const tmp = useMemo(
    () => ({
      pos: new THREE.Vector3(),
      start: new THREE.Vector3(),
      from: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      qi: new THREE.Quaternion(),
      m: new THREE.Matrix4(),
      sc: new THREE.Matrix4(),
      z: new THREE.Vector3(0, 0, 1),
      spin: new THREE.Euler(),
      curve: null as THREE.CatmullRomCurve3 | null,
      farKey: "",
    }),
    [],
  );
  const nextWave = useRef(2.2);
  const waving = useRef(false);
  const spin = useRef({ x: 0, y: 0, z: 0 });

  useFrame(({ clock, camera, size }, delta) => {
    const s = state.current;
    const g = outer.current;
    const k = inner.current;
    if (!g || !k) return;
    const t = clock.elapsedTime;
    const dt = Math.min(delta, 0.05);

    // What his body is doing. Drifting, he treads space and now and then waves. Yanked, he
    // flails; fighting, he swims for it, hard, toward us; each yank throws him back into a flail,
    // and as his thrusters die it's all flailing. Ripped away, he's flung spread-eagled, tumbling.
    // On the far side he's thrown out the same way.
    {
      const f = s.pull;
      const lost = s.far ? 1 : smooth(TUG, TUG + 0.1, f);
      const jolt = Math.max(0, s.jolt);
      const panic = Math.min(1, jolt * 1.6 + (1 - s.thrust) * s.fight * 0.85);
      const engaged = Math.max(s.fight, Math.min(1, jolt * 2)) * (1 - lost);
      const target = {
        float: (1 - engaged) * (1 - lost),
        swim: s.fight * (1 - lost) * (1 - panic),
        flail: engaged * panic + lost * (s.far ? 0.35 : 0.45),
        spread: lost * (s.far ? 0.65 : 0.55),
      };
      const total = target.float + target.swim + target.flail + target.spread || 1;
      const w = weights.current;
      const ease = 1 - Math.exp(-dt * (jolt > 0.2 ? 30 : 9));
      for (const key of ["float", "swim", "flail", "spread"] as const) {
        w[key] += (target[key] / total - w[key]) * ease;
        moves[key]?.setEffectiveWeight(w[key]);
      }
      // Fighting harder than he can: strokes speed up. At the edge, time itself slows for him,
      // as seen from outside, until he's frozen.
      if (moves.swim) moves.swim.timeScale = 1.5 + s.fight * 0.4;
      if (moves.flail) moves.flail.timeScale = s.far ? 1.1 : 1.35;
      if (moves.spread) moves.spread.timeScale = s.far ? 1.6 : 1.2;
      mixer.timeScale = s.far ? 1 : 1 - 0.97 * smooth(0.82, 0.99, f);
      // A hello, now and then, while he's only drifting.
      const wave = moves.wave;
      const calm = s.look < 0.05 && s.fight < 0.05 && !s.far;
      if (wave && calm && s.shown > 0.6 && t > nextWave.current) {
        wave.reset().fadeIn(0.25).play();
        waving.current = true;
        nextWave.current = t + 4.2;
      }
      if (wave && !calm && waving.current) {
        waving.current = false;
        wave.fadeOut(0.2);
      }
      mixer.update(dt);
    }

    // Where he is.
    const drift = tmp.start.set(
      Math.sin(t * 0.33) * 0.35,
      Math.sin(t * 0.52) * 0.22 + 0.1,
      Math.sin(t * 0.21) * 0.4 - (1 - s.shown) * 18,
    );
    let stretch = 1;
    let red = 0;
    if (s.far) {
      // Flung out of the hero's black hole, past the camera.
      const key = `${Math.round(s.from.x)},${Math.round(s.from.y)},${size.width},${size.height}`;
      if (tmp.farKey !== key) {
        tmp.farKey = key;
        const at = (x: number, y: number, dist: number) => {
          const v = new THREE.Vector3(x, y, 0.5).unproject(camera).sub(camera.position).normalize();
          return camera.position.clone().addScaledVector(v, dist);
        };
        const sx = (s.from.x / size.width) * 2 - 1;
        const sy = -(s.from.y / size.height) * 2 + 1;
        tmp.curve = new THREE.CatmullRomCurve3([
          at(sx, sy, 60),
          at(sx * 0.6 - 0.2, sy * 0.4 - 0.15, 16),
          at(-0.3, -0.2, 5.2),
          at(-1.5, -1.3, 2.6),
        ]);
      }
      const e = s.eject;
      // Shot out fast, easing as he comes close, then gone past the camera.
      const u = e < 0.72 ? 0.8 * (1 - (1 - e / 0.72) ** 3) : 0.8 + 0.2 * ((e - 0.72) / 0.28) ** 2;
      tmp.curve?.getPointAt(Math.min(u, 1), tmp.pos);
      tmp.curve?.getTangentAt(Math.min(u, 0.999), tmp.dir);
      stretch = 1 + 1.8 * (1 - smooth(0, 0.3, e));
      spin.current.x += dt * (6 - 3 * e);
      spin.current.z += dt * 2.2;
      k.rotation.set(spin.current.x, 0.6 + spin.current.z * 0.4, spin.current.z);
      g.visible = e > 0.001 && e < 0.999;
    } else {
      const f = s.pull;
      // Dragged back toward the hole while he fights; then whipped round it and in.
      tugged(drift, f, tmp.pos);
      if (f > TUG) spiral(tmp.from.copy(tmp.pos), (f - TUG) / (1 - TUG), Math.PI * 4.4, tmp.pos);
      // Fighting it: he turns to face us and leans into his thrusters, shaking with the effort.
      const fight = s.fight * (1 - smooth(TUG, TUG + 0.12, f));
      const shiver = fight * 0.06;
      tmp.pos.x += Math.sin(t * 43) * shiver;
      tmp.pos.y += Math.cos(t * 37) * shiver;
      // Losing it: tumbling faster the faster he falls.
      const tumble = smooth(TUG, 0.7, f);
      spin.current.x += dt * tumble * (5 + 9 * f);
      spin.current.z += dt * tumble * (3 + 6 * f);
      // Drifting, he turns this way and that; as space warps he looks back over his shoulder;
      // fighting, he faces us and leans hard into his thrusters, jerked back by every yank.
      const idleYaw = 0.35 + Math.sin(t * 0.3) * 0.3;
      const lookYaw = THREE.MathUtils.lerp(idleYaw, 2.4, s.look * (1 - s.fight));
      const yaw = THREE.MathUtils.lerp(lookYaw, Math.sin(t * 7) * 0.14, fight);
      const pitch = THREE.MathUtils.lerp(Math.sin(t * 0.5) * 0.1, 0.55, fight) - s.jolt * 0.9;
      k.rotation.set(
        pitch + spin.current.x,
        yaw,
        Math.sin(t * 0.45) * 0.12 * (1 - fight) +
          spin.current.z +
          Math.sin(t * 29) * fight * 0.06 +
          s.jolt * 0.35,
      );
      // Tidal stretch toward the hole, and the light from him redshifting as he nears it.
      stretch = 1 + 2.6 * smooth(0.55, 1, f) ** 2;
      red = smooth(0.8, 1, f);
      tmp.dir.copy(HOLE).sub(tmp.pos).normalize();
      g.visible = s.shown > 0.001 && f < 0.994;
    }

    // Stretch along the pull, in world space (the tumble stays his own).
    tmp.q.setFromUnitVectors(tmp.z, tmp.dir.lengthSq() > 0 ? tmp.dir : tmp.z);
    tmp.qi.copy(tmp.q).invert();
    const side = 1 / Math.sqrt(stretch);
    tmp.m.makeTranslation(tmp.pos.x, tmp.pos.y, tmp.pos.z);
    tmp.m.multiply(tmp.sc.makeRotationFromQuaternion(tmp.q));
    tmp.m.multiply(tmp.sc.makeScale(side, side, stretch));
    tmp.m.multiply(tmp.sc.makeRotationFromQuaternion(tmp.qi));
    g.matrix.copy(tmp.m);
    g.matrixWorldNeedsUpdate = true;

    for (const { mat, base, emissive } of tinted) {
      mat.color
        .copy(base)
        .lerp(REDSHIFT, red * 0.85)
        .multiplyScalar(1 - 0.75 * red);
      mat.emissive.copy(emissive).lerp(REDSHIFT, red * 0.35);
    }
  });

  return (
    <group ref={outer} matrixAutoUpdate={false}>
      <group ref={inner}>
        <primitive object={model} position={[0, -MID, 0]} />
        {/* His backpack, where the thrusters fire from. */}
        <object3D ref={pack} position={[0, 0.45, -0.55]} />
      </group>
      <Thrusters state={state} pack={pack} />
    </group>
  );
}

// ── Thrusters, debris and streaks: points and lines, one draw each ─────────────────────────────

const pointVertex = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
attribute float aAlpha;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * 900.0 / -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;
const pointFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor * a * a * vAlpha, 0.0);
}
`;

function useGlowPoints(count: number) {
  return useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(count), 1));
    geometry.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(count), 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: pointVertex,
      fragmentShader: pointFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    return { geometry, material };
  }, [count]);
}

/** Blue-white jets from his backpack, pushing him toward us. */
function Thrusters({
  state,
  pack,
}: {
  state: RefObject<CrossingState>;
  pack: RefObject<THREE.Object3D | null>;
}) {
  const N = 260;
  const { geometry, material } = useGlowPoints(N);
  const glow = useRef<THREE.PointLight>(null);
  const parts = useMemo(
    () =>
      Array.from({ length: N }, () => ({
        life: 1,
        p: new THREE.Vector3(),
        v: new THREE.Vector3(),
      })),
    [],
  );
  const cursor = useRef(0);
  const at = useMemo(() => new THREE.Vector3(), []);
  const back = useMemo(() => new THREE.Vector3(), []);
  const inv = useMemo(() => new THREE.Matrix4(), []);
  const nextPuff = useRef(2.4);
  const puff = useRef(0);

  useFrame(({ clock }, delta) => {
    const s = state.current;
    const dt = Math.min(delta, 0.05);
    const t = clock.elapsedTime;
    const o = pack.current;
    const parent = o?.parent?.parent as THREE.Object3D | undefined;
    // A small correcting puff now and then while he drifts.
    if (!s.fight && s.shown > 0.9 && t > nextPuff.current) {
      puff.current = 0.35;
      nextPuff.current = t + 2.6 + Math.random() * 2;
    }
    puff.current = Math.max(0, puff.current - dt);
    // Full thrust while he fights, sputtering as it fails.
    const sputter = s.thrust < 0.8 ? (Math.sin(t * 31) > 0.2 ? 1 : 0.15) : 1;
    const power = Math.max(s.thrust * sputter, puff.current > 0 ? 0.35 : 0);
    if (o && parent && power > 0.01 && !s.far) {
      o.getWorldPosition(at);
      // Backwards out of the pack: his -Z, in world space.
      back.set(0, 0, -1).transformDirection(o.matrixWorld);
      const emit = Math.ceil(power * 9);
      for (let i = 0; i < emit; i++) {
        const q = parts[cursor.current];
        cursor.current = (cursor.current + 1) % N;
        if (!q) continue;
        q.life = 0;
        q.p.copy(at).addScaledVector(back, 0.1);
        q.v
          .copy(back)
          .multiplyScalar(4 + power * 7)
          .add(
            new THREE.Vector3(
              Math.random() - 0.5,
              Math.random() - 0.5,
              Math.random() - 0.5,
            ).multiplyScalar(1.6),
          );
      }
    }
    // The particles live in world space; this object sits inside his (stretched) group, so undo it.
    if (parent) inv.copy(parent.matrixWorld).invert();
    // The flames light him up from behind.
    if (glow.current) {
      glow.current.intensity = s.far ? 0 : power * (6 + Math.sin(t * 53) * 1.5);
      if (o) glow.current.position.copy(o.getWorldPosition(at)).applyMatrix4(inv);
    }
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const col = geometry.attributes.aColor as THREE.BufferAttribute;
    const size = geometry.attributes.aSize as THREE.BufferAttribute;
    const alpha = geometry.attributes.aAlpha as THREE.BufferAttribute;
    parts.forEach((q, i) => {
      q.life += dt / 0.45;
      q.p.addScaledVector(q.v, dt);
      const alive = q.life < 1;
      at.copy(q.p).applyMatrix4(inv);
      pos.setXYZ(i, at.x, at.y, at.z);
      const hot = 1 - q.life;
      // White-hot at the nozzle, cooling to blue.
      col.setXYZ(i, 0.45 + 0.55 * hot * hot, 0.7 + 0.3 * hot, 1.0);
      size.setX(i, alive ? 0.12 + 0.3 * q.life : 0);
      alpha.setX(i, alive ? hot * 1.8 : 0);
    });
    pos.needsUpdate = true;
    col.needsUpdate = true;
    size.needsUpdate = true;
    alpha.needsUpdate = true;
  });

  return (
    <>
      <points geometry={geometry} material={material} frustumCulled={false} />
      <pointLight ref={glow} color="#8fc4ff" intensity={0} distance={6} decay={2} />
    </>
  );
}

/** Rocks drifting in the dark, dragged into the hole with him. */
function Debris({ state }: { state: RefObject<CrossingState> }) {
  const N = 34;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const rocks = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => {
        const a = (i / N) * Math.PI * 2 + Math.random();
        const r = 6.5 + Math.random() * 8;
        return {
          home: new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * 0.62, -4 - Math.random() * 10),
          size: 0.08 + Math.random() ** 3 * 0.34,
          delay: Math.random() * 0.35,
          twist: Math.PI * (2.5 + Math.random() * 3),
          spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(2),
        };
      }),
    [],
  );
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#2a2638",
        roughness: 0.92,
        metalness: 0.05,
        flatShading: true,
      }),
    [],
  );
  const d = useMemo(() => new THREE.Object3D(), []);
  const p = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    const s = state.current;
    const m = mesh.current;
    if (!m) return;
    m.visible = !s.far;
    const t = clock.elapsedTime;
    rocks.forEach((r, i) => {
      const f = Math.min(1, Math.max(0, (s.pull * 1.35 + s.hole * 0.06 - r.delay) / (1 - r.delay)));
      spiral(r.home, f, r.twist, p);
      d.position.copy(p);
      d.position.y += Math.sin(t * 0.4 + i) * 0.15 * (1 - f);
      d.rotation.set(t * r.spin.x, t * r.spin.y, t * r.spin.z);
      d.scale.setScalar(f > 0.985 ? 0 : r.size * (1 + f * 0.5));
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, N]} frustumCulled={false} />;
}

/**
 * Streaks of light: gas falling into the hole in spiralling arcs while it pulls, rushing past the
 * camera as it's dragged in; on the far side, bursting out of the white hole toward you.
 */
function Streaks({ state }: { state: RefObject<CrossingState> }) {
  const N = 220;
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 6), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(N * 6), 3));
    return g;
  }, []);
  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  const lines = useMemo(
    () =>
      Array.from({ length: N }, () => ({
        a: Math.random() * Math.PI * 2,
        r: Math.random(),
        speed: 0.3 + Math.random() * 0.7,
        hue: Math.random(),
        dir: new THREE.Vector3(
          (Math.random() - 0.5) * 1.6,
          (Math.random() - 0.5) * 1.2,
          1,
        ).normalize(),
      })),
    [],
  );
  const origin = useMemo(() => new THREE.Vector3(), []);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  const palette = useMemo(
    () => [
      new THREE.Color("#ffb23d"),
      new THREE.Color("#a76ef8"),
      new THREE.Color("#4998fe"),
      new THREE.Color("#fff1d6"),
    ],
    [],
  );
  const c = useMemo(() => new THREE.Color(), []);

  useFrame(({ camera, size }, delta) => {
    const s = state.current;
    const dt = Math.min(delta, 0.05);
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const col = geometry.attributes.color as THREE.BufferAttribute;
    let far = 0;
    if (s.far) {
      const sx = (s.from.x / size.width) * 2 - 1;
      const sy = -(s.from.y / size.height) * 2 + 1;
      const v = new THREE.Vector3(sx, sy, 0.5).unproject(camera).sub(camera.position).normalize();
      origin.copy(camera.position).addScaledVector(v, 40);
      far = Math.sin(Math.PI * Math.min(1, s.eject * 1.4));
    }
    const pullOn = s.far
      ? 0
      : Math.min(1, s.hole * 0.4 + s.fight * 0.6 + s.dive) *
        (1 - smooth(0.97, 1, s.pull) * (1 - s.dive));
    lines.forEach((l, i) => {
      let energy = 0;
      if (s.far) {
        // Out of the white hole, toward the camera and past it.
        l.r = (l.r + dt * l.speed * 1.4) % 1;
        const dist = l.r * 40;
        a.copy(origin)
          .addScaledVector(l.dir, -dist * 0.02)
          .add(
            b
              .copy(camera.position)
              .sub(origin)
              .multiplyScalar(l.r * 0.97),
          );
        a.x += l.dir.x * dist * 0.35;
        a.y += l.dir.y * dist * 0.35;
        b.copy(a)
          .sub(origin)
          .normalize()
          .multiplyScalar(-1.2 - 3 * l.r);
        b.add(a);
        energy = far * l.r;
      } else {
        // Falling in: spiralling arcs round the hole, faster and tighter as they near it.
        l.r -= dt * l.speed * (0.12 + 0.6 * pullOn + 1.5 * s.dive);
        if (l.r < 0.02) {
          l.r = 1;
          l.a = Math.random() * Math.PI * 2;
        }
        const r = 1.2 + l.r * 16;
        const ang = l.a + (1 - l.r) * 4 + 0.1 / (l.r + 0.05);
        a.set(HOLE.x + Math.cos(ang) * r, HOLE.y + Math.sin(ang) * r * 0.55, HOLE.z + l.r * 6);
        const r2 = r * 1.06 + 0.4;
        const ang2 = ang - 0.08 - 0.25 * (1 - l.r);
        b.set(
          HOLE.x + Math.cos(ang2) * r2,
          HOLE.y + Math.sin(ang2) * r2 * 0.55,
          HOLE.z + l.r * 6 + 0.3,
        );
        energy = pullOn * (1 - l.r) * 0.9;
      }
      pos.setXYZ(i * 2, a.x, a.y, a.z);
      pos.setXYZ(i * 2 + 1, b.x, b.y, b.z);
      c.copy(palette[Math.floor(l.hue * palette.length)] as THREE.Color).multiplyScalar(energy);
      col.setXYZ(i * 2, c.r, c.g, c.b);
      col.setXYZ(i * 2 + 1, 0, 0, 0);
    });
    pos.needsUpdate = true;
    col.needsUpdate = true;
  });

  return <lineSegments geometry={geometry} material={material} frustumCulled={false} />;
}

// ── The camera: shaking with the pull, dragged into the hole, reset on the far side ────────────

function Rig({ state }: { state: RefObject<CrossingState> }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const look = useMemo(() => new THREE.Vector3(), []);
  const into = useMemo(() => new THREE.Vector3(), []);
  const him = useMemo(() => new THREE.Vector3(), []);
  const base = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const s = state.current;
    const t = clock.elapsedTime;
    if (s.far) {
      camera.position.copy(CAMERA);
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);
      camera.fov = 40;
      camera.updateProjectionMatrix();
      return;
    }
    const k = s.dive;
    const ease = k * k * k;
    // Into the hole, stopping just short of its shadow (which by then fills the view).
    into.set(HOLE.x, HOLE.y, HOLE.z + 1.2);
    // Dragged partway along with him while he fights, so he stays big against the hole.
    tugged(DRIFT, s.pull, him);
    base.copy(him).sub(DRIFT).multiplyScalar(FOLLOW).add(CAMERA);
    camera.position.lerpVectors(base, into, ease);
    const sh = s.shake;
    camera.position.x += (Math.sin(t * 41) + Math.sin(t * 23.7) * 0.6) * 0.05 * sh;
    camera.position.y += (Math.cos(t * 37) + Math.sin(t * 19.3) * 0.6) * 0.05 * sh;
    // On him; once the hole is open, framing him against it; then on the hole as it takes him.
    look.copy(him).lerp(HOLE, Math.min(1, s.hole * 0.3 + smooth(TUG, 1, s.pull) * 0.7 + k));
    const roll = ease * 3 + Math.sin(t * 17) * 0.02 * sh;
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    camera.lookAt(look);
    camera.fov = 40 + sh * 3 + ease * 16;
    camera.updateProjectionMatrix();
  });
  return null;
}

function Hole({ state }: { state: RefObject<CrossingState> }) {
  const group = useRef<THREE.Group>(null);
  const ignite = useRef(0);
  const mix = useRef(0);
  useFrame(() => {
    const s = state.current;
    const g = group.current;
    ignite.current = s.ignite;
    if (!g) return;
    g.visible = s.hole > 0.001 && !s.far;
    g.scale.setScalar(Math.max(0.001, s.hole) * HOLE_SCALE);
  });
  return (
    <group ref={group} position={HOLE}>
      <BlackHole mix={mix} still={false} ignite={ignite} />
      {/* Its light on him: an amber rim from behind. */}
    </group>
  );
}

function HoleLight({ state }: { state: RefObject<CrossingState> }) {
  const light = useRef<THREE.DirectionalLight>(null);
  useFrame(() => {
    const s = state.current;
    if (light.current) light.current.intensity = s.far ? 0 : s.hole * (2.2 + s.ignite * 2);
  });
  return <directionalLight ref={light} position={HOLE} color="#ffb04a" intensity={0} />;
}

/**
 * Shader programs (and the reflections) are made in the background before the first frame: until
 * then nothing is drawn, as drawing with a shader that isn't ready makes the page wait for it.
 */
function Warm({ onWarm }: { onWarm: () => void }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    let live = true;
    warmScene(gl, scene, camera).then(() => live && onWarm());
    return () => {
      live = false;
    };
  }, [gl, scene, camera, onWarm]);
  return null;
}

function CrossingCanvas({
  state,
  warm,
  onLoaded,
  onWarm,
}: {
  state: RefObject<CrossingState>;
  warm: boolean;
  onLoaded: () => void;
  onWarm: () => void;
}) {
  return (
    <Canvas
      dpr={1}
      frameloop={warm ? "always" : "never"}
      camera={{
        position: CAMERA.toArray() as [number, number, number],
        fov: 40,
        near: 0.1,
        far: 200,
      }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        quietShaderChecks(gl);
        gl.setClearColor(0x000000, 0);
      }}
    >
      <Studio shadows={false} mix={{ current: 0 }} />
      <HoleLight state={state} />
      <Sky state={state} />
      <Hole state={state} />
      <Debris state={state} />
      <Streaks state={state} />
      <Rig state={state} />
      <Suspense fallback={null}>
        <Astronaut state={state} onLoaded={onLoaded} />
        <Warm onWarm={onWarm} />
      </Suspense>
    </Canvas>
  );
}

export type CrossingDom = {
  loader: HTMLElement;
  space: HTMLElement;
  flash: HTMLElement;
  ring: HTMLElement;
  stage: HTMLElement;
};

/** How long he drifts before the hole can come, at the least, and the longest the loading waits. */
const DRIFT_MS = 2200;
const MAX_MS = 9000;

/**
 * The director: shows the astronaut as soon as he's loaded, reports how far the page has got, and
 * once it's ready (the hero has drawn, the fonts are in, and he's had his moment) plays the fall.
 */
export function Crossing({
  dom,
  onProgress,
  onDone,
}: {
  dom: RefObject<CrossingDom | null>;
  onProgress: (p: number) => void;
  onDone: () => void;
}) {
  const state = useRef(initialCrossing());
  const flags = useRef({ loaded: false, warm: false, shownAt: 0, hero: false, fonts: false });
  const started = useRef(false);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const [warm, setWarm] = useState(false);

  const onLoaded = useCallback(() => {
    flags.current.loaded = true;
  }, []);
  // He drifts in from the dark once there's something to draw him with.
  const onWarm = useCallback(() => {
    flags.current.warm = true;
    flags.current.shownAt = performance.now();
    setWarm(true);
    gsap.to(state.current, { shown: 1, duration: 1.8, ease: "power2.out" });
  }, []);

  useEffect(() => {
    const f = flags.current;
    const t0 = performance.now();
    const html = document.documentElement;
    f.hero = "heroReady" in html.dataset;
    const onHero = () => {
      f.hero = true;
    };
    window.addEventListener("realm:hero-ready", onHero);
    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      f.fonts = true;
    });

    // The loading line: real milestones, eased so it moves smoothly.
    let shown = 0;
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      const target =
        Math.min(0.25, ((now - t0) / 2500) * 0.25) +
        (f.fonts ? 0.1 : 0) +
        (f.loaded ? 0.2 : 0) +
        (f.warm ? 0.15 : 0) +
        (f.hero ? 0.3 : 0);
      shown += (target - shown) * 0.08;
      onProgress(Math.min(1, shown));
      const ready = f.loaded && f.warm && f.hero && f.fonts && now - f.shownAt > DRIFT_MS;
      const late = now - t0 > MAX_MS && f.loaded && f.warm;
      if (!started.current && (ready || late) && dom.current) {
        started.current = true;
        onProgress(1);
        tl.current = playCrossing(state.current, dom.current, locateCentrepiece, onDone);
      }
      // If even he can't load, don't hold the site back.
      if (!started.current && !f.loaded && now - t0 > MAX_MS + 3000) {
        started.current = true;
        onDone();
      }
      if (!started.current || shown < 0.999) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("realm:hero-ready", onHero);
      tl.current?.kill();
    };
  }, [dom, onProgress, onDone]);

  return <CrossingCanvas state={state} warm={warm} onLoaded={onLoaded} onWarm={onWarm} />;
}

/** Starts the timeline; see the component comment for the story it tells. */
function playCrossing(
  s: CrossingState,
  dom: CrossingDom,
  locate: () => { x: number; y: number } | null,
  onDone: () => void,
) {
  const tl = gsap.timeline({ onComplete: onDone });
  const P = (v: number, d: number, ease: string, at: number | string) =>
    tl.to(s, { pull: v, duration: d, ease }, at);

  tl.to(dom.loader, { opacity: 0, y: 12, duration: 0.5, ease: "power2.in" }, 0)
    // Something's wrong: space starts to warp and rumble, and he looks behind him.
    .to(s, { hole: 0.07, duration: 0.9, ease: "sine.inOut" }, 0.1)
    .to(s, { shake: 0.18, duration: 0.6 }, 0.2)
    .to(s, { look: 1, duration: 0.7, ease: "power2.inOut" }, 0.3)
    // The black hole bursts open behind him.
    .to(s, { flash: 1, duration: 0.1, ease: "power2.out" }, 1.05)
    .to(s, { flash: 0, duration: 1.1, ease: "power2.out" }, 1.17)
    .to(s, { hole: 1, duration: 0.95, ease: "expo.out" }, 1.05)
    .to(s, { ignite: 0.3, duration: 0.12, ease: "power2.out" }, 1.05)
    .to(s, { ignite: 0.05, duration: 1.2, ease: "power2.out" }, 1.2)
    .to(s, { shake: 1, duration: 0.08 }, 1.05)
    .to(s, { shake: 0.3, duration: 0.8, ease: "power2.out" }, 1.15);
  const yank = (at: number, to: number, kick: number) => {
    P(to, 0.32, "power4.out", at);
    tl.to(s, { jolt: kick, duration: 0.08, ease: "power2.out" }, at)
      .to(s, { jolt: 0, duration: 0.6, ease: "elastic.out(1, 0.45)" }, at + 0.08)
      .to(s, { shake: 0.9 + kick * 0.3, duration: 0.06 }, at)
      .to(s, { shake: 0.35, duration: 0.5 }, at + 0.1)
      .to(s, { flash: 0.18, duration: 0.06 }, at)
      .to(s, { flash: 0, duration: 0.4 }, at + 0.06);
  };
  // Yanked backwards; he spins round to face us and fights it, thrusters blazing, and claws back.
  yank(1.1, 0.19, 0.8);
  tl.to(s, { fight: 1, duration: 0.4, ease: "back.out(2.2)" }, 1.35).to(
    s,
    { thrust: 1, duration: 0.15, ease: "power2.out" },
    1.45,
  );
  P(0.12, 0.75, "sine.inOut", 1.45);
  // Dragged further, harder; he claws back, less.
  yank(2.2, 0.33, 1);
  P(0.28, 0.55, "sine.inOut", 2.52);
  yank(3.05, 0.42, 1.1);
  // His thrusters sputter and die.
  tl.to(s, { thrust: 0.35, duration: 0.3, ease: "power1.in" }, 3.2).to(
    s,
    { thrust: 0, duration: 0.2 },
    3.5,
  );
  // Ripped away: whipped round the hole, stretched, tumbling, the view shaking hard.
  P(0.93, 1.25, "power2.in", 3.45);
  tl.to(s, { shake: 1.2, duration: 1.1, ease: "power1.in" }, 3.45)
    .to(s, { ignite: 0.12, duration: 1.1, ease: "power1.in" }, 3.45)
    // At the edge: slowing, reddening, frozen, gone.
    .to(s, { pull: 0.998, duration: 0.95, ease: "expo.out" }, 4.7)
    .to(s, { ignite: 0, duration: 0.4 }, 4.7)
    .to(s, { shake: 0.4, duration: 0.6 }, 4.7)
    // Dragged in after him, rolling, until the shadow is everything.
    .to(s, { dive: 1, duration: 0.85, ease: "power2.in" }, 5.45)
    .to(s, { shake: 1.2, duration: 0.85, ease: "power2.in" }, 5.45);

  // The far side: a white hole opens from the hero's black hole, and out he comes.
  tl.add(() => {
    // Wake the hero first (it rests while it's covered), then open onto it.
    document.documentElement.dataset.introReveal = "";
    const at = locate() ?? { x: window.innerWidth * 0.6, y: window.innerHeight * 0.42 };
    s.from = at;
    s.far = true;
    s.shake = 0;
    for (const el of [dom.space, dom.flash, dom.ring]) {
      el.style.setProperty("--hx", `${at.x}px`);
      el.style.setProperty("--hy", `${at.y}px`);
    }
    dom.space.setAttribute("data-open", "");
  }, 6.3);
  const cover = () => Math.hypot(window.innerWidth, window.innerHeight) * 1.05;
  const hole = { r: 0 };
  tl.to(
    hole,
    {
      r: 1,
      duration: 1.25,
      ease: "expo.out",
      onUpdate: () => {
        const r = hole.r * cover();
        dom.space.style.setProperty("--hole", `${r}px`);
        dom.ring.style.width = `${r * 2}px`;
        dom.ring.style.height = `${r * 2}px`;
      },
    },
    6.32,
  )
    // (Not applied until then: a fromTo sets its start the moment it's made, which left the ring
    // showing over the whole fall.)
    .fromTo(
      dom.ring,
      { opacity: 1 },
      { opacity: 0, duration: 1.1, ease: "power2.in", immediateRender: false },
      6.32,
    )
    .fromTo(dom.flash, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.12 }, 6.3)
    .to(dom.flash, { opacity: 0, duration: 1.1, ease: "power2.out" }, 6.42)
    .to(s, { eject: 1, duration: 1.9, ease: "none" }, 6.35)
    .to(dom.stage, { opacity: 0, duration: 0.3 }, 8.05);
  return tl;
}
