/**
 * @file mark_of_handling_human.ts
 * Defines the data for the Mark of Handling Human race in the Aralia RPG.
 * Humans with the Mark of Handling possess exceptional abilities with animals and beasts.
 */
import { Race } from '../../types';

export const MARK_OF_HANDLING_HUMAN_DATA: Race = {
  id: 'beastborn_human',
  name: 'Beastborn Human',
  baseRace: 'human',
  description:
    'Bearing a sigil that seems to shift like animal tracks, humans with the Mark of Handling possess an innate connection to beasts and wild creatures. This hereditary gift grants them the ability to calm savage animals, communicate with beasts, and forge bonds that others cannot match. Their mark glows softly when they touch an animal, conveying peace and understanding. These beast-touched individuals become legendary animal trainers, wilderness guides, and beastmasters, their unique bond with the natural world making them invaluable companions.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Resourceful: You gain Heroic Inspiration whenever you finish a Long Rest.',
    'Skillful: You gain proficiency in one skill of your choice.',
    'Versatile: You gain an Origin feat of your choice.',
    'Wild Intuition: When you make a Wisdom (Animal Handling) or Intelligence (Nature) check, you can roll a d4 and add the number rolled to the ability check.',
    'Primal Connection: You can cast the Animal Friendship and Speak with Animals spells with this trait, requiring no material component. Once you cast either spell with this trait, you can\'t cast that spell with it again until you finish a Short Rest or Long Rest. Wisdom is your spellcasting ability for these spells.',
    'The Bigger They Are: Starting at 3rd level, you can target a beast or monstrosity when you cast Animal Friendship or Speak with Animals, provided the creature\'s Intelligence score is 3 or lower.',
    'Spells of the Mark: If you have the Spellcasting or Pact Magic class feature, the spells on the Mark of Handling Spells table are added to the spell list of your spellcasting class.',
  ],
  visual: {
    id: 'mark_of_handling_human',
    icon: '🐾',
    color: '#8B4513',
    maleIllustrationPath: 'assets/images/races/Human_Beastborn_Male.png',
    femaleIllustrationPath: 'assets/images/races/Human_Beastborn_Female.png',
  },
  knownSpells: [
    { minLevel: 1, spellId: 'animal-friendship' },
    { minLevel: 1, spellId: 'speak-with-animals' },
  ],
};
