/**
 * @file pallid_elf.ts
 * Defines the data for the Pallid Elf race in the Aralia RPG.
 * Pallid elves are unique to Exandria, dwelling in shadowed recesses without sunlight.
 */
import { Race } from '../../types';

export const PALLID_ELF_DATA: Race = {
  id: 'pallid_elf',
  name: 'Pallid Elf',
  baseRace: 'elf',
  description:
    'Pallid elves are a subrace of elves unique to Exandria, dwelling in the shadowed recesses of the Pallid Grove in the Greying Wildlands. They have adapted to a life without sunlight, developing pale, almost luminescent skin and an affinity for the mysteries of the Luxon. Their connection to light and darkness gives them unique magical abilities, and their society values knowledge, introspection, and the secrets hidden in shadow. Pallid elves possess heightened analytical abilities and a gift for perceiving truth through deception.',
  abilityBonuses: [], // Flexible ASIs handled by Point Buy.
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium (about 5-6 feet tall)',
    'Speed: 30 feet',
    'Darkvision: You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can\'t discern color in darkness, only shades of gray.',
    'Fey Ancestry: You have advantage on saving throws you make to avoid or end the Charmed condition on yourself.',
    'Keen Senses: You have proficiency in the Perception skill.',
    'Trance: You don\'t need to sleep, and magic can\'t put you to sleep. You can finish a Long Rest in 4 hours if you spend those hours in a trancelike meditation, during which you retain consciousness.',
    'Incisive Sense: You have advantage on Intelligence (Investigation) and Wisdom (Insight) checks.',
    'Blessing of the Moon Weaver: You know the Light cantrip. When you reach 3rd level, you can cast the Sleep spell once with this trait and regain the ability to do so when you finish a Long Rest. When you reach 5th level, you can cast the Invisibility spell (targeting yourself only) once with this trait and regain the ability to do so when you finish a Long Rest. Casting these spells with this trait doesn\'t require material components. Wisdom is your spellcasting ability for these spells.',
  ],
  imageUrl: 'assets/images/races/pallid_elf.png',
  visual: {
    id: 'pallid_elf',
    icon: '👁️',
    color: '#D3D3D3',
    maleIllustrationPath: 'assets/images/races/pallid_elf_male.png',
    femaleIllustrationPath: 'assets/images/races/pallid_elf_female.png',
  },
};
