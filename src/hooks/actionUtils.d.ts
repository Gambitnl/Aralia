/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/07/2026, 14:02:14
 * Dependents: hooks/useAbilitySystem.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { Ability, CombatCharacter, Position, CombatAction, BattleMapData, SelectedSpellTarget } from '../types/combat';
import { AoEParams } from '../utils/combat/aoeCalculations';
import { GameState } from '../types';
import { Plane } from '../types/planes';
export declare const buildAbilityCombatAction: (ability: Ability, caster: CombatCharacter, targetPosition: Position, targetCharacterIds: string[], selectedSpellTargets?: SelectedSpellTarget[]) => CombatAction;
export declare const getZoneAreaFromAoEParams: (areaOfEffect: {
    shape: string;
}, aoeParams: AoEParams) => {
    shape: string;
    size: number;
};
export declare const applyResourceSnapshotToCaster: (finalCaster: CombatCharacter, resourceSnapshot: CombatCharacter) => CombatCharacter;
export declare const replaceCasterForCommandState: (characters: CombatCharacter[], casterWithPaidCost: CombatCharacter) => CombatCharacter[];
export declare const buildCommandGameState: (characters: CombatCharacter[], mapData: BattleMapData | null, currentPlane?: Plane) => GameState;
export declare const resolveMultiTargetIds: (ability: Ability, caster: CombatCharacter, clickedTarget: CombatCharacter, characters: CombatCharacter[], getValidTargets: (ability: Ability, caster: CombatCharacter) => Position[]) => string[];
