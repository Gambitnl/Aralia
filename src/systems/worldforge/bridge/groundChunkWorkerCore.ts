/**
 * @file groundChunkWorkerCore.ts
 * @description The pure heart of GROUND chunk meshing. Runs identically on the
 * main thread (the inline loader, tests) and inside the ground mesh Web Worker.
 *
 * Mirrors chunkWorkerCore.ts (the continent path). Decoupling the mesh algorithm
 * from the worker environment keeps it fully unit-testable on Node/Vitest, and
 * gives one source of truth: `buildGroundLoaderFromWorld` and the worker both
 * call this, so the worker mesh always equals the main-thread mesh.
 *
 * See docs/superpowers/specs/2026-07-07-offthread-ground-chunk-meshing-design.md.
 */
import type { ChunkMeshBundle } from '../../world3d/types';
import { buildChunkBundle } from '../../world3d/chunkBundle';
import { sampleGroundChunk, buildGroundVegetation } from './groundChunkLoader';
import type { GroundWorld } from './groundChunkLoader';

export interface GroundChunkRequest {
  cx: number;
  cy: number;
  /** Mesh resolution, already resolved from the LOD tier by the caller. */
  resolution: number;
}

/**
 * Mesh one ground chunk: sample the terrain surface, assemble the mesh bundle,
 * and attach the chunk's instanced tree + bush scatter. Empty vegetation layers
 * are omitted (undefined), exactly as the inline loader does.
 */
export function handleGroundChunkRequest(ground: GroundWorld, req: GroundChunkRequest): ChunkMeshBundle {
  const bundle = buildChunkBundle(sampleGroundChunk(ground, req.cx, req.cy, req.resolution));
  // Artifact features drive the scatter (determinism + no lattice banding); trees
  // and bushes are separate instanced layers.
  const { trees, bushes } = buildGroundVegetation(ground, req.cx, req.cy);
  return {
    ...bundle,
    vegetation: trees.positions.length > 0 ? trees : undefined,
    bushes: bushes.positions.length > 0 ? bushes : undefined,
  };
}
