/**
 * @file centaur.ts
 * Defines the data for the Centaur race in the Aralia RPG, based on Mordenkainen Presents: Monsters of the Multiverse, pg. 9.
 */
import { Race } from '../../types'; // Path relative to src/data/races/

export const CENTAUR_DATA: Race = {
  id: 'centaur',
  name: 'Centaur',
  description:
    'Centaurs gallop throughout the multiverse and trace their origins to many different realms. The centaurs presented here hail from the Feywild and mystically resonate with the natural world. From the waist up, they resemble elves, displaying all the elf varieties of skin tone. From the waist down, they have the bodies of horses.',
  abilityBonuses: [], // Flexible ASIs are handled by Point Buy system.
  traits: [
    'Creature Type: Fey',
    'Size: Medium',
    'Speed: 40 feet',
    'Charge: If you move at least 30 feet straight toward a target and then hit it with a melee weapon attack on the same turn, you can immediately follow that attack with a bonus action, making one attack against the target with your hooves.',
    'Equine Build: You count as one size larger when determining your carrying capacity and the weight you can push or drag. In addition, any climb that requires hands and feet is especially difficult for you because of your equine legs. When you make such a climb, each foot of movement costs you 4 extra feet instead of the normal 1 extra foot.',
    'Hooves: You have hooves that you can use to make unarmed strikes. When you hit with them, the strike deals 1d6 + your Strength modifier bludgeoning damage, instead of the bludgeoning damage normal for an unarmed strike.',
    'Natural Affinity: Your fey connection to nature gives you an intuitive connection to the natural world and the animals within it. You therefore have proficiency in one of the following skills of your choice: Animal Handling, Medicine, Nature, or Survival.',
  ],
  imageUrl: 'https://i.ibb.co/pvc3Jkp0/Centaur.png',
};
