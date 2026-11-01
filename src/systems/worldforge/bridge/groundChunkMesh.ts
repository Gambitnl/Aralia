/**
 * Assemble the same ground mesh for the inline loader and mesh worker.
 * Callers supply the existing pure terrain and vegetation samplers, so this
 * shared assembly never imports the loader at runtime or closes its worker cycle.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/10/2026, 20:25:19
 * Dependents: systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/bridge/groundChunkWorkerCore.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { ChunkMeshBundle } from '../../world3d/types';
import { buildChunkBundle } from '../../world3d/chunkBundle';
import type { GroundWorld, sampleGroundChunk, buildGroundVegetation } from './groundChunkLoader';

export interface GroundChunkRequest {
  cx: number;
  cy: number;
  /** Mesh resolution, already resolved from the LOD tier by the caller. */
  resolution: number;
}


interface GroundChunkSamplers {
  sampleGroundChunk: typeof sampleGroundChunk;
  buildGroundVegetation: typeof buildGroundVegetation;
}

/** Terrain, vegetation omission rules, and returned mesh fields stay shared. */
export function buildGroundChunkMesh(ground: GroundWorld, req: GroundChunkRequest, samplers: GroundChunkSamplers): ChunkMeshBundle {
  const { sampleGroundChunk, buildGroundVegetation } = samplers;
  const bundle = buildChunkBundle(sampleGroundChunk(ground, req.cx, req.cy, req.resolution));
  // Artifact features drive the scatter (determinism + no lattice banding); trees
  // and bushes are separate instanced layers.
  const { trees, bushes, understory } = buildGroundVegetation(ground, req.cx, req.cy);
  return {
    ...bundle,
    vegetation: trees.positions.length > 0 ? trees : undefined,
    bushes: bushes.positions.length > 0 ? bushes : undefined,
    understory: understory.count > 0 ? understory : undefined,
  };
}
