"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { registerSunLocator } from "@/lib/edition";
import { HOLE_RADIUS } from "./black-hole";
import type { LayoutRef } from "./layout";
import { SUN_RADIUS } from "./sun";
import { auroraPhase, type DayMix } from "./theme";
import { holdWarmup } from "./warm";

/**
 * The hero's sky, drawn by one full-screen shader behind everything else.
 *
 * Night: a deep blue sky with drifting nebula clouds, a faint Milky Way, three layers of stars
 * that twinkle (some scintillating through colours), shooting stars, and aurora curtains: a sharp
 * bright lower edge, rays shimmering along the curtain, waves rolling through it in both
 * directions, and colours that cycle from green through cyan and magenta to pink and violet
 * (in step with the page's nebula, via the wall clock). Around the black hole the sky is bent by
 * its gravity, like a lens: stars and cloud near it curve around the shadow.
 * Day: dawn, seen from orbit. We hang just above a world wrapped in cloud, looking along its
 * horizon as the sun clears the limb: space and stars above; the atmosphere as a thin band of light
 * along the curve of the world, white-gold under the sun and teal away from it; below, a sea of
 * cloud tops lit from the side, glowing orange toward the sun and mauve in shadow near us,
 * streaming toward us as we orbit; and the sun's light in the lens, a starburst, a streak along
 * the horizon and faint ghosts. The horizon rides just under the sun wherever the scene puts it.
 * Switching editions, the new sky rises from the horizon up, with a warm band and a flare from the
 * sun while it changes.
 *
 * The heavy parts return early where they can't show (mountains high in the sky, the river away
 * from its band, a curtain far below its edge), so the shader costs only what's on screen. And
 * the soft, costly layers (cloud, river, aurora, mountains; the dawn and its cloud sea) are drawn
 * at half size and scaled up,
 * a quarter of the pixels, with only the sharp ones (the stars) drawn at full size over them: on
 * a laptop's integrated graphics the whole sky at full size took most of each frame.
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

// Uniforms and functions both passes use.
const common = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uDay;
uniform vec2 uCentre;
uniform float uHoleR;
uniform float uPhase;
uniform float uScroll;
uniform vec2 uRes;
uniform vec2 uSun;
uniform vec4 uText;
uniform vec2 uPointer;
uniform float uSunR;
uniform sampler2D uCloudMap;
uniform float uDescent;

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

// Cycle a -> b -> c -> a as t runs 0..1.
vec3 cycle(vec3 a, vec3 b, vec3 c, float t) {
  float x = fract(t) * 3.0;
  if (x < 1.0) return mix(a, b, smoothstep(0.0, 1.0, x));
  if (x < 2.0) return mix(b, c, smoothstep(0.0, 1.0, x - 1.0));
  return mix(c, a, smoothstep(0.0, 1.0, x - 2.0));
}

// Cosmic storm colours: electric cyan and blue low, violet and magenta higher up.
vec3 auroraLow(float t) { return cycle(vec3(0.25, 0.85, 0.95), vec3(0.35, 0.55, 1.0), vec3(1.0, 0.42, 0.75), t); }
vec3 auroraMid(float t) { return cycle(vec3(0.42, 0.5, 1.0), vec3(0.66, 0.42, 1.0), vec3(0.9, 0.4, 0.95), t); }
vec3 auroraHigh(float t) { return cycle(vec3(0.62, 0.38, 1.0), vec3(0.95, 0.38, 0.82), vec3(0.4, 0.5, 1.0), t); }

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
  float scint = step(0.66, hash21(id + 4.4));
  col = mix(col, hue(uTime * 0.18 + h * 9.0) * 1.2, scint * (0.4 + 0.3 * sin(uTime * 1.7 + h * 40.0)));
  float sp = 0.0;
  if (spikes > 0.0) {
    vec2 a = abs(d);
    sp = (exp(-a.x * 1.1) * exp(-a.y / (size * 6.0)) + exp(-a.y * 1.1) * exp(-a.x / (size * 6.0)));
    sp *= spikes * step(0.8, hash21(id + 9.9));
  }
  return col * (core + halo + sp) * tw * gain;
}

// Shooting stars: three slots, each firing now and then on its own schedule and heading.
vec3 meteors(vec2 px) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float period = 4.5 + fi * 3.3;
    float tt = uTime + fi * 2.1;
    float n = floor(tt / period);
    float life = fract(tt / period) * period;
    float dur = 1.0;
    if (life > dur || hash21(vec2(n, fi + 1.3)) > 0.75) continue;
    float h1 = hash21(vec2(n * 1.7, fi * 7.1));
    float h2 = hash21(vec2(fi * 3.3, n * 0.9));
    vec2 start = vec2(mix(0.25, 1.05, h1) * uRes.x, mix(0.6, 1.02, h2) * uRes.y);
    float ang = radians(198.0 + h2 * 34.0);
    vec2 dir = vec2(cos(ang), sin(ang));
    float k = life / dur;
    vec2 head = start + dir * uRes.x * 0.55 * life;
    float tail = 190.0 * smoothstep(0.0, 0.35, k);
    vec2 d = px - head;
    float along = dot(d, -dir);
    float across = abs(dot(d, vec2(-dir.y, dir.x)));
    float inTail = step(0.0, along) * (1.0 - smoothstep(0.0, tail, along));
    float line = exp(-across * across / 1.2) * inTail * (1.0 - along / max(tail, 1.0));
    float headGlow = exp(-dot(d, d) / 5.0);
    float fade = smoothstep(0.0, 0.12, k) * (1.0 - smoothstep(0.65, 1.0, k));
    acc += mix(vec3(0.8, 0.95, 1.0), auroraLow(uPhase), 0.25) * (line + headGlow * 1.4) * fade;
  }
  return acc;
}

// One aurora curtain in aspect-corrected space. Its lower edge rolls with waves travelling both
// ways, it billows and folds, rays shimmer along it, and its colours ride the cycle.
vec3 curtain(vec2 p, float seed, float y0, float amp, float spd, float height, float gain, float ang, float phase) {
  vec2 c = vec2(0.5 * uRes.x / uRes.y, 0.5);
  float ca = cos(ang);
  float sa = sin(ang);
  p = mat2(ca, -sa, sa, ca) * (p - c) + c;
  float t = uTime;
  float x = p.x + 0.09 * sin(p.y * 4.5 + t * 0.45 + seed) + 0.035 * sin(p.y * 9.0 - t * 0.7 + seed);
  float waves = 0.06 * sin(x * 2.4 - t * 0.55 + seed) + 0.032 * sin(x * 5.3 + t * 0.85 + seed * 2.0)
              + 0.015 * sin(x * 11.0 - t * 1.6 + seed * 3.0);
  float edge = y0 + amp * (fbm3(vec2(x * 0.85 + t * spd, seed)) - 0.5) * 2.0 + waves;
  float d = p.y - edge;
  // Well below the lower edge the curtain has faded to nothing.
  if (d < -0.1) return vec3(0.0);
  float h = height * (0.8 + 0.4 * (0.5 + 0.5 * sin(x * 1.7 - t * 0.4 + seed)));
  float below = exp(min(d, 0.0) * 70.0);
  float above = exp(-max(d, 0.0) / h) * 0.72 + exp(-max(d, 0.0) / (h * 3.0)) * 0.28;
  float body = d < 0.0 ? below : above;
  float rn = noise(vec2(x * 30.0 + t * spd * 10.0 + seed * 10.0, d * 0.8 - t * 0.1));
  float rf = noise(vec2(x * 95.0 - t * spd * 16.0, d * 2.0));
  float rays = mix(0.6, 1.2, smoothstep(0.15, 0.9, rn)) * (0.88 + 0.2 * rf);
  float folds = smoothstep(0.3, 0.75, fbm3(vec2(x * 1.1 - t * spd * 1.5 + seed * 2.0, seed)));
  float pulse = 0.72 + 0.28 * sin(x * 8.5 - t * (0.9 + abs(spd) * 9.0) * sign(spd) + seed * 3.0);
  float hgt = clamp(d / (h * 2.4), 0.0, 1.0);
  vec3 col = mix(auroraLow(phase), auroraMid(phase), smoothstep(0.05, 0.35, hgt));
  col = mix(col, auroraHigh(phase), smoothstep(0.35, 0.85, hgt));
  col = mix(col, vec3(1.0, 0.4, 0.62), (1.0 - step(0.0, d)) * 0.4);
  col += mix(vec3(0.45, 0.8, 0.55), auroraLow(phase), 0.5) * exp(-abs(d) * 28.0) * 0.55;
  return col * body * rays * pulse * gain * (0.22 + 0.98 * folds);
}

// Bioluminescent sparks: small blue-white points, twinkling as they drift.
vec3 sparks(vec2 px, float cell, float chance) {
  vec2 g = px / cell;
  vec2 id = floor(g);
  float h = hash21(id + 31.7);
  if (h > chance) return vec3(0.0);
  vec2 pos = vec2(hash21(id + 5.1), hash21(id + 9.3)) * 0.7 + 0.15;
  vec2 d = (fract(g) - pos) * cell;
  float size = mix(0.6, 1.8, pow(hash21(id + 2.2), 3.0));
  float core = exp(-dot(d, d) / (size * size));
  float halo = exp(-length(d) / (size * 4.0)) * 0.35;
  float tw = 0.55 + 0.45 * sin(uTime * (1.5 + 3.0 * h) + h * 40.0);
  return mix(vec3(0.35, 0.7, 1.0), vec3(0.85, 0.95, 1.0), hash21(id + 7.7)) * (core + halo) * tw;
}

// The cosmic river: a diagonal storm of cloud rising from the mountains to the top right, violet
// and indigo billows around a molten amber core, rust cloud banks on its far shore, blue sparks
// carried along it, and now and then a star igniting mid-stream. Returns colour and coverage.
vec4 cosmicRiver(vec2 q, vec2 px, float aspect) {
  vec2 o = vec2(0.5 * aspect, -0.08);
  vec2 dir = normalize(vec2(0.62, 1.0));
  vec2 nrm = vec2(-dir.y, dir.x);
  vec2 r = q - o;
  float s = dot(r, dir);
  float u = dot(r, nrm) + 0.13 * sin(s * 3.1 - 0.5) + 0.04 * sin(s * 7.0 + uTime * 0.06);
  float span = smoothstep(-0.02, 0.28, s) * smoothstep(1.5, 1.0, s);
  // Outside its band (and past the far shore's cloud banks) the river adds nothing.
  if (span <= 0.0 || u < -0.8 || u > 0.7) return vec4(0.0);

  float t = uTime * 0.03;
  vec2 fp = vec2(s * 2.2 - t, u * 4.6);
  vec2 warp = vec2(fbm3(fp * 0.7 + vec2(3.0, t)), fbm3(fp * 0.7 - vec2(5.0, t * 0.7)));
  float n = fbm(fp + warp * 1.7);
  float n2 = fbm(fp * 2.1 + warp * 2.4 + 11.0);

  float width = 0.2 + 0.07 * sin(s * 2.1 + 1.0);
  float body = exp(-(u * u) / (width * width)) * span;
  // Billows with layered, stepped edges, like smoke painted in strokes.
  float billow = smoothstep(0.34, 0.6, n) * body;
  float strokes = smoothstep(0.48, 0.52, fract(n2 * 3.0)) * 0.25 + 0.75;
  float coreLine = u + (n - 0.5) * 0.1;
  float core = exp(-(coreLine * coreLine) / 0.0022) * smoothstep(0.4, 0.72, n)
             * smoothstep(0.15, 0.45, s) * smoothstep(1.15, 0.7, s);

  vec3 indigo = vec3(0.16, 0.13, 0.45);
  vec3 violet = vec3(0.46, 0.3, 0.9);
  vec3 lilac = vec3(0.72, 0.5, 1.0);
  vec3 amber = vec3(1.0, 0.56, 0.14);
  vec3 rust = vec3(0.36, 0.15, 0.08);
  vec3 col = mix(indigo, violet, smoothstep(0.42, 0.7, n));
  col = mix(col, lilac, smoothstep(0.66, 0.82, n2) * 0.5);
  col *= billow * strokes * 1.25;

  // Rust cloud banks on the far shore.
  float shore = smoothstep(0.08, 0.3, u) * (1.0 - smoothstep(0.34, 0.62, u)) * span;
  float bank = smoothstep(0.42, 0.66, fbm(vec2(s * 3.0 + t * 0.6, u * 6.0) + warp + 20.0)) * shore;
  col += rust * bank * 1.1;

  col += amber * core * 1.7 + vec3(1.0, 0.82, 0.5) * core * core * 0.8;

  // Sparks carried downstream.
  vec2 flow = dir * uTime * 16.0 * uRes.y / 900.0;
  vec3 sp = (sparks(px - flow, 13.0, 0.28) + sparks(px - flow * 1.6 + 400.0, 29.0, 0.4) * 1.4)
          * smoothstep(0.3, 0.65, n) * body;

  // A star ignites mid-stream every 14 seconds, then scatters into sparks.
  float cycleT = mod(uTime, 14.0);
  float life = cycleT / 2.6;
  vec3 burst = vec3(0.0);
  if (life < 1.0) {
    vec2 bc = o + dir * 0.86 + nrm * 0.02;
    float d = length(q - bc);
    float rise = smoothstep(0.0, 0.25, life) * (1.0 - smoothstep(0.35, 1.0, life));
    float radius = 0.05 + life * 0.22;
    burst = vec3(0.4, 0.75, 1.0) * exp(-d * d / (radius * radius)) * rise * 1.4
          + vec3(0.85, 0.95, 1.0) * exp(-d * d / 0.0012) * rise * 1.2;
    burst += sparks(px + vec2(uTime * 7.0), 9.0, 0.5) * exp(-d / radius) * rise * 2.0;
  }

  float cover = clamp(billow * 0.85 + bank * 0.6 + core, 0.0, 1.0);
  return vec4(col + sp * 1.3 + burst, cover);
}

// Ridged noise for mountain crests.
float ridged(float x) {
  return 1.0 - abs(noise(vec2(x, 0.37)) * 2.0 - 1.0);
}
float ridgeLine(float x) {
  float h = 0.0;
  float a = 0.5;
  float f = 1.0;
  for (int i = 0; i < 5; i++) { h += a * ridged(x * f); f *= 2.13; a *= 0.48; }
  return h;
}

float farRange(float x) { return 0.07 + 0.27 * pow(ridgeLine(x * 1.05 + 2.0), 2.3); }
float nearRange(float x) { return 0.025 + 0.15 * pow(ridgeLine(x * 1.8 + 9.0), 2.6); }

// Two mountain ranges on the horizon, like the silhouettes in a matte painting: sharp peaks, faces
// turned toward the light catching it (snow on the tallest), a hazy far range and a dark near one.
vec4 mountains(vec2 uv, float aspect, vec4 sky) {
  vec3 col = sky.rgb;
  float x = uv.x * aspect;
  float aa = 1.5 / uRes.y;
  float e = 0.004;
  float rock = fbm3(vec2(x * 11.0, uv.y * 22.0));

  float fx = x + uPointer.x * 0.03;
  float farH = farRange(fx);
  float farSlope = (farRange(fx + e) - farRange(fx - e)) / (2.0 * e);
  float far = smoothstep(farH + aa, farH - aa, uv.y);
  float depthF = clamp((farH - uv.y) * 7.0, 0.0, 1.0);
  // Light catches the faces near the crest only; below that the range falls into haze.
  float litF = smoothstep(0.1, 1.2, -farSlope) * exp(-(farH - uv.y) * 26.0) + fbm3(vec2(x * 5.0, uv.y * 9.0)) * 0.25 * (1.0 - depthF);
  float snowF = smoothstep(0.22, 0.3, farH) * smoothstep(0.05, 0.0, farH - uv.y) * (0.5 + 0.5 * litF);
  vec3 farCol = mix(vec3(0.05, 0.06, 0.16), vec3(0.24, 0.23, 0.55), litF * 0.9 + rock * 0.12);
  farCol = mix(farCol, vec3(0.5, 0.52, 0.85), snowF * 0.6);
  col = mix(col, farCol, far * 0.96);
  float show = sky.a * (1.0 - far * 0.96);
  col += vec3(0.3, 0.26, 0.7) * exp(-abs(uv.y - farH) * 110.0) * 0.16;

  float nx = x + uPointer.x * 0.08;
  float nearH = nearRange(nx);
  float nearSlope = (nearRange(nx + e) - nearRange(nx - e)) / (2.0 * e);
  float near = smoothstep(nearH + aa, nearH - aa, uv.y);
  float depthN = clamp((nearH - uv.y) * 9.0, 0.0, 1.0);
  float litN = smoothstep(0.1, 1.4, -nearSlope) * exp(-(nearH - uv.y) * 34.0) + fbm3(vec2(x * 6.0, uv.y * 11.0)) * 0.2 * (1.0 - depthN);
  vec3 nearCol = mix(vec3(0.015, 0.02, 0.05), vec3(0.13, 0.12, 0.33), litN * 0.9 + rock * 0.1);
  return vec4(mix(col, nearCol, near), show * (1.0 - near));
}

float rectMask(vec2 uv, vec4 r, float soft) {
  vec2 lo = smoothstep(r.xy - soft, r.xy + soft, uv);
  vec2 hi = 1.0 - smoothstep(r.zw - soft, r.zw + soft, uv);
  return lo.x * lo.y * hi.x * hi.y;
}

// The soft, costly part of the night sky: the gradient, the cosmic river, the Milky Way's dust and
// the aurora. Returns its colour and how much of the stars still show through it.
vec4 nightClouds(vec2 uv, vec2 px, float aspect, float textMask) {
  vec3 col = mix(vec3(0.05, 0.045, 0.14), vec3(0.018, 0.016, 0.06), smoothstep(0.0, 1.0, uv.y));
  col += vec3(0.07, 0.03, 0.1) * (1.0 - uv.y) * 0.7;

  vec2 q = vec2(uv.x * aspect, uv.y - uScroll * 0.06);

  // The cosmic river, kept away from the headline.
  vec4 river = cosmicRiver(q, px, aspect);
  float riverKeep = 1.0 - textMask * 0.75;
  col = mix(col, col * 0.3, river.a * 0.6 * riverKeep);
  col += river.rgb * riverKeep;

  // Milky Way: a faint diagonal band of dust with more stars in it.
  float band = abs(dot(q - vec2(0.2, 0.95), normalize(vec2(0.55, 1.0))));
  float mw = exp(-band * band * 18.0) * (0.35 + 0.65 * fbm(q * 3.0 + 4.0));
  col += vec3(0.1, 0.1, 0.17) * mw * 0.55;
  col += auroraLow(uPhase) * 0.05 * exp(-uv.y * 5.0);

  vec3 aur = curtain(q, 1.7, 0.6, 0.2, 0.035, 0.2, 1.25, 0.12, uPhase)
           + curtain(q, 5.3, 0.4, 0.24, -0.028, 0.26, 1.0, -0.1, uPhase + 0.09)
           + curtain(q, 9.1, 0.8, 0.14, 0.02, 0.14, 0.7, 0.34, uPhase + 0.18);
  aur += auroraMid(uPhase) * 0.1 * smoothstep(0.45, 0.8, fbm3(q * 1.5 + vec2(uTime * 0.01, 0.0)));
  aur *= mix(1.0, 0.24, textMask) * smoothstep(0.0, 0.18, uv.y) * mix(0.55, 1.0, smoothstep(0.1, 0.75, uv.x));
  aur = 1.0 - exp(-aur * 1.35);

  float glow = dot(aur, vec3(0.3, 0.6, 0.1));
  float hide = clamp(glow * 1.6 + river.a * 0.8, 0.0, 0.9);
  return vec4(col + aur * (1.0 - river.a * 0.7), 1.0 - hide);
}

// The sharp part: three layers of stars and the shooting stars, drawn at full size over the clouds.
vec3 nightStars(vec2 uv, vec2 px, float aspect, float textMask) {
  vec2 q = vec2(uv.x * aspect, uv.y - uScroll * 0.06);
  // More stars along the Milky Way's band.
  float band = abs(dot(q - vec2(0.2, 0.95), normalize(vec2(0.55, 1.0))));
  float mw = exp(-band * band * 18.0) * 0.68;
  vec2 drift = vec2(0.0, uScroll * 90.0);
  vec3 stars = starLayer(px + uPointer * 3.0 + drift * 0.3, 6.0, 0.08 + 0.12 * mw, 0.7, 0.55, 0.0)
             + starLayer(px + uPointer * 7.0 + drift * 0.6, 23.0, 0.32, 1.1, 0.9, 0.0)
             + starLayer(px + uPointer * 12.0 + drift, 97.0, 0.55, 1.9, 1.25, 1.0);
  return stars + meteors(px) * (1.0 - textMask * 0.7);
}



// Gravitational lensing by the black hole, as a thin point-mass lens: each pixel shows the sky
// from where its light really started. Near the Einstein radius that stretches stars into arcs
// hugging the shadow; further out the bend fades away.
vec2 lens(vec2 px) {
  vec2 hole = uSun * uRes;
  vec2 d = px - hole;
  float r2 = max(dot(d, d), 1.0);
  float re = uHoleR * 1.75;
  // Capped short of the singular ring, where bright cloud would smear into thin circles.
  float k = min(re * re / r2, 0.55) * smoothstep(re * 7.0, re * 2.2, sqrt(r2));
  return hole + d * (1.0 - k);
}

// ── By day: dawn, seen from orbit ─────────────────────────────────────────────────────────────
// The view from just above a world wrapped in cloud, looking along its horizon at the sun as it
// clears the limb. Above, space; along the curve of the world, the atmosphere as a thin band of
// light, white-gold toward the sun and teal away from it; below, a sea of cloud tops lit from the
// side, glowing orange toward the sun and falling into mauve shadow nearer us, streaming toward us
// as we orbit. The camera looks toward the sun, so the horizon rides just under it wherever the
// scene puts it.

const float WORLD_R = 1.0;
// How high we are above the cloud tops (as a fraction of the world's radius).
const float ALT = 0.0045;

const vec3 SPACE = vec3(0.006, 0.012, 0.034);
const vec3 DEEP_BLUE = vec3(0.02, 0.075, 0.2);
const vec3 TEAL = vec3(0.1, 0.5, 0.64);
const vec3 SUN_GOLD = vec3(1.0, 0.74, 0.36);
const vec3 EMBER = vec3(1.0, 0.44, 0.15);
const vec3 MAUVE = vec3(0.32, 0.16, 0.25);
const vec3 PLUM = vec3(0.085, 0.045, 0.08);

// How high we are right now (it drops during the descent).
float viewAlt = ALT;

// The ray through a point on screen, the sun's direction, and the horizon's height on screen.
// During the descent we lose height and tip the view down, so the horizon climbs out of the top
// of the frame and the clouds come up toward us.
void orbitView(vec2 uv, float aspect, out vec3 ro, out vec3 rd, out vec3 sunDir, out float hy) {
  float sunR = uSunR / uRes.y;
  float hy0 = clamp(uCentre.y - sunR * 0.62, 0.14, 0.74);
  hy = mix(hy0, 1.4, smoothstep(0.0, 0.6, uDescent));
  viewAlt = ALT * mix(1.0, 0.2, smoothstep(0.05, 0.8, uDescent));
  float dip = sqrt(2.0 * viewAlt / WORLD_R);
  vec3 f = vec3(0.0, -sin(dip), cos(dip));
  vec3 up = vec3(0.0, cos(dip), sin(dip));
  vec3 right = vec3(1.0, 0.0, 0.0);
  // 2 tan(fov / 2): about 50 degrees from the bottom of the screen to the top.
  const float K = 0.95;
  vec2 look = uPointer * vec2(0.02, 0.01);
  vec2 s = (vec2((uv.x - uCentre.x) * aspect, uv.y - hy) + look) * K;
  ro = vec3(0.0, WORLD_R + viewAlt, 0.0);
  rd = normalize(f + up * s.y + right * s.x);
  vec2 ss = (vec2(0.0, uCentre.y - hy0) + look) * K;
  sunDir = normalize(f + up * ss.y + right * ss.x);
}

// The cloud tops' height at a point on the world: the map (public/art/cloud-tops.webp, made by
// scripts/make-cloud-tops.mjs), with a slower, larger read of the same map raising and lowering
// whole fields of heaps, so its tiling never shows.
float cloudHeight(vec2 q) {
  float h = texture2D(uCloudMap, q * 0.085).r;
  float swell = texture2D(uCloudMap, q * 0.0173 + vec2(0.37, 0.61)).r;
  // Close up (coming down through the descent), the finer puffs of the heads themselves.
  float near = smoothstep(0.15, 0.7, uDescent);
  float fine = texture2D(uCloudMap, q * 0.61 + vec2(0.13, 0.71)).r - 0.5;
  float finer = texture2D(uCloudMap, q * 2.3 + vec2(0.57, 0.29)).r - 0.5;
  return h * (0.45 + 0.8 * swell) + (fine * 0.34 + finer * 0.14) * near * h;
}

// How far above the world's surface a ray passes at its closest (in heights of ours): 0 on the
// limb, negative for rays that come down into the clouds.
float limbHeight(vec3 ro, vec3 rd) {
  float b = dot(ro, rd);
  float closest = b < 0.0 ? sqrt(max(dot(ro, ro) - b * b, 0.0)) : length(ro);
  return (closest - WORLD_R) / viewAlt;
}

// How near the sun a direction is along the horizon: warm light gathers under and around it.
float sunwardOf(vec3 rd, vec3 sunDir) {
  return exp(-abs(atan(rd.x, rd.z) - atan(sunDir.x, sunDir.z)) * 2.2);
}

// The dawn sky (colour) and how much of the stars show (alpha).
vec4 dawnSky(vec2 uv, float aspect, float textMask) {
  vec3 ro;
  vec3 rd;
  vec3 sunDir;
  float hy;
  orbitView(uv, aspect, ro, rd, sunDir, hy);
  float toSun = max(dot(rd, sunDir), 0.0);
  float sunward = sunwardOf(rd, sunDir);
  // Quieter behind the headline.
  float hush = 1.0 - textMask * 0.55;

  float b = dot(ro, rd);
  float c = dot(ro, ro) - WORLD_R * WORLD_R;
  float disc = b * b - c;
  float t = disc > 0.0 ? -b - sqrt(disc) : -1.0;

  // The cloud tops, read for every pixel (the map's filtering needs whole blocks of pixels to
  // agree), used only below the limb. Where the view misses the world, a point on the horizon.
  float tc = t > 0.0 ? t : sqrt(2.0 * viewAlt);
  vec3 P = ro + rd * tc;
  // As we orbit, the clouds stream toward us (and drift a little sideways).
  vec2 q = P.xz * 560.0 + vec2(uTime * 0.12, -uTime * 1.0);
  // Normals from nearby heights, the step growing with distance to match the detail left there.
  vec2 fw = fwidth(q);
  float E = max(0.04, max(fw.x, fw.y) * 1.2);
  float h = cloudHeight(q);
  float hx = cloudHeight(q + vec2(E, 0.0));
  float hf = cloudHeight(q + vec2(0.0, E));
  // Is a taller heap standing between this point and the low sun ahead?
  float s1 = cloudHeight(q + vec2(0.0, 0.45));
  float s2 = cloudHeight(q + vec2(0.0, 1.1));

  if (t <= 0.0) {
    // Above the limb: space, the air's glow along the curve of the world, and the sun's light.
    // (The limb's bright line is drawn sharp, at full size, in the second pass.)
    float hz = max(limbHeight(ro, rd), 0.0);
    float glow = exp(-hz * 3.2);
    vec3 col = mix(SPACE, DEEP_BLUE, exp(-hz * 0.85) * 0.85);
    col += mix(TEAL, SUN_GOLD, sunward) * glow * (0.5 + 0.9 * sunward);
    col += EMBER * pow(toSun, 70.0) * 0.55 + SUN_GOLD * pow(toSun, 900.0) * 1.1;
    float starsShow = 1.0 - smoothstep(0.0, 0.5, glow * (0.4 + sunward) + pow(toSun, 30.0) * 2.0);
    return vec4(col * hush, starsShow);
  }

  // Below it: the cloud sea, lit by the sun low ahead. As we come down onto it the light climbs
  // over the tops and the colours lift toward the bright sky below: peach-white heads, soft lilac
  // shadows (the morning going on while we fall).
  float sunUp = smoothstep(0.05, 0.5, uDescent);
  const float RELIEF = 1.25;
  vec3 n = normalize(vec3((h - hx) / E * RELIEF, 1.0, (h - hf) / E * RELIEF));
  vec3 L = normalize(vec3(sunDir.x, mix(max(sunDir.y, 0.0) + 0.09, 0.8, sunUp), sunDir.z));
  float shade = smoothstep(0.02, 0.14, max(s1 - h - 0.045, s2 - h - 0.12));
  float lit = max(dot(n, L), 0.0) * (1.0 - 0.85 * shade);
  float tops = smoothstep(0.25, 0.75, h);
  float gap = 1.0 - smoothstep(0.08, 0.32, h);
  float forward = pow(toSun, 5.0);
  // In shadow: mauve on the heaps, plum down in the gaps, a little cool skylight on top.
  vec3 shadowHigh = mix(MAUVE * (0.75 + 0.35 * tops), vec3(0.6, 0.55, 0.72), sunUp);
  vec3 shadowLow = mix(PLUM, vec3(0.47, 0.44, 0.61), sunUp);
  vec3 col = mix(shadowHigh, shadowLow, gap);
  col += vec3(0.06, 0.08, 0.17) * n.y * tops * 0.45;
  // In the sun: ember on the lit faces, gold on the crests, stronger toward the sun.
  vec3 warm = mix(EMBER, vec3(1.0, 0.78, 0.6), sunUp);
  vec3 bright = mix(SUN_GOLD, vec3(1.0, 0.95, 0.88), sunUp);
  float power = mix(1.0, 0.55, sunUp);
  col += warm * lit * (0.45 + 1.2 * tops) * (0.65 + 1.0 * forward) * power;
  col += bright * pow(lit, 2.5) * tops * (0.7 + 1.3 * forward) * power;
  // Light through the thin edges of the heaps, toward the sun.
  col += EMBER * forward * smoothstep(0.08, 0.2, h) * (1.0 - tops) * 0.3;
  // Toward the horizon it all becomes one glowing sheet, gold under the sun, rose to the sides.
  float far = 1.0 - exp(-t * 12.0);
  vec3 haze = mix(vec3(0.74, 0.36, 0.38), mix(EMBER * 1.1, SUN_GOLD, 0.5), sunward);
  col = mix(col, haze, far * 0.82);
  // The sun's path across the clouds.
  col += SUN_GOLD * pow(toSun, 36.0) * (0.3 + far) * 0.8;
  return vec4(col * hush, 0.0);
}

// The limb, drawn sharp over the scaled-up sky: a razor line of light where the world meets
// space, white-gold at the sun and ice blue away from it, fading off both sides of the edge.
vec3 limbLine(vec2 uv, float aspect, float textMask) {
  vec3 ro;
  vec3 rd;
  vec3 sunDir;
  float hy;
  orbitView(uv, aspect, ro, rd, sunDir, hy);
  float hz = limbHeight(ro, rd);
  float sunward = sunwardOf(rd, sunDir);
  float line = exp(-abs(hz) * 24.0) + exp(-max(hz, 0.0) * 7.0) * 0.18 * step(0.0, hz);
  return mix(vec3(0.45, 0.8, 1.0), vec3(1.0, 0.92, 0.74), sunward) * line
       * (0.35 + 1.3 * sunward) * (1.0 - textMask * 0.7);
}

// Coming down through the cloud, at the end of the descent: puffs that swell toward us and stream
// past as we scroll, thickening to white, sunlit peach high up and cooler lower down.
vec4 descentMist(vec2 uv, float aspect) {
  float d = uDescent;
  float inside = smoothstep(0.5, 0.74, d);
  if (inside <= 0.0) return vec4(0.0);
  vec2 c = (uv - 0.5) * vec2(aspect, 1.0);
  float cover = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float s = fract(d * 5.0 + fi * 0.25 + uTime * 0.015);
    float scale = exp2(s * 2.5) * 0.9;
    vec2 p = c / scale + vec2(fi * 0.37 + 0.11, fi * 0.61 + 0.23);
    float puff = smoothstep(0.3, 0.72, texture2D(uCloudMap, p * 0.6).r) * sin(3.14159 * s);
    cover = 1.0 - (1.0 - cover) * (1.0 - puff);
  }
  float a = clamp(cover * inside + smoothstep(0.66, 0.84, d), 0.0, 1.0);
  vec3 lit = mix(vec3(1.0, 0.84, 0.7), vec3(0.95, 0.97, 1.0), smoothstep(0.6, 0.86, d));
  return vec4(lit * (0.9 + 0.1 * cover), a);
}

// Light in the lens, over the dawn: a starburst of thin rays from the sun, a streak along the
// horizon, and a few faint ghosts of the sun on the line through the middle of the frame.
vec3 sunFlare(vec2 uv, float aspect) {
  float sunR = max(uSunR / uRes.y, 0.02);
  vec2 d = (uv - uCentre) * vec2(aspect, 1.0);
  float r = length(d);
  float a = atan(d.y, d.x);
  float shimmer = 0.85 + 0.15 * sin(uTime * 1.3 + a * 7.0);
  float spikes = pow(abs(cos(a * 3.0 + 0.35)), 160.0) * exp(-r / (sunR * 3.4))
               + pow(abs(cos(a * 5.0 - 0.6 + uTime * 0.012)), 240.0) * exp(-r / (sunR * 2.0)) * 0.7;
  spikes *= smoothstep(sunR * 0.85, sunR * 1.3, r) * shimmer;
  vec3 col = vec3(1.0, 0.86, 0.66) * spikes * 0.6;
  col += vec3(1.0, 0.6, 0.3) * exp(-abs(d.y) / (sunR * 0.05 + 0.002))
       * exp(-abs(d.x) / (sunR * 5.0 + 0.2)) * 0.3;
  vec2 axis = (vec2(0.5) - uCentre) * vec2(aspect, 1.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 g = d - axis * (0.7 + fi * 0.55);
    float rr = sunR * (0.3 + 0.28 * fi);
    float ghost = smoothstep(rr, rr * 0.6, length(g)) * (0.05 - fi * 0.01);
    col += mix(vec3(1.0, 0.5, 0.25), vec3(0.3, 0.8, 0.9), fi / 2.0) * ghost;
  }
  return col;
}

`;

// How far day has come at a point on screen: it rises from the horizon, the lower sky first.
const dayAt = /* glsl */ `
float dayAt(vec2 uv) {
  return smoothstep(0.0, 1.0, clamp(uDay * 1.7 - 0.35 - (uv.y - 0.5) * 0.7, 0.0, 1.0));
}
`;

// Pass 1, at half resolution: the soft, costly layers of the sky (by night the clouds, river,
// aurora and mountains; by day the dawn and the cloud sea), and how much of the stars show
// through them (alpha).
const cloudsFragment = /* glsl */ `
${common}
${dayAt}
void main() {
  vec2 uv = vUv;
  vec2 px = uv * uRes;
  float aspect = uRes.x / uRes.y;
  float textMask = rectMask(uv, uText, 0.22);
  float dm = dayAt(uv);
  vec4 sky = vec4(0.0);
  if (dm < 0.999) {
    vec2 lp = uHoleR > 0.0 ? lens(px) : px;
    sky = nightClouds(lp / uRes, lp, aspect, textMask);
    // The mountains never reach this high: skip them above their tallest peak.
    if (uv.y < 0.42) sky = mountains(uv, aspect, sky);
  }
  if (dm > 0.001) sky = mix(sky, dawnSky(uv, aspect, textMask), dm);
  gl_FragColor = sky;
}
`;

// Pass 2, full size: the soft layers scaled up, the stars sharp on top, and by day the light of
// the sun in the lens.
const fragment = /* glsl */ `
${common}
${dayAt}
uniform sampler2D uClouds;
void main() {
  vec2 uv = vUv;
  vec2 px = uv * uRes;
  float aspect = uRes.x / uRes.y;
  float textMask = rectMask(uv, uText, 0.22);
  float dm = dayAt(uv);
  vec4 sky = texture2D(uClouds, uv);
  // The black hole bends the stars by night; by day they're where they are.
  vec2 lp = uHoleR > 0.0 && dm < 0.999 ? lens(px) : px;
  vec3 col = sky.rgb + nightStars(lp / uRes, lp, aspect, textMask) * sky.a;
  if (dm > 0.001) col += (sunFlare(uv, aspect) + limbLine(uv, aspect, textMask)) * dm;
  col += (hash21(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;

  // While the edition changes: a warm band along the horizon and a flare from the sun.
  float change = sin(clamp(uDay, 0.0, 1.0) * 3.14159);
  if (change > 0.001) {
    vec2 sd = (uv - uCentre) * vec2(aspect, 1.0);
    float flare = exp(-length(sd) * 2.6) * change * change * 0.7;
    float band = exp(-uv.y * 3.5) * change * 0.25;
    col += vec3(1.0, 0.6, 0.3) * band + vec3(1.0, 0.86, 0.62) * flare;
  }
  // The descent: through the cloud, then the canvas clears onto the page's own bright sky.
  if (dm > 0.001 && uDescent > 0.0) {
    vec4 mist = descentMist(uv, aspect);
    col = mix(col, mist.rgb, mist.a * dm);
  }
  float alpha = 1.0 - smoothstep(0.86, 1.0, uDescent) * dm;
  // Premultiplied: where it clears, the page behind shows through.
  gl_FragColor = vec4(col * alpha, alpha);
}
`;

const CLOUD_MAP = "/art/cloud-tops.webp";
const blankMap = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
blankMap.needsUpdate = true;

/**
 * Full-screen sky behind the hero scene: the night storm, or by day (`mix` → 1) dawn from orbit.
 * `hole` is the black hole, which the sky bends around; `sun` is the sun, which the day's horizon
 * rides under; `centre` is where the sun and the black hole meet, which the flare comes from and
 * which the edition switch opens the new edition from;
 * `layout` says where the headline sits, so the sky quietens there; `scroll` is the intro's
 * progress, for a little parallax; `descent` is the day's descent through the cloud (0 → 1), at
 * the end of which the canvas clears onto the page.
 */
export function SkyBackdrop({
  mix,
  still,
  hole,
  sun,
  centre,
  layout,
  scroll,
  descent,
}: {
  mix: DayMix;
  still: boolean;
  hole: RefObject<THREE.Object3D | null>;
  sun?: RefObject<THREE.Object3D | null>;
  centre: RefObject<THREE.Object3D | null>;
  layout: LayoutRef;
  scroll?: RefObject<number>;
  descent?: RefObject<number>;
}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  // The clouds' half-size pass: its own target, and a scene of one full-screen triangle pair.
  const clouds = useMemo(() => {
    // Half floats where the GPU can draw to them, so the dark gradients don't band when scaled up.
    const half =
      gl.extensions.has("EXT_color_buffer_half_float") ||
      gl.extensions.has("EXT_color_buffer_float");
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: half ? THREE.HalfFloatType : THREE.UnsignedByteType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      generateMipmaps: false,
    });
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return { target, scene, camera };
  }, [gl]);
  const { material, cloudsMaterial } = useMemo(() => {
    // Both passes share one set of uniforms.
    const uniforms = {
      uTime: { value: 0 },
      uDay: { value: 0 },
      uCentre: { value: new THREE.Vector2(0.7, 0.6) },
      uHoleR: { value: 0 },
      uPhase: { value: 0 },
      uScroll: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uSun: { value: new THREE.Vector2(0.7, 0.6) },
      uText: { value: new THREE.Vector4(0, 0, 0, 0) },
      uPointer: { value: new THREE.Vector2() },
      uSunR: { value: 0 },
      uCloudMap: { value: blankMap },
      uDescent: { value: 0 },
      uClouds: { value: clouds.target.texture },
    };
    const pass = {
      vertexShader: vertex,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      transparent: false,
      blending: THREE.NoBlending,
      uniforms,
    };
    return {
      // Drawn first, as an opaque pass, so it never lands on top of the scene.
      material: new THREE.ShaderMaterial({ ...pass, fragmentShader: fragment }),
      cloudsMaterial: new THREE.ShaderMaterial({ ...pass, fragmentShader: cloudsFragment }),
    };
  }, [clouds]);
  // The day's cloud tops (a small height map; until it arrives the clouds are flat).
  useEffect(() => {
    let live = true;
    const loader = new THREE.TextureLoader();
    loader.load(CLOUD_MAP, (map) => {
      if (!live) {
        map.dispose();
        return;
      }
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.colorSpace = THREE.NoColorSpace;
      // Crisp toward the horizon, where the view skims across the clouds.
      map.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
      (cloudsMaterial.uniforms.uCloudMap as THREE.IUniform<THREE.Texture>).value = map;
    });
    return () => {
      live = false;
      const map = (cloudsMaterial.uniforms.uCloudMap as THREE.IUniform<THREE.Texture>).value;
      if (map !== blankMap) map.dispose();
    };
  }, [gl, cloudsMaterial]);
  useEffect(() => {
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), cloudsMaterial);
    quad.frustumCulled = false;
    clouds.scene.add(quad);
    // Compiled in the background, as it's drawn (into its target: a shader drawn to a target
    // differs from one drawn to the screen), and the scene isn't warm until it's ready.
    const was = gl.getRenderTarget();
    gl.setRenderTarget(clouds.target);
    holdWarmup(scene, gl.compileAsync(clouds.scene, clouds.camera));
    gl.setRenderTarget(was);
    return () => {
      clouds.scene.remove(quad);
      quad.geometry.dispose();
    };
  }, [gl, scene, clouds, cloudsMaterial]);
  useEffect(
    () => () => {
      clouds.target.dispose();
      material.dispose();
      cloudsMaterial.dispose();
    },
    [clouds, material, cloudsMaterial],
  );
  const v = useMemo(() => new THREE.Vector3(), []);
  const edge = useMemo(() => new THREE.Vector3(), []);
  const scale = useMemo(() => new THREE.Vector3(), []);
  const seen = useRef(-1);
  // The centre's position on the canvas (0..1, y up), for the edition switch's reveal.
  const onCanvas = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const where = () => {
      const p = onCanvas.current;
      if (!p) return null;
      const c = gl.domElement.getBoundingClientRect();
      return { x: c.left + p.x * c.width, y: c.top + (1 - p.y) * c.height };
    };
    const night = registerSunLocator("night", where);
    const day = registerSunLocator("day", where);
    return () => {
      night();
      day();
    };
  }, [gl]);

  useFrame((state) => {
    const u = material.uniforms as Record<string, THREE.IUniform>;
    if (!still) u.uTime.value = state.clock.elapsedTime + 40;
    u.uDay.value = mix.current ?? 0;
    u.uPhase.value = auroraPhase();
    u.uScroll.value = scroll?.current ?? 0;
    // Eased a touch, so the descent glides with the scroll.
    u.uDescent.value += ((descent?.current ?? 0) - u.uDescent.value) * 0.18;
    if (Math.abs((descent?.current ?? 0) - u.uDescent.value) < 0.0005) {
      u.uDescent.value = descent?.current ?? 0;
    }
    (u.uRes.value as THREE.Vector2).set(state.size.width, state.size.height);
    (u.uPointer.value as THREE.Vector2).lerp(state.pointer, 0.04);

    const h = hole.current;
    if (h) {
      h.getWorldPosition(v);
      // The shadow's radius on screen: project a point on its rim, sideways from the camera.
      edge.setFromMatrixColumn(state.camera.matrixWorld, 0).multiplyScalar(HOLE_RADIUS).add(v);
      v.project(state.camera);
      edge.project(state.camera);
      const sx = v.x * 0.5 + 0.5;
      const sy = v.y * 0.5 + 0.5;
      (u.uSun.value as THREE.Vector2).set(sx, sy);
      u.uHoleR.value = Math.hypot(
        ((edge.x - v.x) * state.size.width) / 2,
        ((edge.y - v.y) * state.size.height) / 2,
      );
    }
    const sn = sun?.current;
    if (sn) {
      // The sun's radius on screen, the same way (it grows as it comes forward by day).
      sn.getWorldPosition(v);
      sn.getWorldScale(scale);
      edge
        .setFromMatrixColumn(state.camera.matrixWorld, 0)
        .multiplyScalar(SUN_RADIUS * scale.x)
        .add(v);
      v.project(state.camera);
      edge.project(state.camera);
      u.uSunR.value = Math.hypot(
        ((edge.x - v.x) * state.size.width) / 2,
        ((edge.y - v.y) * state.size.height) / 2,
      );
    }
    const c = centre.current;
    if (c) {
      c.getWorldPosition(v).project(state.camera);
      const cx = v.x * 0.5 + 0.5;
      const cy = v.y * 0.5 + 0.5;
      (u.uCentre.value as THREE.Vector2).set(cx, cy);
      onCanvas.current = { x: cx, y: cy };
    }

    const L = layout.current;
    if (L && L.version !== seen.current) {
      seen.current = L.version;
      (u.uText.value as THREE.Vector4).set(L.text.x0, L.text.y0, L.text.x1, L.text.y1);
    }

    // The soft layers at half size, ahead of the frame.
    {
      const dpr = state.gl.getPixelRatio();
      const w = Math.max(1, Math.round(state.size.width * dpr * 0.5));
      const h = Math.max(1, Math.round(state.size.height * dpr * 0.5));
      if (clouds.target.width !== w || clouds.target.height !== h) clouds.target.setSize(w, h);
      const before = state.gl.getRenderTarget();
      state.gl.setRenderTarget(clouds.target);
      state.gl.render(clouds.scene, clouds.camera);
      state.gl.setRenderTarget(before);
    }
  });

  return (
    <mesh frustumCulled={false} renderOrder={-1000} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
