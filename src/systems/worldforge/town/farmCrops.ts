/**
 * @file farmCrops.ts — the one crop a farmstead grows, and the field it grows it in.
 *
 * WHY. Worldforge grades the outskirts as farm, pasture or scrub
 * (`townEngine.ts` `buildOutskirts`) and scatters farmsteads across the farm
 * parcels (`population.ts`), but nothing ever says WHAT is grown. Every farm in
 * every town therefore reads the same. The retired RealmSmith prototype gave
 * each farmhouse a "family crop" and planted it in rows
 * (in `BuildingGenerator.ts`, retired 2026-09-23) — a cheap identity
 * signal Worldforge has no equivalent for (deepdive finding F8,
 * `docs/deepdives/realmsmith-vs-worldforge.md`).
 *
 * WHAT THIS IS. A pure, seeded mapping: farmstead → crop, and farmstead → the
 * farm parcel it works. It owns no geometry and draws nothing. The crop reaches
 * the eye through paths that already exist:
 *   • 3D props — `props/placementEngine.ts` dresses a `farm` plot carrying a
 *     `crop` with that crop's working kit (hives and baskets, or plough and
 *     sacks, or retting barrels and drying frames).
 *   • the parcel — `cropByParcel` keys the crop by farm-parcel index, so a
 *     surface that already draws outskirt parcels can tint or hatch the field
 *     it belongs to without learning anything new about farmsteads.
 *
 * Structural inputs only (`{ id, x, y }`, `{ polygon, kind }`): this module
 * must not import the town engine or the population model, because both of
 * those already import far too much, and the crop is a leaf fact.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 01/11/2026, 04:56:53
 * Dependents: None (Orphan)
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { SeedPath } from '../seedPath';
import { childSeedPath, rngFromPath, streamPath } from '../seedPath';

/** Plan-frame point, matching the town engine's own `Pt`. */
export type Pt = [number, number];

/**
 * What a farmstead grows. Four, because four is what a town needs for two
 * neighbouring farms to read apart, and each one has a DIFFERENT working kit
 * in the yard — a crop nobody can see the difference of is not an identity.
 */
export type FarmCrop = 'grain' | 'roots' | 'orchard-fruit' | 'flax';

/** The vocabulary, in the order the seeded pick draws from. */
export const FARM_CROPS: readonly FarmCrop[] = ['grain', 'roots', 'orchard-fruit', 'flax'];

/**
 * Relative share of each crop across a town's farms. Cereal is the staple
 * everywhere, so most farms grow it; flax is the specialist.
 */
const CROP_WEIGHTS: ReadonlyArray<readonly [FarmCrop, number]> = [
  ['grain', 0.45], ['roots', 0.25], ['orchard-fruit', 0.18], ['flax', 0.12],
];

/** The minimum a farmstead needs to be given a crop. */
export interface CropFarmstead {
  /** Source index into farm-only parcels. Legacy sources omit this field. */
  farmParcelIndex?: number;
  id: string;
  x: number;
  y: number;
}

/** The minimum a parcel needs to receive one. Only `kind: 'farm'` is tilled. */
export interface CropParcel {
  polygon: readonly Pt[];
  kind: string;
}

/**
 * The crop one farmstead grows. Seeded off the TOWN's seed path and the
 * farmstead's own id, so a farm keeps its crop however many other farmsteads
 * the plan gains or loses around it.
 */
export function cropForFarmstead(seedPath: SeedPath, farmsteadId: string): FarmCrop {
  const rng = rngFromPath(childSeedPath(streamPath(seedPath, 'farm-crop'), `f:${farmsteadId}`));
  let total = 0;
  for (const [, w] of CROP_WEIGHTS) total += w;
  let roll = rng.next() * total;
  for (const [crop, w] of CROP_WEIGHTS) {
    roll -= w;
    if (roll <= 0) return crop;
  }
  return CROP_WEIGHTS[CROP_WEIGHTS.length - 1][0];
}

/** One shared field has one crop, stable when neighboring households change. */
export function cropForFarmParcel(seedPath: SeedPath, farmParcelIndex: number): FarmCrop {
  if (!Number.isInteger(farmParcelIndex) || farmParcelIndex < 0)
    throw new Error('A farm crop requires a valid source parcel index.');
  return cropForFarmstead(seedPath, 'parcel:' + farmParcelIndex);
}

/** Centroid of a parcel polygon (area-weighted; degenerate rings fall to the mean). */
function polygonCentroid(poly: readonly Pt[]): Pt {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    const cross = x0 * y1 - x1 * y0;
    a += cross; cx += (x0 + x1) * cross; cy += (y0 + y1) * cross;
  }
  if (Math.abs(a) < 1e-9) {
    const n = poly.length || 1;
    return [
      poly.reduce((s, p) => s + p[0], 0) / n,
      poly.reduce((s, p) => s + p[1], 0) / n,
    ];
  }
  a *= 0.5;
  return [cx / (6 * a), cy / (6 * a)];
}

/** One town's crop assignment. */
export interface FarmCropAssignment {
  /** Crop per farmstead id — every farmstead has exactly one. */
  cropByFarmstead: Map<string, FarmCrop>;
  /**
   * Crop per parcel INDEX into the array that was passed in. Only farm parcels
   * that a farmstead actually works appear: a farm parcel with nobody on it
   * grows nothing, rather than being handed a crop that no farmhouse owns.
   */
  cropByParcel: Map<number, FarmCrop>;
}

/**
 * Explicit rural sources join the generation-time farm parcel ordinal and
 * share that field's stable crop. Distance cannot change a family's field.
 * Legacy sources retain their original per-house crop and nearest-centroid
 * projection, with the first claim supplying the coarse field display.
 * These are growing/use facts; neither branch grants legal ownership.
 */
export function assignFarmCrops(
  seedPath: SeedPath,
  farmsteads: readonly CropFarmstead[],
  parcels: readonly CropParcel[],
): FarmCropAssignment {
  const cropByFarmstead = new Map<string, FarmCrop>();
  const cropByParcel = new Map<number, FarmCrop>();

  // Keep the source ordinal even for malformed fields. Skipping a damaged
  // field must not shift every later household onto a different parcel.
  const farmSources = parcels.map((parcel,index)=>({parcel,index})).filter(({parcel})=>parcel.kind==='farm');
  const farmCentroids: Array<{ index: number; c: Pt }> = [];
  parcels.forEach((p, index) => {
    if (p.kind !== 'farm' || p.polygon.length < 3) return;
    farmCentroids.push({ index, c: polygonCentroid(p.polygon) });
  });

  const ordered = [...farmsteads].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const farm of ordered) {
    // Explicit source joins outrank distance. A moved marker cannot acquire a
    // neighbor's field, and families sharing one field agree on its crop.
    // An invalid saved join refuses; only legacy sources use the old proxy.
    if (farm.farmParcelIndex !== undefined) {
      const source = farmSources[farm.farmParcelIndex];
      if (!Number.isInteger(farm.farmParcelIndex) || !source || source.parcel.polygon.length < 3
        || source.parcel.polygon.some(point=>!point.every(Number.isFinite)))
        throw new Error('A farmstead refers to an unavailable source parcel.');
      const crop = cropForFarmParcel(seedPath, farm.farmParcelIndex);
      cropByFarmstead.set(farm.id, crop);
      cropByParcel.set(source.index, crop);
      continue;
    }
    const crop = cropForFarmstead(seedPath, farm.id);
    cropByFarmstead.set(farm.id, crop);
    let best = -1;
    let bestD = Infinity;
    for (const { index, c } of farmCentroids) {
      const d = (c[0] - farm.x) ** 2 + (c[1] - farm.y) ** 2;
      if (d < bestD) { bestD = d; best = index; }
    }
    if (best >= 0 && !cropByParcel.has(best)) cropByParcel.set(best, crop);
  }

  return { cropByFarmstead, cropByParcel };
}
