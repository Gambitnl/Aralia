/**
 * @file mark_of_hospitality_halfling.ts
 * Defines the data for the Mark of Hospitality Halfling race in the Aralia RPG.
 * Mark of Hospitality halflings have innate talents for food, shelter, and making others feel welcome.
 */
import { Race } from '../../types';

export const MARK_OF_HOSPITALITY_HALFLING_DATA: Race = {
    id: 'hearthkeeper_halfling',
    name: 'Hearthkeeper Halfling',
    baseRace: 'halfling',
    description:
        'Blessed with a warm sigil that emanates comfort and welcome, halflings bearing the Mark of Hospitality possess an innate magical gift for creating spaces of warmth and safety. This hereditary mark enhances their natural charm and culinary talents, allowing them to conjure hospitality through both mundane skill and arcane power. Their presence turns any space into a haven, their food nourishes both body and spirit, and their service brings joy to the weary. These marked halflings are natural innkeepers, chefs, and ambassadors of goodwill.',
    abilityBonuses: [], // Flexible ASIs handled by Point Buy.
    traits: [
        'Creature Type: Humanoid',
        'Size: Small (about 3 feet tall)',
        'Speed: 25 feet',
        'Lucky: When you roll a 1 on the d20 for an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.',
        'Brave: You have Advantage on saving throws against being frightened.',
        'Halfling Nimbleness: You can move through the space of any creature that is of a size larger than yours.',
        'Ever Hospitable: When you make a Charisma (Persuasion) check or an ability check involving brewer\'s supplies or cook\'s utensils, you can roll a d4 and add the number rolled to the ability check.',
        'Innkeeper\'s Magic: You know the Prestidigitation cantrip. You can also cast the Purify Food and Drink and Unseen Servant spells with this trait. Once you cast either spell with this trait, you can\'t cast that spell with it again until you finish a Long Rest. Charisma is your spellcasting ability for these spells.',
        'Spells of the Mark: If you have the Spellcasting or Pact Magic class feature, the spells on the Mark of Hospitality Spells table are added to the spell list of your spellcasting class.',
    ],
    imageUrl: 'assets/images/races/mark_of_hospitality_halfling.png',
    visual: {
        id: 'mark_of_hospitality_halfling',
        icon: '🏠',
        color: '#FFB347',
        maleIllustrationPath: 'assets/images/races/Halfling_Hearthkeeper_Male.png',
        femaleIllustrationPath: 'assets/images/races/Halfling_Hearthkeeper_Female.png',
    },
};
