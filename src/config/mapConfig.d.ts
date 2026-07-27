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
/**
 * @file src/config/mapConfig.ts
 * Centralizes configuration variables related to game maps and grids.
 */
export declare const BATTLE_MAP_DIMENSIONS: {
    width: number;
    height: number;
};
export declare const TILE_SIZE_PX = 32;
export declare const BATTLE_MAP_CELL_SIZE_FEET = 5;
export declare const BATTLE_MAP_ELEVATION_METERS_PER_UNIT = 0.3;
export declare const BATTLE_MAP_CONTOUR_INTERVAL_FEET = 5;
export interface DirectionVector {
    dx: number;
    dy: number;
    opposite: string;
}
export declare const DIRECTION_VECTORS: Record<string, DirectionVector>;
