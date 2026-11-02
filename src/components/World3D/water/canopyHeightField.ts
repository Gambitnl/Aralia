/**
 * @file canopyHeightField.ts — the tree tops the world water reflects.
 *
 * WHY (agora-257c, 2026-10-28, GG-528). Real still water reflects whatever
 * stands around it. A tree line 20 m tall and 30 m away fills a forest pond's
 * reflection up to about 34 degrees of elevation. The water only knew a fixed
 * band of low banks (under about 13 degrees), so a forest pond seen from 20
 * degrees or more reflected pale sky and read as a white sheet. A meadow pond
 * looked right, because low banks are what stand around it.
 *
 * WHAT. A height map of the tree crowns in the loaded window, in scene space:
 * one texel per cell holds the top of the tallest crown over that cell. The
 * WebGPU water (gpu/waterSurfaceNode.ts) walks its reflected ray across this
 * map and reflects canopy where the ray passes under a crown. A pond with
 * trees on one side only reflects them on that side.
 *
 * A plain module, like waterSkyState.ts: World3DScene writes it and the node
 * material binds the SAME texture and uniform objects, so no WebGPU code loads
 * into WebGL pages through this file.
 *
 * Crown sizes come from each tree's own unit-frame mesh (its bounding box),
 * not from a guessed ratio. Only the grown-tree path is measured: under
 * `?trees=preset` the field stays empty and says so on the console.
 */
import { DataTexture, DataUtils, HalfFloatType, LinearFilter, RedFormat, ClampToEdgeWrapping, Vector4 } from 'three';
import { buildGrownTreeBatches, type TreeBatchInput } from '@/systems/worldforge/vegetation/treeBatching';
import { grownTreeGeometry } from '@/systems/worldforge/vegetation/grownTreeVariants';

/** Texels per side. 512 at the 2 m floor covers a 1 km window. */
export const CANOPY_FIELD_TEXELS = 512;
/** The finest cell, meters. A crown is a few meters wide; finer buys nothing. */
const MIN_CELL_M = 2;
/** Value of a cell with no crown: far under any water surface. */
export const CANOPY_EMPTY_Y = -10000;
/**
 * A crown's height falls toward its rim: the top at the center, this share of
 * the crown height at the rim (a rounded crown, not a flat-topped disc).
 */
const RIM_HEIGHT_SHARE = 0.55;

const data = new Uint16Array(CANOPY_FIELD_TEXELS * CANOPY_FIELD_TEXELS);
const EMPTY_HALF = DataUtils.toHalfFloat(CANOPY_EMPTY_Y);
data.fill(EMPTY_HALF);

/** The map itself. Half float, so the GPU can filter it on every adapter. */
export const canopyFieldTexture = new DataTexture(data, CANOPY_FIELD_TEXELS, CANOPY_FIELD_TEXELS, RedFormat, HalfFloatType);
canopyFieldTexture.magFilter = LinearFilter;
canopyFieldTexture.minFilter = LinearFilter;
canopyFieldTexture.wrapS = ClampToEdgeWrapping;
canopyFieldTexture.wrapT = ClampToEdgeWrapping;
canopyFieldTexture.generateMipmaps = false;
canopyFieldTexture.needsUpdate = true;

/**
 * Where the map lies: (originX, originZ, 1 / field size in meters, unused).
 * Texture u runs along scene x and v along scene z.
 */
export const canopyFieldPlacement = new Vector4(0, 0, 1 / (CANOPY_FIELD_TEXELS * MIN_CELL_M), 0);

/** Unit-frame crown extents per (biome, variant): top y and widest radius. */
const crownExtents = new Map<string, { top: number; radius: number }>();
function crownExtentFor(biome: string, variant: number): { top: number; radius: number } {
  const key = `${biome}|${variant}`;
  const hit = crownExtents.get(key);
  if (hit) return hit;
  const p = grownTreeGeometry(biome, variant).positions;
  let top = 0;
  let radius = 0;
  for (let i = 0; i < p.length; i += 3) {
    top = Math.max(top, p[i + 1]);
    radius = Math.max(radius, Math.hypot(p[i], p[i + 2]));
  }
  const e = { top, radius };
  crownExtents.set(key, e);
  return e;
}

let warnedPreset = false;

/** The same `?trees=preset` flag VegetationTreeField reads, once at load. */
const PRESET_TREES =
  typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('trees') === 'preset';

/**
 * Rebuild the map from the trees the world draws. Call when the set of loaded
 * tree chunks changes. Under `?trees=preset` that path's meshes are not
 * measured here, so the map is emptied and the water reflects only the low
 * banks, as before this field existed.
 */
export function publishCanopyField(inputs: readonly TreeBatchInput[]): void {
  data.fill(EMPTY_HALF);
  if (PRESET_TREES) {
    if (!warnedPreset) {
      warnedPreset = true;
      console.warn('[world3d-water] ?trees=preset: the canopy field is empty; water reflects banks, not trees.');
    }
    canopyFieldTexture.needsUpdate = true;
    return;
  }
  const batches = buildGrownTreeBatches(inputs);

  // Extent of every crown, so the map covers the trees and nothing else.
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const b of batches) {
    const e = crownExtentFor(b.biome, b.variant);
    for (let n = 0; n < b.count; n++) {
      const r = e.radius * b.scale[n];
      minX = Math.min(minX, b.position[n * 3] - r);
      maxX = Math.max(maxX, b.position[n * 3] + r);
      minZ = Math.min(minZ, b.position[n * 3 + 2] - r);
      maxZ = Math.max(maxZ, b.position[n * 3 + 2] + r);
    }
  }
  if (!Number.isFinite(minX)) {
    canopyFieldTexture.needsUpdate = true;
    return;
  }
  // One empty texel ring on every side, so a clamped sample past the map edge
  // reads "no crown" and not the outermost tree.
  const usable = CANOPY_FIELD_TEXELS - 2;
  const cell = Math.max(MIN_CELL_M, (maxX - minX) / usable, (maxZ - minZ) / usable);
  const size = cell * CANOPY_FIELD_TEXELS;
  const originX = (minX + maxX) / 2 - size / 2;
  const originZ = (minZ + maxZ) / 2 - size / 2;
  canopyFieldPlacement.set(originX, originZ, 1 / size, 0);

  // Max of the crown tops in float, then one conversion to half per texel.
  const tops = new Float32Array(CANOPY_FIELD_TEXELS * CANOPY_FIELD_TEXELS).fill(CANOPY_EMPTY_Y);
  for (const b of batches) {
    const e = crownExtentFor(b.biome, b.variant);
    for (let n = 0; n < b.count; n++) {
      const s = b.scale[n];
      const x = b.position[n * 3];
      const baseY = b.position[n * 3 + 1];
      const z = b.position[n * 3 + 2];
      const h = e.top * s;
      const r = Math.max(e.radius * s, cell * 0.5);
      const i0 = Math.max(1, Math.floor((x - r - originX) / cell));
      const i1 = Math.min(CANOPY_FIELD_TEXELS - 2, Math.floor((x + r - originX) / cell));
      const j0 = Math.max(1, Math.floor((z - r - originZ) / cell));
      const j1 = Math.min(CANOPY_FIELD_TEXELS - 2, Math.floor((z + r - originZ) / cell));
      for (let j = j0; j <= j1; j++) {
        const cz = originZ + (j + 0.5) * cell - z;
        for (let i = i0; i <= i1; i++) {
          const cx = originX + (i + 0.5) * cell - x;
          const d2 = (cx * cx + cz * cz) / (r * r);
          if (d2 > 1) continue;
          const y = baseY + h * (1 - (1 - RIM_HEIGHT_SHARE) * d2);
          const k = j * CANOPY_FIELD_TEXELS + i;
          if (y > tops[k]) tops[k] = y;
        }
      }
    }
  }
  let filled = 0;
  for (let k = 0; k < tops.length; k++) {
    if (tops[k] !== CANOPY_EMPTY_Y) { data[k] = DataUtils.toHalfFloat(tops[k]); filled++; }
  }
  canopyFieldTexture.needsUpdate = true;
  // Dev hook, sibling to __wf3dTrees: what the field holds. A rig sets
  // `placement.z = 0` to sample only the empty corner texel, which turns the
  // tree reflection off for an A/B at one pose.
  if (typeof window !== 'undefined') {
    (window as unknown as { __wf3dCanopyField?: unknown }).__wf3dCanopyField = {
      placement: canopyFieldPlacement, cellM: cell, filledTexels: filled,
      trees: batches.reduce((n, b) => n + b.count, 0),
    };
  }
}
