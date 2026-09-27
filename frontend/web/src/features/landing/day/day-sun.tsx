"use client";

import { useEffect, useRef } from "react";
import { cx } from "@/lib/cx";
import { registerSunLocator, SKY_EVENT, SKY_LEAD_MS } from "@/lib/edition";

/**
 * The day hero's sun, drawn live by one small fragment shader (plain WebGL 2, no 3D engine, so the
 * day page doesn't download one).
 *
 * A granulated surface that churns and turns, with limb darkening, bright faculae near the edge and
 * a pair of sunspots riding the rotation; a thin chromosphere; flame-like prominences licking up
 * from the limb and streaming outward, painted in soft steps like the rest of the scene; a corona
 * with slow streamers. Every few seconds a flare bursts on the limb: a flash, a magnetic loop
 * rising, and a shell of plasma thrown out into space. When the page switches to night, the sun
 * swells and flashes, and the night page opens from it.
 *
 * The canvas spans `EXTENT` sun radii each way from the centre. Output is premultiplied: the disc
 * is opaque (it covers the planet in the video behind), the glow is light added over the sky.
 */
export const EXTENT = 2.4;

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform float uTime;
uniform float uSwell;
uniform float uExtent;

const float TAU = 6.2831853;
const float TURN = 0.15915494;

float hash11(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float hash21(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
vec2 hash22(vec2 p) { return vec2(hash21(p), hash21(p + 19.19)); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}
// Value noise repeating every so many cells along y: angles go on y, with no seam where they wrap.
float noiseP(vec2 p, float period) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float y0 = mod(i.y, period);
  float y1 = mod(i.y + 1.0, period);
  return mix(mix(hash21(vec2(i.x, y0)), hash21(vec2(i.x + 1.0, y0)), u.x),
             mix(hash21(vec2(i.x, y1)), hash21(vec2(i.x + 1.0, y1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float fbmP(vec2 p, float period) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noiseP(p, period); p = vec2(p.x * 2.03 + 17.0, p.y * 2.0); period *= 2.0; a *= 0.5; }
  return v;
}
// Granulation: convection cells that slowly boil.
float cells(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d = 1.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = 0.5 + 0.42 * sin(uTime * 0.35 + TAU * hash22(i + g));
      d = min(d, length(g + o - f));
    }
  }
  return d;
}
float dAngle(float a, float b) { return atan(sin(a - b), cos(a - b)); }

vec3 surface(vec2 p, float rho) {
  float mu = sqrt(max(1.0 - rho * rho, 0.0));
  // On the sphere, so features crowd toward the limb; the sun turns slowly.
  float lon = atan(p.x, mu) + uTime * 0.018;
  float lat = asin(clamp(p.y, -1.0, 1.0));
  vec2 s = vec2(lon, lat);
  // Plasma flows: large, slow currents that drag the granulation along.
  vec2 flow = vec2(fbm(s * 2.2 + vec2(0.0, uTime * 0.02)), fbm(s * 2.2 + vec2(5.2, -uTime * 0.017)));
  float gran = cells(s * 19.0 + flow * 1.6);
  float lanes = smoothstep(0.15, 0.62, gran);
  float region = fbm(s * 2.6 + flow * 0.8 + vec2(uTime * 0.006, 3.0));
  float fac = fbm(s * 7.0 + vec2(region * 2.0, uTime * 0.02));

  vec3 core = vec3(1.0, 0.86, 0.52);
  vec3 mid = vec3(1.0, 0.6, 0.2);
  vec3 edge = vec3(0.96, 0.36, 0.1);
  vec3 col = mix(edge, mid, smoothstep(0.0, 0.5, mu));
  col = mix(col, core, smoothstep(0.45, 1.0, mu) * (0.45 + 0.55 * region));
  // Limb darkening: the edge is deeper and redder, the centre hot.
  col *= 0.46 + 0.54 * pow(mu, 0.7);
  // Fine granulation: the lanes between cells a little darker, fading out toward the limb.
  col *= 1.04 - lanes * 0.13 * (0.4 + 0.6 * mu);
  col += vec3(1.0, 0.82, 0.55) * smoothstep(0.58, 0.78, fac) * (1.0 - mu) * 0.45;

  // Two sunspots, dark cores with lighter rims, carried round by the rotation.
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    vec2 c = vec2(-0.55 + fi * 0.8 + uTime * 0.018, 0.28 - fi * 0.5);
    vec2 d = vec2(dAngle(s.x, c.x) * cos(s.y), s.y - c.y);
    float r = length(d) * (1.0 + 0.25 * noise(d * 40.0));
    float pen = smoothstep(0.1, 0.055, r);
    float umb = smoothstep(0.045, 0.025, r);
    col *= 1.0 - pen * 0.3 - umb * 0.5;
  }
  return col;
}

void main() {
  vec2 p = (vUv * 2.0 - 1.0) * uExtent;
  float rho = length(p);
  if (rho > uExtent) { outColor = vec4(0.0); return; }
  float theta = atan(p.y, p.x);
  float h = rho - 1.0;
  float fade = smoothstep(uExtent, uExtent * 0.72, rho);
  float sw = uSwell;
  vec3 glow = vec3(0.0);

  // Corona: a warm glow with slow streamers.
  float str = fbmP(vec2(max(h, 0.0) * 1.1 - uTime * 0.04, (theta + uTime * 0.008) * TURN * 11.0), 11.0);
  glow += vec3(1.0, 0.6, 0.3) * exp(-max(h, 0.0) * 2.6) * 0.8 * (0.65 + 0.7 * smoothstep(0.3, 0.8, str));
  glow += vec3(1.0, 0.44, 0.46) * exp(-max(h, 0.0) * 0.95) * 0.26 * (0.6 + 0.8 * str);

  // Prominences: tongues of flame licking up from the limb and streaming outward, in soft steps.
  if (h > -0.01 && h < 0.5) {
    float f = fbmP(vec2(h * 3.2 - uTime * 0.36, theta * TURN * 13.0), 13.0);
    float lift = h * 1.7;
    float tongue = smoothstep(lift + 0.3, lift + 0.5, f);
    tongue = mix(tongue, floor(tongue * 3.0 + 0.5) / 3.0, 0.3);
    vec3 flame = mix(vec3(1.0, 0.8, 0.4), vec3(1.0, 0.4, 0.42), smoothstep(0.0, 0.3, h));
    glow += flame * tongue * 1.1;
  }

  // Chromosphere: a thin bright rim.
  glow += vec3(1.0, 0.55, 0.32) * exp(-pow(max(h, 0.0) / 0.016, 2.0)) * 1.1;

  // A flare every few seconds: a flash on the limb, a magnetic loop rising, and a shell of plasma
  // thrown out into space.
  float period = 6.5;
  float n = floor(uTime / period);
  float life = fract(uTime / period) * period / 3.2;
  if (life < 1.0) {
    float fa = hash11(n + 7.0) * TAU;
    vec2 dir = vec2(cos(fa), sin(fa));
    vec2 fc = dir * 1.0;
    float env = smoothstep(0.0, 0.05, life) * pow(1.0 - life, 2.0);
    float d = length(p - fc);
    glow += vec3(1.3, 1.12, 0.9) * (exp(-d * d / 0.003) * 2.2 + exp(-d * 6.0) * 0.55) * env;
    // The loop: a glowing arch of plasma above the limb, brightest at its feet, frayed by noise.
    float loopR = 0.05 + life * 0.2;
    float ring = abs(length(p - fc) - loopR);
    float width = 0.018 + 0.012 * noise(p * 30.0 + uTime);
    float arch = exp(-ring * ring / (width * width)) * smoothstep(1.0, 1.04, rho)
               * (0.55 + 0.45 * smoothstep(loopR * 1.6, 0.0, h));
    glow += vec3(1.0, 0.55, 0.32) * arch * smoothstep(0.0, 0.12, life) * (1.0 - life) * 0.9;
    float shellR = 1.0 + life * 1.25;
    float ang = dAngle(theta, fa);
    float shell = exp(-pow((rho - shellR) / 0.07, 2.0)) * exp(-ang * ang / 0.1)
                * smoothstep(0.0, 0.15, life) * (1.0 - life);
    glow += vec3(1.0, 0.72, 0.58) * shell * 0.55;
  }

  // Switching to night: the sun swells and flashes.
  glow *= 1.0 + sw * 1.6;
  glow += vec3(1.0, 0.9, 0.75) * exp(-max(h, 0.0) * mix(5.0, 1.0, sw)) * sw * sw * 1.2;
  glow *= fade;

  // The disc, opaque, with a soft antialiased limb.
  float disc = smoothstep(1.004, 0.996, rho);
  vec3 col = glow;
  float alpha = clamp(max(max(glow.r, glow.g), glow.b), 0.0, 1.0);
  if (disc > 0.0) {
    vec3 s = surface(p, min(rho, 1.0)) * (1.0 + sw * 0.8);
    col = mix(glow, s + glow * 0.25, disc);
    alpha = mix(alpha, 1.0, disc);
  }
  col = min(col, vec3(alpha));
  outColor = vec4(col, alpha);
}`;

function compile(gl: WebGL2RenderingContext) {
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const vs = shader(gl.VERTEX_SHADER, VERT);
  const fs = shader(gl.FRAGMENT_SHADER, FRAG);
  const program = gl.createProgram();
  if (!vs || !fs || !program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  return program;
}

function shaderLog(gl: WebGL2RenderingContext, program: WebGLProgram) {
  return (gl.getAttachedShaders(program) ?? []).map((s) => gl.getShaderInfoLog(s)).join(" | ");
}

/**
 * The live sun. It only renders while it's on screen and the tab is visible, draws a single frame
 * for reduced motion or Pause motion, and says when its first frame is up (`data-live`), so the
 * CSS sun beneath can step aside. Its WebGL context and shader are only created the first time it's
 * shown (not at all on a night visit), and the shader compiles in the background where the driver
 * allows it: nothing asks the GPU for the program until it reports ready.
 */
export function DaySun({ className }: { className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    type Gpu = {
      gl: WebGL2RenderingContext;
      program: WebGLProgram;
      buffer: WebGLBuffer | null;
      ext: KHR_parallel_shader_compile | null;
      loc: { uTime: WebGLUniformLocation | null; uSwell: WebGLUniformLocation | null } | null;
    };
    let gpu: Gpu | null = null;
    let failed = false;
    const setup = (): Gpu | null => {
      const gl = el.getContext("webgl2", { premultipliedAlpha: true, antialias: false });
      const program = gl && compile(gl);
      if (!gl || !program) {
        failed = true;
        return null;
      }
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      return {
        gl,
        program,
        buffer,
        ext: gl.getExtension("KHR_parallel_shader_compile"),
        loc: null,
      };
    };

    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const start = performance.now();
    let swellFrom: number | null = null;
    let visible = false;
    let raf = 0;

    const still = () => reduce.matches || root.dataset.motion === "paused";

    const draw = (now: number) => {
      raf = 0;
      if (!gpu && !failed) gpu = setup();
      if (!gpu) return;
      const { gl, program } = gpu;
      if (!gpu.loc) {
        if (gpu.ext && !gl.getProgramParameter(program, gpu.ext.COMPLETION_STATUS_KHR)) {
          raf = requestAnimationFrame(draw);
          return;
        }
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          failed = true;
          // The painted sun beneath stays up; say why in development.
          if (process.env.NODE_ENV !== "production") {
            console.error("DaySun shader:", gl.getProgramInfoLog(program), shaderLog(gl, program));
          }
          return;
        }
        // biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram, not a React hook.
        gl.useProgram(program);
        const aPos = gl.getAttribLocation(program, "aPos");
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
        gl.uniform1f(gl.getUniformLocation(program, "uExtent"), EXTENT);
        gpu.loc = {
          uTime: gl.getUniformLocation(program, "uTime"),
          uSwell: gl.getUniformLocation(program, "uSwell"),
        };
      }
      const t = still() ? 20 : 20 + (now - start) / 1000;
      const swell = swellFrom === null ? 0 : Math.min(1, (now - swellFrom) / SKY_LEAD_MS) ** 2;
      gl.viewport(0, 0, el.width, el.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(gpu.loc.uTime, t);
      gl.uniform1f(gpu.loc.uSwell, swell);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      el.dataset.live = "";
      const swelling = swellFrom !== null && swell < 1;
      if (visible && !document.hidden && (!still() || swelling)) raf = requestAnimationFrame(draw);
    };
    const kick = () => {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(draw);
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const w = Math.max(1, Math.round(el.clientWidth * dpr));
      const h = Math.max(1, Math.round(el.clientHeight * dpr));
      if (el.width !== w || el.height !== h) {
        el.width = w;
        el.height = h;
      }
      kick();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    // Also reports hidden while the day hero is display: none (the night edition).
    const io = new IntersectionObserver(([e]) => {
      visible = Boolean(e?.isIntersecting);
      kick();
    });
    io.observe(el);
    const onSky = (e: Event) => {
      swellFrom = (e as CustomEvent<string>).detail === "night" ? performance.now() : null;
      kick();
    };
    const mo = new MutationObserver(kick);
    mo.observe(root, { attributes: true, attributeFilter: ["data-motion"] });
    window.addEventListener(SKY_EVENT, onSky);
    document.addEventListener("visibilitychange", kick);
    reduce.addEventListener("change", kick);
    resize();

    // Where the sun is, for the edition switch's reveal.
    const unregister = registerSunLocator("day", () => {
      const r = el.getBoundingClientRect();
      return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
    });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      window.removeEventListener(SKY_EVENT, onSky);
      document.removeEventListener("visibilitychange", kick);
      reduce.removeEventListener("change", kick);
      unregister();
      if (gpu) {
        gpu.gl.deleteProgram(gpu.program);
        gpu.gl.deleteBuffer(gpu.buffer);
      }
    };
  }, []);

  return <canvas ref={canvas} className={cx("block size-full", className)} />;
}
