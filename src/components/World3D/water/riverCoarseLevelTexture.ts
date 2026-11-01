/**
 * THE COARSE FAR LEVEL TEXTURE (2026-10-27, GG-430).
 *
 * The live flow map no longer fills the water level of every cell far from
 * the water. Those cells carry RIVER_FAR_LEVEL in the level channel (t0.w),
 * and each picture carries the coarse level grid (one value for each 4 x 4
 * cells) that the old map interpolated into them. This texture holds that
 * grid. The bank shader reads it where a flow texel is a far cell
 * (createRiverBankMaterial), so the banks see the same smooth level as before
 * without a whole-grid fill and a whole-texture upload for each picture.
 *
 * Half floats, as the flow textures: the old path stored the same values
 * there in half precision.
 */

import * as THREE from 'three/webgpu';
import type { RiverCoarseLevel } from '@/systems/world3d/river/riverFlowPatch';
import { toHalfBits } from '@/systems/world3d/river/riverWaterSheet';

/** The coarse grid's cell, in flow-map cells (flowMapCore's `q`). */
const COARSE_Q = 4;

export interface RiverCoarseLevelTexture {
  texture: THREE.DataTexture;
  /**
   * Flow-map uv to coarse-texture uv. The coarse grid covers ceil(nx / 4)
   * cells, a little more than the map, so the scale is nx / (4 cx) per axis.
   */
  scale: THREE.Vector2;
}

export function riverCoarseLevelTexture(grid: { nx: number; nz: number }): RiverCoarseLevelTexture {
  const cx = Math.ceil(grid.nx / COARSE_Q), cz = Math.ceil(grid.nz / COARSE_Q);
  const texture = new THREE.DataTexture(new Uint16Array(cx * cz), cx, cz, THREE.RedFormat, THREE.HalfFloatType);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return { texture, scale: new THREE.Vector2(grid.nx / (COARSE_Q * cx), grid.nz / (COARSE_Q * cz)) };
}

/** Write a picture's coarse grid. A grid of another size is skipped with a warning (the texture keeps its size). */
export function writeRiverCoarseLevel(target: RiverCoarseLevelTexture, coarse: RiverCoarseLevel): void {
  const image = target.texture.image as { data: Uint16Array; width: number; height: number };
  if (coarse.cx !== image.width || coarse.cz !== image.height || coarse.q !== COARSE_Q) {
    console.warn(`[river] coarse level ${coarse.cx}x${coarse.cz}/q${coarse.q} does not fit the ${image.width}x${image.height} texture; far banks keep the old level.`);
    return;
  }
  const data = image.data;
  for (let k = 0; k < data.length; k += 1) data[k] = toHalfBits(coarse.data[k]);
  target.texture.needsUpdate = true;
}
