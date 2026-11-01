/**
 * @file groundChunkWorkerCore.ts
 * @description The pure heart of GROUND chunk meshing. Runs identically on the
 * main thread (the inline loader, tests) and inside the ground mesh Web Worker.
 *
 * Mirrors chunkWorkerCore.ts (the continent path). Decoupling the mesh algorithm
 * from the worker environment keeps it fully unit-testable on Node/Vitest, and
 * gives one source of truth: the inline loader and this worker-compatible API
 * call groundChunkMesh with the same existing samplers. No worker request,
 * cache, fallback or mesh field changes as the dependency cycle is removed.
 *
 * See docs/superpowers/specs/2026-07-07-offthread-ground-chunk-meshing-design.md.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/10/2026, 20:25:19
 * Dependents: components/World3D/groundChunkWorker.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { ChunkMeshBundle } from '../../world3d/types';
import { buildGroundChunkMesh } from './groundChunkMesh';
import type { GroundChunkRequest } from './groundChunkMesh';
export type { GroundChunkRequest } from './groundChunkMesh';
import { sampleGroundChunk, buildGroundVegetation } from './groundChunkLoader';
import type { GroundWorld } from './groundChunkLoader';

/**
 * Mesh one ground chunk: sample the terrain surface, assemble the mesh bundle,
 * and attach the chunk's instanced tree + bush scatter. Empty vegetation layers
 * are omitted (undefined), exactly as the inline loader does.
 */
export function handleGroundChunkRequest(ground: GroundWorld, req: GroundChunkRequest): ChunkMeshBundle {
  return buildGroundChunkMesh(ground, req, { sampleGroundChunk, buildGroundVegetation });
}
