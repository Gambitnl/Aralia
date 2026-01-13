/**
 * @file mark_of_shadow_elf.ts
 * Defines the data for the Mark of Shadow Elf race in the Aralia RPG.
 * Elves bearing the Mark of Shadow possess power over illusion and darkness.
 */
import { Race } from '../../types';

export const MARK_OF_SHADOW_ELF_DATA: Race = {
  id: 'shadowveil_elf',
  name: 'Shadowveil Elf',
  baseRace: 'elf',
  description:
    'Bearing a sigil that seems to absorb light itself, elves with the Mark of Shadow are masters of deception and illusion. This hereditary gift grants them the power to bend shadows, craft convincing phantasms, and slip unseen through the world. Their mark appears as a constantly shifting pattern of darkness on their skin, never quite the same shape twice. These shadow-touched elves excel as spies, performers, illusionists, and infiltrators, their ability to manipulate perception making them invaluable—and dangerous—allies.',
  abilityBonuses: [], // Flexible ASIs handled by Point Buy.
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium (about 5-6 feet tall)',
    'Speed: 30 feet',
    'Darkvision: You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can\'t discern color in darkness, only shades of gray.',
    'Fey Ancestry: You have advantage on saving throws you make to avoid or end the Charmed condition on yourself.',
    'Keen Senses: You have proficiency in the Perception skill.',
    'Trance: You don\'t need to sleep, and magic can\'t put you to sleep. You can finish a Long Rest in 4 hours if you spend those hours in a trancelike meditation, during which you retain consciousness.',
    'Cunning Intuition: When you make a Charisma (Performance) or Dexterity (Stealth) check, you can roll a d4 and add the number rolled to the ability check.',
    'Shape Shadows: You know the Minor Illusion cantrip. Starting at 3rd level, you can cast the Invisibility spell once with this trait, and you regain the ability to cast it when you finish a Long Rest. Charisma is your spellcasting ability for these spells.',
    'Spells of the Mark: If you have the Spellcasting or Pact Magic class feature, the spells on the Mark of Shadow Spells table are added to the spell list of your spellcasting class. These include spells like Disguise Self, Pass without Trace, Clairvoyance, and Greater Invisibility.',
  ],
  imageUrl: 'assets/images/races/mark_of_shadow_elf.png',
  visual: {
    id: 'mark_of_shadow_elf',
    icon: '🌑',
    color: '#191970',
    maleIllustrationPath: 'assets/images/races/mark_of_shadow_elf_male.png',
    femaleIllustrationPath: 'assets/images/races/mark_of_shadow_elf_female.png',
  },
};
