/**
 * @file oceanSampler.ts — the one read of a cascade plane, shared.
 *
 * WHY THIS IS ITS OWN FILE
 *
 * The bilinear read of an FFT plane at a world position, and the distance
 * roll-off of one cascade, are the arithmetic that puts a hull on the drawn
 * water. `oceanSurface.ts` used to hold both as closures inside
 * `createOceanSurface`, so `oceanBuoyancyProbe.ts` mirrored them node for
 * node (GG-273). Two copies of that arithmetic drift: a change to the surface
 * moved the water a floating body sampled. Now there is one definition, and
 * the surface and the probe both call it.
 *
 * SAMPLING IS MANUAL BILINEAR FROM A STORAGE BUFFER
 *
 * The FFT output lives in storage buffers, so there is no hardware filtering.
 * Each sample is four reads and three mixes. The index wrap is a mask, not a
 * modulo: the grid edge is a power of two, and TSL's integer `.mod()`
 * miscompiles to WGSL silently. A negative index masks correctly in two's
 * complement, which is exactly the wrap wanted.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 25/09/2026, 05:21:02
 * Dependents: components/DesignPreview/steps/sidebyside/oceanExtras/buoys.ts, systems/world3d/ocean/index.ts, systems/world3d/ocean/oceanBuoyancyProbe.ts, systems/world3d/ocean/oceanFoam.ts, systems/world3d/ocean/oceanSeabed.ts, systems/world3d/ocean/oceanSpray.ts, systems/world3d/ocean/oceanSurface.ts, systems/world3d/ocean/oceanUnderwater.ts, systems/world3d/ocean/oceanWake.ts, systems/world3d/ocean/oceanWakeBoat.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {
  bitAnd,
  float,
  floor,
  fract,
  int,
  mix,
  smoothstep,
  storage,
  texture,
  vec2,
} from 'three/tsl';
import type { CascadeLod } from './oceanConfig';
import { log2Exact } from './oceanConfig';
import type { OceanGpuBuffers } from './oceanCompute';

/**
 * A TSL node expression. See `oceanSurface.ts` for why this is `any`: three
 * 0.172 ships no type that names every concrete node class an expression can
 * produce.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TslNode = any;

export interface OceanSampler {
  /** The displacement planes, read-only: dispX, height, dispZ, Jacobian. */
  readonly disp: TslNode;
  /** The normal planes, read-only: nx, nz, Jacobian, unused. */
  readonly norm: TslNode;
  /**
   * Bilinear read of one cascade's plane in `buf` at a world XZ position.
   *
   * @param buf         `disp`, `norm`, or any storage node laid out as
   *                    cascade-major n*n cells.
   * @param world       vec2 world XZ, meters.
   * @param cascadeIdx  which cascade's plane.
   * @param patchM      that cascade's patch size, meters.
   */
  sampleCascade(buf: TslNode, world: TslNode, cascadeIdx: number, patchM: number): TslNode;
  /**
   * The distance roll-off for one cascade, 0 to 1, measured from the patch
   * center. See `CascadeLod` in oceanConfig for what each range means.
   */
  cascadeLod(world: TslNode, lod: CascadeLod): TslNode;
}

/**
 * Build the sampler over a set of GPU buffers.
 *
 * @param uCenter  the `uniform(Vector2)` the patch is centered on. The range
 *                 fade measures from it; the sample coordinate does not, since
 *                 the caller already adds it to the grid position.
 */
export function createOceanSampler(
  bufs: OceanGpuBuffers,
  uCenter: TslNode,
  opts: {
    /**
     * Read the sampler's own `disp` and `norm` through the bordered atlases
     * (`OceanGpuBuffers.dispTex`, `.normTex`): one hardware-bilinear fetch in
     * place of four buffer reads and their address math (performance pass,
     * 2026-09-25). For the RENDER-side readers: the surface's vertex shader,
     * the floor's refraction and the view from below. The compute readers
     * (spray, wake, buoyancy) leave it off and keep the exact fp32 read, so
     * no physics changes. The atlas is half float and the hardware filter
     * weighs in fixed point, so a drawn height can differ from the buffer
     * read by a few millimeters: below a pixel everywhere (GG-273's hull
     * still sits on the drawn water).
     */
    readonly filtered?: boolean;
  } = {},
): OceanSampler {
  const n = bufs.n;
  // Validates that n is radix-2 before any index math assumes it.
  log2Exact(n);
  const cells = n * n;

  const disp = storage(bufs.disp, 'vec4', bufs.disp.count).toReadOnly();
  const norm = storage(bufs.norm, 'vec4', bufs.norm.count).toReadOnly();

  // Measured A/B (perf iteration 5): overall frame time 4.00 -> 3.54 ms across
  // five scenes (the shallows 4.4 -> 2.9, the view from below 2.4 -> 1.9), and
  // at most 0.1% of pixels moved by over 8/255, as scattered glint flips.
  const filtered = opts.filtered === true;
  const colW = n + 2;
  const atlasW = colW * bufs.cascades;

  /** The atlas read: texel i of the plane sits at atlas texel (column + 1 + i). */
  const sampleAtlas = (tex: unknown, world: TslNode, cascadeIdx: number, patchM: number): TslNode => {
    const texel = world.div(float(patchM)).mul(float(n));
    const base = floor(texel);
    const f = fract(texel);
    const m = int(n - 1);
    const x0 = bitAnd(int(base.x), m);
    const z0 = bitAnd(int(base.y), m);
    const x = float(int(cascadeIdx * colW + 1).add(x0)).add(f.x).add(float(0.5));
    const y = float(int(1).add(z0)).add(f.y).add(float(0.5));
    return texture(tex as never, vec2(x.div(float(atlasW)), y.div(float(colW)))).level(float(0));
  };

  const sampleCascade = (
    buf: TslNode,
    world: TslNode,
    cascadeIdx: number,
    patchM: number,
  ): TslNode => {
    if (filtered && buf === disp) return sampleAtlas(bufs.dispTex, world, cascadeIdx, patchM);
    if (filtered && buf === norm) return sampleAtlas(bufs.normTex, world, cascadeIdx, patchM);
    const texel = world.div(float(patchM)).mul(float(n));
    const base = floor(texel);
    const f = fract(texel);

    const ix = int(base.x);
    const iz = int(base.y);
    const m = int(n - 1);
    const x0 = bitAnd(ix, m);
    const x1 = bitAnd(ix.add(int(1)), m);
    const z0 = bitAnd(iz, m);
    const z1 = bitAnd(iz.add(int(1)), m);
    const off = int(cascadeIdx * cells);

    const at = (xi: TslNode, zi: TslNode) => buf.element(
      off.add(bitAnd(zi, m).mul(int(n))).add(xi),
    );

    const a = at(x0, z0);
    const b = at(x1, z0);
    const c = at(x0, z1);
    const d = at(x1, z1);
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  };

  /**
   * Beyond `startM` the mesh spacing exceeds that cascade's wave scale, so
   * the contribution is rolled off rather than aliased. Each cascade carries
   * its own range and its own floor: the ripple is gone by 48 m, the swell
   * keeps 60% of itself forever, because a 126 m wave is still resolvable at
   * 3 km.
   */
  const cascadeLod = (world: TslNode, lod: CascadeLod): TslNode => {
    const r = world.sub(uCenter).length();
    const k = float(1).sub(smoothstep(float(lod.startM), float(lod.endM), r));
    return k.mul(float(1 - lod.floor)).add(float(lod.floor));
  };

  return { disp, norm, sampleCascade, cascadeLod };
}
