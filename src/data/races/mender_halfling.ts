/**
 * @file mark_of_healing_halfling.ts
 * Defines the data for the Mark of Healing Halfling race in the Aralia RPG.
 * Mark of Healing halflings possess natural healing abilities through their mystical mark.
 */
import { Race } from '../../types';

export const MARK_OF_HEALING_HALFLING_DATA: Race = {
    id: 'mender_halfling',
    name: 'Mender Halfling',
    baseRace: 'halfling',
    description:
        'Born with a luminous sigil that radiates life-giving energy, halflings bearing the Mark of Healing are blessed with the power to mend wounds and cure ailments. This hereditary gift pulses with restorative magic, allowing them to channel healing energy through their very touch. Natural caregivers whose presence brings comfort to the afflicted, these marked halflings are sought after as healers, physicians, and miracle workers, their compassion amplified by the arcane legacy flowing through their bloodline.',
    abilityBonuses: [], // Flexible ASIs handled by Point Buy.
    traits: [
        'Creature Type: Humanoid',
        'Size: Small (about 3 feet tall)',
        'Speed: 25 feet',
        'Lucky: When you roll a 1 on the d20 for an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.',
        'Brave: You have Advantage on saving throws against being frightened.',
        'Halfling Nimbleness: You can move through the space of any creature that is of a size larger than yours.',
        'Medical Intuition: When you make a Wisdom (Medicine) check or an ability check using an herbalism kit, you can roll a d4 and add the number rolled to the ability check.',
        'Healing Touch: You can cast the Cure Wounds spell with this trait. Starting at 3rd level, you can also cast Lesser Restoration with it. Once you cast either spell with this trait, you can\'t cast that spell with it again until you finish a Long Rest. Wisdom is your spellcasting ability for these spells.',
        'Spells of the Mark: If you have the Spellcasting or Pact Magic class feature, the spells on the Mark of Healing Spells table are added to the spell list of your spellcasting class.',
    ],
    imageUrl: 'assets/images/races/mark_of_healing_halfling.png',
    visual: {
        id: 'mark_of_healing_halfling',
        icon: '⚕️',
        color: '#FF69B4',
        maleIllustrationPath: 'assets/images/races/Halfling_Mender_Male.png',
        femaleIllustrationPath: 'assets/images/races/Halfling_Mender_Female.png',
    },
};
