/**
 * @file half_elf_high.ts
 * Defines the data for the High Half-Elf variant in the Aralia RPG, based on SCAG.
 * Half-elves with high elf ancestry gain a wizard cantrip.
 */
import { Race } from '../../types';

export const HALF_ELF_HIGH_DATA: Race = {
  id: 'half_elf_high',
  name: 'Half-Elf (High)',
  baseRace: 'half_elf',
  description:
    'Half-elves with high elf heritage often display an affinity for the arcane arts that runs strong in their elven bloodline. They may have features that lean slightly more elven than human, with longer ears and more angular features. Many are drawn to magical study, finding that wizardry and other arcane pursuits come naturally to them. Their high elf parent\'s culture of intellectual curiosity and magical tradition often leaves a lasting impression, even when raised among humans.',
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
    'Speed: 30 feet',
    'Darkvision: Thanks to your elf blood, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can\'t discern color in darkness, only shades of gray.',
    'Fey Ancestry: You have advantage on saving throws against being charmed, and magic can\'t put you to sleep.',
    'Skill Versatility: You gain proficiency in one skill of your choice.',
    'Cantrip: You know one cantrip of your choice from the wizard spell list. Intelligence is your spellcasting ability for it.',
  ],
  imageUrl: 'assets/images/races/half_elf_high.png',
  visual: {
    id: 'half_elf_high',
    icon: '⭐',
    color: '#B0C4DE',
    maleIllustrationPath: 'assets/images/races/half_elf_high_male.png',
    femaleIllustrationPath: 'assets/images/races/half_elf_high_female.png',
  },
};
