/**
 * @file lotusden_halfling.ts
 * Defines the data for the Lotusden Halfling race in the Aralia RPG, based on Explorer's Guide to Wildemount.
 * Lotusden halflings have a deep connection to the natural world and druidic magic.
 */
import { Race } from '../../types';

export const LOTUSDEN_HALFLING_DATA: Race = {
    id: 'lotusden_halfling',
    name: 'Lotusden Halfling',
    baseRace: 'halfling',
    description:
        'Lotusden halflings are native to the Lotusden Greenwood of Exandria, where they have developed a deep connection to the natural world and druidic magic. Living in harmony with the forest, they possess innate abilities to communicate with nature and call upon plant life for protection. Their communities are well-hidden among the trees, and they serve as guardians of the woodland realms.',
    abilityBonuses: [], // Flexible ASIs handled by Point Buy.
    traits: [
        'Creature Type: Humanoid',
        'Size: Small (about 3 feet tall)',
        'Speed: 25 feet',
        'Lucky: When you roll a 1 on the d20 for an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.',
        'Brave: You have Advantage on saving throws against being frightened.',
        'Halfling Nimbleness: You can move through the space of any creature that is of a size larger than yours.',
        'Child of the Wood: You know the Druidcraft cantrip. When you reach 3rd level, you can cast the Entangle spell once with this trait and regain the ability to do so when you finish a Long Rest. When you reach 5th level, you can cast the Spike Growth spell once with this trait and regain the ability to do so when you finish a Long Rest. Casting these spells with this trait doesn\'t require material components. Wisdom is your spellcasting ability for these spells.',
        'Timberwalk: Ability checks made to track you have Disadvantage, and you can move across difficult terrain made of nonmagical plants and undergrowth without expending extra movement.',
    ],
    imageUrl: 'assets/images/races/lotusden_halfling.png',
    visual: {
        id: 'lotusden_halfling',
    color: '#98FB98',
        maleIllustrationPath: 'assets/images/races/Halfling_Lotusden_Male.png',
        femaleIllustrationPath: 'assets/images/races/Halfling_Lotusden_Female.png',
    },
};
