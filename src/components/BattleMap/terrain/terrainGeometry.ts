// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 10:07:12
 * Dependents: components/BattleMap/terrain/TerrainMesh.tsx, components/BattleMap/terrain/terrainPointer.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file terrain/terrainGeometry.ts
 * Heightfield geometry construction for the battle-map terrain.
 *
 * Extracted from TerrainMesh.tsx (task agora-b70d) so the vertex displacement
 * and the interior-hole index cut can be read, reasoned about, and reused
 * without pulling React and the terrain shader in with them. TerrainMesh.tsx
 * now only memoizes a call to `buildTerrainGeometry` and binds an index.
 *
 * This module owns geometry ONLY. Height sampling already lived in
 * `./terrainHeightSampler` (the arena volume's worker imports it), the
 * beyond-the-board landscape in `./apronField`, and the ground shader in
 * `./terrainSurfaceMaterial`. Nothing was moved out of those.
 *
 * Dependencies: three, types/combat, ./terrainHeightSampler, ./apronField
 * Dependents: terrain/TerrainMesh.tsx
 */

import * as THREE from "three";
import type { BattleMapData, BattleMapTile } from "../../../types/combat";
import { makeTerrainHeightSampler } from "./terrainHeightSampler";
import { FRINGE_TILES, makeApronField } from "./apronField";

/** How many geometry subdivisions per tile (4x = smooth enough for BG3 feel) */
export const SUBDIVISIONS_PER_TILE = 4;

/** World unit size of each tile */
export const TILE_SIZE = 1.0;

export interface TerrainGeometryOptions {
  mapData: BattleMapData;
  /** Row-major [y][x] tile lookup, null where the map has no tile. */
  tileGrid: (BattleMapTile | null)[][];
  width: number;
  height: number;
  /**
   * Drop triangles more than this many tiles INSIDE the playable rect. When
   * undefined, no hole indices are built and the geometry has one index buffer.
   */
  interiorHoleInsetTiles?: number;
}

/**
 * Build the terrain heightfield.
 *
 * The plane extends FRINGE_TILES beyond the playable rect on every side. Past
 * the rect it stops asking the heightfield where the ground is and asks the
 * APRON FIELD, which is the heightfield plus a landscape that ramps in from
 * zero — so the first row outside the board is bit-for-bit the board's own
 * terrain and every row after it climbs into the country the apron mesh
 * carries to the horizon.
 *
 * It used to ease DOWN to a fixed datum (-0.15) to meet a flat fog-coloured
 * quad. That is what put the battlefield on a shelf, and the quad's far edge
 * is the "cliff down to nothingness" Remy circled (2026-08-10). There is no
 * datum now and no quad: one continuous surface, sampled by two meshes.
 *
 * No vertex colors — the shader handles color.
 *
 * When `interiorHoleInsetTiles` is given, BOTH index buffers are stashed on
 * `geo.userData` (`fullIndex` / `holedIndex`) and the caller chooses which one
 * is bound. Building both up front is deliberate: see the `interiorHoleActive`
 * prop docs in TerrainMesh.tsx for why the swap has to cost nothing.
 */
export const buildTerrainGeometry = ({
  mapData,
  tileGrid,
  width,
  height,
  interiorHoleInsetTiles,
}: TerrainGeometryOptions): THREE.BufferGeometry => {
  const fringeW = width + FRINGE_TILES * 2;
  const fringeH = height + FRINGE_TILES * 2;
  const segsX = fringeW * SUBDIVISIONS_PER_TILE;
  const segsZ = fringeH * SUBDIVISIONS_PER_TILE;

  const geo = new THREE.PlaneGeometry(
    fringeW * TILE_SIZE,
    fringeH * TILE_SIZE,
    segsX,
    segsZ,
  );

  geo.rotateX(-Math.PI / 2);
  const positions = geo.attributes.position as THREE.BufferAttribute;
  const vertexCount = positions.count;

  const seed = mapData.seed ?? 42;
  const getVertexY = makeTerrainHeightSampler(tileGrid, width, height, seed);
  // One formula for everything outside the rect. Inside it this returns the
  // heightfield's own value, unchanged, so the whole plane can be built
  // without a branch per vertex.
  const apron = makeApronField(mapData, getVertexY);

  for (let i = 0; i < vertexCount; i++) {
    const vx = positions.getX(i);
    const vz = positions.getZ(i);

    const tileX = vx / TILE_SIZE + width / 2;
    const tileZ = vz / TILE_SIZE + height / 2;

    positions.setY(i, apron.heightAt(tileX, tileZ));
    positions.setX(i, vx + (width / 2) * TILE_SIZE);
    positions.setZ(i, vz + (height / 2) * TILE_SIZE);
  }

  /* Normals BEFORE the hole is cut. `computeVertexNormals` averages the faces
   * that reference a vertex, so cutting first would light the hole's rim from
   * half its neighbours and draw a bright ring around the volume ground. */
  geo.computeVertexNormals();

  /* The interior hole. Vertices keep their positions and their normals — the
   * normals at the hole's rim are then the SAME normals the uncut mesh had,
   * so the border band lights identically to before. Only the index buffer
   * changes: a triangle whose three corners all sit deeper than the inset is
   * dropped. Per-triangle rather than per-vertex, so the boundary row of
   * triangles survives and the hole's edge lands cleanly on the inset. */
  if (interiorHoleInsetTiles !== undefined && geo.index) {
    const inset = interiorHoleInsetTiles;
    const src = geo.index.array as ArrayLike<number>;
    const kept: number[] = [];
    const flag = new Uint8Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) {
      const tx = positions.getX(i) / TILE_SIZE;
      const tz = positions.getZ(i) / TILE_SIZE;
      flag[i] =
        tx > inset && tx < width - inset && tz > inset && tz < height - inset ? 1 : 0;
    }
    for (let t = 0; t < src.length; t += 3) {
      const a = src[t];
      const b = src[t + 1];
      const c = src[t + 2];
      if (flag[a] && flag[b] && flag[c]) continue;
      kept.push(a, b, c);
    }
    geo.userData.fullIndex = geo.index;
    geo.userData.holedIndex = new THREE.BufferAttribute(new Uint32Array(kept), 1);
  }

  positions.needsUpdate = true;
  return geo;
};

/**
 * Bind whichever index buffer the hole flag asks for.
 *
 * Both were built with the geometry, so this is a pointer swap and a
 * bounding-volume reuse. A no-op when the geometry was built without a hole.
 */
export const applyInteriorHole = (
  geometry: THREE.BufferGeometry,
  interiorHoleActive: boolean
): void => {
  const full = geometry.userData.fullIndex as THREE.BufferAttribute | undefined;
  const holed = geometry.userData.holedIndex as THREE.BufferAttribute | undefined;
  if (!full || !holed) return;
  geometry.setIndex(interiorHoleActive ? holed : full);
};

/**
 * Build the row-major tile lookup the heightfield samples.
 *
 * Kept beside the geometry because it exists only to make the per-vertex
 * sampling a plain array read instead of a Map lookup per vertex.
 */
export const buildTileGrid = (
  mapData: BattleMapData,
  width: number,
  height: number
): (BattleMapTile | null)[][] => {
  const grid: (BattleMapTile | null)[][] = [];
  for (let y = 0; y < height; y++) {
    grid[y] = [];
    for (let x = 0; x < width; x++) {
      grid[y][x] = mapData.tiles.get(`${x}-${y}`) ?? null;
    }
  }
  return grid;
};
