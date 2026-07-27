/**
 * @file chunkBundle.ts
 * Assemble all per-chunk builders into a ChunkMeshBundle. Optional sub-meshes are
 * omitted (left undefined) when empty so the scene can skip rendering them.
 */
import type { ChunkData, ChunkMeshBundle } from './types';
export declare function buildChunkBundle(rawData: ChunkData): ChunkMeshBundle;
