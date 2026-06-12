// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 11/06/2026, 03:21:46
 * Dependents: None (Orphan)
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
import {
  applyDeltas,
  type ApplyDeltasResult,
} from '../delta/applyDeltas';
import type { WorldDelta } from '../delta/types';
import { createWorld } from './createWorld';

// ---------------------------------------------------------------------------
// Store save schema
// ---------------------------------------------------------------------------
// This schema versions the compact world-store envelope. Delta records inside
// it still carry their own versions for replay compatibility.
// ---------------------------------------------------------------------------

export const WORLD_STORE_SCHEMA_VERSION = 1;

export interface SerializedWorldStore {
  schemaVersion: number;
  seedStr: string;
  worldSeed: number;
  options: WorldGenOptions;
  deltas: WorldDelta[];
}

// ---------------------------------------------------------------------------
// WorldStore
// ---------------------------------------------------------------------------
// `view()` is cached because applying deltas will become more expensive as
// lower layers and mutation types grow. Appending a delta invalidates the cache
// so the next view includes the new mutation.
// ---------------------------------------------------------------------------

export class WorldStore {
  private readonly baseArtifact: AtlasArtifactWithOptions;
  private readonly options: Readonly<WorldGenOptions>;
  private readonly deltas: WorldDelta[];
  private cachedView: ApplyDeltasResult<AtlasArtifactWithOptions> | null = null;

  constructor(
    private readonly seedStr: string,
    private readonly worldSeed: number,
    options: WorldGenOptions,
    deltas: WorldDelta[] = [],
  ) {
    const created = createWorld(seedStr, worldSeed, options);
    this.baseArtifact = created.artifact;
    this.options = created.options;
    this.deltas = [...deltas];
  }

  view(): ApplyDeltasResult<AtlasArtifactWithOptions> {
    if (!this.cachedView) {
      this.cachedView = applyDeltas(this.baseArtifact, this.deltas);
    }

    return this.cachedView;
  }

  appendDelta(delta: WorldDelta): void {
    this.deltas.push(delta);
    this.cachedView = null;
  }

  serialize(): string {
    return JSON.stringify({
      schemaVersion: WORLD_STORE_SCHEMA_VERSION,
      seedStr: this.seedStr,
      worldSeed: this.worldSeed,
      options: this.options,
      deltas: this.deltas,
    } satisfies SerializedWorldStore);
  }

  static deserialize(json: string): WorldStore {
    const parsed = JSON.parse(json) as SerializedWorldStore;

    if (parsed.schemaVersion !== WORLD_STORE_SCHEMA_VERSION) {
      throw new Error(
        `Unsupported WorldStore schema version ${parsed.schemaVersion}.`,
      );
    }

    return new WorldStore(
      parsed.seedStr,
      parsed.worldSeed,
      parsed.options,
      parsed.deltas,
    );
  }
}
