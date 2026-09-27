"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useMemo } from "react";
import * as THREE from "three";
import type { DayMix } from "./theme";

/**
 * The hero's sky, drawn by one full-screen shader behind everything else.
 *
 * Night: a deep blue sky with a faint Milky Way, three layers of stars that twinkle (a few of
 * them scintillate through colours, the way low stars do on a cold night), and aurora curtains:
 * a sharp green lower edge, rays that shimmer along the curtain, violet and pink higher up, each
 * curtain folding and drifting in its own direction.
 * Day: a bright sky, deeper blue overhead, warm at the horizon, glare and soft rays around the
 * sun, and slow cirrus.
 *
 * Colours are authored in display space (no tone mapping or colour-space conversion).
 */
const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.9999, 1.0);
}
`;

const fragment = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uDay;
uniform vec2 uRes;
uniform vec2 uSun;
uniform vec4 uText;
uniform vec2 uPointer;

float hash21(vec2 p) {
  p = fract(p * vec2(233.34, 851.73));
  p += dot(p, p + 23.45);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}

const mat2 ROT = mat2(1.6, 1.2, -1.2, 1.6);

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = ROT * p; a *= 0.5; }
  return v;
}

float fbm3(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = ROT * p; a *= 0.5; }
  return v;
}

vec3 hue(float t) { return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67))); }

// Star colour by temperature: blue-white, white, then warm yellow and orange.
vec3 starTint(float h) {
  vec3 c = mix(vec3(0.66, 0.78, 1.0), vec3(1.0), smoothstep(0.0, 0.45, h));
  c = mix(c, vec3(1.0, 0.88, 0.7), smoothstep(0.55, 0.85, h));
  return mix(c, vec3(1.0, 0.72, 0.52), smoothstep(0.9, 1.0, h));
}

// One layer of stars: at most one per grid cell, placed and sized at random.
vec3 starLayer(vec2 px, float cell, float chance, float sizeMax, float gain, float spikes) {
  vec2 g = px / cell;
  vec2 id = floor(g);
  float h = hash21(id);
  if (h > chance) return vec3(0.0);
  vec2 pos = vec2(hash21(id + 11.3), hash21(id + 27.1)) * 0.7 + 0.15;
  vec2 d = (fract(g) - pos) * cell;
  float size = mix(0.45, sizeMax, pow(hash21(id + 5.7), 4.0));
  float r2 = dot(d, d);
  float core = exp(-r2 / (size * size));
  float halo = exp(-sqrt(r2) / (size * 3.5)) * 0.1;
  float speed = 0.6 + 3.0 * hash21(id + 3.1);
  float tw = 0.62 + 0.38 * sin(uTime * speed + h * 61.0) * sin(uTime * speed * 0.41 + h * 17.0);
  vec3 col = starTint(hash21(id + 8.8));
  float scint = step(0.7, hash21(id + 4.4));
  col = mix(col, hue(uTime * 0.18 + h * 9.0) * 1.15, scint * (0.35 + 0.3 * sin(uTime * 1.7 + h * 40.0)));
  float sp = 0.0;
  if (spikes > 0.0) {
    vec2 a = abs(d);
    sp = (exp(-a.x * 1.1) * exp(-a.y / (size * 6.0)) + exp(-a.y * 1.1) * exp(-a.x / (size * 6.0)));
    sp *= spikes * step(0.8, hash21(id + 9.9));
  }
  return col * (core + halo + sp) * tw * gain;
}

// One aurora curtain in aspect-corrected space. The lower edge meanders and drifts sideways at
// the curtain's own speed and direction; rays shimmer along it; colour climbs from green to violet.
vec3 curtain(vec2 p, float seed, float y0, float amp, float spd, float height, float gain, float ang) {
  vec2 c = vec2(0.5 * uRes.x / uRes.y, 0.5);
  float ca = cos(ang);
  float sa = sin(ang);
  p = mat2(ca, -sa, sa, ca) * (p - c) + c;
  float t = uTime;
  float x = p.x + 0.07 * sin(p.y * 5.0 + t * 0.25 + seed);
  float edge = y0 + amp * (fbm3(vec2(x * 0.85 + t * spd, seed)) - 0.5) * 2.0
             + 0.035 * sin(x * 3.3 - t * spd * 6.0 + seed);
  float d = p.y - edge;
  float below = exp(min(d, 0.0) * 70.0);
  float above = exp(-max(d, 0.0) / height) * 0.72 + exp(-max(d, 0.0) / (height * 3.0)) * 0.28;
  float body = d < 0.0 ? below : above;
  float rn = noise(vec2(x * 30.0 + t * spd * 10.0 + seed * 10.0, d * 0.8 - t * 0.1));
  float rf = noise(vec2(x * 95.0 - t * spd * 16.0, d * 2.0));
  float rays = mix(0.6, 1.2, smoothstep(0.15, 0.9, rn)) * (0.88 + 0.2 * rf);
  // Bright folds and dim gaps along the curtain, drifting slower than the rays.
  float folds = smoothstep(0.3, 0.75, fbm3(vec2(x * 1.1 - t * spd * 1.5 + seed * 2.0, seed)));
  float pulse = 0.72 + 0.28 * sin(x * 8.5 - t * (0.9 + abs(spd) * 9.0) * sign(spd) + seed * 3.0);
  float hgt = clamp(d / (height * 2.4), 0.0, 1.0);
  vec3 col = mix(vec3(0.34, 1.0, 0.58), vec3(0.3, 0.96, 0.78), smoothstep(0.0, 0.3, hgt));
  col = mix(col, vec3(0.5, 0.42, 1.0), smoothstep(0.3, 0.8, hgt));
  col = mix(col, vec3(0.9, 0.38, 0.82), smoothstep(0.8, 1.0, hgt) * 0.7);
  col = mix(col, vec3(1.0, 0.4, 0.62), (1.0 - step(0.0, d)) * 0.45);
  // The lower edge burns brightest, almost white-green, as in long exposures.
  col += vec3(0.45, 0.8, 0.55) * exp(-abs(d) * 28.0) * 0.55;
  return col * body * rays * pulse * gain * (0.22 + 0.98 * folds);
}

float rectMask(vec2 uv, vec4 r, float soft) {
  vec2 lo = smoothstep(r.xy - soft, r.xy + soft, uv);
  vec2 hi = 1.0 - smoothstep(r.zw - soft, r.zw + soft, uv);
  return lo.x * lo.y * hi.x * hi.y;
}

vec3 nightSky(vec2 uv, vec2 px, float aspect, float textMask) {
  vec3 col = mix(vec3(0.035, 0.07, 0.12), vec3(0.012, 0.024, 0.055), smoothstep(0.0, 1.0, uv.y));
  col += vec3(0.05, 0.02, 0.08) * (1.0 - uv.y) * 0.7;
  col += vec3(0.03, 0.11, 0.07) * exp(-uv.y * 5.0);

  // Milky Way: a faint diagonal band of dust with more stars in it.
  vec2 q = vec2(uv.x * aspect, uv.y);
  float band = abs(dot(q - vec2(0.2, 0.95), normalize(vec2(0.55, 1.0))));
  float mw = exp(-band * band * 18.0) * (0.35 + 0.65 * fbm(q * 3.0 + 4.0));
  col += vec3(0.1, 0.1, 0.17) * mw * 0.55;

  vec3 stars = starLayer(px + uPointer * 3.0, 6.0, 0.08 + 0.12 * mw, 0.7, 0.55, 0.0)
             + starLayer(px + uPointer * 7.0, 23.0, 0.32, 1.1, 0.9, 0.0)
             + starLayer(px + uPointer * 12.0, 97.0, 0.55, 1.9, 1.25, 1.0);

  vec3 aur = curtain(q, 1.7, 0.6, 0.2, 0.035, 0.2, 1.25, 0.12)
           + curtain(q, 5.3, 0.4, 0.24, -0.028, 0.26, 1.0, -0.1)
           + curtain(q, 9.1, 0.8, 0.14, 0.02, 0.14, 0.7, 0.34);
  aur += vec3(0.08, 0.35, 0.2) * smoothstep(0.45, 0.8, fbm3(q * 1.5 + vec2(uTime * 0.01, 0.0))) * 0.35;
  aur *= mix(1.0, 0.24, textMask) * smoothstep(0.0, 0.18, uv.y) * mix(0.55, 1.0, smoothstep(0.1, 0.75, uv.x));
  aur = 1.0 - exp(-aur * 1.35);

  float glow = dot(aur, vec3(0.3, 0.6, 0.1));
  return col + stars * (1.0 - clamp(glow * 1.6, 0.0, 0.85)) + aur;
}

vec3 daySky(vec2 uv, float aspect, float textMask) {
  vec3 col = mix(vec3(1.0, 0.92, 0.82), vec3(0.58, 0.8, 1.0), smoothstep(0.0, 0.45, uv.y));
  col = mix(col, vec3(0.2, 0.5, 0.96), smoothstep(0.45, 1.05, uv.y));

  vec2 sd = (uv - uSun) * vec2(aspect, 1.0);
  float r = length(sd);
  float a = atan(sd.y, sd.x);
  col += vec3(1.0, 0.86, 0.6) * exp(-r * 3.2) * 0.5;
  col += vec3(1.0, 0.97, 0.9) * exp(-r * 14.0) * 0.6;
  float rays = fbm3(vec2(a * 5.0, uTime * 0.04)) * fbm3(vec2(a * 13.0 + 3.0, uTime * 0.07));
  col += vec3(1.0, 0.92, 0.75) * pow(rays, 1.5) * exp(-r * 1.6) * 0.55;

  vec2 cp = vec2(uv.x * aspect, uv.y) * vec2(1.4, 5.0) + vec2(uTime * 0.012, 0.0);
  float cl = fbm(cp + fbm3(cp * 0.6 + uTime * 0.01) * 1.4);
  cl = smoothstep(0.52, 0.86, cl) * smoothstep(0.15, 0.7, uv.y);
  col = mix(col, vec3(1.0, 0.99, 0.97), cl * 0.6);

  return mix(col, vec3(0.97, 0.98, 1.0), textMask * 0.42);
}

void main() {
  vec2 uv = vUv;
  vec2 px = uv * uRes;
  float aspect = uRes.x / uRes.y;
  float textMask = rectMask(uv, uText, 0.12);

  vec3 col;
  if (uDay < 0.001) col = nightSky(uv, px, aspect, textMask);
  else if (uDay > 0.999) col = daySky(uv, aspect, textMask);
  else {
    col = mix(nightSky(uv, px, aspect, textMask), daySky(uv, aspect, textMask), smoothstep(0.0, 1.0, uDay));
    col += vec3(1.0, 0.45, 0.2) * exp(-uv.y * 4.0) * sin(uDay * 3.14159) * 0.35;
  }

  col += (hash21(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * Full-screen sky behind the hero scene. `sun` is the object whose screen position the day sky's
 * glare follows; `text` is the headline column, where the sky quietens so the copy stays readable.
 */
export function SkyBackdrop({
  mix,
  still,
  sun,
  text,
}: {
  mix: DayMix;
  still: boolean;
  sun: RefObject<THREE.Object3D | null>;
  text: RefObject<HTMLElement | null>;
}) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        uniforms: {
          uTime: { value: 0 },
          uDay: { value: 0 },
          uRes: { value: new THREE.Vector2(1, 1) },
          uSun: { value: new THREE.Vector2(0.7, 0.6) },
          uText: { value: new THREE.Vector4(0, 0, 0, 0) },
          uPointer: { value: new THREE.Vector2() },
        },
      }),
    [],
  );
  const gl = useThree((s) => s.gl);
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    const u = material.uniforms;
    if (!still) (u.uTime as THREE.IUniform<number>).value = state.clock.elapsedTime + 40;
    (u.uDay as THREE.IUniform<number>).value = mix.current;
    (u.uRes as THREE.IUniform<THREE.Vector2>).value.set(state.size.width, state.size.height);
    (u.uPointer as THREE.IUniform<THREE.Vector2>).value.lerp(state.pointer, 0.04);

    if (sun.current) {
      sun.current.getWorldPosition(v).project(state.camera);
      (u.uSun as THREE.IUniform<THREE.Vector2>).value.set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
    }
    const el = text.current;
    if (el) {
      const c = gl.domElement.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      (u.uText as THREE.IUniform<THREE.Vector4>).value.set(
        (r.left - c.left) / c.width,
        1 - (r.bottom - c.top) / c.height,
        (r.right - c.left) / c.width,
        1 - (r.top - c.top) / c.height,
      );
    }
  });

  return (
    <mesh frustumCulled={false} renderOrder={-1000} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
