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
 * Give every farmstead its crop and carry that crop onto the farm parcel the
 * farmstead works — the nearest `farm` parcel by centroid distance.
 *
 * Farmsteads claim in id order, and a parcel keeps the FIRST crop claimed on
 * it, so two farmhouses sharing one field do not fight over what is growing in
 * it. Nothing here is random beyond `cropForFarmstead`, so the whole assignment
 * is stable for one seed path.
 */
export function assignFarmCrops(
  seedPath: SeedPath,
  farmsteads: readonly CropFarmstead[],
  parcels: readonly CropParcel[],
): FarmCropAssignment {
  const cropByFarmstead = new Map<string, FarmCrop>();
  const cropByParcel = new Map<number, FarmCrop>();

  const farmCentroids: Array<{ index: number; c: Pt }> = [];
  parcels.forEach((p, index) => {
    if (p.kind !== 'farm' || p.polygon.length < 3) return;
    farmCentroids.push({ index, c: polygonCentroid(p.polygon) });
  });

  const ordered = [...farmsteads].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const farm of ordered) {
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
