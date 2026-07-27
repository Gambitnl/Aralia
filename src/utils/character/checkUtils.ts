// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 29/06/2026, 02:45:39
 * Dependents: systems/crafting/batchCrafting.ts, systems/crafting/craftingEngine.ts, systems/puzzles/mechanism.ts, utils/character/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/utils/character/checkUtils.ts
 * Utility functions for handling ability checks and skill checks in D&D 5e.
 */
import { PlayerCharacter } from '../../types/character';
import { CombatCharacter, StatusEffect } from '../../types/combat';
import { rollDice } from '../combat/combatUtils';
import { getAbilityModifierValue } from './statUtils';
import { AbilityScoreName } from '../../types/core';

/**
 * Result of an ability or skill check.
 */
export interface CheckResult {
    /** The raw d20 roll before modifiers */
    roll: number;
    /** Final total after all modifiers and bonuses */
    total: number;
    /** List of modifiers that were applied (e.g., Guidance, Racial Intuition) */
    modifiersApplied?: { source: string; value: number }[];
}

// ---------------------------------------------------------------------------
// Modifier text matching
// ---------------------------------------------------------------------------
// Many character modifiers are still stored as readable text. Generic entries
// like "advantage on ability checks" should affect every ability check, while
// structured spell bridges such as Enhance Ability write targeted entries like
// "advantage on Strength ability checks". This helper keeps targeted ability
// names from accidentally becoming global just because the phrase also contains
// "ability check".
const ABILITY_NAMES: AbilityScoreName[] = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];

function modifierAppliesToCheck(text: string, ability: AbilityScoreName, skill?: string): boolean {
    const normalized = text.toLowerCase();
    const requestedAbility = ability.toLowerCase();
    const requestedSkill = skill?.toLowerCase();
    const namesSpecificAbility = ABILITY_NAMES.some(abilityName => normalized.includes(abilityName.toLowerCase()));

    if (requestedSkill && normalized.includes(requestedSkill)) {
        return true;
    }

    if (namesSpecificAbility) {
        return normalized.includes(requestedAbility);
    }

    return normalized.includes('ability check');
}

interface StructuredAbilityCheckModifier {
    source: string;
    value?: number;
    bonusDice?: string;
    advantage?: boolean;
    disadvantage?: boolean;
}

function normalizedLabel(value: string): string {
    return value.trim().toLowerCase().replace(/[_-]+/g, ' ');
}

function labelList(value: string | string[] | undefined): string[] {
    return (Array.isArray(value) ? value : value ? [value] : []).map(normalizedLabel);
}

function abilityCheckModifierApplies(
    modifier: NonNullable<StatusEffect['abilityCheckModifier']>,
    statusEffect: StatusEffect,
    ability: AbilityScoreName,
    skill?: string
): boolean {
    const selection = normalizedLabel(modifier.skillSelection || '');
    const selected = statusEffect.modifiers?.skill?.trim();
    const pool = labelList(modifier.skillPool);
    const requestedAbility = normalizedLabel(ability);
    const requestedSkill = skill ? normalizedLabel(skill) : undefined;
    const appliesTo = normalizedLabel(modifier.appliesTo || '');
    const poolMatches = (value: string | undefined): boolean => Boolean(value && pool.includes(value));

    if (selection === 'chosen skill') {
        return Boolean(requestedSkill && selected && normalizedLabel(selected) === requestedSkill);
    }

    if (selection === 'chosen ability') {
        return Boolean(selected && normalizedLabel(selected) === requestedAbility);
    }

    if (selection === 'all abilities') {
        return pool.length === 0 || poolMatches(requestedAbility);
    }

    if (selection === 'fixed skill' || selection === 'fixed skills') {
        return Boolean(requestedSkill && (poolMatches(requestedSkill) || appliesTo.includes(requestedSkill)));
    }

    if (selection === 'not applicable' || selection === '') {
        return appliesTo === 'ability check' || (requestedSkill ? appliesTo.includes(requestedSkill) : appliesTo.includes(requestedAbility));
    }

    // Preserve future selection labels while still allowing source text that
    // names a concrete skill or ability to participate in a matching check.
    return poolMatches(requestedSkill) || poolMatches(requestedAbility) ||
        (requestedSkill ? appliesTo.includes(requestedSkill) : appliesTo.includes(requestedAbility));
}

function collectStructuredAbilityCheckModifiers(
    character: PlayerCharacter | CombatCharacter,
    ability: AbilityScoreName,
    skill?: string
): StructuredAbilityCheckModifier[] {
    const statusEffects = 'statusEffects' in character ? character.statusEffects ?? [] : []
    const applied: StructuredAbilityCheckModifier[] = []

    for (const effect of statusEffects as StatusEffect[]) {
        const modifier = effect.abilityCheckModifier
        const statusModifiers = effect.modifiers
        const source = effect.source || effect.name

        if (modifier && abilityCheckModifierApplies(modifier, effect, ability, skill)) {
            const bonusDice = modifier.bonusDice?.trim()
            if (bonusDice) {
                applied.push({ source, bonusDice })
            } else if (typeof modifier.flatModifier === 'number') {
                applied.push({ source, value: modifier.flatModifier })
            } else if (modifier.flatModifier === 'advantage' || modifier.flatModifier === 'disadvantage') {
                applied.push({
                    source,
                    [modifier.flatModifier]: true,
                })
            }
        }

        // Some command bridges expose advantage/disadvantage as a status
        // modifier without duplicating the full source payload. Honor that
        // packet here so pre-roll offers and Enhance Ability share one roll path.
        const statusSkill = statusModifiers?.skill
        const statusScopeMatches = !statusSkill ||
            normalizedLabel(statusSkill) === normalizedLabel(ability) ||
            normalizedLabel(statusSkill) === normalizedLabel(skill || '');
        if (statusScopeMatches && statusModifiers?.advantage?.includes('check')) {
            applied.push({ source, advantage: true })
        }
        if (statusScopeMatches && statusModifiers?.disadvantage?.includes('check')) {
            applied.push({ source, disadvantage: true })
        }
    }

    return applied
}

/**
 * Rolls an ability check or skill check for a character (Player or Combatant).
 */
export function rollAbilityCheck(
    character: PlayerCharacter | CombatCharacter,
    ability: AbilityScoreName,
    skill?: string,
    options?: { advantage?: boolean; disadvantage?: boolean; externalModifier?: number }
): CheckResult {
    let hasAdvantage = options?.advantage || false;
    let hasDisadvantage = options?.disadvantage || false;

    // Read structured spell riders before rolling so advantage/disadvantage
    // changes the d20 selection while numeric and dice riders are applied to
    // the final modifier below.
    const structuredModifiers = collectStructuredAbilityCheckModifiers(character, ability, skill)
    for (const modifier of structuredModifiers) {
        hasAdvantage ||= modifier.advantage === true
        hasDisadvantage ||= modifier.disadvantage === true
    }

    // Check racial advantage/disadvantage
    character.modifiers?.advantage.forEach(adv => {
        if (modifierAppliesToCheck(adv, ability, skill)) {
            hasAdvantage = true;
        }
    });
    character.modifiers?.disadvantage.forEach(dis => {
        if (modifierAppliesToCheck(dis, ability, skill)) {
            hasDisadvantage = true;
        }
    });

    // Roll d20
    let roll = rollDice('1d20');
    if (hasAdvantage && !hasDisadvantage) {
        roll = Math.max(roll, rollDice('1d20'));
    } else if (hasDisadvantage && !hasAdvantage) {
        roll = Math.min(roll, rollDice('1d20'));
    }

    // Base ability modifier
    // Handle differences between PlayerCharacter (finalAbilityScores) and CombatCharacter (stats)
    let score = 10;
    let isProficient = false;
    let level = 1;

    if ('finalAbilityScores' in character) {
        score = character.finalAbilityScores[ability] ?? 10;
        level = character.level || 1;
        if (skill) {
            isProficient = character.skills.some(s => s.id === skill.toLowerCase().replace(/\s+/g, '_') || s.name.toLowerCase() === skill.toLowerCase());
        }
    } else {
        const abilityKey = ability.toLowerCase() as keyof typeof character.stats;
        score = (character.stats[abilityKey] ?? 10) as number;
        level = character.level || 1;
        // CombatCharacter skill proficiency check
        if (skill) {
            const skillKey = skill.toLowerCase().replace(/\s+/g, '_');
            isProficient = character.modifiers?.skillProficiencies?.some(p => p.toLowerCase().replace(/\s+/g, '_') === skillKey) || false;
        }
    }

    let mod = getAbilityModifierValue(score);
    if (isProficient) {
        mod += (2 + Math.floor(Math.max(0, level - 1) / 4)); // calculateProficiencyBonus inline or import
    }

    // Add external modifier (e.g. from crafting progression or location)
    if (options?.externalModifier) {
        mod += options.externalModifier;
    }

    // Track modifiers for logging
    const modifiersApplied: { source: string; value: number }[] = [];

    // Racial Intuition / Bonuses
    character.modifiers?.bonuses.forEach(bonus => {
        const isTargetMatch = modifierAppliesToCheck(bonus, ability, skill);

        if (isTargetMatch) {
            const diceMatch = bonus.match(/(\d*d\d+)/i);
            // Signed flat bonuses use an unescaped character class so lint stays clean without changing behavior.
            const flatMatch = bonus.match(/([+-]\d+)/);
            if (diceMatch) {
                const val = rollDice(diceMatch[1] || '1d4');
                mod += val;
                modifiersApplied.push({ source: 'Racial Bonus', value: val });
            } else if (flatMatch) {
                const val = parseInt(flatMatch[1], 10);
                mod += val;
                modifiersApplied.push({ source: 'Racial Bonus', value: val });
            }
        }
    });

    // Spell-linked ability-check riders such as Guidance live on status
    // effects so concentration cleanup can remove them without re-parsing
    // combat log text. They still feed the same modifier list here so the
    // shared check roll stays the single consumer of the bonus dice.
    for (const modifier of structuredModifiers) {
        const value = modifier.value ?? (modifier.bonusDice ? rollDice(modifier.bonusDice) : undefined)
        if (value === undefined) continue
        mod += value
        modifiersApplied.push({ source: modifier.source, value })
    }

    return {
        roll,
        total: roll + mod,
        modifiersApplied: modifiersApplied.length > 0 ? modifiersApplied : undefined
    };
}
