/**
 * @file worldGpuPost.ts — ADR 0009 step 5: the game world's post chain on
 * WebGPURenderer (`?gpu=1`), built from three's node `PostProcessing`.
 *
 * WHY THIS FILE EXISTS. On WebGL the ground view draws through an
 * EffectComposer chain in `World3DScene.tsx`: N8AO, volumetric clouds, ACES
 * tone mapping, SMAA. That chain is a WebGL library and is off under the flag,
 * so the WebGPU world drew with no ambient occlusion and no anti-aliasing. This
 * module builds the same chain from three's TSL display nodes. The WebGL chain
 * stays in place for `?gpu=0`.
 *
 * THE CHAIN (one frame)
 *   scenePass = pass(scene, camera, { samples: 0 })   linear half-float color + depth
 *   aoFactor  = denoise(ao(depth, normals-from-depth, camera))   GTAO, half size
 *   lit       = sceneColor * aoFactor
 *   out       = renderOutput(lit)                      ACES at renderer exposure, then sRGB
 *   output    = smaa(out)                              edge anti-aliasing on the final image
 *
 * WHAT IS THE SAME AS WEBGL
 * - No MSAA in the scene pass (`multisampling={0}` on WebGL) and SMAA last.
 * - ACES tone mapping at the renderer's exposure (1.05). `PostProcessing` turns
 *   the renderer's tone mapping and output color space OFF while it draws the
 *   passes, so the scene pass is linear, and `renderOutput` applies both ONCE.
 *   `outputColorTransform` is false so SMAA can run after that, on the image
 *   the player sees, as the WebGL chain does.
 * - The AO starts from N8AO's settings (half resolution, radius 7 m) and its
 *   depth range and power were then set by measurement against the WebGL
 *   frame at two poses (sweeps in .agent/scratch/water-campaign/s5sweep.mjs,
 *   numbers in the domain doc, step 5). GTAO is a different estimator:
 *   - `thickness` is a hard depth cut. At N8AO's 3.5 m a tiled roof 4 m from
 *     the camera went from 28 to 7 of 255 where N8AO leaves it at 27; at
 *     1.5 m the roof is untouched and a post's foot still darkens.
 *   - `scale` is `pow(ao, scale)`, as N8AO's `intensity`. 5 instead of 3.2
 *     brings the post's foot to N8AO's value (44 against 42) with the thin
 *     depth range. Open ground does not move at any setting (94 -> 94).
 *   - What it does NOT reach: the wide creases N8AO darkens through its soft
 *     range (a tree foot 64 -> 51 here against 34 on WebGL). That is a gap.
 *
 * WHAT IS NOT THE SAME (recorded in the domain doc)
 * - No clouds. `VolumetricClouds` is a takram WebGL effect; step 7 owns it.
 * - Normals come from depth, as N8AO does. An MRT normal target would be
 *   sharper at leaf edges; it is a later cut if the AO proves too soft.
 *
 * THE HANDLE FOR THE WATER PASS (step 6). The river water layer must draw its
 * water AFTER the opaque scene and read the opaque color and depth. This module
 * keeps one live handle (`getWorldGpuPost()`): `scenePass`, `sceneColor`,
 * `sceneDepth`, `aoFactor`, and `setComposite(fn)`, which lets the water layer
 * replace the `lit` node with its own (for example `fn = (lit) => waterOver(lit,
 * sceneColor, sceneDepth)`) and rebuilds the output. `onWorldGpuPost(listener)`
 * tells a late-mounting layer when the chain exists.
 */
import type { Camera, Scene } from 'three';
import type { PostProcessing, WebGPURenderer } from 'three/webgpu';

/* TSL node graphs chain operators that @types/three 0.172 does not model (no
 * ShaderNodeObject). The alias matches gpu/worldGpuSky.ts. */
/* eslint-disable @typescript-eslint/no-explicit-any */
type N = any;

/** The AO settings, kept as numbers so a rig can read them beside the result. */
export const WORLD_GPU_AO = {
  /** Half resolution, as N8AO `halfRes`. */
  resolutionScale: 0.5,
  /** Sampling radius in meters, as N8AO `aoRadius`. */
  radiusM: 7,
  /** Depth range (m) within which a sample counts as an occluder. 2 m and above darkens tiled roofs near the camera; see the file comment. */
  thicknessM: 1.5,
  /** `pow(ao, scale)`, as N8AO `intensity`; 5 matches N8AO's contact darkening with the thin depth range. */
  scale: 5,
  /** Horizon samples per pixel. */
  samples: 16,
  /**
   * View distance (m) where the AO starts to fade, and where it is gone
   * (agora-257c, 2026-10-28). The AO rebuilds normals from depth, and far out
   * the depth steps are coarser than the ground's relief: GTAO read that
   * stepping as creases and drew a dark noisy band along the horizon, 500 m
   * and more out (Remy's walk; an A/B with scale 0 removed it). A 7 m radius
   * adds no visible contact shadow at that range, so the AO now fades to open.
   */
  fadeStartM: 150,
  fadeEndM: 300,
} as const;

/** One node that stands between the scene color and the tone mapper. */
export type WorldGpuComposite = (lit: N, parts: { sceneColor: N; sceneDepth: N; aoFactor: N }) => N;

export interface WorldGpuPostHandle {
  readonly renderer: WebGPURenderer;
  readonly scene: Scene;
  readonly camera: Camera;
  readonly post: PostProcessing;
  /** `pass(scene, camera)`: the opaque scene drawn once per frame. */
  readonly scenePass: N;
  /** Linear half-float scene color (`scenePass.getTextureNode('output')`). */
  readonly sceneColor: N;
  /** Scene depth texture node (`scenePass.getTextureNode('depth')`). */
  readonly sceneDepth: N;
  /** Denoised ambient-occlusion factor, 1 = open. */
  readonly aoFactor: N;
  /** The GTAO node, for its uniforms (`radius`, `thickness`, `scale`, `samples`). */
  readonly ao: N;
  /**
   * Replace the node the tone mapper reads. `null` restores `sceneColor * aoFactor`.
   * The water layer inserts its water here.
   */
  setComposite(fn: WorldGpuComposite | null): void;
  /** Draw one frame through the chain. */
  render(): void;
  /** Release the passes. The handle is dead after this. */
  dispose(): void;
}

let current: WorldGpuPostHandle | null = null;
const listeners = new Set<(handle: WorldGpuPostHandle | null) => void>();

/** The live post chain of the WebGPU world, or null while none is mounted. */
export function getWorldGpuPost(): WorldGpuPostHandle | null {
  return current;
}

/** Called with the handle when a chain mounts, and with null when it unmounts. */
export function onWorldGpuPost(listener: (handle: WorldGpuPostHandle | null) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function publish(handle: WorldGpuPostHandle | null): void {
  current = handle;
  for (const l of listeners) l(handle);
}

/**
 * Build the chain. The display addons load here, not at module load: SMAANode
 * carries its search and area textures inline, and the WebGL world must not pay
 * for them.
 */
export async function buildWorldGpuPost(renderer: WebGPURenderer, scene: Scene, camera: Camera): Promise<WorldGpuPostHandle> {
  const [{ PostProcessing }, tsl, { ao }, { denoise }, { smaa }] = await Promise.all([
    import('three/webgpu'),
    import('three/tsl'),
    import('three/examples/jsm/tsl/display/GTAONode.js'),
    import('three/examples/jsm/tsl/display/DenoiseNode.js'),
    import('three/examples/jsm/tsl/display/SMAANode.js'),
  ]);
  const { pass, renderOutput, smoothstep, mix, textureLoad, ivec2, screenCoordinate, uniform, perspectiveDepthToViewZ } = tsl;

  const post = new PostProcessing(renderer);
  // renderOutput() below does the tone map and the color space; a second one
  // at the output would tone-map the frame twice.
  post.outputColorTransform = false;

  // No MSAA in the pass, as the WebGL chain (multisampling 0): SMAA at the end
  // does the anti-aliasing, and a multisampled depth texture cannot be read.
  const scenePass: N = pass(scene, camera, { samples: 0 });
  const sceneColor: N = scenePass.getTextureNode('output');
  const sceneDepth: N = scenePass.getTextureNode('depth');

  // Normals from depth, as N8AO reconstructs them. The JS accepts a null
  // normal node; @types/three 0.172 declares it required.
  const noNormals: N = null;
  const aoNode: N = ao(sceneDepth, noNormals, camera);
  aoNode.resolutionScale = WORLD_GPU_AO.resolutionScale;
  aoNode.radius.value = WORLD_GPU_AO.radiusM;
  aoNode.thickness.value = WORLD_GPU_AO.thicknessM;
  aoNode.scale.value = WORLD_GPU_AO.scale;
  aoNode.samples.value = WORLD_GPU_AO.samples;
  // The half-size GTAO is noisy per pixel; the denoise is the step N8AO also
  // takes before it multiplies the color.
  const aoNear: N = denoise(aoNode.getTextureNode(), sceneDepth, noNormals, camera);
  // Fade the AO to open with view distance (see WORLD_GPU_AO.fadeStartM).
  // The post quad has its own camera, so the scene camera's near and far
  // arrive as uniforms, read at each render.
  const perspective = camera as Camera & { near: number; far: number };
  const near: N = uniform(perspective.near).onRenderUpdate(() => perspective.near);
  const far: N = uniform(perspective.far).onRenderUpdate(() => perspective.far);
  // The depth is an unsampled load at the integer pixel. The pass's own depth
  // node (or getViewZNode) and a sampled read both build a size lookup, and
  // three r172 reuses the size variable that GTAO and denoise declared for
  // this texture without declaring it again: the shader failed to compile.
  const depthHere: N = textureLoad(scenePass.getTexture('depth'), ivec2(screenCoordinate.xy)).x;
  const viewDistM: N = perspectiveDepthToViewZ(depthHere, near, far).negate();
  const aoFactor: N = mix(aoNear, 1, smoothstep(WORLD_GPU_AO.fadeStartM, WORLD_GPU_AO.fadeEndM, viewDistM));

  const defaultLit = (): N => sceneColor.mul(aoFactor);
  let smaaNode: N = null;
  const applyOutput = (lit: N): void => {
    smaaNode?.dispose?.();
    smaaNode = smaa(renderOutput(lit));
    post.outputNode = smaaNode;
    post.needsUpdate = true;
  };
  applyOutput(defaultLit());

  let disposed = false;
  const handle: WorldGpuPostHandle = {
    renderer,
    scene,
    camera,
    post,
    scenePass,
    sceneColor,
    sceneDepth,
    aoFactor,
    ao: aoNode,
    setComposite(fn) {
      if (disposed) return;
      applyOutput(fn ? fn(defaultLit(), { sceneColor, sceneDepth, aoFactor }) : defaultLit());
    },
    render() {
      if (disposed) return;
      // The repo's other R3F WebGPU pages fire renderAsync and do not await it:
      // useFrame is synchronous and the renderer is already initialized.
      void post.renderAsync();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (current === handle) publish(null);
      // r172's PostProcessing declares dispose() in its types but its JS has
      // none; the passes own the render targets, so they are released here.
      (post as { dispose?: () => void }).dispose?.();
      smaaNode?.dispose?.();
      scenePass.dispose?.();
      aoNode.dispose?.();
      aoFactor.dispose?.();
    },
  };
  publish(handle);
  return handle;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
