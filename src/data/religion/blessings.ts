
import { StatusEffect } from '../../types/combat';

/**
 * Mechanical definitions for divine blessings.
 * These map a blessing ID (from DivineFavor or TempleService) to a StatusEffect.
 */

const ROUNDS_PER_MINUTE = 10;
const ROUNDS_PER_HOUR = 60 * ROUNDS_PER_MINUTE;
const ROUNDS_PER_DAY = 24 * ROUNDS_PER_HOUR;

export interface BlessingDefinition {
    id: string;
    name: string;
    description: string;
    effect: StatusEffect;
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
            effect: {
                type: 'stat_modifier',
                stat: 'wisdom', // Simplified, actual advantage logic would be in skill checks
                value: 0 // Placeholder, implementation depends on skill check logic
            },
            icon: '⚖️'
        }
    },
    // Moradin
    'blessing_artisans_touch': {
        id: 'blessing_artisans_touch',
        name: 'Artisan\'s Touch',
        description: 'Your crafting checks are blessed.',
        effect: {
            id: 'status_artisans_touch',
            name: 'Artisan\'s Touch',
            type: 'buff',
            duration: ROUNDS_PER_DAY,
            effect: {
                type: 'stat_modifier',
                stat: 'strength', // Placeholder for crafting stat
                value: 2 // +2 bonus
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
