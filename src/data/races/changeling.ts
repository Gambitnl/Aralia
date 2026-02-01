/**
 * @file changeling.ts
 * Defines the data for the Changeling race in the Aralia RPG, based on Mordenkainen Presents: Monsters of the Multiverse, pg. 10.
 */
import { Race } from '../../types'; // Path relative to src/data/races/

export const CHANGELING_DATA: Race = {
  id: 'changeling',
  name: 'Changeling',
  baseRace: 'shapeshifters',
  description:
    'With ever-changing appearances, changelings reside in many societies undetected. Each changeling can supernaturally adopt any face they like. For some changelings, a new face is only a disguise. For other changelings, a new face may reveal an aspect of their soul.',
  abilityBonuses: [], // Flexible ASIs are handled by Point Buy.
  traits: [
    'Creature Type: Fey',
    'Size: Medium or Small. You choose the size when you select this race.',
    'Speed: 30 feet',
    'Changeling Instincts: Thanks to your connection to the fey realm, you gain proficiency with two of the following skills of your choice: Deception, Insight, Intimidation, Performance, or Persuasion.',
    'Shapechanger: As an action, you can change your appearance and your voice. You determine the specifics of the changes, including your coloration, hair length, and sex. You can also adjust your height and weight and can change your size between Medium and Small. You can make yourself appear as a member of another race, though none of your game statistics change. You can’t duplicate the appearance of an individual you’ve never seen, and you must adopt a form that has the same basic arrangement of limbs that you have. Your clothing and equipment aren’t changed by this trait.',
  ],
  imageUrl: 'https://i.ibb.co/N28tRQfH/Changeling.png',
  visual: {
    id: 'changeling',
    color: '#E8E8E8',
    maleIllustrationPath: 'assets/images/races/Changeling_Male.png',
    femaleIllustrationPath: 'assets/images/races/Changeling_Female.png',
  },
};
