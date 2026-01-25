/**
 * @file mark_of_sentinel_human.ts
 * Defines the data for the Mark of Sentinel Human race in the Aralia RPG.
 * Humans with the Mark of Sentinel possess exceptional protective and defensive abilities.
 */
import { Race } from '../../types';

export const MARK_OF_SENTINEL_HUMAN_DATA: Race = {
  id: 'guardian_human',
  name: 'Guardian Human',
  baseRace: 'human',
  description:
    'Bearing a sigil shaped like a watchful eye or shield, humans with the Mark of Sentinel are natural guardians blessed with heightened awareness and protective instincts. This hereditary gift grants them the power to sense danger before it strikes and shield others from harm, even at risk to themselves. Their mark flares with light when they intercept attacks or protect their allies. These sentinel-touched individuals become legendary bodyguards, protectors, and defenders, their unwavering vigilance making them the most trusted guardians in the realm.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Resourceful: You gain Heroic Inspiration whenever you finish a Long Rest.',
    'Skillful: You gain proficiency in one skill of your choice.',
    'Versatile: You gain an Origin feat of your choice.',
    'Sentinel\'s Intuition: When you make a Wisdom (Insight) or Wisdom (Perception) check, you can roll a d4 and add the number rolled to the ability check.',
    'Guardian\'s Shield: You can cast the Shield spell once with this trait, and you regain the ability to cast it when you finish a Long Rest. Constitution is your spellcasting ability for this spell.',
    'Vigilant Guardian: When a creature you can see within 5 feet of you is hit by an attack roll, you can use your reaction to swap places with that creature, and you are hit by the attack instead. Once you use this trait, you can\'t do so again until you finish a Long Rest.',
    'Spells of the Mark: If you have the Spellcasting or Pact Magic class feature, the spells on the Mark of Sentinel Spells table are added to the spell list of your spellcasting class.',
  ],
  visual: {
    id: 'mark_of_sentinel_human',
    color: '#4169E1',
    maleIllustrationPath: 'assets/images/races/Human_Guardian_Male.png',
    femaleIllustrationPath: 'assets/images/races/Human_Guardian_Female.png',
  },
  knownSpells: [
    { minLevel: 1, spellId: 'shield' },
  ],
};
