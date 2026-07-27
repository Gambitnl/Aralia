/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/07/2026, 01:47:08
 * Dependents: components/BattleMap/dungeon/Dungeon3DPreview.tsx, components/World3D/DungeonParchmentMap.tsx, systems/worldforge/dungeon/world/dungeonLevels.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file turns explored cells from the canonical DungeonPlan into remembered map ink.
 *
 * Movement supplies the player's real grid cell. This model reveals only nearby floor cells and
 * then filters the same plan used by the 3D renderer, so the parchment cannot expose a second
 * generated layout. Key authored rooms become landmarks only after one of their floor cells has
 * been explored. Deterministic level descriptors can now add stairs, truthful vertical sightlines,
 * and the deepest boss objective as annotations. They still pass through this same discovery gate,
 * so a page never leaks a transition or objective before its floor cell has been explored.
 *
 * Called by: Dungeon3DPreview movement, DungeonParchmentMap, and focused map tests.
 * Depends on: the pure-data dungeon plan contract.
 */
import { type Cell, type DungeonPlan, type DungeonRoom } from '../types';
export declare const DUNGEON_SURFACE_LEVEL_ID = "level:0";
export declare function dungeonCellKey(cell: Cell): string;
export declare function revealedDungeonCellKeys(plan: DungeonPlan, playerCell: Cell): string[];
export type DungeonMapLandmarkKind = 'entrance' | 'treasure' | 'shrine' | 'stairs-up' | 'stairs-down' | 'boss' | 'overlook';
export interface DungeonMapAnnotation {
    id: string;
    kind: Extract<DungeonMapLandmarkKind, 'stairs-up' | 'stairs-down' | 'boss' | 'overlook'>;
    label: string;
    cell: Cell;
    roomId: number;
}
export interface DungeonMapLandmark {
    id: string;
    kind: DungeonMapLandmarkKind;
    label: string;
    purpose: DungeonRoom['purpose'];
    roomId: number;
    cell: Cell;
}
export interface DungeonParchmentSheetModel {
    exploredBounds: {
        minX: number;
        minY: number;
        width: number;
        height: number;
    };
    exploredCells: Cell[];
    exploredDoors: Array<{
        cell: Cell;
        state: string;
    }>;
    visibleLandmarks: DungeonMapLandmark[];
    discoveredCellCount: number;
    hiddenFloorCellCount: number;
    hiddenLandmarkCount: number;
}
export declare function buildDungeonParchmentSheet(plan: DungeonPlan, discoveredCellKeys: readonly string[], annotations?: readonly DungeonMapAnnotation[]): DungeonParchmentSheetModel;
