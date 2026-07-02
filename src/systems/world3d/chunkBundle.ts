/**
 * @file chunkBundle.ts
 * Assemble all per-chunk builders into a ChunkMeshBundle. Optional sub-meshes are
 * omitted (left undefined) when empty so the scene can skip rendering them.
 */
import type { ChunkData, ChunkMeshBundle } from './types';
import { buildTerrainMesh } from './chunkGeometry';
import { weldChunkEdgeHeights } from './edgeWeld';
import { buildWaterMesh } from './waterGeometry';
import { buildRoadMesh } from './roadGeometry';
import { buildWallMesh } from './wallGeometry';
import { buildDeckMesh } from './deckGeometry';
import { buildGateMesh } from './gateGeometry';
import { buildSiteMeshes } from './siteGeometry';
import { buildVegetationScatter } from './vegetationScatter';

export function buildChunkBundle(rawData: ChunkData): ChunkMeshBundle {
  // Weld border heights onto the cross-tier anchor polyline BEFORE any builder
  // reads them, so neighboring chunks of any LOD mix stay watertight (edgeWeld.ts).
  const data: ChunkData = {
    ...rawData,
    heights: weldChunkEdgeHeights(rawData.heights, rawData.resolution),
  };
  const terrain = buildTerrainMesh(data);
  const water = buildWaterMesh(data);
  const roads = buildRoadMesh(data);
  const walls = buildWallMesh(data);
  const decks = buildDeckMesh(data);
  const gates = buildGateMesh(data);
  const sites = buildSiteMeshes(data);
  const vegetation = buildVegetationScatter(data);

  return {
    cx: data.cx,
    cy: data.cy,
    terrain,
    water: water.positions.length > 0 ? water : undefined,
    roads: roads.positions.length > 0 ? roads : undefined,
    walls: walls.positions.length > 0 ? walls : undefined,
    decks: decks.positions.length > 0 ? decks : undefined,
    gates: gates.positions.length > 0 ? gates : undefined,
    sites,
    vegetation: vegetation.positions.length > 0 ? vegetation : undefined,
  };
}
