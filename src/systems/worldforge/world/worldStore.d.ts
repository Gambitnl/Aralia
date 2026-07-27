/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 12/06/2026, 03:10:00
 * Dependents: None (Orphan)
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file worldStore.ts - compact in-memory store for a generated Worldforge world.
 *
 * The store owns one world recipe: FMG seed string, Worldforge root seed,
 * creation options, and accumulated deltas. It regenerates the base artifact
 * from that recipe and applies deltas for the current view. Saves intentionally
 * do not contain generated cells; they persist only the recipe and mutations.
 */
import type { AtlasArtifactWithOptions } from '../adapter/atlasArtifact';
import type { WorldGenOptions } from '../adapter/worldGenOptions';
import { type ApplyDeltasResult } from '../delta/applyDeltas';
import type { WorldDelta } from '../delta/types';
export declare const WORLD_STORE_SCHEMA_VERSION = 1;
export interface SerializedWorldStore {
    schemaVersion: number;
    seedStr: string;
    worldSeed: number;
    options: WorldGenOptions;
    deltas: WorldDelta[];
}
export declare class WorldStore {
    private readonly seedStr;
    private readonly worldSeed;
    private readonly baseArtifact;
    private readonly options;
    private readonly deltas;
    private cachedView;
    constructor(seedStr: string, worldSeed: number, options: WorldGenOptions, deltas?: WorldDelta[]);
    view(): ApplyDeltasResult<AtlasArtifactWithOptions>;
    appendDelta(delta: WorldDelta): void;
    serialize(): string;
    static deserialize(json: string): WorldStore;
}
