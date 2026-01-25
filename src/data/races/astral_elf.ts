/**
 * @file astral_elf.ts
 * Defines the data for the Astral Elf race in the Aralia RPG.
 * Astral elves ventured from the Feywild to the Astral Plane, imbuing their souls with divine light.
 */
import { Race } from '../../types';

export const ASTRAL_ELF_DATA: Race = {
  id: 'astral_elf',
  name: 'Astral Elf',
  baseRace: 'elf',
  description:
    'Long ago, groups of elves ventured from the Feywild to the Astral Plane to be closer to their gods. Life in the Silver Void has imbued their souls with a spark of divine light. That light manifests as a starry gleam in an astral elf\'s eyes. Because nothing ages in the Astral Plane, astral elves who inhabit that plane can be very old, and their longevity gives them an unusual perspective on the flow of time. Some are prone to melancholy, while others display an uncharacteristic elven brightness. Many seek to return to the Material Plane to experience life as other mortals do, finding the passage of time strangely exhilarating.',
  abilityBonuses: [], // Flexible ASIs handled by Point Buy.
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium (about 5-6 feet tall)',
    'Speed: 30 feet',
    "Vision: You can see in [[dim_light|dim light]] within 60 feet of you as if it were [[bright_light|bright light]], and in [[darkness]] as if it were [[dim_light|dim light]]. You can't discern color in [[darkness]], only shades of gray.",
    'Fey Ancestry: You have advantage on saving throws you make to avoid or end the Charmed condition on yourself.',
    'Keen Senses: You have proficiency in the Perception skill.',
    'Trance: You don\'t need to sleep, and magic can\'t put you to sleep. You can finish a Long Rest in 4 hours if you spend those hours in a trancelike meditation, during which you retain consciousness.',
    'Astral Fire: You know one of the following cantrips of your choice: Dancing Lights, Light, or Sacred Flame. Intelligence, Wisdom, or Charisma is your spellcasting ability for it (choose when you select this race).',
    'Starlight Step: As a Bonus Action, you can magically teleport up to 30 feet to an unoccupied space you can see. You can use this trait a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest.',
    'Astral Trance: When you take a Long Rest, you gain proficiency in one skill of your choice and with one weapon or tool of your choice, selected from the Player\'s Handbook. These proficiencies last until the end of your next Long Rest.',
  ],
  imageUrl: 'assets/images/races/astral_elf.png',
  visual: {
    id: 'astral_elf',
    color: '#4169E1',
    maleIllustrationPath: 'assets/images/races/Elf_Astral_Male.png',
    femaleIllustrationPath: 'assets/images/races/Elf_Astral_Female.png',
  },
};
