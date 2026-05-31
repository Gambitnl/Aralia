/**
 * @file chunkWorkerCore.ts
 * @description The pure heart of chunk generation. Runs identically on the main thread (tests,
 * fallback) and inside a Web Worker (production).
 *
 * Why this is built this way:
 * - Decoupling the procedural geometry algorithm from browser/worker thread environments
 *   makes it 100% unit testable on Node/Vitest without worker mocking.
 * - This provides the primary seam that Plan 3 extends: by swapping out
 *   `buildPlaceholderHeightfield` with the rich textured mesh builder inside this single function,
 *   we completely upgrade 3D details without touching coordinates, streaming, or React logic.
 */

import type { WorldData } from '@/services/worldSim/types';
import type { ChunkMeshBundle } from './types';
import { sampleChunk } from './chunkSampler';
import { buildChunkBundle } from './chunkBundle';

export interface ChunkRequest {
  cx: number;
  cy: number;
  resolution: number;
}

/**
 * Handles a request to load chunk data by sampling the world and assembling the full mesh bundle.
 */
export function handleChunkRequest(world: WorldData, req: ChunkRequest): ChunkMeshBundle {
  const data = sampleChunk(world, req.cx, req.cy, req.resolution);
  return buildChunkBundle(data);
}
