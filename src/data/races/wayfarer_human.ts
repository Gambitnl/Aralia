/**
 * @file mark_of_passage_human.ts
 * Defines the data for the Mark of Passage Human race in the Aralia RPG.
 * Humans with the Mark of Passage possess exceptional speed and teleportation abilities.
 */
import { Race } from '../../types';

export const MARK_OF_PASSAGE_HUMAN_DATA: Race = {
  id: 'wayfarer_human',
  name: 'Wayfarer Human',
  baseRace: 'human',
  description:
    'Adorned with a sigil that flows like a winding road, humans bearing the Mark of Passage are blessed with supernatural swiftness and the power to traverse distance in the blink of an eye. This hereditary gift grants them enhanced speed and the ability to teleport short distances, making barriers and obstacles mere suggestions. Their mark glimmers when they move at full speed or vanish through space. These passage-touched individuals become legendary couriers, scouts, and travelers, their ability to move freely making them invaluable messengers and guides.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 35 feet',
    'Resourceful: You gain Heroic Inspiration whenever you finish a Long Rest.',
    'Skillful: You gain proficiency in one skill of your choice.',
    'Versatile: You gain an Origin feat of your choice.',
    'Courier\'s Speed: Your base walking speed is 35 feet.',
    'Intuitive Motion: When you make a Dexterity (Acrobatics) check or any ability check to operate or maintain a land vehicle, you can roll a d4 and add the number rolled to the ability check.',
    'Magical Passage: You can cast the Misty Step spell once with this trait, and you regain the ability to cast it when you finish a Long Rest. Dexterity is your spellcasting ability for this spell.',
    'Spells of the Mark: If you have the Spellcasting or Pact Magic class feature, the spells on the Mark of Passage Spells table are added to the spell list of your spellcasting class.',
  ],
  visual: {
    id: 'mark_of_passage_human',
    icon: '🏃',
    color: '#4682B4',
    maleIllustrationPath: 'assets/images/races/Human_Wayfarer_Male.png',
    femaleIllustrationPath: 'assets/images/races/Human_Wayfarer_Female.png',
  },
  knownSpells: [
    { minLevel: 1, spellId: 'misty-step' },
  ],
};
