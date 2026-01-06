/**
 * @file dwarf.ts
 * Defines the data for the Dwarf race in the Aralia RPG, based on Player's Handbook, pg. 188.
 * This includes their ID, name, description, and unique traits.
 * ASIs are handled flexibly during character creation.
 */
import { Race } from '../../types'; // Path relative to src/data/races/

export const DWARF_DATA: Race = {
  id: 'dwarf',
  name: 'Dwarf',
  baseRace: 'dwarf',
  isSelectableAsBase: true,
  description:
    'Dwarves are a stout and resilient people, forged in the depths of mountains and tempered by centuries of toil. Legend says they were raised from the earth itself by a deity of the forge, granting them an innate affinity for stone and metal. Squat and often bearded, dwarves carved their first cities and strongholds into mountainsides and under the earth. Their oldest tales speak of valorous battles against giants and subterranean horrors, inspiring a culture that celebrates the little overcoming the mighty. With a life span of about 350 years, dwarves are known for their craftsmanship, their stubbornness, and their unyielding loyalty to clan and kin.',
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
  imageUrl: 'assets/images/races/dwarf.png',
};