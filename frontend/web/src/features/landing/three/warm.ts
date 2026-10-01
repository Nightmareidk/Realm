import type * as THREE from "three";

/**
 * Shaders are compiled in the background before a scene is first drawn (KHR_parallel_shader_compile):
 * drawing with one that isn't ready makes the page wait for it, and on Windows (Direct3D) the big
 * noise shaders take seconds. `compileAsync` covers what's in the scene; work drawn some other way
 * (into an off-screen target, or the environment's prefilter) registers here, and the scene only
 * counts as warm once that's ready too.
 */
type Warming = { warming?: Promise<unknown>[] };

/**
 * Checking each new shader for errors asks the GPU process a question and waits for the answer,
 * behind whatever it's busy with (compiling the other shaders): half a second at a time on Windows.
 * The shaders here are fixed, so production builds skip it; development keeps it, to see errors.
 */
export function quietShaderChecks(gl: THREE.WebGLRenderer) {
  if (process.env.NODE_ENV === "production") gl.debug.checkShaderErrors = false;
}

export function holdWarmup(scene: THREE.Scene, ready: Promise<unknown>) {
  const data = scene.userData as Warming;
  data.warming ??= [];
  data.warming.push(ready);
}

export async function warmScene(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  quietShaderChecks(gl);
  await gl.compileAsync(scene, camera).catch(() => {});
  // Anything registered meanwhile (a child's effect runs after this one starts) is waited for too.
  const data = scene.userData as Warming;
  for (let list = data.warming ?? []; list.length; list = data.warming ?? []) {
    data.warming = [];
    await Promise.all(list.map((p) => p.catch(() => {})));
  }
}
