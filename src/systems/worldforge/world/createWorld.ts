// @dependencies-start
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
// @dependencies-end

/**
 * @file createWorld.ts - one entry point for creating a Worldforge world.
 *
 * This file ties FMG generation to the Worldforge artifact spine. The FMG
 * `seedStr` controls the continent generator's random stream, while
 * `worldSeed` controls the Worldforge seed-path root used by lower layers.
 * Both values are part of world identity: changing either creates a different
 * world even if the visible options are identical.
 */
import {
  buildAtlasArtifact,
  type AtlasArtifactWithOptions,
} from '../adapter/atlasArtifact';
import {
  DEFAULT_WORLD_GEN_OPTIONS,
  type WorldGenOptions,
} from '../adapter/worldGenOptions';
import { generateFmgWorld, type FmgWorldOptions } from '../fmg/generateWorld';

// ---------------------------------------------------------------------------
// Created world shape
// ---------------------------------------------------------------------------
// The artifact carries the frozen options too, but returning `options`
// separately gives callers a stable place to read creation settings without
// knowing the artifact internals.
// ---------------------------------------------------------------------------

export interface CreatedWorld {
  artifact: AtlasArtifactWithOptions;
  options: Readonly<WorldGenOptions>;
}

// ---------------------------------------------------------------------------
// Option translation
// ---------------------------------------------------------------------------
// WorldGenOptions records unlocked map-size fields as null. FMG's generator
// expects undefined for unlocked optional inputs, so this adapter keeps the
// saved contract verbatim while calling FMG with the shape it already accepts.
// ---------------------------------------------------------------------------

function toFmgWorldOptions(options: WorldGenOptions): FmgWorldOptions {
  return {
    ...options,
    mapSize: options.mapSize ?? undefined,
    latitude: options.latitude ?? undefined,
    longitude: options.longitude ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Public creation entry point
// ---------------------------------------------------------------------------
// Generation is deterministic: same seedStr + worldSeed + options produces the
// same FMG world and therefore the same AtlasArtifact. Option freezing happens
// inside buildAtlasArtifact, so callers cannot mutate creation settings during
// play.
// ---------------------------------------------------------------------------

export function createWorld(
  seedStr: string,
  worldSeed: number,
  options: WorldGenOptions = DEFAULT_WORLD_GEN_OPTIONS,
): CreatedWorld {
  const fmgWorld = generateFmgWorld(seedStr, toFmgWorldOptions(options));
  const artifact = buildAtlasArtifact(fmgWorld, worldSeed, options);

  return {
    artifact,
    options: artifact.options,
  };
}
