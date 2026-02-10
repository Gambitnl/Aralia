/**
 * @file shadar_kai.ts
 * Defines the data for the Shadar-kai race in the Aralia RPG.
 * Shadar-kai are the elves of the Shadowfell, transformed by its bleak and haunting nature.
 */
import { Race } from '../../types';

export const SHADAR_KAI_DATA: Race = {
  id: 'shadar_kai',
  name: 'Shadar-kai',
  baseRace: 'elf',
  description:
    'Shadar-kai are the elves of the Shadowfell, a bleak and haunted realm where emotion itself feels muted. They were once drawn to the Shadowfell by the Raven Queen, and over the centuries, some of them have been transformed by it, gaining supernatural abilities. Their skin ranges from alabaster to deep ebony, and many adorn themselves with elaborate tattoos, piercings, and scars. The shadar-kai serve the Raven Queen and act as her agents in the multiverse. They are grim but not without emotion—they simply express it differently, valuing passion and intensity in all things as a way to feel truly alive.',
  abilityBonuses: [], // Flexible ASIs handled by Point Buy.
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium (about 5-6 feet tall)',
    'Speed: 30 feet',
    "Vision: You can see in [[dim_light|dim light]] within 60 feet of you as if it were [[bright_light|bright light]], and in [[darkness]] as if it were [[dim_light|dim light]]. You can't discern color in [[darkness]], only shades of gray.",
    'Fey Ancestry: You have advantage on saving throws you make to avoid or end the Charmed condition on yourself.',
    'Keen Senses: You have proficiency in the Perception skill.',
    'Trance: You don\'t need to sleep, and magic can\'t put you to sleep. You can finish a Long Rest in 4 hours if you spend those hours in a trancelike meditation, during which you retain consciousness.',
    'Blessing of the Raven Queen: As a Bonus Action, you can magically teleport up to 30 feet to an unoccupied space you can see. You can use this trait a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest. Starting at 3rd level, you also gain resistance to all damage when you teleport using this trait. The resistance lasts until the start of your next turn. During that time, you appear ghostly and translucent.',
    'Necrotic Resistance: You have resistance to necrotic damage.',
  ],
  imageUrl: 'assets/images/races/shadar_kai.png',
  visual: {
    id: 'shadar_kai',
    color: '#2F4F4F',
    maleIllustrationPath: 'assets/images/races/Shadar-kai_Male.png',
    femaleIllustrationPath: 'assets/images/races/Shadar-kai_Female.png',
  },
};
