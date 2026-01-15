/**
 * @file mark_of_detection_half_elf.ts
 * Defines the data for the Mark of Detection Half-Elf race in the Aralia RPG.
 * Mark of Detection half-elves possess enhanced powers of observation and insight.
 */
import { Race } from '../../types';

export const MARK_OF_DETECTION_HALF_ELF_DATA: Race = {
  id: 'seersight_half_elf',
  name: 'Seersight Half-Elf',
  baseRace: 'half_elf',
  description:
    'Born with an arcane sigil that grants powers of observation and insight, half-elves bearing the Mark of Detection possess an almost supernatural awareness of their surroundings. This hereditary gift manifests as a glowing pattern on the skin, awakening enhanced senses that pierce through deception and reveal hidden truths. Those with this mark are sought after as investigators, bodyguards, and advisors, their ability to perceive danger and uncover secrets making them invaluable in matters requiring discernment and protection.',
  abilityBonuses: [
    {
      ability: 'Wisdom',
      bonus: 2,
    },
    {
      ability: 'Intelligence',
      bonus: 1,
    },
  ],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium (about 5-6 feet tall)',
    'Speed: 30 feet',
    'Darkvision: You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can\'t discern color in darkness, only shades of gray.',
    'Fey Ancestry: You have advantage on saving throws against being charmed, and magic can\'t put you to sleep.',
    'Deductive Intuition: When you make an Intelligence (Investigation) or Wisdom (Insight) check, you can roll a d4 and add the number rolled to the ability check.',
    'Magical Detection: You can cast the Detect Magic and Detect Poison and Disease spells with this trait. Starting at 3rd level, you can also cast the See Invisibility spell with it. Once you cast any of these spells with this trait, you can\'t cast that spell with it again until you finish a Long Rest. Intelligence is your spellcasting ability for these spells, and you don\'t require material components for them.',
    'Spells of the Mark: If you have the Spellcasting or Pact Magic class feature, the spells on the Mark of Detection Spells table are added to the spell list of your spellcasting class.',
  ],
  imageUrl: 'assets/images/races/mark_of_detection_half_elf.png',
  visual: {
    id: 'mark_of_detection_half_elf',
    icon: '🔍',
    color: '#FFD700',
    maleIllustrationPath: 'assets/images/races/mark_of_detection_half_elf_male.png',
    femaleIllustrationPath: 'assets/images/races/mark_of_detection_half_elf_female.png',
  },
};
