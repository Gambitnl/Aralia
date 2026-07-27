/**
 * @file src/hooks/combat/useCombatValidation.ts
 * Placeholder for a hook that could contain complex validation logic for combat actions,
 * such as checking prerequisites, environmental factors, or complex ability interactions.
 */
import { CombatCharacter, Ability, BattleMapData } from '../../types/combat';
export declare const useCombatValidation: (_characters: CombatCharacter[], _mapData: BattleMapData | null) => {
    isAbilityUsable: (_caster: CombatCharacter, _ability: Ability) => boolean;
};
