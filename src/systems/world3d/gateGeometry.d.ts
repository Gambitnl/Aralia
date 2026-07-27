/**
 * @file gateGeometry.ts
 * Procedural gatehouse models at town road-gate openings (styled-architecture
 * slice, 2026-07-01). Assembled from oriented boxes into one vertex-colored
 * mesh per chunk — same transferable-arrays contract as wallGeometry/deckGeometry.
 */
import type { ChunkData, ChunkGeometryArrays } from './types';
type GateMesh = ChunkGeometryArrays & {
    colors: Float32Array;
};
export declare function buildGateMesh(data: ChunkData): GateMesh;
export {};
