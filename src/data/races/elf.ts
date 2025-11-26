/**
 * @file elf.ts
 * Defines the data for the Elf race in the Aralia RPG, based on 2024 PHB.
 * This includes base Elf traits and specific Elven Lineages: Drow, High Elf, and Wood Elf.
 */
import { Race, ElvenLineage } from '../../types.ts'; // Path relative to src/data/races/

const ELVEN_LINEAGES_DATA: ElvenLineage[] = [
  {
    id: 'drow',
    name: 'Drow Elf Lineage',
    description:
      'Descended from elves shaped by the Underdark or similar environments, drow possess superior darkvision and unique innate magic.',
    benefits: [
      {
        level: 1,
        description: 'Your Darkvision range increases to 120 feet.',
        darkvisionRange: 120,
        cantripId: 'dancing-lights',
      },
      {
        level: 3,
        spellId: 'faerie-fire',
        description: 'You learn the Faerie Fire spell (Level 1 spell).',
      },
      {
        level: 5,
        spellId: 'darkness',
        description: 'You learn the Darkness spell (Level 2 spell).',
      },
    ],
  },
  {
    id: 'high_elf',
    name: 'High Elf Lineage',
    description:
      'Heirs to elves infused with the magic of the Feywild or similar mystical places, high elves are naturally adept at arcane arts.',
    benefits: [
      {
        level: 1,
        cantripId: 'prestidigitation',
        canSwapCantrip: true,
        swappableCantripSource: 'wizard',
        description:
          'You know the Prestidigitation cantrip. You can replace it with another Wizard cantrip after a Long Rest.',
      },
      {
        level: 3,
        spellId: 'detect-magic',
        description: 'You learn the Detect Magic spell (Level 1 spell).',
      },
      {
        level: 5,
        spellId: 'misty-step',
        description: 'You learn the Misty Step spell (Level 2 spell).',
      },
    ],
  },
  {
    id: 'wood_elf',
    name: 'Wood Elf Lineage',
    description:
      'Embodying the spirit of primeval forests, wood elves are swift, perceptive, and possess a primal connection to nature.',
    benefits: [
      {
        level: 1,
        speedIncrease: 5,
        cantripId: 'druidcraft',
        description: 'Your Speed increases by 5 feet.',
      },
      {
        level: 3,
        spellId: 'longstrider',
        description: 'You learn the Longstrider spell (Level 1 spell).',
      },
      {
        level: 5,
        spellId: 'pass-without-trace',
        description: 'You learn the Pass without Trace spell (Level 2 spell).',
      },
    ],
  },
];

export const ELF_DATA: Race = {
  id: 'elf',
  name: 'Elf',
  description:
    'Elves are a magical people of otherworldly grace, living long lives and experiencing the world with a unique perspective. They trance instead of sleep.',
  // Elves in the 2024 PHB do not get direct ability score increases from their base race or lineage.
  // Ability scores are typically handled by background or other choices.
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium (about 5-6 feet tall)',
    'Base Speed: 30 feet',
    'Darkvision: You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can’t discern color in darkness, only shades of gray.',
    'Elven Lineage: Choose a Drow, High Elf, or Wood Elf lineage, granting specific benefits.',
    'Fey Ancestry: You have advantage on saving throws you make to avoid or end the Charmed condition on yourself.',
    'Keen Senses: You gain proficiency in one of the following skills of your choice: Insight, Perception, or Survival.',
    'Trance: You don’t need to sleep and can’t be put to sleep by magic. You can finish a Long Rest in 4 hours if you spend those hours in a trancelike meditation, during which you retain consciousness.',
  ],
  elvenLineages: ELVEN_LINEAGES_DATA,
  imageUrl: 'https://i.ibb.co/MDWPvKPr/Elf.png',
};