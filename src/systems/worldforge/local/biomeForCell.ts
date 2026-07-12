/**
 * @file biomeForCell.ts — the legacy biome id for an atlas cell (cell-native).
 *
 * The cell-native successor to reading a biome off a `coord_X_Y` grid tile: given
 * the player's canonical cell, return its biome straight from the FMG atlas
 * (`pack.cells.biome`) translated to the granular legacy `BIOMES` vocabulary. No
 * grid round-trip — the cell is the source of truth.
 *
 * Pure (aside from the bridge's per-seed atlas cache). Grid-retirement Phase A2.
 *
 * Forests campaign (2026-07-11): cells inside a HAUNTED or FEY named forest
 * escalate to the matching legacy biome (`forest_haunted` / `forest_fey`) —
 * escalate-only, so ordinary/ancient forests and non-forest cells keep exactly
 * the plain `wfBiomeIndexToLegacyId` mapping they always had.
 *
 * Mountains campaign (2026-07-11): after forest kinds, cells classify by
 * elevation (`rangeForCell.elevationClassForCell`) — peaks escalate to
 * `mountain_crag`, other h >= 70 cells to `mountain_alpine`, named-range
 * shoulders (50 <= h < 70) to `highland_plateau`, and low pockets ringed by
 * range cells to `highland_vale`. Escalate-only again: Glacier cells (index
 * 11) keep `mountain_glacier` via the plain table, and every cell with no
 * elevation class and no forest kind returns exactly the value it always had.
 */
import { getBridgeAtlas } from '../bridge/legacySubmapBridge';
import { lookupForAtlas } from '../forests/forestKindForCell';
import { elevationClassForCell, type ElevationClass } from '../mountains/rangeForCell';
import { wfBiomeIndexToLegacyId } from './wfBiomeToLegacy';

/** Elevation class → the legacy biome id it revives (spec §3 first bullet). */
const ELEVATION_TO_LEGACY: Record<ElevationClass, string> = {
  crag: 'mountain_crag',
  alpine: 'mountain_alpine',
  plateau: 'highland_plateau',
  vale: 'highland_vale',
};

/**
 * The legacy biome id of the given atlas cell, or `undefined` when the cell has
 * no biome entry (honest unknown — caller keeps its own fallback). For a land
 * cell this is always a real walkable biome id. Escalation order (file
 * header): haunted/fey named forests, then elevation class, then the plain
 * mapping.
 */
export function biomeIdForCell(worldSeed: number, cellId: number): string | undefined {
  const atlas = getBridgeAtlas(worldSeed);
  const biomeIndex = (atlas.pack.cells as unknown as { biome?: ArrayLike<number> }).biome?.[cellId];
  if (biomeIndex == null) return undefined;
  const kind = lookupForAtlas(atlas)(cellId); // same atlas object → shared WeakMap build
  if (kind === 'haunted') return 'forest_haunted';
  if (kind === 'fey') return 'forest_fey';
  const elevation = elevationClassForCell(atlas, cellId); // same atlas object again
  if (elevation != null) return ELEVATION_TO_LEGACY[elevation];
  return wfBiomeIndexToLegacyId(biomeIndex);
}
