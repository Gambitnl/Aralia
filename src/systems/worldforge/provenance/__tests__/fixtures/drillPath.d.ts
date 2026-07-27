import type { GroundWorld } from '../../../bridge/groundChunkLoader';
import type { LocalArtifact, RegionArtifact } from '../../../artifacts';
import type { Pack } from '../../../fmg/features';
export declare const GOLDEN_WORLD_SEED = 12345;
export declare const GRID_COLS = 64;
export declare const GRID_ROWS = 64;
export interface GoldenDrillPath {
    pack: Pack;
    cellId: number;
    burgId: number;
    /** FMG biome id the submap pipeline actually used for the local */
    biomeIdUsed: number;
    region: RegionArtifact;
    local: LocalArtifact;
    ground: GroundWorld;
}
/**
 * Deterministically drills one settlement cell World -> Region -> Local -> Ground.
 * Picks the first burg-bearing tile on a 64x64 grid for the golden seed.
 */
export declare function buildGoldenDrillPath(): GoldenDrillPath;
