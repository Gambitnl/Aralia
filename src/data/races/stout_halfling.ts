/**
 * @file stout_halfling.ts
 * Defines the data for the Stout Halfling race in the Aralia RPG, based on Player's Handbook 2014.
 * Stout halflings are hardier than average and have resistance to poison.
 */
import { Race } from '../../types';

export const STOUT_HALFLING_DATA: Race = {
    id: 'stout_halfling',
    name: 'Stout Halfling',
    baseRace: 'halfling',
    description:
        'As a stout halfling, you\'re hardier than average and have some resistance to poison. Some say that stouts have dwarven blood. In the Forgotten Realms, these halflings are called stronghearts, and they\'re most common in the south. Stout halflings are a bit tougher and more robust than their lightfoot cousins. They tend to be bolder and more adventurous, though they still value home and hearth. Their rumored dwarven ancestry is reflected in their resilience and determination.',
    abilityBonuses: [], // Flexible ASIs handled by Point Buy.
    traits: [
        'Creature Type: Humanoid',
        'Size: Small (about 3 feet tall)',
        'Speed: 25 feet',
        'Lucky: When you roll a 1 on the d20 for an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.',
        'Brave: You have Advantage on saving throws against being frightened.',
        'Halfling Nimbleness: You can move through the space of any creature that is of a size larger than yours.',
        'Stout Resilience: You have Advantage on saving throws against poison, and you have Resistance to poison damage.',
    ],
    imageUrl: 'assets/images/races/stout_halfling.png',
    visual: {
        id: 'stout_halfling',
        icon: '🛡️',
        color: '#8B7355',
        maleIllustrationPath: 'assets/images/races/stout_halfling_male.png',
        femaleIllustrationPath: 'assets/images/races/stout_halfling_female.png',
    },
};
