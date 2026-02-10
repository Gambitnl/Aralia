/**
 * @file half_elf_aquatic.ts
 * Defines the data for the Aquatic Half-Elf variant in the Aralia RPG, based on SCAG.
 * Half-elves with sea elf ancestry gain a swimming speed.
 */
import { Race } from '../../types';

export const HALF_ELF_AQUATIC_DATA: Race = {
  id: 'half_elf_aquatic',
  name: 'Aquatic Half-Elf',
  baseRace: 'half_elf',
  description:
    'Half-elves of aquatic elf heritage are rare, as aquatic elves seldom interact with surface-dwelling peoples. Those who do exist often feel torn between two worlds—the depths of the ocean and the lands above. They typically have webbed fingers and toes, skin tinted with blues or greens, and an affinity for water that sets them apart from other half-elves. Many become sailors, fishermen, or adventurers who explore both the depths and the shores.',
  abilityBonuses: [
    {
      ability: 'Charisma',
      bonus: 2,
    },
    {
      ability: 'Any',
      bonus: 1,
      choiceCount: 2,
    },
  ],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium (about 5-6 feet tall)',
    'Speed: 30 feet',
    'Swim Speed: 30 feet',
    "Vision: You can see in [[dim_light|dim light]] within 60 feet of you as if it were [[bright_light|bright light]], and in [[darkness]] as if it were [[dim_light|dim light]]. You can't discern color in [[darkness]], only shades of gray.",
    'Fey Ancestry: You have advantage on saving throws against being charmed, and magic can\'t put you to sleep.',
    'Skill Versatility: You gain proficiency in one skill of your choice.',
    'Swim Speed: Your aquatic elf heritage grants you a swimming speed of 30 feet.',
  ],
  imageUrl: 'assets/images/races/half_elf_aquatic.png',
  visual: {
    id: 'half_elf_aquatic',
    color: '#5F9EA0',
    maleIllustrationPath: 'assets/images/races/Half-Elf_Aquatic_Male.png',
    femaleIllustrationPath: 'assets/images/races/Half-Elf_Aquatic_Female.png',
  },
};
