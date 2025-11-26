/**
 * @file dwarf.ts
 * Defines the data for the Dwarf race in the Aralia RPG, based on Player's Handbook, pg. 188.
 * This includes their ID, name, description, and unique traits.
 * ASIs are handled flexibly during character creation.
 */
import { Race } from '../../types.ts'; // Path relative to src/data/races/

export const DWARF_DATA: Race = {
  id: 'dwarf',
  name: 'Dwarf',
  description:
    'Dwarves were raised from the earth in the elder days by a deity of the forge. Called by various names on different worlds—Moradin, Reorx, and others—that god gave dwarves an affinity for stone and metal and for living underground. The god also made them resilient like the mountains, with a life span of about 350 years.\n\nSquat and often bearded, the original dwarves carved cities and strongholds into mountainsides and under the earth. Their oldest legends tell of conflicts with the monsters of mountaintops and the Underdark, whether those monsters were towering giants or subterranean horrors. Inspired by those tales, dwarves of any culture often sing of valorous deeds—especially of the little overcoming the mighty.\n\nOn some worlds in the multiverse, the first settlements of dwarves were built in hills or mountains, and the families who trace their ancestry to those settlements call themselves hill dwarves or mountain dwarves, respectively. The Greyhawk and Dragonlance settings have such communities.',
  abilityBonuses: [], // ASIs are handled flexibly during character creation.
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium (about 4–5 feet tall)',
    'Speed: 30 feet',
    'Darkvision: You have Darkvision with a range of 120 feet.',
    'Dwarven Resilience: You have Resistance to Poison damage. You also have Advantage on saving throws you make to avoid or end the Poisoned condition.',
    'Dwarven Toughness: Your Hit Point maximum increases by 1, and it increases by 1 again whenever you gain a level.',
    'Stonecunning: As a Bonus Action, you gain Tremorsense with a range of 60 feet for 10 minutes. You must be on a stone surface or touching a stone surface to use this Tremorsense. The stone can be natural or worked. You can use this Bonus Action a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest.',
  ],
  imageUrl: 'https://i.ibb.co/4n5pV7k2/Dwarf.png',
};