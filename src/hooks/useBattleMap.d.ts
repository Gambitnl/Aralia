/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 22:40:15
 * Dependents: components/BattleMap/BattleMap.tsx, components/BattleMap/BattleMap3D.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file useBattleMap.ts
 * Custom hook to manage the state and logic of a procedural battle map.
 * Refactored to use useGridMovement for pathfinding state.
 *
 * CURRENT FUNCTIONALITY:
 * - Manages character positioning and selection state
 * - Handles turn-based action modes (move/ability)
 * - Integrates with grid movement system for pathfinding
 * - Coordinates with ability system for targeting
 * - Provides tile and character click handlers
 *
 * PERFORMANCE OPPORTUNITIES:
 * - CharacterPositions Map recreation on every character array change
 * - No spatial indexing for fast position lookups
 * - Missing camera/view state integration for viewport calculations
 * - Pathfinding recalculated frequently without caching
 * - No batched state updates for multiple simultaneous changes
 */
import React from 'react';
import { BattleMapData, BattleMapTile, CombatCharacter, CharacterPosition, CombatAction } from '../types/combat';
import { useTurnManager } from './combat/useTurnManager';
import { useAbilitySystem } from './useAbilitySystem';
interface UseBattleMapReturn {
    characterPositions: Map<string, CharacterPosition>;
    selectedCharacterId: string | null;
    validMoves: Set<string>;
    activePath: BattleMapTile[];
    actionMode: 'move' | 'ability' | null;
    setActionMode: React.Dispatch<React.SetStateAction<'move' | 'ability' | null>>;
    handleTileClick: (tile: BattleMapTile) => void;
    handleCharacterClick: (character: CombatCharacter) => void;
}
export declare function inferMovementModeForAction(character: CombatCharacter): CombatAction['movementMode'] | undefined;
export declare function useBattleMap(mapData: BattleMapData | null, characters: CombatCharacter[], turnManager: ReturnType<typeof useTurnManager>, abilitySystem: ReturnType<typeof useAbilitySystem>): UseBattleMapReturn;
export {};
