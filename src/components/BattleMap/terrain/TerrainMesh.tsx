// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 13/08/2026, 04:04:29
 * Dependents: components/BattleMap/BattleMap3DGpuScene.tsx, components/BattleMap/terrain/DecorationProps.tsx, components/BattleMap/terrain/EzTreeLayer.tsx, components/BattleMap/terrain/GrassLayer.tsx, components/BattleMap/terrain/GridOverlay.tsx, components/BattleMap/terrain/GroundScatter.tsx, components/BattleMap/terrain/WaterSystem.tsx, components/BattleMap/terrain/index.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file TerrainMesh.tsx
 * Continuous heightfield terrain mesh with procedural PBR-like texturing.
 *
 * Uses a single subdivided PlaneGeometry whose vertex Y positions are set from
 * tile elevation values via bicubic interpolation. Surface detail comes from
 * GLSL procedural noise injected into MeshStandardMaterial via onBeforeCompile,
 * giving us free lighting, shadows, fog, and tone mapping.
 *
 * Terrain types (grass, rock, dirt, sand, etc.) are encoded in a DataTexture
 * and the fragment shader selects per-type color + noise patterns. Edge blending
 * softens transitions between adjacent terrain types.
 *
 * @see docs/superpowers/specs/2026-05-21-3d-combat-map-design.md — "Terrain System" section
 */
import React, { useEffect, useMemo, useRef } from "react";
import { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { BattleMapData, BattleMapTile } from "../../../types/combat";
import { resolveTerrainTileCoordinates } from "./terrainTileMapping";
import { createTilePointerGestureGuard } from "../camera/battleMapCameraInput";
/* The surface formula moved to a plain module so the arena volume's WORKER can
 * import the ground truth without importing React and the terrain shader with
 * it. Re-exported here because every existing consumer imports it from this
 * file, and a rename would be churn for no gain. */
import {
  makeTerrainHeightSampler,
  WATER_BASIN_DEPTH,
} from "./terrainHeightSampler";
import { FRINGE_TILES, makeApronField } from "./apronField";
/* The ground shader lives beside this file now, because the apron paints with
 * it too. See terrainSurfaceMaterial.ts for why that is not optional. */
import { makeTerrainSurfaceMaterial } from "./terrainSurfaceMaterial";
export {
  makeTerrainHeightSampler,
  WATER_BASIN_DEPTH,
} from "./terrainHeightSampler";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How many geometry subdivisions per tile (4x = smooth enough for BG3 feel) */
const SUBDIVISIONS_PER_TILE = 4;

/* The non-playable visual run-out beyond the playable rect now lives in
 * `apronField` — the fringe is the FIRST band of the apron, not a separate
 * dressing, and both have to agree on how wide it is. */

/** World unit size of each tile */
const TILE_SIZE = 1.0;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TerrainMeshProps {
  mapData: BattleMapData;
  validMoves: Set<string>;
  activePath: { id: string }[];
  actionMode: "move" | "ability" | null;
  onTileClick: (tile: BattleMapTile) => void;
  /**
   * Tile-hover callback (AoE template preview while targeting). Pass it ONLY
   * while it's needed: an onPointerMove handler makes R3F raycast this whole
   * heightfield on every mouse move, so the host gates it on targetingMode.
   */
  onTileHover?: (tile: BattleMapTile) => void;
  /**
   * Drop the heightfield's triangles more than this many tiles INSIDE the
   * playable rect, leaving a border band and the fringe run-out.
   *
   * Set when the voxel arena volume draws the playable ground (see
   * `VolumeArenaGround`). The volume covers the whole rect and its rim ramp
   * sinks under the terrain over the outer `RIM_RAMP_TILES`, so the two
   * surfaces must OVERLAP across that ramp — the visible ground is the higher
   * of the two, and the higher of two continuous surfaces is continuous. Cut
   * the heightfield at the ramp's inner edge and the crossing keeps its cover
   * while everything past it stops being drawn twice: at the shipped map size
   * that is a quarter of a million triangles of hidden overdraw.
   */
  interiorHoleInsetTiles?: number;
  /**
   * Whether the hole is currently OPEN.
   *
   * Split from the inset so the swap costs nothing. The volume ground takes
   * about a second to build in its worker, and for that second the heightfield
   * is the only ground there is — cutting the hole on mount would leave a hole
   * in the middle of the board while the player looks at it. Rebuilding the
   * geometry a second later would instead cost a quarter-million bicubic
   * samples in one frame. So both index buffers are built ONCE, up front, and
   * this flag only chooses which one is bound.
   */
  interiorHoleActive?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TerrainMesh: React.FC<TerrainMeshProps> = ({
  mapData,
  validMoves,
  activePath,
  actionMode,
  onTileClick,
  onTileHover,
  interiorHoleInsetTiles,
  interiorHoleActive = false,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { width, height } = mapData.dimensions;

  // Build tile lookup for fast access
  const tileGrid = useMemo(() => {
    const grid: (BattleMapTile | null)[][] = [];
    for (let y = 0; y < height; y++) {
      grid[y] = [];
      for (let x = 0; x < width; x++) {
        grid[y][x] = mapData.tiles.get(`${x}-${y}`) ?? null;
      }
    }
    return grid;
  }, [mapData, width, height]);

  /* Generate the heightfield geometry (no vertex colors — shader handles color).
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
   * datum now and no quad: one continuous surface, sampled by two meshes. */
  const geometry = useMemo(() => {
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
  }, [tileGrid, width, height, mapData.seed, interiorHoleInsetTiles]);

  /* Bind whichever index buffer the hole flag asks for. Both were built with
   * the geometry, so this is a pointer swap and a bounding-volume reuse. */
  useEffect(() => {
    const full = geometry.userData.fullIndex as THREE.BufferAttribute | undefined;
    const holed = geometry.userData.holedIndex as THREE.BufferAttribute | undefined;
    if (!full || !holed) return;
    geometry.setIndex(interiorHoleActive ? holed : full);
  }, [geometry, interiorHoleActive]);

  const terrainHeightSampler = useMemo(
    () => makeTerrainHeightSampler(tileGrid, width, height, mapData.seed ?? 42),
    [tileGrid, width, height, mapData.seed],
  );

  // The ground shader, per-tile type map and biome dapple — one factory, the
  // same one the apron calls, so the board and the country beyond it are the
  // same material.
  const surface = useMemo(() => makeTerrainSurfaceMaterial(mapData), [mapData]);
  useEffect(() => () => surface.dispose(), [surface]);

  // Active path set for quick lookup
  const activePathSet = useMemo(() => {
    const set = new Set<string>();
    activePath.forEach((p) => set.add(p.id));
    return set;
  }, [activePath]);

  // Handle click → determine which tile was hit
  const handleClick = useMemo(() => {
    return (event: THREE.Intersection) => {
      if (!event.point) return;
      // The mesh can produce tiny floating-point drift at map edges when the
      // ray lands on a steeply displaced surface. Clamping the derived tile
      // coordinate keeps valid edge clicks from falling out of bounds.
      const tileCoords = resolveTerrainTileCoordinates(
        {
          x: event.point.x / TILE_SIZE,
          y: event.point.y,
          z: event.point.z / TILE_SIZE,
        },
        { width, height },
        { sampleHeight: terrainHeightSampler },
      );
      if (!tileCoords) return;
      const tileId = `${tileCoords.x}-${tileCoords.y}`;
      const tile = mapData.tiles.get(tileId);
      if (tile) onTileClick(tile);
    };
  }, [height, mapData, onTileClick, terrainHeightSampler, width]);

  // Hover → tile under the pointer, deduped so the callback fires once per
  // tile crossing instead of on every pointermove event. Same height-aware
  // coordinate resolution as clicks.
  const lastHoverTileId = useRef<string | null>(null);
  const tilePointerGesture = useMemo(() => createTilePointerGestureGuard(), []);
  const handlePointerMove = useMemo(() => {
    if (!onTileHover) return undefined;
    return (e: ThreeEvent<PointerEvent>) => {
      const point = e.intersections[0]?.point;
      if (!point) return;
      const tileCoords = resolveTerrainTileCoordinates(
        { x: point.x / TILE_SIZE, y: point.y, z: point.z / TILE_SIZE },
        { width, height },
        { sampleHeight: terrainHeightSampler },
      );
      if (!tileCoords) return;
      const tileId = `${tileCoords.x}-${tileCoords.y}`;
      if (lastHoverTileId.current === tileId) return;
      lastHoverTileId.current = tileId;
      const tile = mapData.tiles.get(tileId);
      if (tile) onTileHover(tile);
    };
  }, [height, mapData, onTileHover, terrainHeightSampler, width]);

  return (
    <>
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={surface.material}
        receiveShadow
        onPointerDown={(event: ThreeEvent<PointerEvent>) => {
          tilePointerGesture.begin(event.nativeEvent);
        }}
        onPointerUp={(event: ThreeEvent<PointerEvent>) => {
          tilePointerGesture.end(event.nativeEvent);
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (!tilePointerGesture.consumeClick()) return;
          if (e.intersections[0]) {
            handleClick(e.intersections[0]);
          }
        }}
        onPointerMove={(event: ThreeEvent<PointerEvent>) => {
          tilePointerGesture.move(event.nativeEvent);
          handlePointerMove?.(event);
        }}
      />
    </>
  );
};

export default TerrainMesh;
