/**
 * @file triton.ts
 * Defines the data for the Triton race in the Aralia RPG, based on Mordenkainen Presents: Monsters of the Multiverse, pg. 32.
 * ASIs are handled flexibly during character creation, not as fixed racial bonuses.
 */
import { Race } from '../../types';

export const TRITON_DATA: Race = {
  id: 'triton',
  name: 'Triton',
  description:
    'Originally from the Elemental Plane of Water, many tritons entered the Material Plane centuries ago to protect it from the growing threat of evil elementals. They spread across the worlds’ oceans, establishing deep-sea settlements to guard the surface from terrors in the deep. With their webbed hands and feet and small fins on their calves, they are perfectly adapted for aquatic life.',
  abilityBonuses: [], // Flexible ASIs are handled by the Point Buy system.
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet, swim 30 feet',
    'Amphibious: You can breathe air and water.',
    'Control Air and Water: You can cast Fog Cloud with this trait. Starting at 3rd level, you can cast Gust of Wind with it, and starting at 5th level, you can also cast Water Walk with it. Once you cast any of these spells with this trait, you can’t cast that spell with it again until you finish a long rest. You can also cast these spells using any spell slots you have of the appropriate level. Intelligence, Wisdom, or Charisma is your spellcasting ability for these spells when you cast them with this trait (choose when you select this race).',
    'Darkvision: You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.',
    'Emissary of the Sea: You can communicate simple ideas to any Beast, Elemental, or Monstrosity that has a swimming speed. It can understand your words, though you have no special ability to understand it in return.',
    'Guardian of the Depths: Adapted to the frigid ocean depths, you have resistance to cold damage.',
  ],
  imageUrl: 'https://i.ibb.co/Placeholder/Triton.png',
  visual: {
    id: 'triton',
    icon: '🔱',
    color: '#20B2AA',
    maleIllustrationPath: 'assets/images/races/triton_male.png',
    femaleIllustrationPath: 'assets/images/races/triton_female.png',
  },
};
