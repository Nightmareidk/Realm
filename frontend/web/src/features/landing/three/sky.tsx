"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { registerSunLocator } from "@/lib/edition";
import { HOLE_RADIUS } from "./black-hole";
import type { LayoutRef } from "./layout";
import { auroraPhase, type DayMix } from "./theme";

/**
 * The hero's sky, drawn by one full-screen shader behind everything else.
 *
 * Night: a deep blue sky with drifting nebula clouds, a faint Milky Way, three layers of stars
 * that twinkle (some scintillating through colours), shooting stars, and aurora curtains: a sharp
 * bright lower edge, rays shimmering along the curtain, waves rolling through it in both
 * directions, and colours that cycle from green through cyan and magenta to pink and violet
 * (in step with the page's nebula, via the wall clock). Around the black hole the sky is bent by
 * its gravity, like a lens: stars and cloud near it curve around the shadow.
 * Switching to day, the sky gives way from the horizon up and the day film behind the canvas
 * shows through, with a warm band and a flare from the sun while it changes; switching back,
 * night falls over it again.
 *
 * The heavy parts return early where they can't show (mountains high in the sky, the river away
 * from its band, a curtain far below its edge), so the shader costs only what's on screen.
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
uniform vec2 uCentre;
uniform sampler2D uGate;
uniform vec3 uGround;
uniform float uHoleR;
uniform float uPhase;
uniform float uScroll;
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
vec3 mountains(vec2 uv, float aspect, vec3 col) {
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
  col += vec3(0.3, 0.26, 0.7) * exp(-abs(uv.y - farH) * 110.0) * 0.16;

  float nx = x + uPointer.x * 0.08;
  float nearH = nearRange(nx);
  float nearSlope = (nearRange(nx + e) - nearRange(nx - e)) / (2.0 * e);
  float near = smoothstep(nearH + aa, nearH - aa, uv.y);
  float depthN = clamp((nearH - uv.y) * 9.0, 0.0, 1.0);
  float litN = smoothstep(0.1, 1.4, -nearSlope) * exp(-(nearH - uv.y) * 34.0) + fbm3(vec2(x * 6.0, uv.y * 11.0)) * 0.2 * (1.0 - depthN);
  vec3 nearCol = mix(vec3(0.015, 0.02, 0.05), vec3(0.13, 0.12, 0.33), litN * 0.9 + rock * 0.1);
  return mix(col, nearCol, near);
}

float rectMask(vec2 uv, vec4 r, float soft) {
  vec2 lo = smoothstep(r.xy - soft, r.xy + soft, uv);
  vec2 hi = 1.0 - smoothstep(r.zw - soft, r.zw + soft, uv);
  return lo.x * lo.y * hi.x * hi.y;
}

vec3 nightSky(vec2 uv, vec2 px, float aspect, float textMask) {
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

  vec2 drift = vec2(0.0, uScroll * 90.0);
  vec3 stars = starLayer(px + uPointer * 3.0 + drift * 0.3, 6.0, 0.08 + 0.12 * mw, 0.7, 0.55, 0.0)
             + starLayer(px + uPointer * 7.0 + drift * 0.6, 23.0, 0.32, 1.1, 0.9, 0.0)
             + starLayer(px + uPointer * 12.0 + drift, 97.0, 0.55, 1.9, 1.25, 1.0);

  vec3 aur = curtain(q, 1.7, 0.6, 0.2, 0.035, 0.2, 1.25, 0.12, uPhase)
           + curtain(q, 5.3, 0.4, 0.24, -0.028, 0.26, 1.0, -0.1, uPhase + 0.09)
           + curtain(q, 9.1, 0.8, 0.14, 0.02, 0.14, 0.7, 0.34, uPhase + 0.18);
  aur += auroraMid(uPhase) * 0.1 * smoothstep(0.45, 0.8, fbm3(q * 1.5 + vec2(uTime * 0.01, 0.0)));
  aur *= mix(1.0, 0.24, textMask) * smoothstep(0.0, 0.18, uv.y) * mix(0.55, 1.0, smoothstep(0.1, 0.75, uv.x));
  aur = 1.0 - exp(-aur * 1.35);

  float glow = dot(aur, vec3(0.3, 0.6, 0.1));
  float hide = clamp(glow * 1.6 + river.a * 0.8, 0.0, 0.9);
  return col + (stars + meteors(px) * (1.0 - textMask * 0.7)) * (1.0 - hide) + aur * (1.0 - river.a * 0.7);
}



// ── Day: a bright cloudy sky over rolling hills, with the old brick gateway on the middle hill ──

// Scroll intro parallax for the day layers: each is magnified around the horizon at the start and
// eases to its place as the camera pulls back, nearer layers more.
vec2 dayLayer(vec2 q, float aspect, float depth) {
  vec2 anchor = vec2(0.5 * aspect, 0.2);
  float zoom = 1.0 + depth * (1.0 - uScroll);
  return anchor + (q - anchor) / zoom + vec2(uPointer.x * depth * 0.05, 0.0);
}

vec3 daySkyColor(vec2 uv, float aspect) {
  vec3 zenith = vec3(0.24, 0.5, 0.88);
  vec3 mid = vec3(0.47, 0.72, 0.97);
  vec3 horizon = vec3(0.86, 0.93, 0.99);
  vec3 col = mix(horizon, mid, smoothstep(0.18, 0.55, uv.y));
  col = mix(col, zenith, smoothstep(0.55, 1.05, uv.y));
  // Sunlight warms and brightens the sky around the sun.
  vec2 sd = (uv - uCentre) * vec2(aspect, 1.0);
  float d = length(sd);
  col = mix(col, vec3(1.0, 0.95, 0.84), exp(-d * 2.2) * 0.35);
  col += vec3(1.0, 0.93, 0.78) * (exp(-d * 6.0) * 0.28 + exp(-d * 1.6) * 0.06);
  return col;
}

// Cumulus: a warped, drifting density field, heaped into a band with flatter bases, lit from the
// sun's side (bright tops and edges, soft blue-grey undersides).
float cloudField(vec2 p) {
  vec2 w = vec2(fbm3(p * 0.6 + 3.0), fbm3(p * 0.6 - 5.0));
  return fbm(p + w * 1.3);
}
vec4 cumulus(vec2 q, vec2 uv, float aspect, float band, float spread, float scale, float speed, float seed) {
  vec2 p = q * scale + vec2(uTime * speed + seed, seed * 0.37);
  float n = cloudField(p);
  float fromBand = abs(uv.y - band) / spread;
  float threshold = 0.5 + fromBand * fromBand * 0.35;
  float base = band - spread * 0.55 + (noise(vec2(p.x * 0.8, seed)) - 0.5) * spread * 0.4;
  float dens = smoothstep(threshold, threshold + 0.16, n) * smoothstep(base, base + 0.05, uv.y);
  if (dens <= 0.001) return vec4(0.0);
  // Light: less cloud toward the sun means brighter.
  vec2 toSun = normalize((uCentre - uv) * vec2(aspect, 1.0) + vec2(0.0001));
  float ahead = cloudField(p + toSun * 0.22);
  float lit = clamp(0.62 + (n - ahead) * 3.2, 0.0, 1.0);
  float under = smoothstep(base + 0.12, base, uv.y);
  vec3 shadow = vec3(0.62, 0.69, 0.82);
  vec3 bright = vec3(1.0, 0.995, 0.975);
  vec3 col = mix(shadow, bright, lit);
  col = mix(col, vec3(0.7, 0.75, 0.86), under * 0.45);
  // A silver lining where the cloud thins toward the sun.
  float sunNear = exp(-length((uv - uCentre) * vec2(aspect, 1.0)) * 3.0);
  col += vec3(1.0, 0.92, 0.75) * (1.0 - dens) * sunNear * 0.6;
  return vec4(col, dens);
}

// Rolling hills: soft ridgelines, lit on the slopes facing the sun (upper right), patchwork fields
// with hedgerows on the nearer ones, and clumps of round trees along the ridges.
float hill(float x, float base, float amp, float f, float seed) {
  return base + amp * (0.55 * sin(x * f + seed) + 0.3 * sin(x * f * 2.3 + seed * 1.7) + 0.15 * (noise(vec2(x * f * 3.0, seed)) - 0.5));
}

// A clump of trees: two to four round canopies on the ridge, shaded from the upper right.
vec4 treeClumps(vec2 q, float base, float amp, float f, float seed, float size) {
  vec4 best = vec4(0.0);
  float cells = 6.0;
  for (int k = -1; k <= 1; k++) {
    float cell = floor(q.x * cells) + float(k);
    float r = hash21(vec2(cell, seed));
    if (r > 0.55) continue;
    for (int j = 0; j < 4; j++) {
      float fj = float(j);
      if (fj > 1.0 + r * 5.0) break;
      float cx = (cell + 0.15 + 0.7 * hash21(vec2(cell + fj * 7.1, seed + 1.0))) / cells;
      float sz = size * (0.55 + 0.6 * hash21(vec2(cell + fj * 3.3, seed + 2.0)));
      float cy = hill(cx, base, amp, f, seed) + sz * 0.62;
      vec2 d = (q - vec2(cx, cy)) / sz;
      float rr = length(d * vec2(1.0, 1.1)) + (noise(d * 6.0 + fj) - 0.5) * 0.12;
      float c = smoothstep(1.0, 0.92, rr);
      if (c <= 0.0) continue;
      float light = clamp(0.5 + dot(d, vec2(0.62, 0.78)) * 0.55, 0.0, 1.0);
      vec3 col = mix(vec3(0.1, 0.24, 0.1), vec3(0.4, 0.58, 0.22), light);
      col *= 0.9 + 0.15 * noise(d * 14.0 + cell);
      // Nearer canopies (drawn later in the loop) cover the ones behind.
      best = vec4(mix(best.rgb, col, c), max(best.a, c));
    }
  }
  return best;
}

vec4 hillLayer(vec2 q, float base, float amp, float f, float seed, vec3 lit, vec3 grass, vec3 deep, float fields, float trees) {
  float x = q.x;
  float h = hill(x, base, amp, f, seed);
  float aa = 1.5 / uRes.y;
  float cover = smoothstep(h + aa, h - aa, q.y);
  vec3 col = vec3(0.0);
  if (cover > 0.0) {
    float e = 0.003;
    float slope = (hill(x + e, base, amp, f, seed) - hill(x - e, base, amp, f, seed)) / (2.0 * e);
    float light = clamp(0.6 - slope * 0.9, 0.25, 1.0);
    float down = clamp((h - q.y) * 5.0, 0.0, 1.0);
    // Sunlit near the ridge, deeper green below and on slopes turned away.
    col = mix(lit, grass, smoothstep(0.0, 0.5, down));
    col = mix(col, deep, (1.0 - light) * 0.7 + down * 0.25);
    if (fields > 0.0) {
      vec2 fp = vec2(x * 4.5 + (noise(vec2(q.y * 8.0, seed)) - 0.5) * 0.8, (h - q.y) * 14.0 + (noise(vec2(x * 3.0, seed + 5.0)) - 0.5) * 1.2);
      vec2 id = floor(fp);
      vec2 fr = fract(fp);
      float tint = hash21(id + seed);
      col *= mix(0.88, 1.1, tint);
      col = mix(col, col * vec3(1.08, 1.04, 0.82), step(0.8, tint) * 0.6);
      float edge = min(min(fr.x, 1.0 - fr.x), min(fr.y, 1.0 - fr.y));
      col = mix(col, deep * 0.72, smoothstep(0.07, 0.0, edge) * fields);
    }
    col *= 0.94 + 0.1 * noise(vec2(x * 80.0, q.y * 80.0));
    // Light catching the ridge line.
    col += vec3(0.16, 0.18, 0.06) * exp(-(h - q.y) * 120.0) * light;
  }
  vec4 layer = vec4(col, cover);
  if (trees > 0.0 && q.y < h + trees * 2.0 && q.y > h - trees * 0.4) {
    vec4 t = treeClumps(q, base, amp, f, seed, trees);
    layer = vec4(mix(layer.rgb, t.rgb, t.a), max(layer.a, t.a));
  }
  return layer;
}

vec3 daySky(vec2 uv, float aspect) {
  vec2 q0 = vec2(uv.x * aspect, uv.y);
  vec3 col = daySkyColor(uv, aspect);
  vec3 haze = vec3(0.8, 0.88, 0.95);

  // High wisps, then two decks of cumulus.
  vec2 qs = dayLayer(q0, aspect, 0.05);
  float wisp = smoothstep(0.55, 0.85, fbm(vec2(qs.x * 1.2 + uTime * 0.004, qs.y * 7.0)));
  col = mix(col, vec3(1.0), wisp * smoothstep(0.55, 0.95, uv.y) * 0.35);
  if (uv.y > 0.28) {
    vec4 hi = cumulus(qs, uv, aspect, 0.8, 0.2, 1.7, 0.006, 3.0);
    col = mix(col, hi.rgb, hi.a * 0.9);
    vec4 lo = cumulus(dayLayer(q0, aspect, 0.08), uv, aspect, 0.52, 0.16, 2.3, 0.01, 11.0);
    col = mix(col, mix(lo.rgb, haze, 0.15), lo.a);
  }

  if (uv.y < 0.46) {
    // Far hills: pale and blue with distance.
    vec2 qf = dayLayer(q0, aspect, 0.1);
    vec4 far = hillLayer(qf, 0.31, 0.06, 1.9, 1.3, vec3(0.66, 0.8, 0.74), vec3(0.56, 0.7, 0.7), vec3(0.46, 0.6, 0.66), 0.0, 0.0);
    col = mix(col, mix(far.rgb, haze, 0.5), far.a);

    // Middle hill: fields and hedgerows, with the brick gateway standing on it.
    vec2 qm = dayLayer(q0, aspect, 0.16);
    vec4 mid = hillLayer(qm, 0.245, 0.05, 1.35, 4.2, vec3(0.66, 0.8, 0.4), vec3(0.47, 0.66, 0.32), vec3(0.3, 0.46, 0.26), 0.7, 0.014);
    col = mix(col, mix(mid.rgb, haze, 0.2), mid.a);
    float gx = 0.63 * aspect;
    float gBase = hill(gx, 0.245, 0.05, 1.35, 4.2) - 0.012;
    float S = 0.3;
    vec2 guv = vec2((qm.x - gx) / S + 0.5, (qm.y - gBase) / S + 0.083);
    if (guv.x > 0.0 && guv.x < 1.0 && guv.y > 0.0 && guv.y < 1.0) {
      vec4 g = texture2D(uGate, guv);
      col = mix(col, mix(g.rgb, haze, 0.1), g.a);
    }

    // Near hill with trees along its ridge, and the nearest slope.
    vec4 near = hillLayer(dayLayer(q0, aspect, 0.24), 0.15, 0.06, 1.05, 7.7, vec3(0.6, 0.78, 0.32), vec3(0.4, 0.62, 0.25), vec3(0.22, 0.4, 0.18), 0.0, 0.026);
    col = mix(col, near.rgb, near.a);
    vec4 front = hillLayer(dayLayer(q0, aspect, 0.32), 0.06, 0.045, 1.6, 2.2, vec3(0.52, 0.72, 0.28), vec3(0.34, 0.55, 0.2), vec3(0.18, 0.34, 0.14), 0.0, 0.0);
    col = mix(col, front.rgb, front.a);
  }
  // A warm morning mist in the lowest valley, into the page's own colour.
  col = mix(col, uGround, smoothstep(0.12, 0.0, uv.y) * 0.55);
  return col;
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

void main() {
  vec2 uv = vUv;
  vec2 px = uv * uRes;
  float aspect = uRes.x / uRes.y;
  float textMask = rectMask(uv, uText, 0.22);

  // Day rises from the horizon: the lower sky gives way first, then the rest.
  float dm = smoothstep(0.0, 1.0, clamp(uDay * 1.7 - 0.35 - (uv.y - 0.5) * 0.7, 0.0, 1.0));
  vec3 night = vec3(0.0);
  if (dm < 0.999) {
    vec2 lp = uHoleR > 0.0 ? lens(px) : px;
    night = nightSky(lp / uRes, lp, aspect, textMask);
    // The mountains never reach this high: skip them above their tallest peak.
    if (uv.y < 0.42) night = mountains(uv, aspect, night);
  }
  vec3 day = dm > 0.001 ? daySky(uv, aspect) : vec3(0.0);
  vec3 col = mix(night, day, dm);
  col += (hash21(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;

  // While the edition changes: a warm band along the horizon and a flare from the sun.
  float change = sin(clamp(uDay, 0.0, 1.0) * 3.14159);
  if (change > 0.001) {
    vec2 sd = (uv - uCentre) * vec2(aspect, 1.0);
    float flare = exp(-length(sd) * 2.6) * change * change * 0.7;
    float band = exp(-uv.y * 3.5) * change * 0.25;
    col += vec3(1.0, 0.6, 0.3) * band + vec3(1.0, 0.86, 0.62) * flare;
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

/** The page's day ground (apricot, oklch(0.91 0.05 50)) in display RGB, for the valley mist. */
const DAY_GROUND = new THREE.Vector3(0.996, 0.849, 0.77);

/**
 * Full-screen sky behind the hero scene: the night sky, or by day (`mix` → 1) a bright cloudy sky
 * over rolling hills with a brick gateway, giving way to each other from the horizon up.
 * `hole` is the black hole, which the sky bends around; `centre` is where the sun and the black
 * hole meet, which the flare comes from and which the edition switch opens the new edition from;
 * `layout` says where the headline sits, so the sky quietens there; `scroll` is the intro's
 * progress, for a little parallax.
 */
export function SkyBackdrop({
  mix,
  still,
  hole,
  centre,
  layout,
  scroll,
}: {
  mix: DayMix;
  still: boolean;
  hole: RefObject<THREE.Object3D | null>;
  centre: RefObject<THREE.Object3D | null>;
  layout: LayoutRef;
  scroll?: RefObject<number>;
}) {
  const gate = useMemo(() => {
    const t = new THREE.TextureLoader().load("/art/day-gateway.webp");
    // Sampled as stored: the shader works in display colours.
    t.colorSpace = THREE.NoColorSpace;
    t.anisotropy = 4;
    return t;
  }, []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        // Drawn first, as an opaque pass, so it never lands on top of the scene.
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        transparent: false,
        blending: THREE.NoBlending,
        uniforms: {
          uTime: { value: 0 },
          uDay: { value: 0 },
          uCentre: { value: new THREE.Vector2(0.7, 0.6) },
          uGate: { value: gate },
          uGround: { value: DAY_GROUND },
          uHoleR: { value: 0 },
          uPhase: { value: 0 },
          uScroll: { value: 0 },
          uRes: { value: new THREE.Vector2(1, 1) },
          uSun: { value: new THREE.Vector2(0.7, 0.6) },
          uText: { value: new THREE.Vector4(0, 0, 0, 0) },
          uPointer: { value: new THREE.Vector2() },
        },
      }),
    [gate],
  );
  const gl = useThree((s) => s.gl);
  const v = useMemo(() => new THREE.Vector3(), []);
  const edge = useMemo(() => new THREE.Vector3(), []);
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
  });

  return (
    <mesh frustumCulled={false} renderOrder={-1000} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
