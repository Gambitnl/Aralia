/**
 * @file wfBiomeToLegacy.ts — map a WF/FMG biome to a legacy `BIOMES` id.
 *
 * The WF world names biomes with the 13-entry FMG vocabulary (Marine, Savanna,
 * Taiga, …); gameplay/`mapData` uses the granular legacy `BIOMES` ids
 * (forest_temperate, plains_prairie, …). This is the translation primitive the
 * mapData-onto-WF unification needs — start here, wire the full grid later.
 *
 * Pure: no imports beyond the static table. Index order matches
 * `systems/worldforge/fmg/biomes.ts` `name[]`.
 */

/** FMG biome index → a representative WALKABLE legacy biome id (Marine = water). */
const WF_INDEX_TO_LEGACY: readonly string[] = [
  'coastal_reef',        // 0  Marine (water)
  'desert_dune',         // 1  Hot desert
  'desert_rocky',        // 2  Cold desert
  'plains_savanna',      // 3  Savanna
  'plains_prairie',      // 4  Grassland
  'jungle_monsoon',      // 5  Tropical seasonal forest
  'forest_temperate',    // 6  Temperate deciduous forest
  'jungle_tropical',     // 7  Tropical rainforest
  'forest_ancient',      // 8  Temperate rainforest
  'forest_boreal',       // 9  Taiga
  'tundra_permafrost',   // 10 Tundra
  'mountain_glacier',    // 11 Glacier
  'wetland_marsh',       // 12 Wetland
];

const WF_NAME_TO_INDEX: Record<string, number> = {
  Marine: 0, 'Hot desert': 1, 'Cold desert': 2, Savanna: 3, Grassland: 4,
  'Tropical seasonal forest': 5, 'Temperate deciduous forest': 6, 'Tropical rainforest': 7,
  'Temperate rainforest': 8, Taiga: 9, Tundra: 10, Glacier: 11, Wetland: 12,
};

/** Translate an FMG biome index → legacy biome id (fallback for out-of-range). */
export function wfBiomeIndexToLegacyId(index: number | undefined, fallback = 'plains_meadow'): string {
  if (index == null || index < 0 || index >= WF_INDEX_TO_LEGACY.length) return fallback;
  return WF_INDEX_TO_LEGACY[index];
}

/** Translate an FMG biome name → legacy biome id (fallback when unknown). */
export function wfBiomeNameToLegacyId(name: string | undefined, fallback = 'plains_meadow'): string {
  if (!name) return fallback;
  const idx = WF_NAME_TO_INDEX[name];
  return idx == null ? fallback : WF_INDEX_TO_LEGACY[idx];
}
