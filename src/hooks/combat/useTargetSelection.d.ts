/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/06/2026, 10:16:10
 * Dependents: components/BattleMap/BattleMap.tsx, components/BattleMap/BattleMap3D.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { BattleMapData, CombatCharacter, Ability } from '../../types/combat';
interface UseTargetSelectionProps {
    selectedAbility: Ability | null;
    targetingMode: boolean;
    isValidTarget: (ability: Ability, caster: CombatCharacter, position: {
        x: number;
        y: number;
    }) => boolean;
    aoePreview?: {
        affectedTiles: {
            x: number;
            y: number;
        }[];
    } | null;
    teleportDestinationPreview?: {
        affectedTiles: {
            x: number;
            y: number;
        }[];
    } | null;
    currentCharacter?: CombatCharacter;
    mapData: BattleMapData | null;
    characters: CombatCharacter[];
}
export declare function useTargetSelection({ selectedAbility, targetingMode, isValidTarget, aoePreview, teleportDestinationPreview, currentCharacter, mapData, characters }: UseTargetSelectionProps): {
    aoeSet: Set<string>;
    validTargetSet: Set<string>;
    teleportDestinationSet: Set<string>;
};
export {};
