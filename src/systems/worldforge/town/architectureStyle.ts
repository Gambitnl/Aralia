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
