/**
 * @file half_elf_drow.ts
 * Defines the data for the Drow Half-Elf variant in the Aralia RPG, based on SCAG.
 * Half-elves with drow ancestry gain drow magic abilities.
 */
import { Race } from '../../types';

export const HALF_ELF_DROW_DATA: Race = {
  id: 'half_elf_drow',
  name: 'Drow Half-Elf',
  baseRace: 'half_elf',
  description:
    'Half-elves of drow heritage are often the result of forbidden unions or raids upon the surface world. Many face prejudice from both sides of their ancestry—mistrusted by surface dwellers for their dark elf blood and scorned by drow for their human taint. Despite these hardships, half-drow often develop strong wills and a determination to forge their own path. They may inherit the drow\'s affinity for shadow magic, manifesting as an ability to conjure dancing lights, darkness, and other supernatural effects.',
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
    'Skill Versatility: You gain proficiency in one skill of your choice.',
    'Drow Magic: You know the Dancing Lights cantrip. When you reach 3rd level, you can cast the Faerie Fire spell once with this trait, and you regain the ability to do so when you finish a Long Rest. When you reach 5th level, you can cast the Darkness spell once with this trait, and you regain the ability to do so when you finish a Long Rest. Charisma is your spellcasting ability for these spells.',
  ],
  imageUrl: 'assets/images/races/half_elf_drow.png',
  visual: {
    id: 'half_elf_drow',
    color: '#663399',
    maleIllustrationPath: 'assets/images/races/Half-Elf_Drow_Male.png',
    femaleIllustrationPath: 'assets/images/races/Half-Elf_Drow_Female.png',
  },
};
