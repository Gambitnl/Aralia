/**
 * @file half_elf.ts
 * Defines the data for the Half-Elf race in the Aralia RPG, based on 2014 PHB.
 * Half-elves combine the best qualities of both human and elven ancestry.
 */
import { Race } from '../../types';

export const HALF_ELF_DATA: Race = {
  id: 'half_elf',
  name: 'Half-Elf',
  description:
    'Walking in two worlds but truly belonging to neither, half-elves combine what some say are the best qualities of their elf and human parents: human curiosity, inventiveness, and ambition tempered by the refined senses, love of nature, and artistic tastes of the elves. Some half-elves live among humans, set apart by their emotional and physical differences, while others dwell in elven settlements, restless and unfulfilled by elven timelessness. Most find places among other half-elves or in diverse communities where their heritage is less of an issue.',
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
    "Vision: You can see in [[dim_light|dim light]] within 60 feet of you as if it were [[bright_light|bright light]], and in [[darkness]] as if it were [[dim_light|dim light]]. You can't discern color in [[darkness]], only shades of gray.",
    'Fey Ancestry: You have advantage on saving throws against being charmed, and magic can\'t put you to sleep.',
    'Skill Versatility: You gain proficiency in two skills of your choice.',
  ],
  imageUrl: 'assets/images/races/half_elf.png',
  visual: {
    id: 'half_elf',
    color: '#DDA0DD',
    maleIllustrationPath: 'assets/images/races/Half_elf_Male.png',
    femaleIllustrationPath: 'assets/images/races/Half_elf_Female.png',
  },
};
