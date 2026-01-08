/**
 * @file goliath.ts
 * Defines the data for the Goliath race in the Aralia RPG.
 * This includes their ID, name, description, traits, and Giant Ancestry choices.
 */
// TODO(lint-intent): 'GiantAncestryType' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { Race, GiantAncestryBenefit, GiantAncestryType as _GiantAncestryType } from '../../types'; // Path relative to src/data/races/

export const GIANT_ANCESTRY_BENEFITS_DATA: GiantAncestryBenefit[] = [
  {
    id: 'Cloud',
    name: "Cloud's Jaunt",
    description: "As a Bonus Action, you magically teleport up to 30 feet to an unoccupied space you can see. You can use this benefit a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest.",
  },
  {
    id: 'Fire',
    name: "Fire's Burn",
    description: "When you hit a target with an attack roll and deal damage to it, you can also deal 1d10 Fire damage to that target. You can use this benefit a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest.",
  },
  {
    id: 'Frost',
    name: "Frost's Chill",
    description: "When you hit a target with an attack roll and deal damage to it, you can also deal 1d6 Cold damage to that target and reduce its Speed by 10 feet until the start of your next turn. You can use this benefit a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest.",
  },
  {
    id: 'Hill',
    name: "Hill's Tumble",
    description: "When you hit a Large or smaller creature with an attack roll and deal damage to it, you can give that target the Prone condition. You can use this benefit a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest.",
  },
  {
    id: 'Stone',
    name: "Stone's Endurance",
    description: "When you take damage, you can take a Reaction to roll 1d12. Add your Constitution modifier to the number rolled and reduce the damage by that total. You can use this benefit a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest.",
  },
  {
    id: 'Storm',
    name: "Storm's Thunder",
    description: "When you take damage from a creature within 60 feet of you, you can take a Reaction to deal 1d8 Thunder damage to that creature. You can use this benefit a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest.",
  },
];


export const GOLIATH_DATA: Race = {
  id: 'goliath',
  name: 'Goliath',
  description:
    'Towering over most folk, goliaths are distant descendants of giants. Each goliath bears the favors of the first giants—favors that manifest in various supernatural boons, including the ability to quickly grow and temporarily approach the height of goliaths’ gigantic kin. Goliaths have physical characteristics that are reminiscent of the giants in their family lines. For example, some goliaths look like stone giants, while others resemble fire giants. Whatever giants they count as kin, goliaths have forged their own path in the multiverse—unencumbered by the internecine conflicts that have ravaged giantkind for ages—and seek heights above those reached by their ancestors.',
  abilityBonuses: [], // Per 2024 PHB style, ASIs are generally not tied directly to race.
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium (about 7–8 feet tall)',
    'Speed: 35 feet',
    'Giant Ancestry: You are descended from Giants. Choose one supernatural boon from your ancestry (Cloud’s Jaunt, Fire’s Burn, Frost’s Chill, Hill’s Tumble, Stone’s Endurance, or Storm’s Thunder). You can use the chosen benefit a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest.',
    'Large Form: Starting at character level 5, you can change your size to Large as a Bonus Action if you’re in a big enough space. This transformation lasts for 10 minutes or until you end it (no action required). For that duration, you have Advantage on Strength checks, and your Speed increases by 10 feet. Once you use this trait, you can’t use it again until you finish a Long Rest. (Note: Level-based features are descriptive for now).',
    'Powerful Build: You have Advantage on any ability check you make to end the Grappled condition. You also count as one size larger when determining your carrying capacity.',
  ],
  giantAncestryChoices: GIANT_ANCESTRY_BENEFITS_DATA,
  imageUrl: 'https://i.ibb.co/m5hCjLxW/Goliath.png',
  visual: {
    id: 'goliath',
    icon: '🏔️',
    color: '#708090',
    maleIllustrationPath: 'assets/images/races/goliath_male.png',
    femaleIllustrationPath: 'assets/images/races/goliath_female.png',
  },
};
