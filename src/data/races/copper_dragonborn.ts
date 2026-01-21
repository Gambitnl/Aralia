/**
 * @file copper_dragonborn.ts
 * Defines the data for the Copper Dragonborn race in the Aralia RPG.
 * Copper dragonborn have acid-based breath weapons and damage resistance.
 */
import { Race } from '../../types';

export const COPPER_DRAGONBORN_DATA: Race = {
  id: 'copper_dragonborn',
  name: 'Copper Dragonborn',
  baseRace: 'dragonborn',
  description:
    'Descended from copper dragons, these dragonborn carry the legacy of witty hillside dwellers. Their scales gleam in rich copper tones with hints of green patina, and they possess an affinity for acid. Copper dragonborn are often playful and clever, embodying the mischievous nature of their draconic ancestors.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Draconic Ancestry: Copper Dragon - Acid damage',
    'Breath Weapon: You can use your Breath Weapon as part of the Attack action. You exhale destructive energy in a 5-foot by 30-foot line. Each creature in the area must make a Dexterity saving throw (DC 8 + your Constitution modifier + your proficiency bonus). On a failed save, a creature takes 1d10 acid damage. On a successful save, it takes half as much damage. This damage increases to 2d10 at 5th level, 3d10 at 11th level, and 4d10 at 17th level. After using your breath weapon, you can\'t use it again until you finish a short or long rest.',
    'Damage Resistance: You have resistance to acid damage.',
    'Darkvision: You have Darkvision with a range of 60 feet.',
    'Draconic Language: You can speak, read, and write Draconic.',
  ],
  visual: {
    id: 'copper_dragonborn',
    icon: '🐉',
    color: '#B87333',
    maleIllustrationPath: 'assets/images/races/Dragonborn_Copper_Male.png',
    femaleIllustrationPath: 'assets/images/races/Dragonborn_Copper_Female.png',
  },
};
