/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/05/2026, 14:08:58
 * Dependents: hooks/useBattleMap.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { BattleMapData, BattleMapTile, CombatCharacter, CharacterPosition } from '../../types/combat';
interface UseGridMovementProps {
    mapData: BattleMapData | null;
    characterPositions: Map<string, CharacterPosition>;
    selectedCharacter: CombatCharacter | null;
}
interface UseGridMovementReturn {
    validMoves: Set<string>;
    activePath: BattleMapTile[];
    calculatePath: (character: CombatCharacter, targetTile: BattleMapTile) => void;
    clearMovementState: () => void;
}
export declare function useGridMovement({ mapData, characterPositions, selectedCharacter }: UseGridMovementProps): UseGridMovementReturn;
export {};
