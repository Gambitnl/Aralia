/**
 * @file architectureStyle.ts — regional architecture style families.
 *
 * Single source of truth for HOW a culture builds: palettes, roof shapes,
 * gatehouse forms, dock/bridge detailing. Shared by the 2D town map
 * (TownPlanView) and the 3D ground renderer, sibling of buildingStyle.ts.
 * A burg's family comes from its FMG culture TYPE — deterministic, and per
 * the no-fallback directive an unknown type is an ERROR, not a default.
 */
import type { Pt } from '../submap/submapEngine';
import type { BuildingType, StyleResolved } from '../interior/blueprintTypes';
import { rngFromPath, streamPath, type SeedPath } from '../seedPath';

export type RoofForm = 'gable' | 'hip' | 'steep' | 'flat';
export type GatehouseForm = 'twinTowers' | 'tunnelBlock' | 'singleTower';

export interface DeckDetail {
  /** Support-post spacing along dock/bridge edges (meters). */
  pilingSpacingM: number;
  railing: boolean;
  /** Parabolic mid-span lift for bridges (meters). 0 = flat span. */
  archRiseM: number;
}

export interface StyleFamily {
  id: 'highlandStone' | 'coastalTimber' | 'riverHalfTimber' | 'roughLog' | 'temperateFrame';
  wallPalette: string[];
  roofPalette: string[];
  roofForms: RoofForm[];
  gatehouseForms: GatehouseForm[];
  /** Town rampart tint. */
  wallTint: string;
  chimneys: boolean;
  deckDetail: DeckDetail;
}

export const STYLE_FAMILIES: Record<StyleFamily['id'], StyleFamily> = {
  highlandStone: {
    id: 'highlandStone',
    wallPalette: ['#8d8a83', '#7b786f', '#9a948a', '#6e6c66'],
    roofPalette: ['#4a5058', '#3f444b', '#565c63'],
    roofForms: ['steep', 'gable', 'hip'],
    gatehouseForms: ['twinTowers', 'singleTower'],
    wallTint: '#8a877f',
    chimneys: true,
    deckDetail: { pilingSpacingM: 3.5, railing: false, archRiseM: 1.2 },
  },
  coastalTimber: {
    id: 'coastalTimber',
    wallPalette: ['#9a8a6e', '#a89478', '#8c7a5e', '#b3a184'],
    roofPalette: ['#5e4a38', '#6d5540', '#514031'],
    roofForms: ['gable', 'hip'],
    gatehouseForms: ['singleTower', 'twinTowers'],
    wallTint: '#93865f',
    chimneys: true,
    deckDetail: { pilingSpacingM: 2.5, railing: true, archRiseM: 0.6 },
  },
  riverHalfTimber: {
    id: 'riverHalfTimber',
    wallPalette: ['#cfc0a2', '#d8ccb2', '#c2b191', '#b8a686'],
    roofPalette: ['#7a4a32', '#6d4029', '#8a5238'],
    roofForms: ['gable', 'steep', 'hip'],
    gatehouseForms: ['tunnelBlock', 'twinTowers'],
    wallTint: '#a09680',
    chimneys: true,
    deckDetail: { pilingSpacingM: 3, railing: true, archRiseM: 1.5 },
  },
  roughLog: {
    id: 'roughLog',
    wallPalette: ['#6f5a41', '#7c6549', '#5e4c37', '#87704f'],
    roofPalette: ['#7d6a3e', '#6e5d36', '#8c7845'],
    roofForms: ['gable', 'flat'],
    gatehouseForms: ['singleTower'],
    wallTint: '#6b5a43',
    chimneys: false,
    deckDetail: { pilingSpacingM: 4, railing: false, archRiseM: 0 },
  },
  temperateFrame: {
    id: 'temperateFrame',
    wallPalette: ['#9c7b54', '#a98a5f', '#8a6643', '#b89a72'],
    roofPalette: ['#7a4a32', '#7d6a3e', '#5e3a2c'],
    roofForms: ['hip', 'gable'],
    gatehouseForms: ['twinTowers', 'tunnelBlock', 'singleTower'],
    wallTint: '#9a9387',
    chimneys: true,
    deckDetail: { pilingSpacingM: 3, railing: true, archRiseM: 0.8 },
  },
};

/** FMG culture types (Azgaar): the closed vocabulary this table must cover. */
const CULTURE_TYPE_TO_FAMILY: Record<string, StyleFamily['id']> = {
  Highland: 'highlandStone',
  Naval: 'coastalTimber',
  Lake: 'coastalTimber',
  River: 'riverHalfTimber',
  Hunting: 'roughLog',
  Nomadic: 'roughLog',
  Generic: 'temperateFrame',
};

export function styleFamilyForCultureType(cultureType: string): StyleFamily {
  const id = CULTURE_TYPE_TO_FAMILY[cultureType];
  if (!id) throw new Error(`No architecture style family for culture type "${cultureType}"`);
  return STYLE_FAMILIES[id];
}

/**
 * FMG biome id → architectural ClimateClass. The closed vocabulary is the 13
 * biomes of `fmg/biomes.ts` Biomes.getDefault().name (ids 0-12):
 *   0 Marine, 1 Hot desert, 2 Cold desert, 3 Savanna, 4 Grassland,
 *   5 Tropical seasonal forest, 6 Temperate deciduous forest,
 *   7 Tropical rainforest, 8 Temperate rainforest, 9 Taiga, 10 Tundra,
 *   11 Glacier, 12 Wetland.
 * Keyed on the id (not the name) because that is what a burg's cell carries
 * (`atlas.pack.cells.biome[burg.cell]`, a Uint8Array of ids). Cold-frame
 * biomes (Cold desert, Taiga, Tundra, Glacier) drive steep snow-shed roofs;
 * Hot desert is the sole arid; Wetland is marsh; everything else is temperate.
 * The table is TOTAL over 0-12 — an out-of-range id is an ERROR (no-fallback
 * directive, mirroring styleFamilyForCultureType's throw), so an unmapped
 * biome fails honestly rather than defaulting to temperate.
 */
export const BIOME_TO_CLIMATE: Record<number, ClimateClass> = {
  0: 'temperate',  // Marine
  1: 'arid',       // Hot desert
  2: 'cold',       // Cold desert
  3: 'temperate',  // Savanna
  4: 'temperate',  // Grassland
  5: 'temperate',  // Tropical seasonal forest
  6: 'temperate',  // Temperate deciduous forest
  7: 'temperate',  // Tropical rainforest
  8: 'temperate',  // Temperate rainforest
  9: 'cold',       // Taiga
  10: 'cold',      // Tundra
  11: 'cold',      // Glacier
  12: 'marsh',     // Wetland
};

/** Resolve a burg's FMG biome id to a ClimateClass; throws on an id outside the
 *  closed 0-12 vocabulary (no-fallback — an unknown biome must not silently
 *  become temperate). */
export function climateForBiomeId(biomeId: number): ClimateClass {
  const climate = BIOME_TO_CLIMATE[biomeId];
  if (!climate) {
    throw new Error(
      `No climate class for FMG biome id ${biomeId} ` +
      `(known ids: ${Object.keys(BIOME_TO_CLIMATE).join(', ')})`,
    );
  }
  return climate;
}

/** Stable 0..1 hash of two ints (same recipe as townPlanAdapter.centroidHash01). */
export function hash01(a: number, b: number): number {
  let h = Math.imul((a | 0) + 374761393, 668265263) ^ Math.imul((b | 0) + 1, 2246822519);
  h = (h ^ (h >>> 13)) >>> 0;
  return h / 0xffffffff;
}

/** Bounding box of the plan the plot belongs to — the hashing reference frame. */
export interface StyleFrame { minX: number; minY: number; maxX: number; maxY: number; }

/** Bounding box of a polygon (typically the town plan's footprint). */
export function styleFrameOf(footprint: Pt[]): StyleFrame {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of footprint) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

function polyHash01(poly: Pt[], frame: StyleFrame, salt: number): number {
  let cx = 0, cy = 0;
  for (const [x, y] of poly) { cx += x; cy += y; }
  cx /= poly.length || 1; cy /= poly.length || 1;
  // Normalized 0..1 position inside the town footprint, quantized — invariant
  // under the scale+translate between the normalized 2D frame and region feet.
  const u = Math.round(((cx - frame.minX) / (frame.maxX - frame.minX || 1)) * 4096);
  const v = Math.round(((cy - frame.minY) / (frame.maxY - frame.minY || 1)) * 4096);
  return hash01(u + salt, v);
}

const pick = <T,>(arr: T[], h: number): T => arr[Math.min(arr.length - 1, Math.floor(h * arr.length))];

/**
 * Per-plot style picks, keyed on the plot POLYGON's position NORMALIZED to the
 * plan's footprint bbox (`frame`) — so the 2D map (engine plan, normalized
 * frame) and the 3D bake (artifact plan, region feet) derive identical
 * colors/forms for the same building despite the scale+translate between them.
 */
export function styledWallColor(fam: StyleFamily, poly: Pt[], frame: StyleFrame): string {
  return pick(fam.wallPalette, polyHash01(poly, frame, 0));
}
export function styledRoof(fam: StyleFamily, poly: Pt[], frame: StyleFrame): { form: RoofForm; color: string } {
  return {
    form: pick(fam.roofForms, polyHash01(poly, frame, 101)),
    color: pick(fam.roofPalette, polyHash01(poly, frame, 202)),
  };
}
export function styledGatehouseForm(fam: StyleFamily, gateIndex: number, burgId: number): GatehouseForm {
  return pick(fam.gatehouseForms, hash01(gateIndex + 11, burgId));
}

// ── resolveStyle: culture + climate + wealth → the resolved architectural dress ──

/** Climate class driving roof steepness, eave depth, and plinth. */
export type ClimateClass = 'temperate' | 'cold' | 'arid' | 'marsh';

export interface ResolveStyleInput {
  /** FMG culture type — mapped to a family (throws on unknown, no fallback). */
  cultureType: string;
  climate: ClimateClass;
  wealth: 'poor' | 'common' | 'wealthy';
  /**
   * Phase 3 driver — accepted and carried in the input now, but has NO effect
   * on the resolved style yet (weathering/patina rules land in Phase 3). Kept
   * in the signature so callers can wire it once without a later API break.
   */
  ageBand?: 'new' | 'aged' | 'old' | 'ancient';
  buildingType: BuildingType;
}

/** Wealth-restricted slice of a palette: poor → weathered FIRST half,
 *  wealthy → dressed LAST half, common → full range. Always ≥1 long. */
function tierSlice<T>(palette: T[], wealth: ResolveStyleInput['wealth']): T[] {
  if (palette.length <= 1) return palette;
  const mid = Math.ceil(palette.length / 2);
  if (wealth === 'poor') return palette.slice(0, mid);
  if (wealth === 'wealthy') return palette.slice(palette.length - mid);
  return palette;
}

/**
 * Resolve the full architectural dress for one building. THREE draws from the
 * `'style'` stream in a FIXED order regardless of input (roofForm, wall, roof)
 * so the stream stays refactor-stable; climate is pure post-processing of the
 * drawn form and consumes NO draws. Trim is derived deterministically from the
 * family's rampart tint (`wallTint`) — no draw.
 */
export function resolveStyle(input: ResolveStyleInput, path: SeedPath): StyleResolved {
  const fam = styleFamilyForCultureType(input.cultureType); // throws on unknown
  const rng = rngFromPath(streamPath(path, 'style'));

  // Draw 1: base roof form from the family's offered forms.
  let roofForm = pick(fam.roofForms, rng.next());

  // Climate overrides — deterministic, no extra draws.
  const offers = (f: RoofForm) => fam.roofForms.includes(f);
  if (input.climate === 'cold' && offers('steep')) roofForm = 'steep';
  else if (input.climate === 'arid' && offers('flat')) roofForm = 'flat';
  // Temple must never present a flat roof (temples get a pitched top); keep MAY
  // be flat (parapet). If a flat form slipped through for a temple, lift it to
  // the family's first non-flat form (or 'gable' as the universal pitched form).
  if (roofForm === 'flat' && input.buildingType === 'temple') {
    roofForm = fam.roofForms.find((f) => f !== 'flat') ?? 'gable';
  }

  // Draw 2 & 3: wall then roof color from the wealth-restricted palette slice.
  const wallColor = pick(tierSlice(fam.wallPalette, input.wealth), rng.next());
  const roofColor = pick(tierSlice(fam.roofPalette, input.wealth), rng.next());

  // pitchRiseFt: base 5, steep 8; cold ×1.4; flat → 0.
  let pitchRiseFt = roofForm === 'steep' ? 8 : 5;
  if (input.climate === 'cold') pitchRiseFt *= 1.4;
  if (roofForm === 'flat') pitchRiseFt = 0;

  // eaveOverhangFt: 1; cold 2 (snow shed), arid 0.5.
  const eaveOverhangFt =
    input.climate === 'cold' ? 2 : input.climate === 'arid' ? 0.5 : 1;

  return {
    familyId: fam.id,
    wallColor,
    roofColor,
    trimColor: fam.wallTint, // deterministic derivation — no draw
    roofForm,
    pitchRiseFt,
    eaveOverhangFt,
    finishTier: input.wealth,
    ornament: input.wealth === 'wealthy',
    raisedPlinth: input.climate === 'marsh',
  };
}
