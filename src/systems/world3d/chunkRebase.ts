/**
 * @file chunkRebase.ts
 * @description Shift chunk-local geometry positions by a whole number of
 * chunks, so every terrain mesh in the streamed window can render under ONE
 * shared transform (the anchor chunk's) instead of a per-chunk translation.
 *
 * Why this is built this way:
 * - Two neighbouring chunks emit border vertices at the same world point, but
 *   with per-mesh transforms each side reaches clip space through a DIFFERENT
 *   modelView matrix (view × its own translation, rounded to float32 on
 *   upload). The two paths disagree in the last ulp, and the rasterizer leaks
 *   a faint dotted hairline of background pixels along chunk borders.
 * - Chunk offsets are multiples of CHUNK_WORLD_SIZE (128) and vertex spacings
 *   are multiples of 8 m, so adding `deltaChunks * 128` to the local x/z is
 *   EXACT in float32: both sides of a seam store bit-identical position
 *   attributes. Rendering them under one shared mesh transform then guarantees
 *   bit-identical clip coordinates — the GPU's watertight-rasterization rule
 *   applies and the hairline cannot exist.
 * - The anchor is the scene-origin chunk (frozen at mount, like the floating
 *   origin), so rebased coordinates stay small and float-precision stays high.
 */

import { WORLD3D_CONFIG } from './config';

const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;

/**
 * Returns a copy of `positions` with x/z shifted by a whole number of chunks
 * (dcx/dcy, in chunk units). Pure; the input array is untouched.
 */
export function rebaseChunkPositions(
  positions: Float32Array,
  dcx: number,
  dcy: number,
): Float32Array {
  if (dcx === 0 && dcy === 0) return positions.slice();
  const out = positions.slice();
  const dx = dcx * S;
  const dz = dcy * S;
  for (let v = 0; v < out.length; v += 3) {
    out[v] += dx;
    out[v + 2] += dz;
  }
  return out;
}
