/**
 * @file tabaxi.ts
 * Defines the data for the Tabaxi race in the Aralia RPG, based on Mordenkainen Presents: Monsters of the Multiverse, pg. 26.
 * ASIs are handled flexibly during character creation, not as fixed racial bonuses.
 */
import { Race } from '../../types'; // Path relative to src/data/races/

export const TABAXI_DATA: Race = {
  id: 'tabaxi',
  name: 'Tabaxi',
  description:
    'Hailing from a strange and distant land, wandering tabaxi are catlike humanoids driven by curiosity to collect interesting artifacts, gather tales and stories, and lay eyes on all the world’s wonders. Ultimate travelers, the inquisitive tabaxi rarely stay in one place for long. Their innate nature pushes them to leave no secrets uncovered, no treasures or legends lost.',
  abilityBonuses: [], // Flexible ASIs are handled by the Point Buy system.
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium or Small',
    'Speed: 30 feet',
    'Darkvision: You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.',
    'Cat’s Claws: You can use your claws to make unarmed strikes. When you hit with them, the strike deals 1d6 + your Strength modifier slashing damage, instead of the bludgeoning damage normal for an unarmed strike. You also have a climbing speed equal to your walking speed.',
    'Cat’s Talent: You have proficiency in the Perception and Stealth skills.',
    'Feline Agility: Your reflexes and agility allow you to move with a burst of speed. When you move on your turn in combat, you can double your speed until the end of the turn. Once you use this trait, you can’t use it again until you move 0 feet on one of your turns.',
  ],
  imageUrl: 'https://i.ibb.co/Placeholder/Tabaxi.png',
  visual: {
    id: 'tabaxi',
    icon: '🐱',
    color: '#D2691E',
    maleIllustrationPath: 'assets/images/races/Tabaxi_Male.png',
    femaleIllustrationPath: 'assets/images/races/Tabaxi_Female.png',
  },
};
