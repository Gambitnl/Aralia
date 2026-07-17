// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 16/07/2026, 11:53:17
 * Dependents: components/BattleMap/BattleMap.tsx, components/BattleMap/BattleMapOverlay.tsx, components/BattleMap/CharacterToken.tsx, components/BattleMap/DamageNumberOverlay.tsx, components/BattleMap/elevationPresentation.ts, components/BattleMap/groundPainter/paintPipeline.ts, components/BattleMap/pixi/PixiBattleBoard.tsx, components/BattleMap/terrain/TerrainMesh.tsx, hooks/actions/handleObservation.ts, hooks/useBattleMapGeneration.ts, systems/spells/ai/MaterialTagService.ts, systems/worldforge/bridge/groundChunkLoader.ts, utils/combat/actionUtils.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/config/mapConfig.ts
 * Centralizes configuration variables related to game maps and grids.
 */

// General Map Configuration
// Grid retirement (Cell-Native World): the legacy 30x20 world grid is gone —
// MAP_GRID_SIZE and SUBMAP_DIMENSIONS have both been removed. The world is
// Voronoi-cell-native; local terrain/materials come from the cell-native local
// layer (generateLocal / getWorldforgeLocalForCell). BATTLE_MAP_DIMENSIONS (the
// tactical combat map) is unrelated to the retired world grid and remains.
// 2026-07-01 (Remy): combat area quadrupled (40×30 → 80×60). The 2D map pans
// and zooms to fit; the 3D map renders a non-playable fringe beyond this rect
// so the battlefield no longer ends at a visible boundary.
// 2026-07-06 (Remy): "way more tiles" — 80×60 → 120×90 (2.25×, ~10.8k tiles).
// The 2D grid renders one DOM node per tile, so growth beyond this needs
// viewport culling first.
export const BATTLE_MAP_DIMENSIONS = { width: 120, height: 90 };
export const TILE_SIZE_PX = 32;

// Referee movement, range, and map rulers all treat one tactical cell as five
// feet. Terrain hillshade uses this only to compare vertical rise with the
// horizontal run; it does not alter movement distance.
export const BATTLE_MAP_CELL_SIZE_FEET = 5;

// WorldForge tactical patches encode relief as real metres divided by this
// value. The 3D terrain multiplies by the same constant to recover true
// vertical metres; player-facing 2D labels also use it so the two renderers do
// not quietly disagree about what an elevation value means.
export const BATTLE_MAP_ELEVATION_METERS_PER_UNIT = 0.3;

// Five-foot contours align the terrain read with the combat grid's familiar
// five-foot horizontal cadence. This is presentation, not a new movement or
// line-of-sight rule: those mechanics still consume the source elevation data.
export const BATTLE_MAP_CONTOUR_INTERVAL_FEET = 5;

// Compass Direction Vectors
export interface DirectionVector {
  dx: number;
  dy: number;
  opposite: string; // Opposite direction key
}
export const DIRECTION_VECTORS: Record<string, DirectionVector> = {
  North: { dx: 0, dy: -1, opposite: "South" },
  NorthEast: { dx: 1, dy: -1, opposite: "SouthWest" },
  East: { dx: 1, dy: 0, opposite: "West" },
  SouthEast: { dx: 1, dy: 1, opposite: "NorthWest" },
  South: { dx: 0, dy: 1, opposite: "North" },
  SouthWest: { dx: -1, dy: 1, opposite: "NorthEast" },
  West: { dx: -1, dy: 0, opposite: "East" },
  NorthWest: { dx: -1, dy: -1, opposite: "SouthEast" },
};
