/**
 * @file deckGeometry.ts
 * Build low timber-slab meshes for town dock piers and bridge spans (Worldforge
 * Option B). Each deck is a flat convex quad whose top sits at a given world-Y
 * (just above the town water surface); we fan-triangulate the top face and drop
 * a short vertical skirt around the rim so the slab reads with thickness from
 * the side. Mirrors wallGeometry's chunk-local segment walk.
 */
import type { ChunkData, ChunkGeometryArrays } from './types';
/** Deck meshes carry per-vertex colors so DeckPiece renders with `vertexColors`. */
type DeckMesh = ChunkGeometryArrays & {
    colors: Float32Array;
};
export declare function buildDeckMesh(data: ChunkData): DeckMesh;
export {};
