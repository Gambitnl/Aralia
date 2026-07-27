/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/06/2026, 03:21:45
 * Dependents: systems/worldforge/world/worldStore.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file createWorld.ts - one entry point for creating a Worldforge world.
 *
 * This file ties FMG generation to the Worldforge artifact spine. The FMG
 * `seedStr` controls the continent generator's random stream, while
 * `worldSeed` controls the Worldforge seed-path root used by lower layers.
 * Both values are part of world identity: changing either creates a different
 * world even if the visible options are identical.
 */
import { type AtlasArtifactWithOptions } from '../adapter/atlasArtifact';
import { type WorldGenOptions } from '../adapter/worldGenOptions';
export interface CreatedWorld {
    artifact: AtlasArtifactWithOptions;
    options: Readonly<WorldGenOptions>;
}
export declare function createWorld(seedStr: string, worldSeed: number, options?: WorldGenOptions): CreatedWorld;
