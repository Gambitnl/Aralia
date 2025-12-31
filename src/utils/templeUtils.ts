/**
 * @file src/utils/templeUtils.ts
 * Utilities for generating temple data and managing temple services.
 * Integrates with Deity and Religion systems.
 */

import { DEITIES } from '../data/deities';
import { Temple, TempleService } from '../types/religion';
import { VillagePersonality } from '../types';
import { createSeededRandom } from './seededRandom';

/**
 * Procedurally generates a Temple object for a village.
 * Uses the village's personality/biome to select an appropriate deity if possible.
 */
export const generateVillageTemple = (
    villageId: string,
    personality: VillagePersonality,
    rngSeed: number
): Temple => {
    const rng = createSeededRandom(rngSeed, { x: 0, y: 0 }, 'temple_gen');

    // Select a deity based on personality/industry/biome
    const deityId = selectDeityForVillage(personality, rng);
    const deity = DEITIES.find(d => d.id === deityId) || DEITIES[0];

    return {
        id: `temple_${villageId}_${deityId}`,
        deityId: deity.id,
        name: `Temple of ${deity.name}`,
        description: `A sanctuary dedicated to ${deity.name}. ${deity.description}`,
        locationId: villageId, // Now allowed by Temple in religion.ts? Let's verify.
        services: generateServicesForDeity(deityId)
    };
};

/**
 * Selects a culturally appropriate deity ID based on village traits.
 */
const selectDeityForVillage = (
    personality: VillagePersonality,
    rng: () => number
): string => {
    const candidates: string[] = [];

    // Filter by Dominant Race
    if (personality.dominantRace === 'elf') candidates.push('corellon', 'sehanine', 'melora');
    if (personality.dominantRace === 'dwarf') candidates.push('moradin');
    if (personality.dominantRace === 'orc') candidates.push('gruumsh');

    // Filter by Industry/Culture
    if (personality.primaryIndustry === 'agriculture') candidates.push('pelor', 'melora');
    if (personality.primaryIndustry === 'mining') candidates.push('moradin');
    if (personality.primaryIndustry === 'trade') candidates.push('avandra', 'erathis');
    if (personality.primaryIndustry === 'military') candidates.push('kord', 'bahamut');
    if (personality.primaryIndustry === 'scholarship') candidates.push('ioun');
    if (personality.primaryIndustry === 'fishing') candidates.push('melora');

    // Filter by Alignment/Culture
    if (personality.culture === 'martial') candidates.push('kord');
    if (personality.culture === 'stoic') candidates.push('moradin', 'erathis', 'raven_queen');
    if (personality.culture === 'festive') candidates.push('avandra', 'sehanine', 'corellon');

    // Filter by Biome
    if (personality.biomeStyle === 'swampy') candidates.push('raven_queen', 'zehir');
    if (personality.biomeStyle === 'coastal') candidates.push('melora', 'kord'); // Kord (storms)

    // Fallback if no specific candidates
    if (candidates.length === 0) {
        return 'pelor'; // Generic good sun god
    }

    // Pick random from candidates
    return candidates[Math.floor(rng() * candidates.length)];
};

/**
 * Generates available services for a specific deity.
 * Different deities might offer slightly different flavored services or prices,
 * but mechanically they map to standard effects.
 */
const generateServicesForDeity = (_deityId: string): TempleService[] => {
    const baseServices: TempleService[] = [
        {
            id: 'donate_small',
            name: 'Small Donation',
            description: 'A modest offering to show respect.',
            costGp: 5,
            effect: 'grant_favor_small',
            minFavor: -100
        },
        {
            id: 'heal_wounds',
            name: 'Divine Healing',
            description: 'Restore vitality and mend wounds.',
            costGp: 25,
            effect: 'restore_hp_full',
            minFavor: -10
        },
        {
            id: 'cure_disease',
            name: 'Purify Body',
            description: 'Cure diseases and remove poisons.',
            costGp: 50,
            effect: 'remove_condition_poisoned', // Simplified for now
            minFavor: 0
        },
        {
            id: 'remove_curse',
            name: 'Remove Curse',
            description: 'Lift a curse or hex.',
            costGp: 100,
            effect: 'remove_curse',
            minFavor: 10
        },
        {
            id: 'donate_large',
            name: 'Major Donation',
            description: 'A significant offering to the faith.',
            costGp: 100,
            effect: 'grant_favor_large',
            minFavor: -100
        }
    ];

    // TODO: Add deity-specific services (e.g., Kord = "Blessing of Strength", Pelor = "Blessing of Light")

    return baseServices;
};
