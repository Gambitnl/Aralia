/**
 * @file lightfoot_halfling.ts
 * Defines the data for the Lightfoot Halfling race in the Aralia RPG, based on Player's Handbook 2014.
 * Lightfoot halflings are naturally stealthy and can easily hide from notice.
 */
import { Race } from '../../types';

export const LIGHTFOOT_HALFLING_DATA: Race = {
    id: 'lightfoot_halfling',
    name: 'Lightfoot Halfling',
    baseRace: 'halfling',
    description:
        'As a lightfoot halfling, you can easily hide from notice, even using other people as cover. You\'re inclined to be affable and get along well with others. Lightfoots are more prone to wanderlust than other halflings, and often dwell alongside other races or take up a nomadic life. In the Forgotten Realms, lightfoot halflings have spread the farthest and thus are the most common variety. They are the most social of halflings, often traveling with companions of other races or settling in mixed communities.',
    abilityBonuses: [], // Flexible ASIs handled by Point Buy.
    traits: [
        'Creature Type: Humanoid',
        'Size: Small (about 3 feet tall)',
        'Speed: 25 feet',
        'Lucky: When you roll a 1 on the d20 for an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.',
        'Brave: You have Advantage on saving throws against being frightened.',
        'Halfling Nimbleness: You can move through the space of any creature that is of a size larger than yours.',
        'Naturally Stealthy: You can attempt to hide even when you are obscured only by a creature that is at least one size larger than you.',
    ],
    imageUrl: 'assets/images/races/lightfoot_halfling.png',
    visual: {
        id: 'lightfoot_halfling',
        icon: '🏃',
        color: '#DEB887',
        maleIllustrationPath: 'assets/images/races/lightfoot_halfling_male.png',
        femaleIllustrationPath: 'assets/images/races/lightfoot_halfling_female.png',
    },
};
