/**
 * @file yuan_ti.ts
 * Defines the data for the Yuan-Ti race in the Aralia RPG, inspired by the serpent-folk lore.
 */
import { Race } from '../../types';

export const YUAN_TI_DATA: Race = {
  id: 'yuan_ti',
  name: 'Yuan-Ti',
  baseRace: 'beastfolk',
  description:
    'Yuan-ti are snake-folk whose bodies blend serpentine elegance with humanoid grace. They are cunning manipulators, scholars of forbidden lore, and keepers of ancient serpentine cults.',
  abilityBonuses: [
    { ability: 'Dexterity', bonus: 2 },
    { ability: 'Intelligence', bonus: 1 },
  ],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    "Vision: You can see in [[dim_light|dim light]] within 60 feet of you as if it were [[bright_light|bright light]], and in [[darkness]] as if it were [[dim_light|dim light]]. You can't discern color in [[darkness]], only shades of gray.",
    'Magic Resistance: You have advantage on saving throws against spells.',
    'Poison Resilience: You have resistance to poison damage, and you have advantage on saving throws you make to avoid or end the poisoned condition.',
    'Serpentine Casting: You know the Poison Spray cantrip. Starting at 3rd level, you can cast Animal Friendship (snakes only) without expending a spell slot. Starting at 5th level, you can also cast Suggestion with this trait. Once you cast any of these spells with this trait, you canâ€™t cast it again until you finish a long rest. Intelligence is your spellcasting ability for these spells.',
  ],
  visual: {
    id: 'yuan_ti',
    color: '#4B8B3B',
    maleIllustrationPath: 'assets/images/races/Yuan-Ti_Male.png',
    femaleIllustrationPath: 'assets/images/races/Yuan-Ti_Female.png',
  },
  knownSpells: [
    { minLevel: 0, spellId: 'poison-spray' },
  ],
};
