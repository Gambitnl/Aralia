/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 16/07/2026, 11:54:41
 * Dependents: components/BattleMap/BattleMap3DGpuScene.tsx, components/BattleMap/terrain/DecorationProps.tsx, components/BattleMap/terrain/EzTreeLayer.tsx, components/BattleMap/terrain/GrassLayer.tsx, components/BattleMap/terrain/GridOverlay.tsx, components/BattleMap/terrain/GroundScatter.tsx, components/BattleMap/terrain/WaterSystem.tsx, components/BattleMap/terrain/index.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
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
import React from "react";
import { BattleMapData, BattleMapTile } from "../../../types/combat";
/**
 * How deep water basins are carved below their tile's nominal elevation, in
 * elevation units. The water surface stays at the tile's nominal elevation
 * (see WaterSystem), so this depth is what transparency, the depth gradient,
 * and the shoreline foam band reveal. Bicubic interpolation turns the carve
 * into naturally sloping banks across the shore tiles.
 */
export declare const WATER_BASIN_DEPTH = 1.4;
/**
 * Shared terrain height sampler: tile coordinates → world Y.
 *
 * Single source of truth for the surface formula (bicubic elevation +
 * micro-noise) used by the main heightfield, the perimeter skirt, and
 * WaterSystem's per-vertex depth bake. Water tiles are carved down by
 * WATER_BASIN_DEPTH so pools have real beds below their surface plane.
 */
export declare function makeTerrainHeightSampler(tileGrid: (BattleMapTile | null)[][], width: number, height: number, seed: number): (tileX: number, tileZ: number) => number;
interface TerrainMeshProps {
    mapData: BattleMapData;
    validMoves: Set<string>;
    activePath: {
        id: string;
    }[];
    actionMode: "move" | "ability" | null;
    onTileClick: (tile: BattleMapTile) => void;
    /**
     * Tile-hover callback (AoE template preview while targeting). Pass it ONLY
     * while it's needed: an onPointerMove handler makes R3F raycast this whole
     * heightfield on every mouse move, so the host gates it on targetingMode.
     */
    onTileHover?: (tile: BattleMapTile) => void;
}
declare const TerrainMesh: React.FC<TerrainMeshProps>;
export default TerrainMesh;
