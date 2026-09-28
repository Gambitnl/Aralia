/**
 * @file oceanNormalMip.ts — a mip chain of the normal buffer, so a distant
 * pixel reads the MEAN normal under it and not one texel of it.
 *
 * WHY
 *
 * The normal buffer is a storage buffer read by hand, so it has no mip chain:
 * a pixel that covers many texels got one of them. From a deck the along-view
 * footprint at 300 m is 5 m, thirteen wind-sea texels, and the wind sea is
 * choppy, so its crests are ridges a texel or two wide. Point-sampling that
 * gave a grey speckle over the whole mid field, and every blind critic named
 * it first: static, sandpaper, salt-and-pepper. A four-tap box at the corners
 * of the footprint did not fix it, because four samples of thirteen texels is
 * still under-sampled. Fading the cascade out fixed the speckle and lost the
 * wave shading with it.
 *
 * A mip chain is the textbook answer. Each frame, after the FFT writes the
 * normal, a small compute pass copies it and averages it down level by level.
 * The fragment shader then reads the level whose texel matches the pixel's
 * footprint, trilinearly, and gets the mean slope and mean Jacobian under the
 * pixel: no aliasing, and the 20 to 97 m waves keep their lit face and shaded
 * back at 300 m because a 5 m average of a 30 m wave is still that wave.
 *
 * THE FFT IS NOT TOUCHED. This reads `bufs.norm` after the unpack kernel and
 * writes its own buffer. The determinism hash and the GPU-versus-CPU
 * cross-check read `bufs.disp` and are unaffected.
 *
 * W IS THE MEAN SQUARED SLOPE (distance round 3). The normal buffer's fourth
 * channel is unused, so level 0 writes each cell's squared slope there,
 * |(nx, nz) / ny|^2 with ny floored at 0.2 and the square capped at 4 (a
 * fold's spike), and each coarser level averages it as it averages the
 * normal. A read at any level then returns the mean slope (xyz) AND the mean
 * squared slope (w) under it, for no extra fetch: their difference is the
 * slope variance the average hides, which is the roughness a far pixel sees.
 * The surface reads it for its far texture (FAR_TEX_K in oceanSurface.ts).
 * Nothing read w before, so no frame changed when it was written.
 *
 * LAYOUT
 *
 * One buffer, cascade-major. Inside a cascade the levels follow one another,
 * level 0 first at n*n cells, then n/2 * n/2, and so on. The offset of level
 * L inside a cascade has a closed form, (4 n^2 - 4 nL^2) / 3 with nL = n >> L,
 * which is exact in integers for a power-of-two n, so the fragment shader can
 * address a dynamic level with no table.
 *
 * THE READ GOES THROUGH A FILTERED TEXTURE (performance pass, 2026-09-25).
 *
 * The chain is built in the buffer as before, and one more pass copies it
 * into a texture ATLAS that the fragment shader samples with the hardware's
 * bilinear filter. The hand-built read was the largest cost of the frame:
 * 3 cascades x 4 anisotropic taps x 2 levels x 4 buffer reads, 96 reads a
 * pixel with their address math, measured at about half the GPU frame (one
 * tap in place of four took the open-sea draw from 5.6 to 3.0 ms). Through
 * the atlas each level is ONE filtered fetch, 24 a pixel.
 *
 * THE ATLAS KEEPS THE OLD READ'S ARITHMETIC. Each cascade is a column of
 * `n + 2` texels; its levels stand one under the other, each with a one-texel
 * BORDER that holds the texels of the opposite edge. A bilinear fetch that
 * straddles a level's edge then reads the wrapped neighbor, which is what
 * the `bitAnd` wrap of the buffer read did, and never the next level. The
 * fetch point puts texel i of a level at the atlas texel center, so the
 * weights are the old `fract(texel)`: the same convention on every level.
 * The only numeric change is the hardware's weight precision and the
 * half-float storage, and the quality gate measured what that does to the
 * frame (see the pass report).
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/09/2026, 05:21:02
 * Dependents: systems/world3d/ocean/index.ts, systems/world3d/ocean/oceanSurface.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';
import { StorageBufferAttribute } from 'three/webgpu';
import {
  Fn,
  If,
  bitAnd,
  clamp,
  dot,
  float,
  floor,
  fract,
  instanceIndex,
  int,
  max,
  min,
  mix,
  shiftRight,
  storage,
  texture,
  textureStore,
  uint,
  uvec2,
  vec2,
  vec4,
} from 'three/tsl';
import { log2Exact } from './oceanConfig';
import type { OceanGpuBuffers } from './oceanCompute';

/**
 * A TSL node expression. See `oceanSurface.ts` for why this is `any`: three
 * 0.172 ships no type that names every concrete node class an expression can
 * produce.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TslNode = any;

export interface OceanNormalMip {
  /** The mip buffer, for a reader that wants the raw attribute. */
  readonly attr: StorageBufferAttribute;
  /** Compute nodes to run each frame, in order, after the FFT's unpack. */
  readonly dispatches: readonly TslNode[];
  /** Levels below level 0. */
  readonly levels: number;
  /**
   * Trilinear read of one cascade's normal at a world XZ position.
   *
   * @param world       vec2 world XZ, meters. The GRID position, not the
   *                    displaced one; see `vSample` in oceanSurface.
   * @param cascadeIdx  which cascade.
   * @param patchM      that cascade's patch size, meters.
   * @param level       float node, 0 to `levels`. Fractional levels blend the
   *                    two nearest.
   */
  sample(world: TslNode, cascadeIdx: number, patchM: number, level: TslNode): TslNode;
  /**
   * The top level of one cascade's chain, one fetch: the mean over the whole
   * patch. xyz is the mean normal, w the patch's mean squared slope.
   */
  sampleTop(cascadeIdx: number, patchM: number): TslNode;
}

/** Cells in one cascade's whole chain: n^2 + (n/2)^2 + ... down to `levels`. */
function cellsPerCascade(n: number, levels: number): number {
  let total = 0;
  for (let l = 0; l <= levels; l += 1) total += (n >> l) * (n >> l);
  return total;
}

/**
 * Build the chain over a set of GPU buffers.
 *
 * @param levels  levels below level 0. The default runs the chain all the way
 *                to one cell, the mean of the whole patch. That matters for
 *                the ripple: its 13 m patch under a 5 m footprint asks for a
 *                level past 4 cells a side, and stopping there left a random
 *                4x4 slope pattern tiling the mid field every 13 m. The mean
 *                of a whole patch is the correct limit, and it is near zero.
 */
export function createOceanNormalMip(
  bufs: OceanGpuBuffers,
  levels = log2Exact(bufs.n),
): OceanNormalMip {
  const n = bufs.n;
  const logN = log2Exact(n);
  if (levels < 1 || levels > logN) {
    throw new Error(
      `[ocean] Normal mip levels must be 1 to ${logN} for a ${n} grid, got ${levels}.`,
    );
  }
  const cells = n * n;
  const cascades = bufs.cascades;
  const perCascade = cellsPerCascade(n, levels);

  const attr = new StorageBufferAttribute(new Float32Array(perCascade * cascades * 4), 4);
  const src = storage(bufs.norm, 'vec4', bufs.norm.count).toReadOnly();
  const mipRW = storage(attr, 'vec4', attr.count);
  const mipRO = storage(attr, 'vec4', attr.count).toReadOnly();

  /** Offset of level L inside a cascade, in cells. JS side, for the kernels. */
  const levelOffset = (l: number): number => {
    let off = 0;
    for (let j = 0; j < l; j += 1) off += (n >> j) * (n >> j);
    return off;
  };

  const dispatches: TslNode[] = [];

  // ONE TRILINEAR FETCH WAS TRIED (performance pass, iteration 9) and failed
  // the quality bar: a real mip chain per cascade, sampled once per tap, puts
  // level L's texel i at its true center (i + 0.5) / nL, where this chain's
  // read puts it at the corner, 0.5 (2^L - 1) level-0 texels off. The move
  // shifted the mid-field glints, 2.7% of the open-sea pixels and 3.8% of the
  // wake scene's by over 8/255. Correcting that placement is a LOOK change,
  // to be judged blind, not a speed change.

  // Level 0 is a copy. The normal buffer and the chain are laid out
  // differently (the chain has the coarser levels between cascades), so the
  // copy is what makes one addressing rule serve every level. The copy puts
  // the cell's squared slope in the unused w (see W IS THE MEAN SQUARED
  // SLOPE); xyz is copied as before.
  dispatches.push(Fn(() => {
    const i = int(instanceIndex);
    const cascade = shiftRight(i, int(2 * logN));
    const cell = bitAnd(i, int(cells - 1));
    const nv = src.element(i).toVar();
    const sl = vec2(nv.x, nv.y).div(max(nv.z, float(0.2)));
    mipRW.element(cascade.mul(int(perCascade)).add(cell))
      .assign(vec4(nv.x, nv.y, nv.z, min(dot(sl, sl), float(4))));
  })().compute(cells * cascades));

  // Each coarser level averages the four cells of the finer one under it.
  // The averaged Jacobian is the mean Jacobian, which is what the foam term
  // wants at range: a fold under one texel of a thirteen-texel pixel is not a
  // whitecap, it is a shade of grey.
  for (let l = 1; l <= levels; l += 1) {
    const nL = n >> l;
    const nP = n >> (l - 1);
    const offL = levelOffset(l);
    const offP = levelOffset(l - 1);
    const cellsL = nL * nL;
    dispatches.push(Fn(() => {
      const i = int(instanceIndex);
      const cascade = i.div(int(cellsL));
      const cell = i.sub(cascade.mul(int(cellsL)));
      const z = cell.div(int(nL));
      const x = cell.sub(z.mul(int(nL)));
      const base = cascade.mul(int(perCascade));
      const pz = z.mul(int(2));
      const px = x.mul(int(2));
      const at = (xx: TslNode, zz: TslNode) => mipRW.element(
        base.add(int(offP)).add(zz.mul(int(nP))).add(xx),
      );
      const sum = at(px, pz)
        .add(at(px.add(int(1)), pz))
        .add(at(px, pz.add(int(1))))
        .add(at(px.add(int(1)), pz.add(int(1))));
      mipRW.element(base.add(int(offL)).add(z.mul(int(nL))).add(x))
        .assign(vec4(sum.mul(float(0.25))));
    })().compute(cellsL * cascades));
  }

  /* THE ATLAS. Cascade c's column starts at x = c (n + 2); level L's region
   * starts at row yL = sum over j < L of ((n >> j) + 2), which is
   * 2n - 2 (n >> L) + 2L in closed form, so a dynamic level needs no table.
   * Region L is (n >> L) + 2 texels square: the level plus its border. */
  const colW = n + 2;
  const levelRow: number[] = [];
  let rows = 0;
  for (let l = 0; l <= levels; l += 1) {
    levelRow.push(rows);
    rows += (n >> l) + 2;
  }
  const atlasW = colW * cascades;
  const atlasH = rows;
  const atlas = new THREE.StorageTexture(atlasW, atlasH);
  atlas.type = THREE.HalfFloatType;
  atlas.wrapS = THREE.ClampToEdgeWrapping;
  atlas.wrapT = THREE.ClampToEdgeWrapping;
  atlas.magFilter = THREE.LinearFilter;
  atlas.minFilter = THREE.LinearFilter;
  atlas.generateMipmaps = false;

  // The copy into the atlas, after the chain is complete. One thread per
  // atlas texel; texels right of a narrow level's region are left empty.
  // Measured A/B against the buffer read in the same minutes (perf iteration
  // 2): overall frame time 6.48 -> 4.32 ms across five scenes, the open-sea
  // draw 5.3 -> 3.0 ms, and 0.009% of pixels at most moved by over 8/255.
  {
    dispatches.push(Fn(() => {
      const i = int(instanceIndex);
      const v = i.div(int(atlasW));
      const u = i.sub(v.mul(int(atlasW)));
      const c = u.div(int(colW));
      const lu = u.sub(c.mul(int(colW)));
      const y0 = int(0).toVar();
      const s = int(n).toVar();
      for (let l = 1; l <= levels; l += 1) {
        If(v.greaterThanEqual(int(levelRow[l])), () => {
          y0.assign(int(levelRow[l]));
          s.assign(int(n >> l));
        });
      }
      const lv = v.sub(y0);
      If(lu.lessThan(s.add(int(2))), () => {
        const m = s.sub(int(1));
        // Border texels (local -1 and s) wrap to the opposite edge.
        const ix = bitAnd(lu.sub(int(1)).add(s), m);
        const iz = bitAnd(lv.sub(int(1)).add(s), m);
        const offL = int(4 * cells).sub(s.mul(s).mul(int(4))).div(int(3));
        const val = mipRO.element(c.mul(int(perCascade)).add(offL).add(iz.mul(s)).add(ix));
        textureStore(atlas, uvec2(uint(u), uint(v)), val);
      });
    })().compute(atlasW * atlasH));
  }

  /** Bilinear read at one integer level through the atlas: one filtered fetch. */
  const sampleLevelAtlas = (
    world: TslNode,
    cascadeIdx: number,
    patchM: number,
    levelInt: TslNode,
  ): TslNode => {
    const nL = shiftRight(int(n), levelInt);
    const m = nL.sub(int(1));
    const tex = world.div(float(patchM)).mul(float(nL));
    const base = floor(tex);
    const f = fract(tex);
    const x0 = bitAnd(int(base.x), m);
    const z0 = bitAnd(int(base.y), m);
    const yL = int(2 * n).sub(nL.mul(int(2))).add(levelInt.mul(int(2)));
    // Texel i of the level sits at atlas texel (origin + 1 + i); its center
    // is + 0.5, so the filter weights are f, as in the buffer read.
    const x = float(int(cascadeIdx * colW + 1).add(x0)).add(f.x).add(float(0.5));
    const y = float(yL.add(int(1)).add(z0)).add(f.y).add(float(0.5));
    return texture(atlas, vec2(x.div(float(atlasW)), y.div(float(atlasH)))).level(float(0));
  };

  const sample = (
    world: TslNode,
    cascadeIdx: number,
    patchM: number,
    level: TslNode,
  ): TslNode => {
    const lv = clamp(level, float(0), float(levels)).toVar();
    const lo = floor(lv).toVar();
    const t = lv.sub(lo);
    const loI = int(lo);
    // The upper level is clamped so the top of the chain reads itself twice
    // rather than one cell past the end.
    const hiI = int(clamp(lo.add(float(1)), float(0), float(levels)));
    const sampleLevel = sampleLevelAtlas;
    return mix(
      sampleLevel(world, cascadeIdx, patchM, loI),
      sampleLevel(world, cascadeIdx, patchM, hiI),
      t,
    );
  };

  // The top level is one cell inside its border, so any point reads its
  // center exactly.
  const sampleTop = (cascadeIdx: number, patchM: number): TslNode =>
    sampleLevelAtlas(vec2(float(0), float(0)), cascadeIdx, patchM, int(levels));

  return { attr, dispatches, levels, sample, sampleTop };
}
