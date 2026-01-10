/**
 * @file black_dragonborn.ts
 * Defines the data for the Black Dragonborn race in the Aralia RPG.
 * Black dragonborn have acid-based breath weapons and damage resistance.
 */
import { Race } from '../../types';

export const BLACK_DRAGONBORN_DATA: Race = {
  id: 'black_dragonborn',
  name: 'Black Dragonborn',
  baseRace: 'dragonborn',
  description:
    'Descended from black dragons, these dragonborn carry the legacy of swamp-dwelling predators. Their scales range from charcoal to deep obsidian, and they possess an affinity for acid. Black dragonborn are often cunning and patient hunters, embodying the methodical nature of their draconic ancestors.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Draconic Ancestry: Black Dragon - Acid damage',
    'Breath Weapon: You can use your Breath Weapon as part of the Attack action. You exhale destructive energy in a 5-foot by 30-foot line. Each creature in the area must make a Dexterity saving throw (DC 8 + your Constitution modifier + your proficiency bonus). On a failed save, a creature takes 1d10 acid damage. On a successful save, it takes half as much damage. This damage increases to 2d10 at 5th level, 3d10 at 11th level, and 4d10 at 17th level. After using your breath weapon, you can\'t use it again until you finish a short or long rest.',
    'Damage Resistance: You have resistance to acid damage.',
    'Darkvision: You have Darkvision with a range of 60 feet.',
    'Draconic Language: You can speak, read, and write Draconic.',
  ],
  visual: {
    id: 'black_dragonborn',
    icon: '🐉',
    color: '#2F4F4F',
    maleIllustrationPath: 'assets/images/races/black_dragonborn_male.png',
    femaleIllustrationPath: 'assets/images/races/black_dragonborn_female.png',
  },
};
