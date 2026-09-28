// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 09/09/2026, 10:00:41
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
 * Continuous heightfield terrain mesh with procedural PBR-like texturing —
 * CONTAINER.
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
 * SPLIT (task agora-b70d, 2026-09-09): this file is now hooks + scene mounting.
 * The pieces live in sibling modules, three of which PREDATE this task — the
 * terrain split was already most of the way done, so this pass added only what
 * was still inline:
 *
 * - `./terrainGeometry`        NEW: vertex displacement + interior-hole indices
 * - `./terrainPointer`         NEW: click/hover → tile resolution
 * - `./terrainHeightSampler`   pre-existing: the surface formula (worker-safe)
 * - `./apronField`             pre-existing: the landscape beyond the rect
 * - `./terrainSurfaceMaterial` pre-existing: the ground shader + type map
 *
 * The task body asked for a `terrainMaterial.ts`; that module already exists
 * as `terrainSurfaceMaterial.ts` and is shared with the apron, so it was left
 * where it is rather than renamed for the sake of a filename.
 *
 * @see docs/superpowers/specs/2026-05-21-3d-combat-map-design.md — "Terrain System" section
 */
import React, { useEffect, useMemo, useRef } from "react";
import { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { BattleMapData, BattleMapTile } from "../../../types/combat";
import { createTilePointerGestureGuard } from "../camera/battleMapCameraInput";
/* The surface formula moved to a plain module so the arena volume's WORKER can
 * import the ground truth without importing React and the terrain shader with
 * it. Re-exported here because every existing consumer imports it from this
 * file, and a rename would be churn for no gain. */
import {
  makeTerrainHeightSampler,
  WATER_BASIN_DEPTH,
} from "./terrainHeightSampler";
/* The ground shader lives beside this file now, because the apron paints with
 * it too. See terrainSurfaceMaterial.ts for why that is not optional. */
import { makeTerrainSurfaceMaterial } from "./terrainSurfaceMaterial";
import {
  applyInteriorHole,
  buildTerrainGeometry,
  buildTileGrid,
} from "./terrainGeometry";
import { createHoverTileResolver, resolveTileAtPoint } from "./terrainPointer";
export {
  makeTerrainHeightSampler,
  WATER_BASIN_DEPTH,
} from "./terrainHeightSampler";
/* SUBDIVISIONS_PER_TILE and TILE_SIZE moved to ./terrainGeometry with the code
 * that uses them; re-exported so nothing that reached for them here breaks. */
export { SUBDIVISIONS_PER_TILE, TILE_SIZE } from "./terrainGeometry";

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
  const tileGrid = useMemo(
    () => buildTileGrid(mapData, width, height),
    [mapData, width, height]
  );

  // Heightfield geometry (see terrainGeometry.ts for the apron, normals, and
  // interior-hole reasoning).
  const geometry = useMemo(
    () => buildTerrainGeometry({ mapData, tileGrid, width, height, interiorHoleInsetTiles }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mapData.seed is the
    // only mapData field the geometry depends on; widening this to `mapData`
    // would rebuild a quarter-million vertices on unrelated map-state changes.
    [tileGrid, width, height, mapData.seed, interiorHoleInsetTiles]
  );

  useEffect(() => {
    applyInteriorHole(geometry, interiorHoleActive);
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

  const tileResolverOptions = useMemo(
    () => ({ mapData, width, height, sampleHeight: terrainHeightSampler }),
    [height, mapData, terrainHeightSampler, width],
  );

  // Handle click → determine which tile was hit
  const handleClick = useMemo(() => {
    return (event: THREE.Intersection) => {
      if (!event.point) return;
      const tile = resolveTileAtPoint(event.point, tileResolverOptions);
      if (tile) onTileClick(tile);
    };
  }, [onTileClick, tileResolverOptions]);

  // Hover → tile under the pointer, deduped so the callback fires once per
  // tile crossing instead of on every pointermove event. Same height-aware
  // coordinate resolution as clicks.
  const tilePointerGesture = useMemo(() => createTilePointerGestureGuard(), []);
  const handlePointerMove = useMemo(() => {
    if (!onTileHover) return undefined;
    /* The dedupe state now lives in this closure rather than a component ref.
     * It therefore resets when the map or its dimensions change — which is the
     * only time `tileResolverOptions` changes, and at that point the previously
     * hovered tile id no longer refers to anything. Worst case is one extra
     * hover callback right after a map swap. */
    const resolveHover = createHoverTileResolver(tileResolverOptions, onTileHover);
    return (e: ThreeEvent<PointerEvent>) => resolveHover(e.intersections[0]?.point);
  }, [onTileHover, tileResolverOptions]);

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
