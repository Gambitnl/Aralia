
import { StatusEffect } from '../../types/combat';

/**
 * Mechanical definitions for divine blessings.
 * These map a blessing ID (from DivineFavor or TempleService) to a StatusEffect.
 *
 * Two kinds of mechanical payload live here:
 *  - `effect.abilityCheckModifier` is the structured check rider that
 *    `rollAbilityCheck` already consumes, so a blessing that grants advantage on
 *    a skill needs no special case in the check resolver.
 *  - `craftingCheckBonus` is the flat bonus the crafting system reads through
 *    {@link getCraftingBlessingBonus}. Crafting checks are resolved by the
 *    crafting system, which hands the bonus to `rollAbilityCheck` as an external
 *    modifier, so the bonus is counted exactly once.
 */

const ROUNDS_PER_MINUTE = 10;
const ROUNDS_PER_HOUR = 60 * ROUNDS_PER_MINUTE;
const ROUNDS_PER_DAY = 24 * ROUNDS_PER_HOUR;

/** Moradin's Artisan's Touch adds this to every crafting check while it lasts. */
export const ARTISANS_TOUCH_CRAFTING_BONUS = 2;

export interface BlessingDefinition {
    id: string;
    name: string;
    description: string;
    effect: StatusEffect;
    /** Flat bonus added to crafting checks while this blessing is active. */
    craftingCheckBonus?: number;
}

export const BLESSING_EFFECTS: Record<string, BlessingDefinition> = {
    // Bahamut
    'blessing_scales_of_justice': {
        id: 'blessing_scales_of_justice',
        name: 'Scales of Justice',
        description: 'You have advantage on Insight checks.',
        effect: {
            id: 'status_scales_of_justice',
            name: 'Scales of Justice',
            type: 'buff',
            duration: ROUNDS_PER_DAY,
            source: 'Scales of Justice',
            effect: {
                // The advantage itself is carried by abilityCheckModifier below.
                // This entry stays so the status keeps the shape older readers expect.
                type: 'stat_modifier',
                stat: 'wisdom',
                value: 0
            },
            // Read by rollAbilityCheck: advantage on Insight checks only, never on
            // every Wisdom check and never on saving throws.
            abilityCheckModifier: {
                appliesTo: 'Wisdom (Insight) checks',
                flatModifier: 'advantage',
                skillSelection: 'fixed_skills',
                skillChooser: 'blessing',
                skillPool: ['Insight'],
                frequency: 'every_matching_check',
                durationScope: 'while_blessing_lasts'
            },
            icon: '⚖️'
        }
    },
    // Moradin
    'blessing_artisans_touch': {
        id: 'blessing_artisans_touch',
        name: 'Artisan\'s Touch',
        description: `Your crafting checks gain a +${ARTISANS_TOUCH_CRAFTING_BONUS} bonus.`,
        craftingCheckBonus: ARTISANS_TOUCH_CRAFTING_BONUS,
        effect: {
            id: 'status_artisans_touch',
            name: 'Artisan\'s Touch',
            type: 'buff',
            duration: ROUNDS_PER_DAY,
            source: 'Artisan\'s Touch',
            effect: {
                // Crafting is not an ability score, so this status carries no stat
                // modifier. The crafting system reads craftingCheckBonus instead, which
                // keeps a single craft roll from counting the bonus twice.
                type: 'condition'
            },
            icon: '🔨'
        }
    },
    // Generic
    'blessing_minor': {
        id: 'blessing_minor',
        name: 'Minor Blessing',
        description: 'A small boost to morale.',
        effect: {
            id: 'status_blessing_minor',
            name: 'Blessed',
            type: 'buff',
            duration: ROUNDS_PER_HOUR,
            effect: {
                type: 'stat_modifier',
                // Assuming temp HP or similar mechanic, but keeping it simple for now
                stat: 'baseInitiative',
                value: 1
            },
            icon: '✨'
        }
    }
};

/** Status-effect id to blessing definition, so a live buff can be traced back. */
const BLESSING_BY_STATUS_ID: Record<string, BlessingDefinition> = Object.fromEntries(
    Object.values(BLESSING_EFFECTS).map(definition => [definition.effect.id, definition])
);

/**
 * Helper to get a status effect from a blessing ID.
 */
export const getBlessingEffect = (blessingId: string): StatusEffect | null => {
    const definition = BLESSING_EFFECTS[blessingId];
    if (!definition) return null;
    return definition.effect;
};

/**
 * Helper to get the full definition.
 */
export const getBlessingDefinition = (blessingId: string): BlessingDefinition | null => {
    return BLESSING_EFFECTS[blessingId] || null;
};

/**
 * Helper to get the full definition behind a live status effect id.
 */
export const getBlessingDefinitionByStatusId = (statusId: string): BlessingDefinition | null => {
    return BLESSING_BY_STATUS_ID[statusId] || null;
};

/**
 * Totals the crafting-check bonus from the blessings currently on a character.
 * The crafting system passes the total to rollAbilityCheck as an external
 * modifier and shows the sources in the craft message.
 */
export const getCraftingBlessingBonus = (
    statusEffects: StatusEffect[] | undefined
): { bonus: number; sources: { source: string; value: number }[] } => {
    const sources: { source: string; value: number }[] = [];
    let bonus = 0;

    for (const status of statusEffects ?? []) {
        const definition = getBlessingDefinitionByStatusId(status.id);
        if (!definition) continue;
        const value = definition.craftingCheckBonus;
        if (typeof value !== 'number' || value === 0) continue;
        bonus += value;
        sources.push({ source: definition.name, value });
    }

    return { bonus, sources };
};
