/**
 * @file src/utils/savingThrowUtils.ts
 * Utility functions for handling saving throws in D&D 5e combat.
 */
import {
    CombatCharacter,
} from '../types/combat';
import {
    SavingThrowAbility,
    // StatusConditionEffect // Not used yet but good for future
} from '../types/spells';

export interface SavingThrowResult {
    success: boolean;
    roll: number;
    total: number;
    dc: number;
    natural20: boolean;
    natural1: boolean;
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
    const score = caster.stats[abilityName.toLowerCase() as keyof typeof caster.stats] || 10;
    const mod = Math.floor((score - 10) / 2);

    return 8 + pb + mod;
}

/**
 * Rolls a saving throw for a character against a target DC.
 */
export function rollSavingThrow(
    target: CombatCharacter,
    ability: SavingThrowAbility,
    dc: number
): SavingThrowResult {
    const roll = Math.floor(Math.random() * 20) + 1;

    // Get ability modifier
    const score = target.stats[ability.toLowerCase() as keyof typeof target.stats] || 10;
    let mod = Math.floor((score - 10) / 2);

    // Add proficiency if applicable
    // Check if class has proficiency in this save
    const isProficient = target.class?.savingThrowProficiencies?.includes(ability.slice(0, 3) as any) || target.class?.savingThrowProficiencies?.includes(ability);

    // Note: SavingThrowAbility is "Strength", "Dexterity", etc.
    // Class.savingThrowProficiencies is AbilityScoreName ("Strength", etc.)
    // So direct comparison should work.
    if (target.class?.savingThrowProficiencies?.includes(ability as any)) {
        mod += calculateProficiencyBonus(target.level || 1);
    }

    // TODO: Add modifiers from active effects (e.g. Bless +1d4, Cover +2)

    const total = roll + mod;

    return {
        success: total >= dc,
        roll,
        total,
        dc,
        natural20: roll === 20,
        natural1: roll === 1
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
