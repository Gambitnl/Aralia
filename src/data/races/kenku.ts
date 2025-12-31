/**
 * @file kenku.ts
 * Defines the data for the Kenku race in the Aralia RPG, based on Mordenkainen Presents: Monsters of the Multiverse, pg. 24.
 * ASIs are handled flexibly during character creation, not as fixed racial bonuses.
 */
// [Mythkeeper] Implemented Kenku race data from MPMotM p.24 to fill a known gap in race options.
import { Race } from '../../types';

export const KENKU_DATA: Race = {
  id: 'kenku',
  name: 'Kenku',
  description:
    'Feathered folk who resemble ravens, kenku are blessed with keen observation and supernaturally accurate memories. None of them can fly, and they often use their talent for mimicry to communicate. They have a reputation for being excellent burglars, scouts, and scribes.',
  abilityBonuses: [], // Flexible ASIs are handled by the Point Buy system.
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium or Small',
    'Speed: 30 feet',
    'Expert Duplication: When you copy writing or craftwork produced by yourself or someone else, you have advantage on any ability checks you make to produce an exact duplicate.',
    'Kenku Recall: Thanks to your supernaturally good memory, you have proficiency in two skills of your choice from the following list: Acrobatics, Deception, History, Investigation, Nature, Perception, Sleight of Hand, Stealth, and Survival. Moreover, when you make an ability check using any skill in which you have proficiency, you can give yourself advantage on the check before rolling the d20. You can use this advantage a number of times equal to your proficiency bonus, and you regain all expended uses when you finish a long rest.',
    'Mimicry: You can mimic sounds you have heard, including voices. A creature that hears the sounds you make can tell they are imitations with a successful Wisdom (Insight) check opposed by your Charisma (Deception) check.',
  ],
  imageUrl: 'https://i.ibb.co/Placeholder/Kenku.png',
};
