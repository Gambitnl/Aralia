/**
 * @file chunkBundle.ts
 * Assemble all per-chunk builders into a ChunkMeshBundle. Optional sub-meshes are
 * omitted (left undefined) when empty so the scene can skip rendering them.
 */
import type { ChunkData, ChunkMeshBundle } from './types';
import { buildTerrainMesh } from './chunkGeometry';
import { buildWaterMesh } from './waterGeometry';
import { buildRoadMesh } from './roadGeometry';
import { buildWallMesh } from './wallGeometry';
import { buildSiteMeshes } from './siteGeometry';
import { buildVegetationScatter } from './vegetationScatter';

export function buildChunkBundle(data: ChunkData): ChunkMeshBundle {
  const terrain = buildTerrainMesh(data);
  const water = buildWaterMesh(data);
  const roads = buildRoadMesh(data);
  const walls = buildWallMesh(data);
  const sites = buildSiteMeshes(data);
  const vegetation = buildVegetationScatter(data);

  return {
    cx: data.cx,
    cy: data.cy,
    terrain,
    water: water.positions.length > 0 ? water : undefined,
    roads: roads.positions.length > 0 ? roads : undefined,
    walls: walls.positions.length > 0 ? walls : undefined,
    sites,
    vegetation: vegetation.positions.length > 0 ? vegetation : undefined,
  };
}
