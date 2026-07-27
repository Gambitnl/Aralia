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
/** Translate an FMG biome index → legacy biome id (fallback for out-of-range). */
export declare function wfBiomeIndexToLegacyId(index: number | undefined, fallback?: string): string;
/** Translate an FMG biome name → legacy biome id (fallback when unknown). */
export declare function wfBiomeNameToLegacyId(name: string | undefined, fallback?: string): string;
