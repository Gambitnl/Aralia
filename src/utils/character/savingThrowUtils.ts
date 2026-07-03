// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 27/02/2026, 09:30:59
 * Dependents: SkillSelection.tsx, character/index.ts, concentrationUtils.ts, savingThrowUtils.ts, skillModifierUtils.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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

/**
 * Result of a saving throw roll.
 * Includes the raw roll, total after modifiers, and whether it succeeded.
 */
export interface SavingThrowResult {
    /** Whether the save was successful (total >= dc) */
    success: boolean;
    /** The raw d20 roll before modifiers */
    roll: number;
    /** Final total: roll + ability mod + proficiency + external modifiers */
    total: number;
    /** The difficulty class that needed to be met or exceeded */
    dc: number;
    /** True if the raw roll was 20 (auto-success in some contexts) */
    natural20: boolean;
    /** True if the raw roll was 1 (auto-fail in some contexts) */
    natural1: boolean;
    /** List of modifiers that were applied (e.g., Bless, Mind Sliver) */
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
    // Step 0: Check for Advantage/Disadvantage (Racial Modifiers, etc.)
    let hasAdvantage = false;
    let hasDisadvantage = false;

    const ALL_ABILITIES = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
    const abilityLower = ability.toLowerCase();

    const checkModifier = (modText: string) => {
        const text = modText.toLowerCase();
        // A modifier only applies to saving throws if it explicitly mentions "saving throw" or "save"
        // (to avoid applying "Dexterity (Stealth) checks" to Dexterity saving throws).
        if (text.includes('saving throw') || text.includes('save')) {
            const mentionsAnyAbility = ALL_ABILITIES.some(ab => text.includes(ab));
            if (mentionsAnyAbility) {
                // If it mentions specific abilities, it MUST mention this specific ability.
                return text.includes(abilityLower);
            } else {
                // Generic saving throw modifier (e.g., "saving throws against magic" or "all saving throws").
                // NOTE: Contextual saves (like "against poison") will over-apply here until context is added to rollSavingThrow.
                return true;
            }
        }
        return false;
    };

    target.modifiers?.advantage.forEach(adv => {
        if (checkModifier(adv)) hasAdvantage = true;
    });
    target.modifiers?.disadvantage.forEach(dis => {
        if (checkModifier(dis)) hasDisadvantage = true;
    });

    // Step 1: Roll the d20
    let roll = rollDice('1d20');
    if (hasAdvantage && !hasDisadvantage) {
        const roll2 = rollDice('1d20');
        roll = Math.max(roll, roll2);
    } else if (hasDisadvantage && !hasAdvantage) {
        const roll2 = rollDice('1d20');
        roll = Math.min(roll, roll2);
    }

    // Step 2: Calculate ability modifier from the relevant stat
    // E.g., for a Dexterity save, look up target.stats.dexterity
    const abilityKey = ability.toString().toLowerCase() as keyof typeof target.stats;
    const score = (target.stats[abilityKey] ?? 10) as number;
    let mod = getAbilityModifierValue(score);

    // Step 3: Check for explicit save bonus override (populated for monsters from 5eTools `save` field).
    // When present, these replace the computed abilityMod so the total matches the published stat block.
    // Map full ability name to abbreviated key ("Dexterity" → "dex").
    const ABILITY_ABBREV: Record<string, string> = {
      strength: 'str', dexterity: 'dex', constitution: 'con',
      intelligence: 'int', wisdom: 'wis', charisma: 'cha',
    };
    const saveKey = ABILITY_ABBREV[abilityKey] ?? abilityKey.slice(0, 3);
    const explicitSaveBonus = target.stats.saveBonuses?.[saveKey];
    if (explicitSaveBonus !== undefined) {
      // Explicit override wins — matches published monster stat block exactly.
      mod = explicitSaveBonus;
    } else {
      // Add proficiency bonus if the character is proficient in this save
      // Proficiency can come from class (e.g., Fighters are proficient in Str/Con)
      // or from the character directly (e.g., Resilient feat grants proficiency)
      const classHasProficiency = (target.class?.savingThrowProficiencies ?? [])
        .some(proficiency => proficiency.toLowerCase() === ability.toLowerCase());
      const charHasProficiency = (target.savingThrowProficiencies ?? [])
        .some(proficiency => proficiency.toLowerCase() === ability.toLowerCase());

      // Note: SavingThrowAbility is "Strength", "Dexterity", etc.
      // Class.savingThrowProficiencies and target.savingThrowProficiencies are AbilityScoreName ("Strength", etc.)
      // So direct comparison should work.
      if (classHasProficiency || charHasProficiency) {
          mod += calculateProficiencyBonus(target.level || 1);
      }
    }

    // Step 4: Apply external modifiers from active effects
    // Examples:
    //   - Bless: +1d4 (bonus)
    //   - Mind Sliver: -1d4 (penalty, applied to next save)
    //   - Cover: +2 flat bonus
    // These are tracked for logging purposes
    const modifiersApplied: { source: string; value: number }[] = [];

    // Racial Bonuses (from modifierBuckets.bonuses)
    target.modifiers?.bonuses.forEach(bonus => {
        const text = bonus.toLowerCase();
        // Check for ability specific bonus (e.g., "d4 to Dexterity")
        // or general saving throw bonus (e.g., "d4 to saving throws")
        const isTargetMatch = text.includes(ability.toLowerCase()) || 
                             text.includes('saving throw') || 
                             (ability === 'Intelligence' && text.includes('arcana')) || // Some intuition phrasings might bleed
                             (ability === 'Wisdom' && (text.includes('insight') || text.includes('perception')));

        if (isTargetMatch) {
            // Extract dice/flat from text like "d4 to saving throws" or "+2 to Dexterity"
            const diceMatch = bonus.match(/(\d*d\d+)/i);
            // Signed flat bonuses use an unescaped character class so lint stays clean without changing behavior.
            const flatMatch = bonus.match(/([+-]\d+)/);
            if (diceMatch) {
                const val = rollDice(diceMatch[1] || '1d4'); // Default to 1d4 if just "d4"
                mod += val;
                modifiersApplied.push({ source: 'Racial Bonus', value: val });
            } else if (flatMatch) {
                const val = parseInt(flatMatch[1], 10);
                mod += val;
                modifiersApplied.push({ source: 'Racial Bonus', value: val });
            }
        }
    });

    if (modifiers && modifiers.length > 0) {
        for (const modifier of modifiers) {
            // Dice modifiers (e.g., "1d4" or "-1d4") are rolled and added
            if (modifier.dice) {
                const diceRoll = rollDice(modifier.dice);
                mod += diceRoll;
                modifiersApplied.push({ source: modifier.source, value: diceRoll });
            }
            // Flat modifiers (e.g., +2 from cover) are added directly
            if (modifier.flat !== undefined) {
                mod += modifier.flat;
                modifiersApplied.push({ source: modifier.source, value: modifier.flat });
            }
        }
    }

    // Step 5: Calculate final total and determine success
    const total = roll + mod;

    return {
        success: total >= dc,  // Must meet or beat the DC
        roll,                  // Raw d20 result
        total,                 // Final modified result
        dc,                    // The target DC
        natural20: roll === 20, // For special auto-success rules
        natural1: roll === 1,   // For special auto-fail rules
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
    // Failed save = full damage always
    if (!saveResult.success) {
        return initialDamage;
    }

    // --- SUCCESSFUL SAVE OUTCOMES ---

    // 'half': Standard for most leveled spells (Fireball, Lightning Bolt, etc.)
    // Successful save reduces damage to half (rounded down)
    if (effectType === 'half') {
        return Math.floor(initialDamage / 2);
    }

    // 'none': Used by save cantrips whose successful save should deal no damage.
    // Sacred Flame, Thunderclap, Word of Radiance, and similar rows rely on this
    // shared convention so the failure branch still hits for full damage while the
    // success branch collapses to zero.
    if (effectType === 'none') {
        return 0;
    }

    // 'negates_condition': Used for effects where a save completely avoids the effect.
    // For damage context, this also means 0 damage on success.
    if (effectType === 'negates_condition') {
        return 0;
    }

    return initialDamage;
}
