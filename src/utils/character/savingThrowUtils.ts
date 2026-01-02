/**
 * @file src/utils/savingThrowUtils.ts
 * Utility functions for handling saving throws in D&D 5e combat.
 */
import {
    CombatCharacter,
} from '../../types/combat';
import { rollDice } from '../combat/combatUtils';
import { getAbilityModifierValue } from './statUtils';
import {
    SavingThrowAbility,
    // StatusConditionEffect // Not used yet but good for future
} from '../../types/spells';

export interface SavingThrowResult {
    success: boolean;
    roll: number;
    total: number;
    dc: number;
    natural20: boolean;
    natural1: boolean;
    modifiersApplied?: { source: string; value: number }[];
}

/**
 * Modifier to apply to a saving throw from external effects.
 * Supports both bonuses (Bless) and penalties (Mind Sliver).
 */
export interface SavingThrowModifier {
    dice?: string;    // e.g. "1d4" (bonus) or "-1d4" (penalty). Will be rolled and ADDED.
    flat?: number;    // e.g. 2 (bonus) or -2 (penalty). Will be ADDED.
    source: string;   // Name of the effect that caused this modifier
}

/**
 * Calculates the proficiency bonus based on character level/CR.
 * Formula: 2 + floor((level - 1) / 4)
 * Level 1-4 = +2, 5-8 = +3, etc.
 */
export function calculateProficiencyBonus(level: number): number {
    return 2 + Math.floor(Math.max(0, level - 1) / 4);
}

/**
 * Calculates the Spell Save DC for a character.
 * Formula: 8 + Proficiency Bonus + Spellcasting Ability Modifier
 */
export function calculateSpellDC(caster: CombatCharacter): number {
    const level = caster.level || 1;
    const pb = calculateProficiencyBonus(level);

    // Identify spellcasting ability from class, default to Intelligence if unknown
    const abilityName = caster.class?.spellcasting?.ability || 'Intelligence';
    const score = (caster.stats[abilityName.toLowerCase() as keyof typeof caster.stats] || 10) as number;
    const mod = getAbilityModifierValue(score);

    return 8 + pb + mod;
}

/**
 * Rolls a saving throw for a character against a target DC.
 * @param target The character making the save
 * @param ability The ability to use for the save
 * @param dc The difficulty class to beat
 * @param modifiers Optional array of modifiers from active effects (e.g., Mind Sliver's -1d4)
 */
export function rollSavingThrow(
    target: CombatCharacter,
    ability: SavingThrowAbility,
    dc: number,
    modifiers?: SavingThrowModifier[]
): SavingThrowResult {
    const roll = rollDice('1d20');

    // Get ability modifier
    const abilityKey = ability.toString().toLowerCase() as keyof typeof target.stats;
    const score = (target.stats[abilityKey] ?? 10) as number;
    let mod = getAbilityModifierValue(score);

    // Add proficiency if applicable
    // Check if class or character has proficiency in this save
    // TODO(lint-intent): The any on 'this value' hides the intended shape of this data.
    // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
    // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
    const classHasProficiency = target.class?.savingThrowProficiencies?.includes(ability as any) || target.class?.savingThrowProficiencies?.includes(ability as any);
    // TODO(lint-intent): The any on 'this value' hides the intended shape of this data.
    // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
    // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
    const charHasProficiency = target.savingThrowProficiencies?.includes(ability as any) || target.savingThrowProficiencies?.includes(ability as any);

    // Note: SavingThrowAbility is "Strength", "Dexterity", etc.
    // Class.savingThrowProficiencies and target.savingThrowProficiencies are AbilityScoreName ("Strength", etc.)
    // So direct comparison should work.
    if (classHasProficiency || charHasProficiency) {
        mod += calculateProficiencyBonus(target.level || 1);
    }

    // Apply external modifiers (e.g., Mind Sliver's -1d4, Bless +1d4, Cover +2)
    const modifiersApplied: { source: string; value: number }[] = [];
    if (modifiers && modifiers.length > 0) {
        for (const modifier of modifiers) {
            if (modifier.dice) {
                const diceRoll = rollDice(modifier.dice);
                // Dice result is ADDED (positive string = bonus, negative string = penalty)
                mod += diceRoll;
                modifiersApplied.push({ source: modifier.source, value: diceRoll });
            }
            if (modifier.flat !== undefined) {
                // Flat modifiers are applied directly (already signed)
                mod += modifier.flat;
                modifiersApplied.push({ source: modifier.source, value: modifier.flat });
            }
        }
    }

    const total = roll + mod;

    return {
        success: total >= dc,
        roll,
        total,
        dc,
        natural20: roll === 20,
        natural1: roll === 1,
        modifiersApplied: modifiersApplied.length > 0 ? modifiersApplied : undefined
    };
}

/**
 * Calculates final damage based on saving throw result.
 */
export function calculateSaveDamage(
    initialDamage: number,
    saveResult: SavingThrowResult,
    effectType: 'none' | 'half' | 'negates_condition' = 'half'
): number {
    if (!saveResult.success) {
        return initialDamage;
    }

    if (effectType === 'half') {
        return Math.floor(initialDamage / 2);
    }

    if (effectType === 'negates_condition') {
        // For damage, usually 'negates' implies 0 damage (like Evasion vs Dex saves, but that's a feature)
        // Or for cantrips like Sacred Flame: "takes 1d8... Dex save negates."
        // If usage is purely damage, 'negates' means 0.
        return 0;
    }

    // effectType === 'none' means save doesn't reduce damage (rare for pure damage spells, maybe secondary effects)
    return initialDamage;
}
