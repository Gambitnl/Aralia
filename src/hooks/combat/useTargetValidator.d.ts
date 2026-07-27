/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 23/07/2026, 21:24:49
 * Dependents: hooks/useAbilitySystem.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { CombatCharacter, Ability, Position, BattleMapData, AbilityCost } from '../../types/combat';
interface UseTargetValidatorProps {
    characters: CombatCharacter[];
    mapData: BattleMapData | null;
}
type TouchDeliveryCost = NonNullable<NonNullable<CombatCharacter['summonMetadata']>['actionPermissions']>['touchDeliveryCost'];
export interface TargetValidationResult {
    isValid: boolean;
    reason?: string;
}
export declare const getBloodCircleRejection: (caster: CombatCharacter, targetCharacter: CombatCharacter | null) => string | null;
export declare const getTouchDeliveryActionCost: (touchDeliveryCost?: TouchDeliveryCost) => AbilityCost | null;
export declare const findTouchDeliveryActor: (ability: Ability, caster: CombatCharacter, targetCharacter: CombatCharacter | null, characters: CombatCharacter[]) => {
    deliveryActor: CombatCharacter;
    casterDistance: number;
    targetDistance: number;
} | null;
export declare function useTargetValidator({ characters, mapData }: UseTargetValidatorProps): {
    isValidTarget: (ability: Ability, caster: CombatCharacter, targetPosition: Position) => boolean;
    getTargetValidation: (ability: Ability, caster: CombatCharacter, targetPosition: Position) => TargetValidationResult;
    getValidTargets: (ability: Ability, caster: CombatCharacter) => Position[];
    getCharacterAtPosition: (position: Position) => CombatCharacter | null;
};
export {};
