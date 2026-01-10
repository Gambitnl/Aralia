/**
 * @file half_elf_wood.ts
 * Defines the data for the Wood Half-Elf variant in the Aralia RPG, based on SCAG.
 * Half-elves with wood elf ancestry gain Fleet of Foot or Mask of the Wild.
 */
import { Race } from '../../types';

export const HALF_ELF_WOOD_DATA: Race = {
  id: 'half_elf_wood',
  name: 'Half-Elf (Wood)',
  baseRace: 'half_elf',
  description:
    'Half-elves with wood elf heritage inherit their elven parent\'s affinity for nature and their swift, graceful movements. They often have tanned skin and hair that ranges from blonde to deep brown, sometimes with hints of green. These half-elves feel most at home in forests and wild places, possessing an instinctive ability to blend into natural surroundings. Many become rangers, druids, or scouts, putting their enhanced speed and natural camouflage to good use.',
  abilityBonuses: [
    {
      ability: 'charisma',
      amount: 2,
    },
    {
      ability: 'any',
      amount: 1,
      choiceCount: 2,
    },
  ],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium (about 5-6 feet tall)',
    'Speed: 35 feet',
    'Darkvision: Thanks to your elf blood, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can\'t discern color in darkness, only shades of gray.',
    'Fey Ancestry: You have advantage on saving throws against being charmed, and magic can\'t put you to sleep.',
    'Skill Versatility: You gain proficiency in one skill of your choice.',
    'Fleet of Foot: Your base walking speed increases to 35 feet.',
    'Mask of the Wild (Alternative): You can attempt to hide even when you are only lightly obscured by foliage, heavy rain, falling snow, mist, and other natural phenomena. This option can replace Fleet of Foot.',
  ],
  imageUrl: 'assets/images/races/half_elf_wood.png',
  visual: {
    id: 'half_elf_wood',
    icon: '🌿',
    color: '#6B8E23',
    maleIllustrationPath: 'assets/images/races/half_elf_wood_male.png',
    femaleIllustrationPath: 'assets/images/races/half_elf_wood_female.png',
  },
};
