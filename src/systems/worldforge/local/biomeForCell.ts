/**
 * @file biomeForCell.ts — the legacy biome id for an atlas cell (cell-native).
 *
 * The cell-native successor to reading a biome off a `coord_X_Y` grid tile: given
 * the player's canonical cell, return its biome straight from the FMG atlas
 * (`pack.cells.biome`) translated to the granular legacy `BIOMES` vocabulary. No
 * grid round-trip — the cell is the source of truth.
 *
 * Pure (aside from the bridge's per-seed atlas cache). Grid-retirement Phase A2.
 */
import { getBridgeAtlas } from '../bridge/legacySubmapBridge';
import { wfBiomeIndexToLegacyId } from './wfBiomeToLegacy';

/**
 * The legacy biome id of the given atlas cell, or `undefined` when the cell has
 * no biome entry (honest unknown — caller keeps its own fallback). For a land
 * cell this is always a real walkable biome id.
 */
export function biomeIdForCell(worldSeed: number, cellId: number): string | undefined {
  const atlas = getBridgeAtlas(worldSeed);
  const biomeIndex = (atlas.pack.cells as unknown as { biome?: ArrayLike<number> }).biome?.[cellId];
  if (biomeIndex == null) return undefined;
  return wfBiomeIndexToLegacyId(biomeIndex);
}
