/**
 * @file worldGpuSky.ts — ADR 0009 step 3: the gradient sky dome and the moon as
 * TSL node materials, for the game world on WebGPURenderer (`?gpu=1`).
 *
 * WHY THIS FILE EXISTS. Under WebGPU a `ShaderMaterial` draws nothing; three
 * logs `NodeMaterial: Material "ShaderMaterial" is not compatible.` and the
 * dome is a hole. The two GLSL materials this ports live in
 * `World3DLighting.tsx` (GradientSky) and `sky/TakramSkySystem.tsx` (Moon).
 * Both stay in place for the WebGL path. This file rebuilds the SAME math as
 * node graphs; it does not approximate the look.
 *
 * WHAT IS THE SAME
 * - GradientSky: `dir = normalize(position)`, `t = pow(clamp(dir.y,0,1), 0.42)`,
 *   `col = mix(horizon, zenith, t) + sunColor * (pow(sd,180)*0.9 + pow(sd,6)*0.1)`
 *   with `sd = max(dot(dir, normalize(sunDir)), 0)`. BackSide, no depth write,
 *   no fog. The uniforms are the same four values the WebGL material takes.
 * - Moon: `NdotL = dot(normalize(viewNormal), sunDir)`, `lit = smoothstep(-0.1,
 *   0.4, NdotL)`, `brightness = 0.06 + lit*0.94`, color `moonColor*brightness`,
 *   alpha `opacity`, additive blending, no depth write. The GLSL dots a
 *   VIEW-space normal with a WORLD-space sun direction; that frame mismatch is
 *   kept on purpose, because the goal of this step is the same picture.
 *
 * WHAT IS NOT THE SAME (known, recorded in the domain doc)
 * - `toneMapped = false` has no effect on the node path: the WebGPU renderer
 *   tone-maps the whole frame in its output pass. In ground mode the WebGL
 *   frame is ALSO tone-mapped whole, by the post chain's ToneMapping effect,
 *   so the two ground pictures agree. The continent profile (no post chain on
 *   WebGL) would differ; it is out of this step's scope.
 * - The moon is additive. Additive light that is tone-mapped after the blend is
 *   not the same number as the WebGL frame's; the difference is small and only
 *   shows at night.
 */
import { AdditiveBlending, BackSide, Color, Vector3 } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  Fn,
  clamp,
  dot,
  float,
  max as tslMax,
  mix,
  normalView,
  normalize as tslNormalize,
  positionLocal,
  pow,
  smoothstep,
  uniform,
} from 'three/tsl';

/* TSL node graphs chain operators that @types/three 0.172 does not model (no
 * ShaderNodeObject). The alias matches gpu/terrainColorNode.ts. */
/* eslint-disable @typescript-eslint/no-explicit-any */
type N = any;

/** A uniform node whose `.value` the host writes, like a ShaderMaterial uniform. */
export interface ValueUniform<T> {
  value: T;
}

export interface GradientSkyNodes {
  material: MeshBasicNodeMaterial;
  zenith: ValueUniform<Color>;
  horizon: ValueUniform<Color>;
  sunColor: ValueUniform<Color>;
  sunDir: ValueUniform<Vector3>;
}

/**
 * The gradient sky dome as a node material. The host writes the four uniform
 * values exactly as it wrote the ShaderMaterial's (`setHex`, `set`).
 */
export function makeGradientSkyNodeMaterial(): GradientSkyNodes {
  const zenith = uniform(new Color());
  const horizon = uniform(new Color());
  const sunColor = uniform(new Color());
  const sunDir = uniform(new Vector3(0, 1, 0));

  const material = new MeshBasicNodeMaterial();
  material.side = BackSide;
  material.depthWrite = false;
  material.fog = false;
  material.toneMapped = false;

  material.colorNode = Fn(() => {
    // The sphere follows the camera, so the local position IS the view ray.
    const dir: N = tslNormalize(positionLocal);
    // Altitude 0 at horizon, 1 overhead; the soft curve keeps the warm band
    // hugging the skyline and the blue filling the upper dome.
    const h: N = clamp(dir.y, 0.0, 1.0);
    const t: N = pow(h, 0.42);
    const col: N = mix(horizon, zenith, t).toVar();
    // A gentle warm glow where the sun sits, fading fast so it reads as a sun
    // rather than washing the whole sky.
    const sd: N = tslMax(dot(dir, tslNormalize(sunDir)), 0.0);
    col.addAssign(sunColor.mul(pow(sd, 180.0).mul(0.9).add(pow(sd, 6.0).mul(0.10))));
    return col;
  })();
  // Dev hook for headless probes: the live uniform values of the dome.
  material.userData.gpuSkyUniforms = { zenith, horizon, sunColor, sunDir };

  return {
    material,
    zenith: zenith as unknown as ValueUniform<Color>,
    horizon: horizon as unknown as ValueUniform<Color>,
    sunColor: sunColor as unknown as ValueUniform<Color>,
    sunDir: sunDir as unknown as ValueUniform<Vector3>,
  };
}

export interface MoonNodes {
  material: MeshBasicNodeMaterial;
  sunDir: ValueUniform<Vector3>;
  moonColor: ValueUniform<Color>;
  opacity: ValueUniform<number>;
}

/** The procedural moon as a node material (see the file header for the math). */
export function makeMoonNodeMaterial(): MoonNodes {
  const sunDir = uniform(new Vector3());
  const moonColor = uniform(new Color(0xfff8e7));
  const opacity = uniform(1.0);

  const material = new MeshBasicNodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.blending = AdditiveBlending;
  // A ShaderMaterial has fog off by default; keep the moon out of the fog.
  material.fog = false;

  material.colorNode = Fn(() => {
    // Lambert against the sun: the face toward the sun is bright, the face
    // away is dark, which gives the phase.
    const NdotL: N = dot((normalView as N).normalize(), sunDir);
    // Soft terminator so the shadow edge is not razor-sharp.
    const lit: N = smoothstep(-0.1, 0.4, NdotL);
    // A small ambient so the dark side is not pure black.
    const brightness: N = float(0.06).add(lit.mul(0.94));
    return moonColor.mul(brightness);
  })();
  material.opacityNode = opacity;

  return {
    material,
    sunDir: sunDir as unknown as ValueUniform<Vector3>,
    moonColor: moonColor as unknown as ValueUniform<Color>,
    opacity: opacity as unknown as ValueUniform<number>,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
