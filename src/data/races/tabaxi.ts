/**
 * @file tabaxi.ts
 * Defines the data for the Tabaxi race in the Aralia RPG.
 * Source: Mordenkainen's Monsters of the Multiverse p. 26 / Volo's Guide to Monsters p. 113
 */
import { Race } from '../../types'; // Path relative to src/data/races/

export const TABAXI_DATA: Race = {
  id: 'tabaxi',
  name: 'Tabaxi',
  description:
    'Hailing from a strange and distant land, wandering tabaxi are catlike humanoids driven by curiosity to collect interesting artifacts, gather tales and stories, and lay eyes on all the world’s wonders.',
  // Using 2014 ASIs (+2 Dex, +1 Cha) for consistency with other races until Background system handles stats globally.
  abilityBonuses: [
    { ability: 'Dexterity', bonus: 2 },
    { ability: 'Charisma', bonus: 1 },
  ],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium or Small. You choose the size when you select this race.',
    'Speed: 30 feet, Climb 20 feet',
    'Darkvision: You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You discern colors in that darkness only as shades of gray.',
    'Cat’s Claws: You can use your claws to make unarmed strikes. When you hit with them, the strike deals 1d6 + your Strength modifier slashing damage, instead of the bludgeoning damage normal for an unarmed strike.',
    'Cat’s Talent: You have proficiency in the Perception and Stealth skills.',
    'Feline Agility: Your reflexes and agility allow you to move with a burst of speed. When you move on your turn in combat, you can double your speed until the end of the turn. Once you use this trait, you can’t use it again until you move 0 feet on one of your turns.',
  ],
  imageUrl: 'https://i.ibb.co/Placeholder/Tabaxi.png', // Placeholder until artwork is available
};
