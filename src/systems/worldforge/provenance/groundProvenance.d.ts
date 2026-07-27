import type { GroundWorld } from '../bridge/groundChunkLoader';
import type { CellFacts } from './worldCell';
import type { EntityVerdict } from './types';
import type { RegionArtifact } from '../artifacts';
/** Terrain: the biome the submap used must equal the cell's biome fact. */
export declare function classifyTerrainBiome(facts: CellFacts, biomeIdUsed: number): EntityVerdict;
/** Towns trace to the cell's burg; individual buildings elaborate that town. */
export declare function classifyTownsAndBuildings(cellBurgId: number, ground: GroundWorld): EntityVerdict[];
/** Hostiles trace to region markers/zones (which the worldmap cell seeds). */
export declare function classifyHostiles(region: RegionArtifact, ground: GroundWorld): EntityVerdict[];
/** Vegetation/rock scatter elaborates the inherited biome. */
export declare function classifyFeatures(ground: GroundWorld): EntityVerdict[];
/**
 * Hidden sites are off-map discovery points. They should trace to a region
 * marker. Until that anchor is wired, an unanchored hidden site is surfaced as
 * a 'warn' orphan (non-blocking this slice) rather than silently accepted.
 */
export declare function classifyHiddenSites(region: RegionArtifact, ground: GroundWorld): EntityVerdict[];
